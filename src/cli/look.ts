import { loadUserConfig, type Machine, realMachine } from "./config";
import type { Io } from "./ids";
import { type Painter, painter } from "./table";

/** What a command's output needs to be drawn: an `Io` with the machine and the terminal's width, which tests inject. */
export type LookIo = Io & { machine?: Machine };

/**
 * The painter of a command's human output (COMMANDS.md, "Terminal style"): colour only on a terminal, without `--plain`,
 * `--json` or `NO_COLOR`; and the layout of `[terminal] style` in the machine's `config.toml` (`simple` unless it says
 * `boxed`), only where colour is on, so that what a program reads never changes with the setting. A malformed config is
 * reported by the commands that need it, not here: it draws as `simple`.
 */
export function terminalPainter(io: LookIo, opts: { plain: boolean; json: boolean }): Painter {
  const machine = io.machine ?? { ...realMachine(), cwd: io.cwd };
  const color = !opts.plain && !opts.json && io.tty && !("NO_COLOR" in machine.env);
  const style = color ? (loadUserConfig(machine).data?.terminalStyle ?? "simple") : "simple";
  return painter(color, { style, width: io.columns ?? null });
}
