import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, type ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { readFailure } from "./paths";

/** The package's folder: the nearest one above this module with a `package.json` (`dist/` when installed, `src/cli/` in the repository). */
function packageRoot(from: string = dirname(fileURLToPath(import.meta.url))): string {
  let dir = from;
  while (!existsSync(join(dir, "package.json"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("the package's folder was not found");
    dir = up;
  }
  return dir;
}

/** Prints one of the package's own files as it is, byte for byte: the guides and the shells' completion scripts. */
export function printPackageFile(relative: string, io: Io): ExitCode {
  let text: string;
  try {
    text = readFileSync(join(packageRoot(), relative), "utf8");
  } catch (error) {
    io.err(`cannot read ${relative}: ${readFailure(error)}`);
    return EXIT.usage;
  }
  if (io.outRaw) io.outRaw(text);
  else io.out(text.replace(/\n$/, ""));
  return EXIT.done;
}
