import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { buildGradeForm } from "../build/grade-form";
import { languagesUsed, loadHighlighter } from "../build/highlight";
import { buildPage } from "../build/page";
import type { Asset } from "../build/render";
import { katexTools } from "../build/tex";
import type { Attempt, parseResults } from "../core/attempt";
import { FONT_CHOICES, type FontsChoice } from "../core/fonts";
import { grade } from "../core/grade";
import { en, vi } from "../core/i18n";
import type { Quiz } from "../core/ir";
import { buildReport, renderMarkdown } from "../core/report";
import {
  type AppliedGrades,
  applyGrades,
  GRADES_FORMAT,
  GRADES_VERSION,
  type Grader,
  gradable,
  gradesTemplate,
  parseGrades,
  resultsHash,
} from "../core/rubric/grades";
import { type ServerOutcome, type SubmitRead, startServer } from "../serve/server";
import { writeFileAtomic } from "./atomic";
import { runtimeFolder, systemOpen } from "./build";
import { loadConfig, realMachine } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import { fail } from "./fail";
import type { GradeIo, GradeOptions } from "./grade";
import { readFailure, shownPath } from "./paths";
import { localIso } from "./time";

/** What `runGrade` hands over once the results file and the quiz are read and agree. */
export type Prepared = {
  /** the results file as the user named it */
  results: string;
  quiz: Quiz;
  hash: string;
  /** the quiz's images, as `loadQuiz` read them: an image in a prompt or a sample answer shows in the form */
  assets: readonly Asset[];
  /** the materials sheets, as `loadQuiz` read them: the second page shows them as `quiz replay`'s does */
  sheets: readonly { path: string; name: string; source: string }[];
  /** the quiz file as shown */
  quizFile: string;
  read: Extract<ReturnType<typeof parseResults>, { ok: true }>;
  attempt: Attempt;
  /** `--grades`, read and checked (G75): where it is, and what it holds */
  grades: { path: string; applied: AppliedGrades } | null;
};

/**
 * What `quiz library grade --web` changes about the form's run (COMMANDS.md): where the grades go, and what is said. The
 * form, the checks of the submit and the way it ends are `quiz grade --web`'s own; with no hooks nothing here applies.
 */
export type LibraryGradeHooks = {
  /** the two files as the saved card names them, in place of the ones next to the results file */
  files: { grades: string; report: string };
  /** said in place of `quiz grade`'s line when no essay or code question was answered */
  nothing: string;
  /** told once the server is up, in place of the `listening` line and the two lines on stderr */
  announce(server: { url: string; port: number }): void;
  /** keeps a submit that passed the checks: in place of writing `RESULTS-grades.json` and the report beside the results */
  save(submit: GradesSubmit): Promise<void>;
  /** what the server's answer to Save grades adds once the keeping was tried: `{ filed: false, command }` when the lock was busy (G32) */
  answer(): Record<string, unknown>;
  /** the words and the exit code once Save grades was accepted */
  done(): ExitCode | Promise<ExitCode>;
};

const defaultInterrupt = (handler: () => void): (() => void) => {
  process.once("SIGINT", handler);
  return () => {
    process.off("SIGINT", handler);
  };
};

/** Whether two paths name one file: the same path, or the same file once links are followed. */
function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const wholeNumber = (text: string, min: number): number | null =>
  /^\d+$/.test(text) && Number(text) >= min ? Number(text) : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every cell the grader owns is empty: the template as `quiz grade --json` writes it, and nothing else. */
export function isEmptyTemplate(json: unknown): boolean {
  if (!isRecord(json) || json.format !== GRADES_FORMAT || json.version !== GRADES_VERSION) return false;
  if (json.grader !== null && json.grader !== undefined) return false;
  if (!isRecord(json.grades)) return false;
  const empty = (v: unknown): boolean => v === null || v === undefined;
  for (const entry of Object.values(json.grades)) {
    if (!isRecord(entry)) return false;
    if (!empty(entry.justification) || !empty(entry.improvement) || !empty(entry.score)) return false;
    for (const cells of [entry.criteria, entry.bullets]) {
      if (cells === undefined) continue;
      if (!isRecord(cells)) return false;
      for (const cell of Object.values(cells)) {
        if (!isRecord(cell)) return false;
        if (!empty(cell.score) || !empty(cell.band) || !empty(cell.note) || !empty(cell.verdict)) return false;
      }
    }
  }
  return true;
}

