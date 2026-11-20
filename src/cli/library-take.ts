import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { type Attempt, attemptOf, parseResults } from "../core/attempt";
import { FONT_CHOICES } from "../core/fonts";
import { en, vi } from "../core/i18n";
import type { Quiz } from "../core/ir";
import { buildReport, type Report } from "../core/report";
import { shortDate } from "../core/review/counts";
import type { Git } from "../library/git";
import type { IndexQuiz } from "../library/index-file";
import { type LibraryPaths, libraryPaths, type QuizPaths, shortHash } from "../library/layout";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { EXIT, type ExitCode } from "./exit-codes";
import { fail } from "./fail";
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
import { missedFor } from "./library-missed";
import { findSection, localStamp, type ServeIo, serveLoaded } from "./serve";
import { plural } from "./table";

export type LibraryTakeOptions = {
  section: string | null;
  /** only the questions wrong or partly right in earlier attempts and not answered fully right since */
  missed: boolean;
  focus: boolean;
  open: boolean;
  /** seconds, as given; null: 0 (no limit) */
  timeout: string | null;
  /** as given; null: a free port */
  port: string | null;
  fonts: string | null;
  json: boolean;
  plain: boolean;
  version: string;
};

export type TakeIo = LibraryIo & ServeIo;

const wholeNumber = (text: string, min: number): number | null =>
  /^\d+$/.test(text) && Number(text) >= min ? Number(text) : null;

/** `<64 hex>.json`: an attempt in progress; the `.serving.json` and `.submitted.json` beside it are not. */
const PROGRESS_NAME = /^[0-9a-f]{64}\.json$/;

/** An attempt saved by an earlier `take`, on the version it was started on. */
type SavedAttempt = { hash: string; attempt: Attempt; file: string };

/** The attempts in progress that can be resumed (an `answering` results file of one of the quiz's versions), oldest first. */
function savedAttempts(paths: QuizPaths, quiz: IndexQuiz): SavedAttempt[] {
  let names: string[];
  try {
    names = readdirSync(paths.progress).filter((n) => PROGRESS_NAME.test(n));
  } catch {
    return [];
  }
  const found: SavedAttempt[] = [];
  for (const name of names) {
    const hash = name.slice(0, -".json".length);
    if (!quiz.versions.some((v) => v.hash === hash)) continue;
    try {
      const read = parseResults(readFileSync(join(paths.progress, name), "utf8"));
      if (!read.ok) continue;
      const attempt = attemptOf(read.results);
      if (attempt.phase === "answering") found.push({ hash, attempt, file: join(paths.progress, name) });
    } catch {
      // unreadable: left alone
    }
  }
  return found.sort(
    (a, b) =>
      (a.attempt.state.startedAt ?? "").localeCompare(b.attempt.state.startedAt ?? "") || a.hash.localeCompare(b.hash),
  );
}

/** `progress/<version>.serving.json`: the process serving a version of the quiz, with the URL to open. */
type Serving = { file: string; pid: number; url: string };

function servingFiles(paths: QuizPaths): Serving[] {
  let names: string[];
  try {
    names = readdirSync(paths.progress).filter((n) => n.endsWith(".serving.json"));
  } catch {
    return [];
  }
  const found: Serving[] = [];
  for (const name of names) {
    const file = join(paths.progress, name);
    try {
      const value = JSON.parse(readFileSync(file, "utf8")) as { pid?: unknown; url?: unknown };
      found.push({
        file,
        pid: typeof value.pid === "number" ? value.pid : -1,
        url: typeof value.url === "string" ? value.url : "",
      });
    } catch {
      found.push({ file, pid: -1, url: "" });
    }
  }
  return found;
}

