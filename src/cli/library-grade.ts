import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Attempt, parseResults } from "../core/attempt";
import { grade } from "../core/grade";
import { en, vi } from "../core/i18n";
import type { Quiz } from "../core/ir";
import { buildReport, type Report, renderMarkdown } from "../core/report";
import {
  type AppliedGrades,
  applyGrades,
  type Grader,
  type GradesFile,
  gradable,
  gradesTemplate,
  parseGrades,
} from "../core/rubric/grades";
import type { Git } from "../library/git";
import type { IndexQuiz } from "../library/index-file";
import { libraryPaths, type QuizPaths, shortHash } from "../library/layout";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import { readAttempt } from "./attempt-read";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  lockEnvOf,
  noSuchQuiz,
  nowOf,
  openLibrary,
  painterFor,
} from "./library-common";
import { type AttemptRecord, readHistory } from "./library-history";
import type { LoadedQuiz } from "./load";
import { readFailure, shownPath } from "./paths";
import type { ServeIo } from "./serve";
import { plural } from "./table";
import { localStamp } from "./time";

export type LibraryGradeOptions = {
  /** a stamp or a prefix of 4 or more characters; null: G28's choice */
  attempt: string | null;
  /** `--grades`: a filled-in grades file; null: the newest kept for the attempt, else none */
  grades: string | null;
  web: boolean;
  /** `--web`: the human grader's name (default: the form asks) */
  name: string | null;
  /** `--web`: seconds as given; null: 1800 */
  timeout: string | null;
  /** `--web`: as given; null: a free port */
  port: string | null;
  open: boolean;
  json: boolean;
  plain: boolean;
  version: string;
};

/** What `--web` needs beyond `LibraryIo`: the clock, the opener, Ctrl+C and the timer, which tests control. */
export type LibraryGradeIo = LibraryIo & ServeIo;

/** `<stamp>.grades.json`: the grades a form saved and nobody kept yet (G29). */
const LEFTOVER_NAME = /^(\d{8}-\d{6})\.grades\.json$/;

/** One attempt of a quiz, read and ready to be graded: the version it names, its answers, and where the files go. */
export type GradeTarget = {
  root: string;
  quiz: IndexQuiz;
  paths: QuizPaths;
  git: Git;
  stamp: string;
  /** the whole hash of the version the attempt was taken on */
  hash: string;
  /** the first characters of it that tell it from the quiz's other versions */
  short: string;
  version: Quiz;
  /** what `loadQuiz` read beside the source, for the form's pages */
  loaded: LoadedQuiz;
  read: Extract<ReturnType<typeof parseResults>, { ok: true }>;
  attempt: Attempt;
  resultsJson: unknown;
};

/** The grades kept for an attempt, read and checked against it. */
export type KeptGrades = { name: string; applied: AppliedGrades };

const waiting = (essay: number, code: number): string =>
  `${[essay > 0 ? plural(essay, "essay") : null, code > 0 ? `${code} code` : null].filter(Boolean).join(", ")} waiting for a grade`;

/** `61%*`: what the score of a report reads as, the star when something still waits for a grade. */
function percentWords(score: Report["score"]): string {
  if (score === null || score.percent === null) return "–";
  return `${Math.round(score.percent)}%${score.pending > 0 ? "*" : ""}`;
}

const pendingOf = (report: Report): { essay: number; code: number } => {
  const open = report.open.filter((o) => o.pending);
  return {
    essay: open.filter((o) => o.type === "essay").length,
    code: open.filter((o) => o.type === "code").length,
  };
};