/** `value` with its keys in the order of `like` (the template's), at every level; keys `like` lacks follow. */
function inOrderOf(value: unknown, like: unknown): unknown {
  if (!isRecord(value) || !isRecord(like)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(like)) if (key in value) out[key] = inOrderOf(value[key], like[key]);
  for (const key of Object.keys(value)) if (!(key in out)) out[key] = value[key];
  return out;
}

/** The entries of a submit's grades, without a `grader` or a `reviewed` of their own: the server writes those. */
function withoutGraders(grades: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(grades).map(([id, entry]) => {
      if (!isRecord(entry)) return [id, entry];
      const { grader: _grader, reviewed: _reviewed, ...rest } = entry;
      return [id, rest];
    }),
  );
}

/** What a submit holds once read and checked: the grades file to write, and the arithmetic the validator did. */
export type GradesSubmit = { file: Record<string, unknown>; applied: AppliedGrades };

/**
 * What the form's submit body must hold (COMMANDS.md, `quiz grade`): this attempt of this version of the quiz, and
 * the grades document. The server sets the grader's `at` from its own clock and takes the name from `--name` when
 * given; then the document is checked with the validator `--grades` uses, against this attempt. Problems come back in
 * plain words (HTTP 400) and the server keeps waiting.
 */
export function gradesSubmitReader(ctx: {
  quizId: string;
  hash: string;
  quiz: Quiz;
  attempt: Attempt;
  resultsJson: unknown;
  name: string | null;
  now: () => Date;
  /** the grades template, whose key order the file keeps (the form's data comes back with its keys sorted) */
  template?: { grades: Record<string, unknown> };
  /** `--grades`: the grader each pre-filled question came from; a question still graded at Save carries it as `reviewed` (G107) */
  reviewed?: ReadonlyMap<string, Grader>;
}): (body: unknown) => SubmitRead<GradesSubmit> {
  const results = resultsHash(ctx.resultsJson);
  return (body) => {
    if (!isRecord(body)) return "the body is not a grades submit";
    if (body.quizId !== ctx.quizId) return `this server grades the quiz "${ctx.quizId}", not "${String(body.quizId)}"`;
    if (body.quizHash !== ctx.hash) return "this form is of another version of the quiz: reload the page";
    const doc = body.grades;
    if (!isRecord(doc) || !isRecord(doc.grades)) return "the body has no grades document";
    if (doc.format !== GRADES_FORMAT || doc.version !== GRADES_VERSION) {
      return `the grades document is not ${GRADES_FORMAT} version ${GRADES_VERSION}`;
    }
    const given = isRecord(doc.grader) && typeof doc.grader.name === "string" ? doc.grader.name : "";
    const name = (ctx.name ?? given).trim();
    if (name === "") return "the grader's name is empty";
    const file = {
      format: GRADES_FORMAT,
      version: GRADES_VERSION,
      results_hash: results,
      grader: { kind: "human", name, at: localIso(ctx.now()) },
      // no question carries a grader of its own, whatever the form sent: the file's is the human's
      grades: ctx.template ? inOrderOf(withoutGraders(doc.grades), ctx.template.grades) : withoutGraders(doc.grades),
    };
    // the same reader and validator as `quiz grade --grades`
    const read = parseGrades(JSON.stringify(file));
    if (!read.ok) return read.message;
    const applied = applyGrades(ctx.quiz, ctx.attempt, ctx.resultsJson, read.file);
    if (applied.problems.length > 0) {
      const more = applied.problems.length > 6 ? ` (and ${applied.problems.length - 6} more)` : "";
      return `${applied.problems.slice(0, 6).join("; ")}${more}`;
    }
    if (applied.details.length === 0) return "nothing is graded yet";
    // G107: each question that was pre-filled and is graded names the grader it was pre-filled from, adjusted or not
    for (const d of applied.details) {
      const from = ctx.reviewed?.get(d.id);
      const entry = (file.grades as Record<string, unknown>)[d.id];
      if (from !== undefined && isRecord(entry)) entry.reviewed = { ...from };
    }
    return { quizId: ctx.quizId, value: { file, applied } };
  };
}

/**
 * `quiz grade RESULTS --quiz FILE --web` (COMMANDS.md): after the refusals of `runGrade`, serves the grading form on
 * 127.0.0.1 and waits for one **Save grades**, which writes `RESULTS-grades.json` (`kind: human`) and the report, both
 * atomically. With `--json` the first line is `listening` and the second the outcome.
 */
