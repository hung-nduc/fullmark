import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, type ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { readFailure } from "./paths";

export type GuideOptions = {
  /** `guide` only: `en` or `vi` */
  lang?: string;
  /** accepted and ignored in the first form: the Markdown is always printed as it is (COMMANDS.md, `quiz guide`) */
  plain: boolean;
  noPager: boolean;
};

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

/** Prints one of the package's Markdown files as it is, byte for byte. */
function printFile(relative: string, io: Io): ExitCode {
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

/**
 * `quiz guide` (COMMANDS.md, "First form"): the authoring reference. Only the English guide is written; `--lang vi`
 * prints it with one line on stderr and exits 0.
 */
export function runGuide(opts: GuideOptions, io: Io): ExitCode {
  if (opts.lang === "vi") io.err("the Vietnamese guide is not written yet: printing the English guide");
  return printFile("guide/GUIDE.md", io);
}

/** `quiz agent-guide`: the instructions for AI agents, `AGENTS.md`, in English only. */
export function runAgentGuide(_opts: GuideOptions, io: Io): ExitCode {
  return printFile("AGENTS.md", io);
}
