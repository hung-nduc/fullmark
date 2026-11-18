import { join } from "node:path";
import type { AppliedGrades } from "../core/rubric/grades";
import { LockBusy } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import { EXIT, type ExitCode } from "./exit-codes";
import type { LibraryGradeHooks } from "./grade-web";
import { libraryFail } from "./library-common";
import type {
  GradeTarget,
  Kept,
  KeptGrades,
  keepAndReport,
  LibraryGradeIo,
  LibraryGradeOptions,
  printKept,
} from "./library-grade";

const wholeNumber = (text: string, min: number): number | null =>
  /^\d+$/.test(text) && Number(text) >= min ? Number(text) : null;

/**
 * `quiz library grade NAME --web` (COMMANDS.md): `quiz grade --web`'s form for the attempt and its version, pre-filled
 * from the newest grades kept for it. The library's lock is not held while the form is served (G29): Save grades writes
 * the checked grades to `progress/<stamp>.grades.json`, then, under the lock, keeps them in `grades/`, writes the report
 * and commits. When the lock is not had in time the grades stay in `progress/` and the next `library grade` keeps them.
 */
export async function runLibraryGradeWeb(
  t: GradeTarget,
  newest: KeptGrades | null,
  opts: LibraryGradeOptions,
  io: LibraryGradeIo,
  hooks: { waiting(text: string): void; stale(text: string): void },
  /** what `library-grade.ts` shares, handed over so that this chunk imports nothing from it (the graph test) */
  kit: {
    keepAndReport: typeof keepAndReport;
    printKept: typeof printKept;
    heading(t: GradeTarget, more?: string): string;
  },
): Promise<ExitCode> {
  const out = opts.json ? io.err : io.out;
  if (opts.timeout !== null && wholeNumber(opts.timeout, 0) === null)
    return libraryFail(io, opts.json, `--timeout ${opts.timeout} is not a number of seconds (0 waits forever)`);
  if (opts.port !== null) {
    const port = wholeNumber(opts.port, 1);
    if (port === null || port > 65535)
      return libraryFail(io, opts.json, `--port ${opts.port} is not a port number (1 to 65535)`);
  }

  const by = newest?.applied.grader ?? null;
  out(kit.heading(t, by === null ? "" : ` · pre-filled from ${by.name}’s grades`));

  const progressFile = join(t.paths.progress, `${t.stamp}.grades.json`);
  const state: { kept?: Kept; busy?: LockBusy } = {};
  const library: LibraryGradeHooks = {
    files: { grades: `grades/${t.stamp}-…-grades.json`, report: `reports/${t.stamp}-report.md` },
    nothing: `nothing to grade: no essay or code question was answered; quiz library grade ${t.quiz.name} writes the report`,
    announce({ url, port }: { url: string; port: number }) {
      if (opts.json) io.out(JSON.stringify({ status: "listening", url, port, pid: process.pid }));
      out(`serving ${url}${opts.open ? "  (opened in your browser)" : ""}`);
    },
    async save({ file, applied }: { file: Record<string, unknown>; applied: AppliedGrades }) {
      const bytes = Buffer.from(`${JSON.stringify(file, null, 2)}\n`, "utf8");
      await (io.atomic ?? writeFileAtomic)(progressFile, bytes);
      try {
        state.kept = await kit.keepAndReport(io, t, { bytes, moveFrom: progressFile }, applied, hooks);
      } catch (error) {
        if (!(error instanceof LockBusy)) throw error;
        state.busy = error;
      }
    },
    done(): ExitCode {
      if (state.busy !== undefined || state.kept === undefined)
        return libraryFail(
          io,
          opts.json,
          `${state.busy?.message ?? "the library is busy"}; your grades are safe in progress/${t.stamp}.grades.json`,
          { fix: `run \`quiz library grade ${t.quiz.name}\` again to keep them` },
        );
      out("");
      kit.printKept(io, opts, t, state.kept);
      return EXIT.done;
    },
  };

  const resultsPath = t.paths.result(t.stamp);
  // a dynamic import, as `quiz grade` has it: the form's server and page builder stay one chunk of their own
  const { runGradeWeb } = await import("./grade-web");
  const exit = await runGradeWeb(
    {
      results: resultsPath,
      quiz: t.version,
      hash: t.hash,
      assets: t.loaded.assets,
      sheets: t.loaded.sheets,
      quizFile: t.loaded.file,
      read: t.read,
      attempt: t.attempt,
      grades: newest === null ? null : { path: join(t.paths.grades, newest.name), applied: newest.applied },
    },
    {
      quiz: null,
      output: null,
      grades: null,
      json: opts.json,
      web: true,
      name: opts.name,
      timeout: opts.timeout,
      open: opts.open,
      port: opts.port,
      version: opts.version,
      plain: opts.plain,
    },
    io,
    library,
  );
  return exit;
}
