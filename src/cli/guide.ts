import type { ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { printPackageFile } from "./package-file";

export type GuideOptions = {
  /** `guide` only: `en` or `vi` */
  lang?: string;
  /** accepted and ignored in the first form: the Markdown is always printed as it is (COMMANDS.md, `quiz guide`) */
  plain: boolean;
  noPager: boolean;
};

/**
 * `quiz guide` (COMMANDS.md, "First form"): the authoring reference. Only the English guide is written; `--lang vi`
 * prints it with one line on stderr and exits 0.
 */
export function runGuide(opts: GuideOptions, io: Io): ExitCode {
  if (opts.lang === "vi") io.err("the Vietnamese guide is not written yet: printing the English guide");
  return printPackageFile("guide/GUIDE.md", io);
}

/** `quiz agent-guide`: the instructions for AI agents, `AGENTS.md`, in English only. */
export function runAgentGuide(_opts: GuideOptions, io: Io): ExitCode {
  return printPackageFile("AGENTS.md", io);
}