/** The attempt to grade: `--attempt`, else the newest one with an essay or code answer waiting, else the newest (G28). */
function pickAttempt(
  io: LibraryIo,
  json: boolean,
  quiz: IndexQuiz,
  attempts: readonly AttemptRecord[],
  wanted: string | null,
): { stamp: string } | { exit: ExitCode } {
  if (attempts.length === 0)
    return {
      exit: libraryFail(io, json, `${quiz.name} has no attempt yet`, { fix: `quiz library take ${quiz.name}` }),
    };
  const stamps = attempts.map((a) => a.stamp);
  if (wanted === null) {
    const waitingOne = [...attempts].reverse().find((a) => a.pending.essay + a.pending.code > 0);
    return { stamp: (waitingOne ?? (attempts.at(-1) as AttemptRecord)).stamp };
  }
  const name = wanted.replace(/\.json$/, "");
  const found = stamps.includes(name) ? [name] : name.length >= 4 ? stamps.filter((s) => s.startsWith(name)) : [];
  if (found.length > 1)
    return {
      exit: libraryFail(io, json, `${wanted} matches ${found.length} attempts: ${found.join(", ")}`, {
        fix: "give more of the stamp",
      }),
    };
  if (found[0] === undefined)
    return {
      exit: libraryFail(io, json, `no attempt ${wanted} of ${quiz.name}`, {
        fix: `the attempts are: ${stamps.slice(-5).join(", ")}${stamps.length > 5 ? ", …" : ""}`,
      }),
    };
  return { stamp: found[0] };
}

/** The attempt read, with the version it names and its answers checked against that version's questions. */
function prepare(
  io: LibraryIo,
  json: boolean,
  root: string,
  git: Git,
  quiz: IndexQuiz,
  stamp: string,
): { target: GradeTarget } | { exit: ExitCode } {
  const paths = libraryPaths(root).quiz(quiz.id);
  const resultsFile = paths.result(stamp);
  let text: string;
  try {
    text = readFileSync(resultsFile, "utf8");
  } catch (error) {
    return { exit: libraryFail(io, json, `cannot read results/${stamp}.json: ${readFailure(error)}`) };
  }
  let resultsJson: unknown;
  try {
    resultsJson = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    resultsJson = null;
  }
  const hash = (resultsJson as { quizHash?: unknown } | null)?.quizHash;
  const all = quiz.versions.map((v) => v.hash);
  const loaded = typeof hash === "string" ? loadStored(root, quiz, hash) : null;
  if (typeof hash !== "string" || loaded === null || loaded.quiz === null || loaded.hash === null) {
    return {
      exit: libraryFail(
        io,
        json,
        `the version ${typeof hash === "string" ? shortHash(hash, all) : "?"} this attempt was taken on cannot be read from the library`,
        { fix: "run `quiz library status` to see what is wrong" },
      ),
    };
  }
  const got = readAttempt(resultsFile, loaded.quiz, hash, quiz.name, io);
  if (got.status !== "ok") {
    const problems = got.status === "problems" ? got.problems : [];
    return {
      exit: libraryFail(io, json, `results/${stamp}.json: ${got.message}`, {
        details: problems.map((p) => `  ${p}`),
      }),
    };
  }
  return {
    target: {
      root,
      quiz,
      paths,
      git,
      stamp,
      hash,
      short: shortHash(hash, all),
      version: loaded.quiz,
      loaded,
      read: got.read,
      attempt: got.attempt,
      resultsJson: got.read.json,
    },
  };
}

/** A grades file's text read and checked against the attempt: the applied grades, or every problem. */
export function checkGrades(
  t: GradeTarget,
  text: string,
): { ok: true; file: GradesFile; applied: AppliedGrades } | { ok: false; message: string; problems: string[] } {
  const read = parseGrades(text);
  if (!read.ok) return { ok: false, message: read.message, problems: [read.message] };
  const applied = applyGrades(t.version, t.attempt, t.resultsJson, read.file);
  if (applied.problems.length > 0) return { ok: false, message: "invalid grades", problems: applied.problems };
  return { ok: true, file: read.file, applied };
}

