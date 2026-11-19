import { type IndexQuiz, isPublished, PUBLIC_SHELF, QUIZ_KIND, writeIndex } from "../library/index-file";
import { libraryPaths } from "../library/layout";
import { LockBusy, withLock } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import type { BuildIo } from "./build";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  lockEnvOf,
  noSuchQuiz,
  openLibrary,
  painterFor,
} from "./library-common";

/** `publish` takes `NAME --on | --off`, or the shelf's folder: `LibraryIo` and what a page build needs. */
export type PublishIo = LibraryIo & BuildIo;

export type LibraryPublishOptions = {
  /** `--on` / `--off`: mark a quiz; neither: sync the shelf */
  on: boolean;
  off: boolean;
  withBrief: boolean;
  noBrief: boolean;
  uiLang: string | null;
  fonts: string | null;
  dryRun: boolean;
  json: boolean;
  plain: boolean;
  /** the program's version, for the pages' footer */
  program: string;
};

/**
 * `quiz library publish NAME --on | --off [--json]` or `quiz library publish [DIR] ...` (COMMANDS.md, `quiz library
 * publish`). The first marks a quiz (this file); the second is the sync, `library-sync.ts`, loaded only when it runs, so
 * marking a quiz loads no page builder.
 */
export async function runLibraryPublish(
  target: string | null,
  opts: LibraryPublishOptions,
  io: PublishIo,
): Promise<ExitCode> {
  if (opts.on && opts.off) return libraryFail(io, opts.json, "--on and --off cannot be given together");
  if (!opts.on && !opts.off) {
    const { runLibrarySync } = await import("./library-sync");
    return runLibrarySync(target, opts, io);
  }
  const sync = [
    opts.withBrief ? "--with-brief" : null,
    opts.noBrief ? "--no-brief" : null,
    opts.uiLang !== null ? "--ui-lang" : null,
    opts.fonts !== null ? "--fonts" : null,
    opts.dryRun ? "--dry-run" : null,
  ].filter((x): x is string => x !== null);
  if (sync.length > 0)
    return libraryFail(io, opts.json, `${sync.join(", ")} goes with the sync, not with --${opts.on ? "on" : "off"}`, {
      fix: "run `quiz library publish DIR` for the sync",
    });
  if (target === null)
    return libraryFail(io, opts.json, `--${opts.on ? "on" : "off"} needs a quiz's name or id`, {
      fix: `quiz library publish NAME --${opts.on ? "on" : "off"}`,
    });
  return runMark(target, opts.on, opts, io);
}

/**
 * Puts a quiz on the `public` shelf, or takes it off (COMMANDS.md): one entry of its record in `library.toml`, one
 * commit, under the lock. Nothing on any shelf is written. Twice the same way says so and changes nothing.
 */
async function runMark(
  name: string,
  on: boolean,
  opts: { json: boolean; plain: boolean },
  io: LibraryIo,
): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const word = on ? "on" : "off";
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  if (findQuiz(opened.index, name) === undefined) return noSuchQuiz(io, opts.json, opened.index, name, EXIT.problems);

  try {
    return await withLock(
      root,
      `quiz library publish ${name} --${word}`,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h) => out(`${p.cyan("note")} removed a lock left by pid ${h.pid} (${h.command})`),
      },
      async () => {
        // the index as it is now that the lock is ours
        const fresh = openLibrary(io, opts.json);
        if ("exit" in fresh) return fresh.exit;
        const index = fresh.index;
        const quiz = findQuiz(index, name);
        if (quiz === undefined) return noSuchQuiz(io, opts.json, index, name, EXIT.problems);
        if (isPublished(quiz) === on) {
          if (opts.json) io.out(JSON.stringify({ status: "unchanged", name: quiz.name, committed: null }));
          out(`${quiz.name} is already ${on ? "on" : "not on"} the ${PUBLIC_SHELF} shelf`);
          return EXIT.done;
        }
        const changed: IndexQuiz = {
          ...quiz,
          shelves: on
            ? [...quiz.shelves, { shelf: PUBLIC_SHELF, kind: QUIZ_KIND }]
            : quiz.shelves.filter((e) => !(e.shelf === PUBLIC_SHELF && e.kind === QUIZ_KIND)),
        };
        const next = { ...index, quizzes: index.quizzes.map((q) => (q === quiz ? changed : q)) };
        await writeIndex(libraryPaths(root).index, next, io.atomic ?? writeFileAtomic);
        const message = `fullmark: publish ${quiz.name} --${word}`;
        const result = await git.commit(["library.toml"], message);
        const committed = result.status === "committed" ? result.hash : null;
        if (opts.json) io.out(JSON.stringify({ status: word, name: quiz.name, committed }));
        out(`${quiz.name} is ${on ? "on" : "off"} the ${PUBLIC_SHELF} shelf`);
        if (result.status === "failed")
          out(`${p.yellow("warning")} the commit failed: ${result.message}; library.toml is written`);
        if (committed !== null) out(p.dim(`committed ${committed} ${message}`));
        out(p.dim("next: quiz library publish"));
        return EXIT.done;
      },
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }
}
