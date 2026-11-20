import { readdirSync, readFileSync } from "node:fs";
import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { attemptOf, parseResults } from "../core/attempt";
import { type IndexQuiz, writeIndex } from "../library/index-file";
import { libraryPaths, QUIZZES_DIR, type QuizPaths } from "../library/layout";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  libraryRefuse,
  lockEnvOf,
  noSuchQuiz,
  openLibrary,
  painterFor,
} from "./library-common";
import { plural } from "./table";

export type LibraryRmOptions = { yes: boolean; force: boolean; json: boolean; plain: boolean };

/** What `rm` needs beyond `LibraryIo`: the question's answer and the removal of a folder, which tests control. */
export type LibraryRmIo = LibraryIo & {
  /** asks `[y/N]`; the default asks on the terminal */
  ask?: (question: string) => Promise<boolean>;
  /** removes a folder with everything in it; a test makes it fail where a killed run would stop */
  removeTree?: (path: string) => Promise<void>;
};

/** `<64 hex>.json`: an attempt in progress; the `.serving.json` and `.submitted.json` beside it are not. */
const PROGRESS_NAME = /^[0-9a-f]{64}\.json$/;

/** The leftover of a deletion a killed run did not finish: the quiz's folder, renamed aside. */
const ASIDE = /^\.[^/]+\.deleting$/;

const count = (dir: string, keep: (name: string) => boolean): number => {
  try {
    return readdirSync(dir).filter(keep).length;
  } catch {
    return 0;
  }
};

/** The attempts in progress: a saved attempt of one of the quiz's versions that was never submitted. */
function inProgress(paths: QuizPaths, quiz: IndexQuiz): number {
  let n = 0;
  try {
    for (const name of readdirSync(paths.progress).filter((f) => PROGRESS_NAME.test(f))) {
      if (!quiz.versions.some((v) => v.hash === name.slice(0, -".json".length))) continue;
      try {
        const read = parseResults(readFileSync(join(paths.progress, name), "utf8"));
        if (read.ok && attemptOf(read.results).phase === "answering") n++;
      } catch {
        // unreadable: not counted
      }
    }
  } catch {
    // no progress folder
  }
  return n;
}

/** The process serving a take of the quiz, when its `serving.json` names one that is running. */
function openTake(io: LibraryIo, paths: QuizPaths): number | null {
  const alive = lockEnvOf(io).alive;
  try {
    for (const name of readdirSync(paths.progress).filter((f) => f.endsWith(".serving.json"))) {
      try {
        const value = JSON.parse(readFileSync(join(paths.progress, name), "utf8")) as { pid?: unknown };
        if (typeof value.pid === "number" && value.pid > 0 && alive(value.pid)) return value.pid;
      } catch {
        // unreadable: not a live take
      }
    }
  } catch {
    // no progress folder
  }
  return null;
}