/** The newest grades file of an attempt in `grades/` (by the graded stamp in its name), read and checked; or null. */
export function newestGrades(t: GradeTarget): KeptGrades | null | { error: string } {
  let name: string | undefined;
  try {
    name = readdirSync(t.paths.grades)
      .filter((f) => f.startsWith(`${t.stamp}-`) && f.endsWith("-grades.json"))
      .sort()
      .at(-1);
  } catch {
    // no grades folder
  }
  if (name === undefined) return null;
  const checked = checkGrades(t, readFileSync(join(t.paths.grades, name), "utf8"));
  if (!checked.ok) return { error: `grades/${name} is not usable: ${checked.problems[0] ?? checked.message}` };
  return { name, applied: checked.applied };
}

/** The first of the clock's `YYYYMMDD-HHMMSS` stamps (then each second after it) with no grades file of this attempt. */
function freeGradedStamp(t: GradeTarget, from: Date): string {
  const at = new Date(from.getTime());
  for (;;) {
    const stamp = localStamp(at);
    if (!existsSync(t.paths.grade(t.stamp, stamp))) return stamp;
    at.setSeconds(at.getSeconds() + 1);
  }
}

/** What a filing made. */
export type Kept = {
  /** `grades/<stamp>-<time>-grades.json`, or null when no grades were given */
  grades: string | null;
  grader: Grader | null;
  report: Report;
  /** the commit's short hash and its message; null when nothing was committed */
  committed: { hash: string; message: string } | null;
  warning: string | null;
};

/**
 * Under the lock: keeps the grades file as given (its bytes, never over another), writes the report of the grades that
 * count (`applied`, else none), and makes one commit of those files (COMMANDS.md, `library grade`). `moveFrom` is a
 * file in `progress/` that goes once the copy is kept (G29).
 */
