import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The system's opener (COMMANDS.md, `--open`): `start` through `cmd` on Windows, `open` on macOS, else `xdg-open`. */
export function systemOpen(path: string): Promise<void> {
  const [command, args]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", '""', `"${path}"`]]
      : process.platform === "darwin"
        ? ["open", [path]]
        : ["xdg-open", [path]];
  return new Promise((done, fail) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsVerbatimArguments: true });
    child.once("error", fail);
    child.once("spawn", () => {
      child.unref();
      done();
    });
  });
}

/** `dist/`: `page.js` and `page.css` sit beside `cli.js`. Run from the sources (tests), they are in `<repo>/dist`. */
export function runtimeFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return existsSync(join(here, "page.js")) ? here : resolve(here, "..", "..", "dist");
}
