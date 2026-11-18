import { shortHash } from "../library/layout";
import type { CheckIo } from "./check";
import type { ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  noSuchQuiz,
  openLibrary,
  pickVersion,
  storedProfile,
} from "./library-common";
import { shownPath } from "./paths";
import { runTemplateAdd } from "./template";

export type LibraryTemplateAddOptions = {
  as: string | null;
  /** `--version`: a hash or a prefix of at least 4 characters; null: the current version */
  version: string | null;
  skeleton: boolean;
  replace: boolean;
  json: boolean;
};

/**
 * `quiz library template add NAME [--as TEMPLATE] [--version HASH] [--skeleton] [--replace] [--json]` (COMMANDS.md): a
 * quiz of the library, at one version, stored as a user template. The version's source and assets go to `quiz template
 * add`'s own machinery, checked under the rules the version was registered with (`check.json`), not the config's. The
 * template goes into the config folder; the library is read and never changed, so nothing is committed.
 */
export async function runLibraryTemplateAdd(
  name: string,
  opts: LibraryTemplateAddOptions,
  io: LibraryIo & CheckIo,
): Promise<ExitCode> {
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const picked = pickVersion(io, opts.json, quiz, opts.version);
  if ("exit" in picked) return picked.exit;
  const short = shortHash(
    picked.hash,
    quiz.versions.map((v) => v.hash),
  );
  const loaded = loadStored(root, quiz, picked.hash);
  if (loaded === null || loaded.quiz === null)
    return libraryFail(io, opts.json, `version ${short} of ${quiz.name} cannot be read from the library`, {
      fix: "run `quiz library status` to see what is wrong",
    });
  return await runTemplateAdd(
    shownPath(loaded.file, io.cwd),
    { as: opts.as, skeleton: opts.skeleton, replace: opts.replace, json: opts.json },
    io,
    {
      profile: storedProfile(root, quiz, picked.hash),
      name: quiz.name,
      from: `${quiz.name} version ${short}`,
      quiz: quiz.name,
    },
  );
}
