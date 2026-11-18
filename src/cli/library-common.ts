import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigError } from "../core/config/types";
import { Git, type GitExec } from "../library/git";
import { type IndexRead, readIndex } from "../library/index-file";
import { INDEX_FILE } from "../library/layout";
import type { LockEnv } from "../library/lock";
import { realLockEnv } from "../library/lock";
import { loadUserConfig, type Machine, realMachine } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { shownPath } from "./paths";
import { painter } from "./table";

/** An `Io` plus what the library commands read from the machine and the world; every part defaults to the real one. */
export type LibraryIo = Io & { machine?: Machine; lock?: LockEnv; gitExec?: GitExec };

export const machineOf = (io: LibraryIo): Machine => io.machine ?? { ...realMachine(), cwd: io.cwd };
export const lockEnvOf = (io: LibraryIo): LockEnv => io.lock ?? realLockEnv();
export const nowOf = (io: LibraryIo): Date => (io.now ?? (() => new Date()))();

/** Colour only on a terminal, without `--plain`, `--json` or `NO_COLOR` (COMMANDS.md, "Terminal style"). */
export const painterFor = (io: LibraryIo, opts: { plain: boolean; json: boolean }) =>
  painter(!opts.plain && !opts.json && io.tty && !("NO_COLOR" in machineOf(io).env));

/**
 * A run error: `error: MESSAGE` on stderr, then `    fix: FIX`, and with `--json` `{"status": "error", "message"}` on
 * stdout (with `"fix"` and `"errors"` when there are any). Always exit 2.
 */
export function libraryFail(
  io: LibraryIo,
  json: boolean,
  message: string,
  extra: { fix?: string; errors?: ConfigError[]; details?: string[] } = {},
): ExitCode {
  if (json) {
    io.out(
      JSON.stringify({
        status: "error",
        message,
        ...(extra.fix ? { fix: extra.fix } : {}),
        ...(extra.errors ? { errors: extra.errors } : {}),
      }),
    );
  }
  io.err(`error: ${message}`);
  if (extra.fix) io.err(`    fix: ${extra.fix}`);
  for (const d of extra.details ?? []) io.err(d);
  return EXIT.usage;
}

/** `file:line: message` and `    fix:` lines for a malformed `config.toml`, as `check` prints them. */
export function configErrorLines(errors: readonly ConfigError[]): string[] {
  return errors.flatMap((e) => [`${e.file}:${e.line}: ${e.message}`, ...(e.fix ? [`    fix: ${e.fix}`] : [])]);
}

export function configFail(io: LibraryIo, json: boolean, errors: ConfigError[]): ExitCode {
  return libraryFail(io, json, "the config has errors", { errors, details: configErrorLines(errors) });
}

export const NO_LIBRARY = "no library: run `quiz library init PATH`";

/** Where the library is, and everything about the machine the library commands need. */
export type Located = {
  root: string;
  /** `FULLMARK_LIBRARY`, or `library` in `config.toml` */
  from: "FULLMARK_LIBRARY" | "config";
  configPath: string;
  /** the library the config names, resolved, or null */
  configLibrary: string | null;
  gitBin: string | null;
  git: Git;
};

/**
 * Finds the library (G8): `FULLMARK_LIBRARY` (relative to the working directory), else `library` in `config.toml`
 * (relative to the config file's folder), else none. `null` with the failure already reported (exit 2) otherwise.
 */
export function locate(io: LibraryIo, json: boolean): { located: Located } | { exit: ExitCode } {
  const machine = machineOf(io);
  const config = loadUserConfig(machine);
  if (config.errors.length > 0) return { exit: configFail(io, json, config.errors) };
  const configDir = resolve(config.path, "..");
  const configLibrary = config.data?.library ? resolve(configDir, config.data.library) : null;
  const fromEnv = machine.env.FULLMARK_LIBRARY;
  const root = fromEnv ? resolve(machine.cwd, fromEnv) : configLibrary;
  const gitBin = config.data?.git ?? null;
  if (root === null) return { exit: libraryFail(io, json, NO_LIBRARY) };
  return {
    located: {
      root,
      from: fromEnv ? "FULLMARK_LIBRARY" : "config",
      configPath: config.path,
      configLibrary,
      gitBin,
      git: gitFor(io, root, gitBin),
    },
  };
}

export const gitFor = (io: LibraryIo, root: string, bin: string | null): Git =>
  new Git(root, { bin, ...(io.gitExec ? { exec: io.gitExec } : {}), env: machineOf(io).env });

/** What `library.toml` of a folder is: no folder, no file, or the read of its text. */
export type Opened =
  | { kind: "no-folder" }
  | { kind: "no-index" }
  | { kind: "unreadable"; message: string }
  | { kind: "read"; read: IndexRead };

export function openIndex(root: string): Opened {
  try {
    if (!statSync(root).isDirectory()) return { kind: "no-folder" };
  } catch {
    return { kind: "no-folder" };
  }
  const file = `${root}/${INDEX_FILE}`;
  if (!existsSync(file)) return { kind: "no-index" };
  try {
    return { kind: "read", read: readIndex(readFileSync(file, "utf8")) };
  } catch (error) {
    return { kind: "unreadable", message: (error as Error).message };
  }
}

/** Why a folder is refused as a library, for the commands that exit 2 (`init`, `path`): message and fix. */
export function refusal(root: string, opened: Opened, cwd: string): { message: string; fix: string } | null {
  const shown = shownPath(root, cwd);
  if (opened.kind === "no-folder")
    return { message: `${shown} does not exist`, fix: `run: quiz library init ${shown}` };
  if (opened.kind === "no-index")
    return {
      message: `${shown} is not a library: it has no library.toml`,
      fix: "name the library's folder, or make one: quiz library init PATH",
    };
  if (opened.kind === "unreadable")
    return { message: `cannot read library.toml: ${opened.message}`, fix: "check the file" };
  if (opened.read.ok) return null;
  const first = opened.read.problems[0];
  return {
    message: `${shown}/${INDEX_FILE}:${first?.line ?? 1}: ${first?.message ?? "library.toml has problems"}`,
    fix: first?.fix ?? "fix library.toml at that line",
  };
}
