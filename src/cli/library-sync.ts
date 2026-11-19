import { EXIT, type ExitCode } from "./exit-codes";
import type { LibraryPublishOptions, PublishIo } from "./library-publish";

/** The sync of `quiz library publish [DIR]`: built in the next commits of slice 5a. */
export async function runLibrarySync(
  _target: string | null,
  opts: LibraryPublishOptions,
  io: PublishIo,
): Promise<ExitCode> {
  io.err("error: the shelf sync is not built yet");
  if (opts.json) io.out(JSON.stringify({ status: "error", message: "the shelf sync is not built yet" }));
  return EXIT.usage;
}