/** The `<hash>.submitted.json` files a server wrote and nobody filed yet. */
function submittedFiles(paths: QuizPaths, quiz: IndexQuiz): { hash: string; file: string }[] {
  let names: string[];
  try {
    names = readdirSync(paths.progress).filter((n) => n.endsWith(".submitted.json"));
  } catch {
    return [];
  }
  return names
    .sort()
    .map((n) => ({ hash: n.slice(0, -".submitted.json".length), file: join(paths.progress, n) }))
    .filter((s) => quiz.versions.some((v) => v.hash === s.hash));
}

/** The first of the time's `YYYYMMDD-HHMMSS` stamps (then each second after it) that no result of the quiz has. */
function freeStamp(paths: QuizPaths, from: Date): string {
  const at = new Date(from.getTime());
  for (;;) {
    const stamp = localStamp(at);
    if (!existsSync(paths.result(stamp))) return stamp;
    at.setSeconds(at.getSeconds() + 1);
  }
}

/** The local time a results file records for its submit, or null. */
function submitTime(text: string): Date | null {
  const read = parseResults(text);
  const at = read.ok ? read.results.state.submittedAt : null;
  const m = at === null ? null : /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(at);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) : null;
}

/** `80%* (20 of 21 points, 4 waiting for a grade)`: what the score of a filed attempt reads as. */
export function scoreText(score: Report["score"]): string {
  if (score === null) return "no points to score";
  const star = score.pending > 0 ? "*" : "";
  const percent = score.percent === null ? "–" : `${Math.round(score.percent)}%`;
  const waiting = score.pending > 0 ? `, ${score.pending} waiting for a grade` : "";
  return `${percent}${star} (${score.earned} of ${score.points} points${waiting})`;
}

/** `4 of 6 right · 67%`: what a `--missed` attempt scored, by the questions it had. */
function missedScoreText(right: number, total: number, score: Report["score"]): string {
  const percent = score === null || score.percent === null ? "–" : `${Math.round(score.percent)}%`;
  const waiting = score !== null && score.pending > 0 ? `, ${score.pending} waiting for a grade` : "";
  return `${right} of ${total} right · ${percent}${score !== null && score.pending > 0 ? "*" : ""}${waiting}`;
}

type Filed = {
  stamp: string;
  results: string;
  report: Report | null;
  plan: Attempt["plan"];
  committed: string | null;
  warning: string | null;
};

/**
 * Files a submit under the lock: `progress/<version>.submitted.json` moves to `results/<stamp>.json`, the progress file
 * of that version goes, and one commit holds the result (COMMANDS.md, `library take`; G9).
 */
