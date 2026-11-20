import { ID_FORMAT } from "../core/slug";
import { type IndexQuiz, writeIndex } from "../library/index-file";
import { libraryPaths } from "../library/layout";
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

export type LibraryRenameOptions = { json: boolean; plain: boolean };

const NAME_FIX = "a name is a slug: a to z, 0 to 9 and -, starting with a letter, 1 to 64 characters";

/** A free name beside `name`: `name-2`, `name-3`, … */
function freeName(name: string, taken: ReadonlySet<string>): string {
  const base = name.slice(0, 60).replace(/-+$/, "");
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * `quiz library rename OLD NEW [--json]` (COMMANDS.md; G13): changes a quiz's name in `library.toml` and nothing else. The
 * id, the folder and the shelf entries stay. NEW is a slug that is no other quiz's name or id (exit 1, with a free name).
 * One commit, under the lock.
 */
export async function runLibraryRename(
  oldName: string,
  newName: string,
  opts: LibraryRenameOptions,
  io: LibraryIo,
): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  if (!ID_FORMAT.test(newName)) return libraryFail(io, opts.json, `${newName} is not a valid name`, { fix: NAME_FIX });
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  if (findQuiz(opened.index, oldName) === undefined) return noSuchQuiz(io, opts.json, opened.index, oldName);

  try {
    return await withLock(
      root,
      `quiz library rename ${oldName} ${newName}`,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h, why) => out(`${p.cyan("note")} ${staleNote(h, why)}`),
      },
      async () => {
        // the index as it is now that the lock is ours
        const fresh = openLibrary(io, opts.json);
        if ("exit" in fresh) return fresh.exit;
        const index = fresh.index;
        const quiz = findQuiz(index, oldName);
        if (quiz === undefined) return noSuchQuiz(io, opts.json, index, oldName);
        if (quiz.name === newName)
          return libraryRefuse(io, opts.json, `${quiz.name} is already the name of this quiz`, "give it another name");
        // a name may equal the quiz's own id, but never another quiz's name or id
        const taken = new Set(index.quizzes.filter((q) => q !== quiz).flatMap((q) => [q.name, q.id]));
        if (taken.has(newName))
          return libraryRefuse(
            io,
            opts.json,
            `the name ${newName} is taken`,
            `quiz library rename ${quiz.name} ${freeName(newName, new Set([...taken, quiz.name, quiz.id]))}`,
          );
        const renamed: IndexQuiz = { ...quiz, name: newName };
        const next = { ...index, quizzes: index.quizzes.map((q) => (q === quiz ? renamed : q)) };
        await writeIndex(libraryPaths(root).index, next, io.atomic ?? writeFileAtomic);
        const message = `fullmark: rename ${quiz.name} ${newName}`;
        const result = await git.commit(["library.toml"], message);
        const committed = result.status === "committed" ? result.hash : null;
        if (opts.json)
          io.out(JSON.stringify({ status: "renamed", old: quiz.name, new: newName, id: quiz.id, committed }));
        out(`${p.green("renamed")} ${quiz.name} to ${newName} · id and folder unchanged (quizzes/${quiz.id})`);
        if (result.status === "failed")
          out(`${p.yellow("warning")} the commit failed: ${result.message}; library.toml is written`);
        if (committed !== null) out(p.dim(`committed ${committed} ${message}`));
        return EXIT.done;
      },
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }
}
