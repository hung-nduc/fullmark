import type { Option } from "commander";

/**
 * The fixed sets of values the flags take, in one place. Each set is declared on its option (`declared`), so `--help`
 * and Tab completion (`quiz __complete`) read the very list the command checks against.
 *
 * The check stays in the command, not in commander's `.choices()`: a bad value there is a usage error that `--json`
 * reports as JSON and that comes after the checks that precede it (a flag that needs `--print`), as COMMANDS.md says.
 * `.choices()` would print commander's own message at parse time and ignore both.
 */
export const UI_LANGS = ["en", "vi"] as const;
export const ANSWER_MODES = ["none", "key", "inline"] as const;
export const MATERIALS_CHOICES = ["none"] as const;

/** Declares `values` as the option's choices for the help and for completion, and leaves the checking to the command. */
export function declared(option: Option, values: readonly string[]): Option {
  option.argChoices = [...values];
  return option;
}

/** The shells `quiz shell-init` prints a completion script for; each script is the package's `shell/quiz.<ext>`. */
export const SHELLS = ["powershell", "bash", "zsh", "fish"] as const;
export type Shell = (typeof SHELLS)[number];
