import { suggest } from "../core/parse/report";
import { libraryPaths } from "../library/layout";
import { EXIT, type ExitCode } from "./exit-codes";
import { type LibraryIo, libraryFail, locate, machineOf, openIndex, refusal } from "./library-common";

/**
 * `quiz library path [NAME]` (COMMANDS.md): the library's folder, or a quiz's (`quizzes/<id>`, found by name, then by
 * id), absolute, nothing else on stdout. An unknown quiz exits 2 with the near names.
 */
export function runLibraryPath(name: string | null, io: LibraryIo): ExitCode {
  const found = locate(io, false);
  if ("exit" in found) return found.exit;
  const { root } = found.located;
  const opened = openIndex(root);
  const refused = refusal(root, opened, machineOf(io).cwd);
  if (refused) return libraryFail(io, false, refused.message, { fix: refused.fix });
  if (name === null) {
    io.out(root);
    return EXIT.done;
  }
  if (opened.kind !== "read" || !opened.read.ok) return EXIT.usage;
  const quizzes = opened.read.index.quizzes;
  const quiz = quizzes.find((q) => q.name === name) ?? quizzes.find((q) => q.id === name);
  if (quiz === undefined) {
    const names = quizzes.flatMap((q) => (q.name === q.id ? [q.name] : [q.name, q.id]));
    const near = suggest(name, names);
    return libraryFail(io, false, `no quiz named "${name}" in the library`, {
      fix: near
        ? `did you mean \`${near}\`?`
        : names.length > 0
          ? `the quizzes are: ${quizzes.map((q) => q.name).join(", ")}`
          : "the library has no quizzes yet: quiz library register FILE",
    });
  }
  io.out(libraryPaths(root).quiz(quiz.id).dir);
  return EXIT.done;
}
