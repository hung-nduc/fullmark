import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { reviewCounts } from "../core/review/counts";
import type { Git } from "../library/git";
import type { IndexQuiz } from "../library/index-file";
import { libraryPaths, type QuizPaths, shortHash } from "../library/layout";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  lockEnvOf,
  noSuchQuiz,
  openLibrary,
  painterFor,
  storedProfile,
} from "./library-common";
import type { LibraryReviewHooks } from "./review";
import { loadReview } from "./review-file";
import type { ServeIo } from "./serve";
import { plural } from "./table";

export type LibraryReviewOptions = {
  /** only the questions new or changed since the stored review */
  since: boolean;
  /** seconds, as given; null: 1800 */
  timeout: string | null;
  /** as given; null: a free port */
  port: string | null;
  open: boolean;
  json: boolean;
  plain: boolean;
  version: string;
};

/** What the form needs beyond `LibraryIo`: the clock, the opener, Ctrl+C and the timer, which tests control. */
export type LibraryReviewIo = LibraryIo & ServeIo;

/** `progress/review.json`: a review the form wrote and nobody filed yet (G34). */
const LEFTOVER = "review.json";

type Filed = { committed: { hash: string; message: string } | null; warning: string | null };

type Where = { root: string; quiz: IndexQuiz; paths: QuizPaths; git: Git };

/**
 * Under the lock: `progress/review.json` moves to `review.json` and one commit holds it (COMMANDS.md,
 * `library review`; G34). A rename, so a killed run leaves the old review or the new one.
 */
