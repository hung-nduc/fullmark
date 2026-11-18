import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseResults } from "../core/attempt";
import { type GradesFile, parseGrades } from "../core/rubric/grades";
import { libraryPaths, shortHash } from "../library/layout";
import { type BuildIo, type BuildOptions, runBuild } from "./build";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  noSuchQuiz,
  nowOf,
  openLibrary,
  painterFor,
} from "./library-common";
import { shortDay } from "./library-row";
import { shownPath } from "./paths";

export type LibraryReplayOptions = {
  /** a stamp or a prefix of at least 4 characters; null: the newest attempt */
  attempt: string | null;
  /** `-o`: a folder to write the page into; null: the temp folder's `fullmark/` */
  output: string | null;
  open: boolean;
  json: boolean;
  plain: boolean;
  fonts: string | null;
  version: string;
};

/** `LibraryIo` with what `build` needs and the temp folder, which tests point somewhere of their own. */
export type ReplayIo = LibraryIo & BuildIo & { tmpDir?: string };

const DAY = 24 * 60 * 60 * 1000;

/** Removes the pages a replay left in the temp folder more than a day ago. */
async function clearOld(dir: string, now: Date): Promise<void> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".html")) continue;
    try {
      if (now.getTime() - statSync(join(dir, name)).mtimeMs > DAY) await rm(join(dir, name), { force: true });
    } catch {
      // gone already
    }
  }
}

/**
 * `quiz library replay NAME [--attempt STAMP] [-o DIR] [--no-open] [--json]` (COMMANDS.md): a past attempt as a page
 * already submitted, built from the version it was taken on (found by the file name the index records) with the newest
 * grades file of that attempt. Writes nothing in the library.
 */
export async function runLibraryReplay(name: string, opts: LibraryReplayOptions, io: ReplayIo): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const paths = libraryPaths(root).quiz(quiz.id);

  let stamps: string[] = [];
  try {
    stamps = readdirSync(paths.results)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .sort();
  } catch {
    // none
  }
  if (stamps.length === 0)
    return libraryFail(io, opts.json, `${quiz.name} has no attempt yet`, { fix: `quiz library take ${quiz.name}` });
  let stamp: string | undefined;
  if (opts.attempt === null) stamp = stamps.at(-1);
  else {
    const wanted = opts.attempt.replace(/\.json$/, "");
    const found = stamps.includes(wanted)
      ? [wanted]
      : wanted.length >= 4
        ? stamps.filter((s) => s.startsWith(wanted))
        : [];
    if (found.length > 1)
      return libraryFail(io, opts.json, `${opts.attempt} matches ${found.length} attempts: ${found.join(", ")}`, {
        fix: "give more of the stamp",
      });
    stamp = found[0];
  }
  if (stamp === undefined)
    return libraryFail(io, opts.json, `no attempt ${opts.attempt} of ${quiz.name}`, {
      fix: `the attempts are: ${stamps.slice(-5).join(", ")}${stamps.length > 5 ? ", …" : ""}`,
    });

  const resultsFile = paths.result(stamp);
  const read = parseResults(readFileSync(resultsFile, "utf8"));
  if (!read.ok) return libraryFail(io, opts.json, `${stamp} is not a results file: ${read.message}`);
  const hash = read.results.quizHash;
  const all = quiz.versions.map((v) => v.hash);
  const loaded = loadStored(root, quiz, hash);
  if (loaded === null || loaded.quiz === null || loaded.hash === null)
    return libraryFail(
      io,
      opts.json,
      `the version ${shortHash(hash, all)} this attempt was taken on is not in the library`,
      {
        fix: "run `quiz library status` to see what is wrong",
      },
    );

  // the newest grades file of this attempt: `<stamp>-<graded stamp>-grades.json`
  let gradesName: string | undefined;
  try {
    gradesName = readdirSync(paths.grades)
      .filter((f) => f.startsWith(`${stamp}-`) && f.endsWith("-grades.json"))
      .sort()
      .at(-1);
  } catch {
    // no grades folder
  }
  let grades: { shown: string; file: GradesFile } | null = null;
  let gradedOn: string | null = null;
  if (gradesName !== undefined) {
    const file = join(paths.grades, gradesName);
    const parsed = parseGrades(readFileSync(file, "utf8"));
    if (!parsed.ok) return libraryFail(io, opts.json, `${gradesName} is not a grades file: ${parsed.message}`);
    grades = { shown: shownPath(file, io.cwd), file: parsed.file };
    const m = /^.*-(\d{4})(\d\d)(\d\d)-\d{6}-grades\.json$/.exec(gradesName);
    gradedOn = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  const dir = opts.output !== null ? resolve(io.cwd, opts.output) : join(io.tmpDir ?? tmpdir(), "fullmark");
  await mkdir(dir, { recursive: true });
  if (opts.output === null) await clearOld(dir, nowOf(io));
  const page = join(dir, `${quiz.name}-${stamp}.html`);

  const lines: string[] = [];
  const build: BuildOptions = {
    profile: null,
    config: null,
    strict: false,
    output: page,
    builtAt: null,
    uiLang: null,
    fonts: opts.fonts,
    plain: true,
    json: false,
    buildFile: null,
    open: false,
    replay: { quiz: shownPath(resultsFile, io.cwd), loaded, grades, open: opts.open ? "yes" : "no" },
    print: false,
    seed: null,
    answerSheet: false,
    answers: null,
    materials: null,
    watch: false,
    serve: false,
    port: null,
    version: opts.version,
  };
  const exit = await runBuild([resultsFile], build, {
    ...io,
    out: (t) => lines.push(t),
    err: (t) => io.err(t),
  });
  if (exit !== EXIT.done) {
    for (const l of lines) io.err(l);
    return exit;
  }

  const short = (h: string): string => shortHash(h, all);
  const state = hash === quiz.current ? "" : ` (not current: ${short(quiz.current)} is)`;
  const graded = gradedOn === null ? "not graded" : `graded ${shortDay(gradedOn, nowOf(io))}`;
  const shown = shownPath(page, io.cwd);
  if (opts.json)
    io.out(JSON.stringify({ status: "built", page: shown, attempt: stamp, version: hash, graded: grades !== null }));
  out(`${quiz.name} · attempt ${stamp} · version ${short(hash)}${state} · ${graded}`);
  out(`${p.green("page:")} ${shown}${opts.open ? "  (opened in your browser)" : ""}`);
  return EXIT.done;
}