async function askOnTerminal(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

/**
 * `quiz library rm NAME [--yes] [--force] [--json]` (COMMANDS.md; G10, G37): deletes a quiz with its versions and results
 * and commits, so `git revert` brings it back. It is refused, unless `--force`, when the library is not its own git
 * repository, the quiz's folder has changes not in git, or a take of the quiz is serving. It asks first, unless
 * `--yes`. The folder is renamed aside before it is removed, so a killed run leaves the quiz whole or gone.
 */
export async function runLibraryRm(name: string, opts: LibraryRmOptions, io: LibraryRmIo): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const paths = libraryPaths(root).quiz(quiz.id);
  const rel = `${QUIZZES_DIR}/${quiz.id}`;

  const repository = git.hasRepository();
  if (!opts.force) {
    if (!repository)
      return libraryRefuse(
        io,
        opts.json,
        `the library is not a git repository, so deleting ${quiz.name} could not be undone`,
        "make it one with git init in the library, or add --force",
      );
    const loose = (await git.uncommitted()).filter((f) => f.startsWith(`${rel}/`));
    if (loose.length > 0)
      return libraryRefuse(
        io,
        opts.json,
        `${rel} has uncommitted changes, so deleting it could not be undone`,
        "commit or discard them, or add --force",
      );
    const pid = openTake(io, paths);
    if (pid !== null)
      return libraryRefuse(
        io,
        opts.json,
        `${quiz.name} is open in a take (pid ${pid})`,
        "finish or stop it, or add --force",
      );
  }

  const progress = inProgress(paths, quiz);
  const question = `delete ${quiz.name} (${quiz.title}): ${[
    plural(quiz.versions.length, "version"),
    plural(
      count(paths.results, (f) => f.endsWith(".json")),
      "attempt",
    ),
    plural(
      count(paths.reports, (f) => f.endsWith("-report.json")),
      "report",
    ),
    ...(progress > 0 ? [`${plural(progress, "attempt")} in progress`] : []),
  ].join(", ")}?`;
  if (!opts.yes) {
    const ask = io.ask ?? (io.tty && !opts.json ? askOnTerminal : null);
    if (ask === null)
      return libraryFail(io, opts.json, `delete ${quiz.name}? pass --yes to confirm`, {
        fix: opts.json ? "add --yes: --json never prompts" : "add --yes: there is no terminal to ask on",
      });
    if (!(await ask(`${question} [y/N] `))) {
      io.err("not deleted");
      return EXIT.usage;
    }
  }

  const removeTree = io.removeTree ?? ((path: string) => rm(path, { recursive: true, force: true }));
  try {
    return await withLock(
      root,
      `quiz library rm ${quiz.name}`,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h, why) => out(`${p.cyan("note")} ${staleNote(h, why)}`),
      },
      async () => {
        // the index as it is now that the lock is ours
        const fresh = openLibrary(io, opts.json);
        if ("exit" in fresh) return fresh.exit;
        const current = findQuiz(fresh.index, quiz.name);
        if (current === undefined) return noSuchQuiz(io, opts.json, fresh.index, quiz.name);
        // what a killed deletion left aside
        const quizzes = libraryPaths(root).quizzes;
        for (const leftover of (await readdir(quizzes).catch(() => [] as string[])).filter((f) => ASIDE.test(f)))
          await removeTree(join(quizzes, leftover));

        // 1. the folder goes aside, whole and at once; 2. the index loses the quiz; 3. the folder is removed; 4. one commit
        const aside = join(quizzes, `.${quiz.id}.${process.pid}.deleting`);
        await rename(paths.dir, aside);
        try {
          await writeIndex(
            libraryPaths(root).index,
            { ...fresh.index, quizzes: fresh.index.quizzes.filter((q) => q !== current) },
            io.atomic ?? writeFileAtomic,
          );
        } catch (error) {
          // the old state: the quiz is put back where it was
          await rename(aside, paths.dir).catch(() => undefined);
          throw error;
        }
        await removeTree(aside);

        let committed: { hash: string; message: string } | null = null;
        let warning: string | null = null;
        const message = `fullmark: rm ${quiz.name}`;
        if (repository) {
          const result = await git.commit(["library.toml", rel], message);
          if (result.status === "committed") committed = { hash: result.hash, message };
          else if (result.status === "failed")
            warning = `the commit failed: ${result.message}; the quiz is deleted and the commit is not made`;
        } else warning = "the library is not a git repository, so this cannot be undone";
        if (opts.json)
          io.out(
            JSON.stringify({ status: "deleted", name: quiz.name, id: quiz.id, committed: committed?.hash ?? null }),
          );
        out(`${p.green("deleted")} ${quiz.name}`);
        if (warning !== null) out(`${p.yellow("warning")} ${warning}`);
        if (committed !== null) out(p.dim(`undo: git -C ${root.replaceAll("\\", "/")} revert ${committed.hash}`));
        return EXIT.done;
      },
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }
}