async function fileReview(
  io: LibraryReviewIo,
  at: Where,
  hooks: { waiting(text: string): void; stale(text: string): void },
): Promise<Filed> {
  const { root, quiz, paths, git } = at;
  return await withLock(
    root,
    `quiz library review ${quiz.name}`,
    lockEnvOf(io),
    {
      waiting: (h) => hooks.waiting(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`),
      stale: (h, why) => hooks.stale(staleNote(h, why)),
    },
    async () => {
      await mkdir(paths.dir, { recursive: true });
      await rename(join(paths.progress, LEFTOVER), paths.review);
      const message = `fullmark: review ${quiz.name}`;
      const result = await git.commit([`quizzes/${quiz.id}/review.json`], message);
      return {
        committed: result.status === "committed" ? { hash: result.hash, message } : null,
        warning: result.status === "failed" ? `the commit failed: ${result.message}; the review is filed` : null,
      };
    },
  );
}

/**
 * `quiz library review NAME [--since] [--timeout SECONDS] [--port N] [--no-open] [--json]` (COMMANDS.md): `quiz
 * review`'s form on the quiz's current version, with the stored `review.json` as the earlier review. The library's lock
 * is not held while the form is served (G34): Finish writes the merged review to `progress/review.json`, then, under
 * the lock, moves it to `review.json` and commits. When the lock is not had in time it stays in `progress/`, and the
 * next `library review` of the quiz files it first.
 */
export async function runLibraryReview(
  name: string,
  opts: LibraryReviewOptions,
  io: LibraryReviewIo,
): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const paths = libraryPaths(root).quiz(quiz.id);
  const at: Where = { root, quiz, paths, git };
  const hashes = quiz.versions.map((v) => v.hash);
  const short = shortHash(quiz.current, hashes);
  const hooks = {
    waiting: (text: string) => io.err(p.dim(text)),
    stale: (text: string) => out(`${p.cyan("note")} ${text}`),
  };
  const progressFile = join(paths.progress, LEFTOVER);

  const loaded = loadStored(root, quiz, quiz.current);
  if (loaded === null || loaded.quiz === null || loaded.hash === null)
    return libraryFail(io, opts.json, `version ${short} of ${quiz.name} cannot be read from the library`, {
      fix: "run `quiz library status` to see what is wrong",
    });
  const counted = (c: ReturnType<typeof reviewCounts>): string =>
    `${c.keep} keep${c.assumed > 0 ? ` (${c.assumed} not looked at)` : ""}, ${c.fix} fix, ${c.drop} drop`;
  const heading = (more = ""): string => [quiz.name, quiz.title, `version ${short}`].join(" · ") + more;

  /** the words of a filed review: `written review.json: …`, then the next step and the commit */
  const printFiled = (
    counts: ReturnType<typeof reviewCounts>,
    filed: Filed,
    next: string,
    filedFrom: "form" | "leftover",
  ): void => {
    if (opts.json)
      io.out(
        JSON.stringify({
          status: "written",
          review: "review.json",
          keep: counts.keep,
          fix: counts.fix,
          drop: counts.drop,
          committed: filed.committed?.hash ?? null,
        }),
      );
    out(`${p.green("written")} review.json: ${counted(counts)}`);
    if (filedFrom === "form") out(p.dim(next));
    if (filed.warning !== null) out(`${p.yellow("warning")} ${filed.warning}`);
    if (filed.committed !== null) out(p.dim(`committed ${filed.committed.hash} ${filed.committed.message}`));
    if (filedFrom === "leftover") out(p.dim(next));
  };
  const busyFail = (error: LockBusy): ExitCode =>
    libraryFail(io, opts.json, `${error.message}; your review is safe in progress/${LEFTOVER}`, {
      fix: `run \`quiz library review ${quiz.name}\` again to file it`,
    });

  // a review the form saved and nobody filed (the lock was busy, or the command died) is filed before anything else
  if (existsSync(progressFile)) {
    const read = loadReview(progressFile, loaded, io.cwd);
    if (!("review" in read))
      return libraryFail(io, opts.json, `progress/${LEFTOVER} cannot be filed: ${read.problems[0] ?? read.message}`, {
        fix: `check or remove the file, then run \`quiz library review ${quiz.name}\` again`,
      });
    out(heading());
    out(`${p.cyan("note")} filing the review an earlier form saved in progress/${LEFTOVER}`);
    try {
      const filed = await fileReview(io, at, hooks);
      printFiled(reviewCounts(loaded.quiz, read.review), filed, `next: quiz library review ${quiz.name}`, "leftover");
      return EXIT.done;
    } catch (error) {
      if (error instanceof LockBusy) return busyFail(error);
      throw error;
    }
  }

  const state: { filed?: Filed; busy?: LockBusy } = {};
  const library: LibraryReviewHooks = {
    stored: paths.review,
    shown: "review.json",
    check: `quiz library register FILE --update ${quiz.name}`,
    profile: storedProfile(root, quiz, quiz.current),
    sinceMissing: `--since needs an existing review; run quiz library review ${quiz.name} first`,
    announce({ url, port }, { quiz: asked, review }) {
      if (opts.json) io.out(JSON.stringify({ status: "listening", url, port, pid: process.pid }));
      const questions = asked.sections.reduce((n, s) => n + s.questions.length, 0);
      const before =
        review === null
          ? 0
          : asked.sections.reduce(
              (n, s) => n + s.questions.filter((q) => review.questions[q.id]?.hash === q.hash).length,
              0,
            );
      out(heading(` · ${plural(questions, "question")}${review === null ? "" : `, ${before} judged before`}`));
      out(`serving ${url}${opts.open ? "  (opened in your browser)" : ""}`);
    },
    async save(bytes) {
      await mkdir(paths.progress, { recursive: true });
      await (io.atomic ?? writeFileAtomic)(progressFile, bytes);
      try {
        state.filed = await fileReview(io, at, hooks);
      } catch (error) {
        if (!(error instanceof LockBusy)) throw error;
        state.busy = error;
      }
    },
    // the form answers once the filing was tried: when the lock was busy its card says so (G34)
    answer: () => (state.busy === undefined ? {} : { filed: false, command: `quiz library review ${quiz.name}` }),
    refuse: (message, problems) =>
      libraryFail(io, opts.json, message, { details: problems.map((problem) => `  ${problem}`) }),
    unchanged(line) {
      if (opts.json) io.out(JSON.stringify({ status: "unchanged", review: "review.json" }));
      out(line);
      return EXIT.done;
    },
    done(counts) {
      if (state.busy !== undefined || state.filed === undefined) {
        return busyFail(state.busy ?? new LockBusy(null, 0));
      }
      printFiled(
        counts,
        state.filed,
        `next: edit the quiz, then quiz library register FILE --update ${quiz.name}`,
        "form",
      );
      return EXIT.done;
    },
  };

  // a dynamic import, as `quiz library grade` has it for `grade --web`: the form's server and page builder stay one
  // chunk of their own, `quiz review`'s
  const { runReview } = await import("./review");
  return await runReview(
    loaded.file,
    {
      out: null,
      since: opts.since ? paths.review : null,
      timeout: opts.timeout,
      open: opts.open,
      port: opts.port,
      json: opts.json,
      profile: null,
      config: null,
      version: opts.version,
    },
    io,
    library,
  );
}
