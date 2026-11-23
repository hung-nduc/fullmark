import type { Shell } from "./choices";
import type { ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { printPackageFile } from "./package-file";

/** The file of each shell's script, in the package's `shell/` folder. */
const SCRIPTS: Record<Shell, string> = {
  powershell: "shell/quiz.ps1",
  bash: "shell/quiz.bash",
  zsh: "shell/quiz.zsh",
  fish: "shell/quiz.fish",
};

/** `quiz shell-init SHELL` (COMMANDS.md): the shell's completion script, printed as the package holds it. Changes nothing. */
export function runShellInit(shell: Shell, io: Io): ExitCode {
  return printPackageFile(SCRIPTS[shell], io);
}