export async function runGradeWeb(
  p: Prepared,
  opts: GradeOptions,
  io: GradeIo,
  library?: LibraryGradeHooks,
): Promise<ExitCode> {
  const { quiz, attempt, hash } = p;
  const timeout = opts.timeout === null ? 1800 : wholeNumber(opts.timeout, 0);
  if (timeout === null) {
    fail(io, opts.json, `--timeout ${opts.timeout} is not a number of seconds (0 waits forever)`);
    return EXIT.usage;
  }
  const port = opts.port === null ? 0 : wholeNumber(opts.port, 1);
  if (port === null || port > 65535) {
    fail(io, opts.json, `--port ${opts.port} is not a port number (1 to 65535)`);
    return EXIT.usage;
  }
  const graded = grade(quiz, attempt);
  // G91: an attempt with no answered essay or code question has an empty template, so there is nothing to fill
  if (gradable(quiz, graded).length === 0) {
    const line =
      library?.nothing ??
      `nothing to grade: no essay or code question was answered; quiz grade ${p.results} --quiz ${p.quizFile} writes the report`;
    if (opts.json) {
      io.out(JSON.stringify({ status: "nothing-to-grade" }));
      io.err(line);
    } else io.out(line);
    return EXIT.done;
  }

  const resultsPath = resolve(io.cwd, p.results);
  const stem = basename(resultsPath).replace(/\.json$/i, "");
  const gradesPath = join(dirname(resultsPath), `${stem}-grades.json`);
  const reportPath = join(dirname(resultsPath), `${stem}-report.md`);
  const gradesShown = library?.files.grades ?? shownPath(gradesPath, io.cwd);
  const reportShown = library?.files.report ?? shownPath(reportPath, io.cwd);
  // G87: an existing grades file that is an empty template is replaced; one holding grades is never touched
  if (library === undefined && existsSync(gradesPath)) {
    let empty = false;
    try {
      empty = isEmptyTemplate(JSON.parse(readFileSync(gradesPath, "utf8").replace(/^﻿/, "")));
    } catch {
      empty = false;
    }
    // G108: `--grades` naming this very file is the usual way to review an agent's grades: Save grades replaces it
    const same = p.grades !== null && samePath(p.grades.path, gradesPath);
    if (!empty && !same) {
      fail(io, opts.json, `${gradesShown} already holds grades; move it away, or adjust it with --grades`);
      return EXIT.usage;
    }
  }

  for (const w of p.grades?.applied.warnings ?? []) io.err(`warning: ${w}`);

  const folder = io.runtimeDir ?? runtimeFolder();
  const read = (name: string): string | null => {
    try {
      return readFileSync(join(folder, name), "utf8");
    } catch {
      return null;
    }
  };
  const script = read("grade.js");
  const pageCss = read("page.css");
  const pageJs = read("page.js");
  const gradeCss = read("grade.css");
  if (script === null || pageCss === null || gradeCss === null || pageJs === null) {
    fail(io, opts.json, "the page runtime is missing next to the program: run `npm run build`");
    return EXIT.usage;
  }

  const quizPath = resolve(io.cwd, p.quizFile);
  const machine = io.machine ?? { ...realMachine(), cwd: io.cwd };
  const machineFonts = loadConfig(machine, dirname(quizPath), null).layers.user?.fonts ?? null;
  const fonts: FontsChoice = machineFonts !== null && FONT_CHOICES.includes(machineFonts) ? machineFonts : "quiz";
  const clock = io.now ?? (() => new Date());
  const highlight = await loadHighlighter(languagesUsed(quiz, []));
  const template = gradesTemplate(quiz, graded, p.read.json) as { grades: Record<string, Record<string, unknown>> };
  const page = buildGradeForm({
    quiz,
    hash,
    assets: p.assets,
    attempt,
    graded,
    template,
    ...(p.grades === null ? {} : { given: p.grades.applied.details }),
    name: opts.name === null ? null : opts.name.trim(),
    files: { grades: gradesShown, report: reportShown },
    script,
    css: pageCss,
    gradeCss,
    builtAt: clock().toISOString(),
    version: opts.version,
    math: katexTools(),
    highlight,
    fonts,
  });

  // G100: the attempt's replay, as `quiz replay` builds it with no grades, for the form's frame. It is `buildPage`'s page,
  // with no server module, so it holds no server code; `grader` makes it read-only for the grader (`PageReplay.grader`)
  const resultsText = readFileSync(resultsPath, "utf8");
  const marked = buildPage(
    [
      {
        quiz,
        hash,
        assets: p.assets,
        sheets: p.sheets,
        replay: { results: resultsText, name: basename(resultsPath), attempt, applied: null, grader: true },
      },
    ],
    {
      runtime: pageJs,
      css: pageCss,
      builtAt: clock().toISOString(),
      version: opts.version,
      math: katexTools(),
      highlight,
      fonts,
      given: { profile: null, fonts: null, uiLang: null, strict: false },
    },
  );

  const quizId = quiz.frontMatter.id;
  const m = (quiz.frontMatter.uiLang === "vi" ? vi : en).report;
  const asked = gradable(quiz, graded).length;
  const taken: { graded?: number } = {};

  let server: Awaited<ReturnType<typeof startServer<GradesSubmit>>>;
  try {
    server = await startServer<GradesSubmit>({
      pages: { "": page, marked },
      quizIds: { [quizId]: hash },
      predicate: (accepted) => accepted.has(quizId),
      timeoutMs: timeout * 1000,
      port,
      readSubmit: gradesSubmitReader({
        quizId,
        hash,
        quiz,
        attempt,
        resultsJson: p.read.json,
        name: opts.name === null ? null : opts.name.trim() === "" ? null : opts.name.trim(),
        now: clock,
        template,
        reviewed: new Map((p.grades?.applied.details ?? []).map((d) => [d.id, d.graded_by])),
      }),
      ...(io.setTimer ? { setTimer: io.setTimer } : {}),
      ...(library ? { answer: () => library.answer() } : {}),
      async onSubmit(_id, { file, applied }) {
        if (library !== undefined) {
          await library.save({ file, applied });
          taken.graded = applied.details.length;
          return null;
        }
        // the report as `quiz grade RESULTS --quiz FILE --grades GRADES` writes it
        const report = buildReport({ quiz, quizHash: hash, attempt, applied }, m);
        await writeFileAtomic(gradesPath, Buffer.from(`${JSON.stringify(file, null, 2)}\n`, "utf8"));
        await writeFileAtomic(reportPath, Buffer.from(renderMarkdown(report, m, p.quizFile), "utf8"));
        taken.graded = applied.details.length;
        return null;
      },
    });
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    fail(
      io,
      opts.json,
      `cannot start the server${port ? ` on port ${port}` : ""}: ${e.code === "EADDRINUSE" ? "the port is in use" : readFailure(error)}`,
    );
    return EXIT.usage;
  }

  const removeInterrupt = (io.onInterrupt ?? defaultInterrupt)(() => server.stop());
  if (library !== undefined) library.announce({ url: server.url, port: server.port });
  else {
    if (opts.json)
      io.out(JSON.stringify({ status: "listening", url: server.url, port: server.port, pid: process.pid }));
    io.err(`grading ${shownPath(resultsPath, io.cwd)} at ${server.url}`);
    io.err("waiting for Save grades (Ctrl+C to stop)");
  }
  if (opts.open) {
    try {
      await (io.open ?? systemOpen)(server.url);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      io.err(
        `warning: cannot open the page: ${e.code === "ENOENT" ? "the system's opener was not found" : (e.message ?? "unknown error")}`,
      );
    }
  }

  const outcome: ServerOutcome = await server.done;
  removeInterrupt();
  switch (outcome.status) {
    case "submitted": {
      if (library !== undefined) return await library.done();
      const done = taken.graded ?? 0;
      const pending = asked - done;
      if (opts.json) {
        io.out(JSON.stringify({ status: "written", grades: gradesShown, report: reportShown, graded: done, pending }));
      } else {
        io.out(`grades written: ${done} graded, ${pending} pending (${gradesShown})`);
        io.out(`report written: ${reportShown}`);
      }
      return EXIT.done;
    }
    case "timeout":
      if (opts.json) io.out(JSON.stringify({ status: "timeout" }));
      io.err(`timed out after ${timeout} seconds without Save grades; nothing was written`);
      return EXIT.usage;
    case "interrupted":
      if (opts.json) io.out(JSON.stringify({ status: "interrupted" }));
      io.err("stopped; nothing was written");
      return EXIT.usage;
    case "error":
      fail(io, opts.json, `cannot write the grades: ${outcome.message}`, { file: gradesShown });
      return EXIT.usage;
  }
}