async function fileSubmitted(
  io: TakeIo,
  root: string,
  libraryPaths_: LibraryPaths,
  quiz: IndexQuiz,
  submitted: { hash: string; file: string },
  stamp: "clock" | "submit",
  lockWords: string,
  hooks: { waiting(text: string): void; stale(text: string): void },
  git: Git,
): Promise<Filed> {
  const paths = libraryPaths_.quiz(quiz.id);
  return await withLock(
    root,
    lockWords,
    lockEnvOf(io),
    {
      waiting: (h) => hooks.waiting(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`),
      stale: (h, why) => hooks.stale(staleNote(h, why)),
    },
    async () => {
      const text = await readFile(submitted.file, "utf8");
      // the stamp is the submit's local time: the clock's for a take that just ended, the file's for one left over
      const free = freeStamp(paths, (stamp === "submit" ? submitTime(text) : null) ?? nowOf(io));
      const target = paths.result(free);
      await mkdir(paths.results, { recursive: true });
      await rename(submitted.file, target);
      const read = parseResults(text);
      // the progress file goes only when it is this attempt's own (a section or missed attempt leaves another's alone)
      try {
        const own = parseResults(await readFile(paths.progressFile(submitted.hash), "utf8"));
        if (own.ok && read.ok && own.results.state.startedAt === read.results.state.startedAt)
          await rm(paths.progressFile(submitted.hash), { force: true });
      } catch {
        // none
      }
      let report: Report | null = null;
      const loaded = loadStored(root, quiz, submitted.hash);
      if (read.ok && loaded?.quiz) {
        const m = (loaded.quiz.frontMatter.uiLang === "vi" ? vi : en).report;
        report = buildReport(
          { quiz: loaded.quiz as Quiz, quizHash: submitted.hash, attempt: attemptOf(read.results), applied: null },
          m,
        );
      }
      const message = `fullmark: take ${quiz.name}`;
      const rel = `quizzes/${quiz.id}/results/${free}.json`;
      const result = await git.commit([rel], message);
      return {
        stamp: free,
        results: `results/${free}.json`,
        report,
        plan: read.ok ? read.results.plan : { source: "full" as const, questions: [] },
        committed: result.status === "committed" ? `${result.hash} ${message}` : null,
        warning: result.status === "failed" ? `the commit failed: ${result.message}; the result is filed` : null,
      };
    },
  );
}

/**
 * `quiz library take NAME [--section S] [--focus] [--no-open] [--timeout SECONDS] [--port N] [--json]` (COMMANDS.md):
 * serves the quiz's current version (or resumes an attempt in progress, on whatever version it began), files the
 * result next to the version and commits. The library's lock is held only to file and commit, never while serving (G9).
 */
export async function runLibraryTake(name: string, opts: LibraryTakeOptions, io: TakeIo): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;

  const timeout = opts.timeout === null ? 0 : wholeNumber(opts.timeout, 0);
  if (timeout === null)
    return libraryFail(io, opts.json, `--timeout ${opts.timeout} is not a number of seconds (0 waits forever)`);
  const port = opts.port === null ? 0 : wholeNumber(opts.port, 1);
  if (port === null || port > 65535)
    return libraryFail(io, opts.json, `--port ${opts.port} is not a port number (1 to 65535)`);
  if (opts.fonts !== null && !(FONT_CHOICES as readonly string[]).includes(opts.fonts))
    return libraryFail(io, opts.json, `--fonts ${opts.fonts} is not one of quiz, all, none`);

  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  const { index } = opened;
  const quiz = findQuiz(index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, index, name);
  const all = libraryPaths(root);
  const paths = all.quiz(quiz.id);
  const hashes = quiz.versions.map((v) => v.hash);
  const short = (hash: string): string => shortHash(hash, hashes);
  const alive = lockEnvOf(io).alive;
  const lockWords = `quiz library take ${quiz.name}`;
  const hooks = {
    waiting: (text: string) => io.err(p.dim(text)),
    stale: (text: string) => out(`${p.cyan("note")} ${text}`),
  };

  // one take at a time per quiz (G9): a serving file whose process is alive refuses this one, a dead one is removed
  for (const s of servingFiles(paths)) {
    if (s.pid > 0 && alive(s.pid)) {
      const message = `${quiz.name} is already open in another take (pid ${s.pid})`;
      if (opts.json) io.out(JSON.stringify({ status: "error", message, fix: `open: ${s.url}`, url: s.url }));
      io.err(`error: ${message}`);
      io.err(`    open: ${s.url}`);
      return EXIT.usage;
    }
    await rm(s.file, { force: true });
  }

  /** the missed questions no longer in the quiz, for `--json`'s `gone` */
  let gone = 0;
  const report = (filed: Filed, stampName: string): void => {
    const score = filed.report?.score ?? null;
    if (opts.json) {
      io.out(
        JSON.stringify({
          status: "filed",
          results: filed.results,
          score,
          plan: { source: filed.plan.source, questions: filed.plan.questions },
          gone,
        }),
      );
    }
    const right = filed.report?.questions.filter((q) => q.status === "correct").length ?? 0;
    out(
      `${p.green("filed")} ${filed.results} · ${
        filed.plan.source === "missed" ? missedScoreText(right, filed.plan.questions.length, score) : scoreText(score)
      }`,
    );
    if ((score?.pending ?? 0) > 0) out(p.dim(`next: quiz library grade ${stampName} --web`));
    if (filed.warning !== null) out(`${p.yellow("warning")} ${filed.warning}`);
    if (filed.committed !== null) out(p.dim(`committed ${filed.committed}`));
  };
  const busy = (error: LockBusy, submitted: string): ExitCode =>
    libraryFail(io, opts.json, `${error.message}; your answers are safe in ${submitted}`, {
      fix: `run \`quiz library take ${quiz.name}\` again to file them`,
    });

  // a submit that was written and not filed (the lock was busy, or the command died) is filed before anything else
  const leftover = submittedFiles(paths, quiz)[0];
  if (leftover !== undefined) {
    out(`${p.cyan("note")} filing the answers an earlier take left in progress/${leftover.hash}.submitted.json`);
    try {
      const filed = await fileSubmitted(io, root, all, quiz, leftover, "submit", lockWords, hooks, git);
      report(filed, quiz.name);
      out(p.dim(`next: quiz library take ${quiz.name}`));
      return EXIT.done;
    } catch (error) {
      if (error instanceof LockBusy) return busy(error, `progress/${leftover.hash}.submitted.json`);
      throw error;
    }
  }

  // which version, and which attempt: a plain take resumes the oldest saved attempt, on whatever version it began
  const plain = opts.section === null && !opts.missed;
  const saved = plain ? (savedAttempts(paths, quiz)[0] ?? null) : null;
  const hash = saved?.hash ?? quiz.current;
  const loaded = loadStored(root, quiz, hash);
  if (loaded === null || loaded.quiz === null || loaded.hash === null) {
    return libraryFail(io, opts.json, `version ${short(hash)} of ${quiz.name} cannot be read from the library`, {
      fix: "run `quiz library status` to see what is wrong",
    });
  }
  const served = loaded.quiz;
  let sectionId: string | null = null;
  if (opts.section !== null) {
    const found = findSection(served, opts.section);
    if (typeof found === "string") return libraryFail(io, opts.json, found);
    sectionId = found.id;
  }
  // `--missed`: the plan the library chooses from the attempts (nothing is served when none is missed)
  const missed = opts.missed ? missedFor(root, quiz, served, sectionId) : null;
  // a saved attempt of missed questions resumes as one: the "changed since you missed it" marks are worked out again (G25)
  const resumedChanged =
    saved !== null && saved.attempt.plan.source === "missed"
      ? (() => {
          const inPlan = new Set(saved.attempt.plan.questions);
          return missedFor(root, quiz, served).changed.filter((id) => inPlan.has(id));
        })()
      : null;
  if (missed !== null) {
    gone = missed.gone;
    if (missed.questions.length === 0) {
      const why =
        missed.attempts === 0
          ? "there is no attempt yet"
          : missed.gone > 0
            ? `${plural(missed.gone, "question")} you got wrong ${missed.gone === 1 ? "is" : "are"} no longer in the quiz, and every other one has been answered right since`
            : "every question you got wrong has been answered right since";
      if (opts.json) io.out(JSON.stringify({ status: "nothing_missed" }));
      out(`nothing missed: ${why}`);
      return EXIT.done;
    }
  }
  const questionCount =
    missed !== null
      ? missed.questions.length
      : saved !== null
        ? saved.attempt.plan.questions.length
        : served.sections
            .filter((s) => sectionId === null || s.id === sectionId)
            .reduce((n, s) => n + s.questions.length, 0);

  // the progress file of this attempt; a saved attempt of the version is never overwritten by a new one
  const progressFile = paths.progressFile(hash);
  const autosave = saved !== null || !existsSync(progressFile);
  await mkdir(paths.progress, { recursive: true });

  const heading = [quiz.name, quiz.title, `version ${short(hash)}`];
  if (saved !== null) {
    const started = saved.attempt.state.startedAt;
    const answered = saved.attempt.plan.questions.filter((id) => saved.attempt.state.answers[id] != null).length;
    const when = started === null ? "an earlier day" : `${shortDate(started)} ${started.slice(11, 16)}`;
    heading.push(
      `resuming your attempt of ${when} (${answered} of ${saved.attempt.plan.questions.length} answered)${
        hash === quiz.current ? "" : `; the quiz has been updated since (now ${short(quiz.current)})`
      }`,
    );
  } else if (missed !== null) {
    heading.splice(
      1,
      2,
      sectionId === null ? "missed questions" : `missed questions of ${opts.section}`,
      `${missed.questions.length} from ${plural(missed.attempts, "attempt")}`,
    );
    if (missed.changed.length > 0) heading.push(`${missed.changed.length} changed since you missed them`);
    if (missed.gone > 0) heading.push(`${missed.gone} no longer in the quiz`);
  } else {
    heading.push(plural(questionCount, "question"), timeout === 0 ? "no time limit" : `time limit ${timeout} s`);
  }
  out(heading.join(" · "));

  const servingFile = paths.servingFile(hash);
  const submittedFile = paths.submittedFile(hash);
  let result: Awaited<ReturnType<typeof serveLoaded>>;
  try {
    result = await serveLoaded(
      loaded,
      loaded.file,
      {
        out: submittedFile,
        timeout: String(timeout),
        open: opts.open,
        port: opts.port,
        json: opts.json,
        profile: null,
        config: null,
        fonts: opts.fonts,
        focus: opts.focus,
        // a missed plan holds its own questions (those of the section, when there is one): the page needs no section
        section: missed !== null ? null : opts.section,
        autosave: autosave ? progressFile : null,
        version: opts.version,
      },
      io,
      {
        ...(missed !== null
          ? { plan: { source: "missed" as const, questions: missed.questions }, changed: missed.changed }
          : resumedChanged !== null
            ? { changed: resumedChanged }
            : {}),
        announce({ url, port: listening }) {
          writeFileSync(
            servingFile,
            `${JSON.stringify({ pid: process.pid, url, started: nowOf(io).toISOString() })}\n`,
          );
          if (opts.json) io.out(JSON.stringify({ status: "listening", url, port: listening, pid: process.pid }));
          out(`serving ${url}${opts.open ? "  (opened in your browser)" : ""}`);
          if (autosave) out("progress is saved: close the tab or press Ctrl+C, and take resumes it");
          else out("this attempt is not saved: another attempt of this version is in progress and is left alone");
        },
      },
    );
  } finally {
    await rm(servingFile, { force: true });
  }
  if ("exit" in result) return result.exit;

  const { outcome } = result;
  switch (outcome.status) {
    case "submitted": {
      out("");
      try {
        const filed = await fileSubmitted(
          io,
          root,
          all,
          quiz,
          { hash, file: submittedFile },
          "clock",
          lockWords,
          hooks,
          git,
        );
        report(filed, quiz.name);
        return EXIT.done;
      } catch (error) {
        if (error instanceof LockBusy) return busy(error, `progress/${hash}.submitted.json`);
        throw error;
      }
    }
    case "timeout":
      if (opts.json) io.out(JSON.stringify({ status: "timeout" }));
      io.err(
        `timed out after ${timeout} seconds without a submit; ${autosave ? "progress is saved: run take again to continue" : "nothing was filed"}`,
      );
      return EXIT.usage;
    case "interrupted":
      if (opts.json) io.out(JSON.stringify({ status: "interrupted" }));
      io.err(autosave ? "progress is saved: run take again to continue" : "stopped; nothing was filed");
      return EXIT.usage;
    case "error":
      fail(io, opts.json, `cannot write the results: ${outcome.message}`, {
        file: `quizzes/${quiz.id}/progress/${hash}.submitted.json`,
      });
      return EXIT.usage;
  }
}