export async function keepAndReport(
  io: LibraryIo,
  t: GradeTarget,
  given: { bytes: Uint8Array; moveFrom?: string } | null,
  applied: AppliedGrades | null,
  hooks: { waiting(text: string): void; stale(text: string): void },
): Promise<Kept> {
  const atomic = io.atomic ?? writeFileAtomic;
  return await withLock(
    t.root,
    `quiz library grade ${t.quiz.name}`,
    lockEnvOf(io),
    {
      waiting: (h) => hooks.waiting(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`),
      stale: (h, why) => hooks.stale(staleNote(h, why)),
    },
    async () => {
      const rels: string[] = [];
      const base = `quizzes/${t.quiz.id}`;
      let grades: string | null = null;
      if (given !== null) {
        const stamp = freeGradedStamp(t, nowOf(io));
        await atomic(t.paths.grade(t.stamp, stamp), given.bytes);
        if (given.moveFrom !== undefined) await rm(given.moveFrom, { force: true });
        grades = `grades/${t.stamp}-${stamp}-grades.json`;
        rels.push(`${base}/${grades}`);
      }
      const m = (t.version.frontMatter.uiLang === "vi" ? vi : en).report;
      const report = buildReport({ quiz: t.version, quizHash: t.hash, attempt: t.attempt, applied }, m);
      await atomic(t.paths.reportJson(t.stamp), Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8"));
      await atomic(t.paths.reportMd(t.stamp), Buffer.from(renderMarkdown(report, m, t.quiz.name), "utf8"));
      rels.push(`${base}/reports/${t.stamp}-report.json`, `${base}/reports/${t.stamp}-report.md`);
      const message = `fullmark: grade ${t.quiz.name}`;
      const result = await t.git.commit(rels, message);
      return {
        grades,
        grader: applied?.grader ?? null,
        report,
        committed: result.status === "committed" ? { hash: result.hash, message } : null,
        warning: result.status === "failed" ? `the commit failed: ${result.message}; the files are written` : null,
      };
    },
  );
}

/** The words of a filing, as COMMANDS.md prints them, and its `--json` object. */
export function printKept(
  io: LibraryIo,
  opts: { json: boolean; plain: boolean },
  t: GradeTarget,
  kept: Kept,
  extra: { template: string | null; next: string | null } = { template: null, next: null },
): void {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const pending = pendingOf(kept.report);
  const waitingCount = pending.essay + pending.code;
  if (opts.json) {
    io.out(
      JSON.stringify({
        status: "written",
        attempt: t.stamp,
        version: t.hash,
        report: `reports/${t.stamp}-report.md`,
        grades: kept.grades,
        template: extra.template,
        graded: kept.report.open.filter((o) => !o.pending).length,
        pending: waitingCount,
        committed: kept.committed?.hash ?? null,
      }),
    );
  }
  if (kept.grades !== null && kept.grader !== null)
    out(`${p.green("grades kept")} ${kept.grades} · ${kept.grader.kind}, ${kept.grader.name}`);
  else if (kept.grades !== null) out(`${p.green("grades kept")} ${kept.grades}`);
  out(
    `${p.green("report")} reports/${t.stamp}-report.md · ${percentWords(kept.report.score)} · ${
      waitingCount > 0 ? waiting(pending.essay, pending.code) : "nothing pending"
    }`,
  );
  if (extra.template !== null) out(`${p.green("written")} ${extra.template} (a grades template)`);
  // a template was just written: the next step is to fill it in (G31), not to ask for one again
  if (extra.template !== null)
    out(
      p.dim(
        `next: fill in ${extra.template}, then quiz library grade ${t.quiz.name} --grades ${extra.template} (or --web)`,
      ),
    );
  else if (waitingCount > 0)
    out(p.dim(`next: quiz library grade ${t.quiz.name} --web, or --json for a grades template`));
  if (kept.warning !== null) out(`${p.yellow("warning")} ${kept.warning}`);
  if (kept.committed !== null) out(p.dim(`committed ${kept.committed.hash} ${kept.committed.message}`));
  if (extra.next !== null) out(p.dim(extra.next));
}

const heading = (t: GradeTarget, more = ""): string =>
  `${t.quiz.name} · attempt ${t.stamp} · version ${t.short}${more}`;

/**
 * `quiz library grade NAME [--attempt STAMP] [--grades FILE] [--json]` and `NAME --web ...` (COMMANDS.md): grades an
 * attempt against the version it was taken on, keeps the grades file given and writes the report into `reports/`.
 */
export async function runLibraryGrade(name: string, opts: LibraryGradeOptions, io: LibraryGradeIo): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  if (opts.name !== null && !opts.web) return libraryFail(io, opts.json, "--name names the grader of --web");
  if (opts.web && opts.grades !== null)
    return libraryFail(io, opts.json, "--web takes no --grades: the form is pre-filled from the newest grades kept", {
      fix: "adjust them in the form, or drop --web",
    });

  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const paths = libraryPaths(root).quiz(quiz.id);
  const hooks = {
    waiting: (text: string) => io.err(p.dim(text)),
    stale: (text: string) => out(`${p.cyan("note")} ${text}`),
  };

  const history = readHistory(root, quiz);

  // grades a form saved and nobody kept (the lock was busy, or the command died) are kept before anything else (G29)
  let leftover: string | undefined;
  try {
    leftover = readdirSync(paths.progress)
      .filter((f) => {
        const m = LEFTOVER_NAME.exec(f);
        return m !== null && history.attempts.some((a) => a.stamp === m[1]);
      })
      .sort()[0];
  } catch {
    // no progress folder
  }
  if (leftover !== undefined) {
    const stamp = (LEFTOVER_NAME.exec(leftover) as RegExpExecArray)[1] as string;
    const prepared = prepare(io, opts.json, root, git, quiz, stamp);
    if ("exit" in prepared) return prepared.exit;
    const { target } = prepared;
    const file = join(paths.progress, leftover);
    const bytes = readFileSync(file);
    const checked = checkGrades(target, bytes.toString("utf8"));
    if (!checked.ok)
      return libraryFail(
        io,
        opts.json,
        `progress/${leftover} cannot be kept: ${checked.problems[0] ?? checked.message}`,
        {
          fix: `check or remove the file, then run \`quiz library grade ${quiz.name}\` again`,
        },
      );
    out(heading(target));
    out(`${p.cyan("note")} keeping the grades an earlier form saved in progress/${leftover}`);
    try {
      const kept = await keepAndReport(io, target, { bytes, moveFrom: file }, checked.applied, hooks);
      printKept(io, opts, target, kept, { template: null, next: `next: quiz library grade ${quiz.name}` });
      return EXIT.done;
    } catch (error) {
      if (error instanceof LockBusy)
        return libraryFail(io, opts.json, `${error.message}; your grades are safe in progress/${leftover}`, {
          fix: `run \`quiz library grade ${quiz.name}\` again to keep them`,
        });
      throw error;
    }
  }

  const picked = pickAttempt(io, opts.json, quiz, history.attempts, opts.attempt);
  if ("exit" in picked) return picked.exit;
  const prepared = prepare(io, opts.json, root, git, quiz, picked.stamp);
  if ("exit" in prepared) return prepared.exit;
  const { target } = prepared;

  if (opts.web) {
    const newest = newestGrades(target);
    if (newest !== null && "error" in newest) return libraryFail(io, opts.json, newest.error);
    return await (await import("./library-grade-web")).runLibraryGradeWeb(target, newest, opts, io, hooks, {
      keepAndReport,
      printKept,
      heading,
    });
  }

  // the grades that count: `--grades` (checked, nothing written when it has a problem), else the newest kept, else none
  let given: { bytes: Uint8Array } | null = null;
  let applied: AppliedGrades | null = null;
  if (opts.grades !== null) {
    const file = resolve(io.cwd, opts.grades);
    let bytes: Buffer;
    try {
      bytes = readFileSync(file);
    } catch (error) {
      return libraryFail(io, opts.json, `cannot read the grades file: ${readFailure(error)}`, {
        fix: shownPath(file, io.cwd),
      });
    }
    const checked = checkGrades(target, bytes.toString("utf8"));
    if (!checked.ok) {
      const shown = shownPath(file, io.cwd);
      if (opts.json)
        io.out(
          JSON.stringify({ status: "problems", file: shown, message: checked.message, problems: checked.problems }),
        );
      io.err(`error: ${shown}: ${checked.problems.length === 1 ? checked.problems[0] : checked.message}`);
      if (checked.problems.length > 1) for (const line of checked.problems) io.err(`  ${line}`);
      return EXIT.problems;
    }
    given = { bytes };
    applied = checked.applied;
    for (const w of applied.warnings) io.err(`warning: ${w}`);
  } else {
    const newest = newestGrades(target);
    if (newest !== null && "error" in newest) return libraryFail(io, opts.json, newest.error);
    applied = newest?.applied ?? null;
  }

  // `--json`: the empty grades template, for an attempt with an essay or code question answered (G27)
  let template: string | null = null;
  if (opts.json && opts.grades === null && gradable(target.version, grade(target.version, target.attempt)).length > 0) {
    const path = join(io.cwd, `${quiz.name}-${target.stamp}-grades.json`);
    if (existsSync(path)) {
      io.err(
        `warning: ${shownPath(path, io.cwd)} already exists, so no grades template was written; delete it for a fresh template`,
      );
    } else {
      const atomic = io.atomic ?? writeFileAtomic;
      const text = `${JSON.stringify(
        gradesTemplate(target.version, grade(target.version, target.attempt), target.resultsJson),
        null,
        2,
      )}\n`;
      try {
        await atomic(path, Buffer.from(text, "utf8"));
      } catch (error) {
        return libraryFail(io, opts.json, `cannot write ${shownPath(path, io.cwd)}: ${(error as Error).message}`);
      }
      template = shownPath(path, io.cwd);
    }
  }

  out(heading(target));
  try {
    const kept = await keepAndReport(io, target, given, applied, hooks);
    printKept(io, opts, target, kept, { template, next: null });
    return EXIT.done;
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }
}
