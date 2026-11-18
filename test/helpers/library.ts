import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** The fixed time of the library tests: every commit, every `created`. */
export const NOW = "2026-11-18T14:22:10+00:00";

const dirs: string[] = [];

/** A fresh temporary folder, removed by `cleanTemps()` (call it from `afterEach`). */
export function tempDir(prefix = "fm-lib-"): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  dirs.push(dir);
  return dir;
}

export function cleanTemps(): void {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

/**
 * The environment a library test runs git and the CLI in (TECHNICAL_DESIGN.md, section 11): the owner's git config
 * never leaks in (`GIT_CONFIG_GLOBAL` is a file the test writes, `GIT_CONFIG_NOSYSTEM=1`), the dates are fixed, and
 * `FULLMARK_CONFIG` points at a file inside `dir`. `identity: false` leaves git without a user.
 */
export function libraryEnv(dir: string, options: { identity?: boolean } = {}): Record<string, string> {
  const gitconfig = join(dir, "gitconfig");
  writeFileSync(
    gitconfig,
    `[init]\n\tdefaultBranch = main\n${options.identity === false ? "" : "[user]\n\tname = Minh Tran\n\temail = minh@example.com\n"}`,
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("FULLMARK_") && !k.startsWith("GIT_") && k !== "NO_COLOR") env[k] = v;
  }
  return {
    ...env,
    NO_COLOR: "1",
    HOME: join(dir, "no-home"),
    GIT_CONFIG_GLOBAL: gitconfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_DATE: NOW,
    GIT_COMMITTER_DATE: NOW,
    FULLMARK_CONFIG: join(dir, "config.toml"),
    FULLMARK_TEST_NOW: NOW,
    TZ: "UTC",
  };
}

export type Ran = { stdout: string; stderr: string; exit: number };

/** Runs the built CLI (`dist/cli.js`) as a subprocess. */
export function quizCli(args: string[], cwd: string, env: Record<string, string>): Promise<Ran> {
  const cli = resolve(import.meta.dirname, "..", "..", "dist", "cli.js");
  return new Promise((done, fail) => {
    const child = execFile(
      process.execPath,
      [cli, ...args],
      { cwd, env, encoding: "utf8" },
      (error, stdout, stderr) => {
        const code = (error as { code?: unknown } | null)?.code;
        if (error && typeof code !== "number") fail(error);
        else done({ stdout, stderr, exit: error ? (code as number) : 0 });
      },
    );
    child.stdin?.end();
  });
}

/** Runs real git in `cwd` with the same environment; throws when it fails. */
export function git(cwd: string, env: Record<string, string>, ...args: string[]): Promise<string> {
  return new Promise((done, fail) => {
    execFile("git", args, { cwd, env, encoding: "utf8" }, (error, stdout, stderr) =>
      error ? fail(new Error(`git ${args.join(" ")}: ${stderr}`)) : done(stdout),
    );
  });
}

export function writeTree(dir: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}
