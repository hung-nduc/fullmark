import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ResolvedProfile } from "../core/config/resolve";
import type { ConfigError } from "../core/config/types";
import { suggest } from "../core/parse/report";
import { CHECK_FILE, readCheck } from "../library/check-file";
import { Git, type GitExec } from "../library/git";
import { type IndexQuiz, type IndexRead, type LibraryIndex, readIndex } from "../library/index-file";
import { INDEX_FILE, libraryPaths } from "../library/layout";
import type { LockEnv } from "../library/lock";
import { realLockEnv } from "../library/lock";
import { loadUserConfig, type Machine, realMachine } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import type { Io } from "./ids";
import { type LoadedQuiz, loadQuiz } from "./load";
import { shownPath } from "./paths";
import { painter } from "./table";

/** An `Io` plus what the library commands read from the machine and the world; every part defaults to the real one. */
export type LibraryIo = Io & {
  machine?: Machine;
  lock?: LockEnv;
  gitExec?: GitExec;
  /** the atomic writer of `library.toml` and the files beside it; tests pass one that dies mid-way */
  atomic?: (file: string, data: Uint8Array) => Promise<void>;
};

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

/** The library a command works on, found and read: or the failure already reported (exit 2). */
export function openLibrary(
  io: LibraryIo,
  json: boolean,
): { located: Located; index: LibraryIndex } | { exit: ExitCode } {
  const found = locate(io, json);
  if ("exit" in found) return found;
  const { root } = found.located;
  const opened = openIndex(root);
  const refused = refusal(root, opened, machineOf(io).cwd);
  if (refused) return { exit: libraryFail(io, json, refused.message, { fix: refused.fix }) };
  if (opened.kind !== "read" || !opened.read.ok) return { exit: EXIT.usage };
  return { located: found.located, index: opened.read.index };
}

/** A quiz by its name, then by its id (COMMANDS.md, "Names, ids and stamps"). */
export const findQuiz = (index: LibraryIndex, name: string): IndexQuiz | undefined =>
  index.quizzes.find((q) => q.name === name) ?? index.quizzes.find((q) => q.id === name);

/** `error: no quiz named NAME`, with the nearest names (exit 2). */
export function noSuchQuiz(io: LibraryIo, json: boolean, index: LibraryIndex, name: string): ExitCode {
  const names = index.quizzes.flatMap((q) => (q.name === q.id ? [q.name] : [q.name, q.id]));
  const near = suggest(name, names);
  const hint =
    near !== null && near !== undefined
      ? `    did you mean: ${near}`
      : names.length > 0
        ? `    the quizzes are: ${index.quizzes.map((q) => q.name).join(", ")}`
        : "    the library has no quizzes yet: quiz library register FILE";
  if (json) io.out(JSON.stringify({ status: "error", message: `no quiz named ${name}`, fix: hint.trim() }));
  io.err(`error: no quiz named ${name}`);
  io.err(hint);
  return EXIT.usage;
}

/**
 * A stored version, loaded from its folder by the file name the index records for it (step 4, G22), never by
 * searching. Null when the version is not the quiz's, or its folder or source is missing or unreadable.
 */
export function loadStored(root: string, quiz: IndexQuiz, hash: string): LoadedQuiz | null {
  const version = quiz.versions.find((v) => v.hash === hash);
  if (version === undefined) return null;
  try {
    return loadQuiz(join(libraryPaths(root).quiz(quiz.id).version(hash), version.file));
  } catch {
    return null;
  }
}

/**
 * The rules a version was registered with: its `check.json`, read back. Null when the file is missing or unreadable, and
 * the caller then checks under the config as `check` would.
 */
export function storedProfile(root: string, quiz: IndexQuiz, hash: string): ResolvedProfile | null {
  try {
    const read = readCheck(readFileSync(join(libraryPaths(root).quiz(quiz.id).version(hash), CHECK_FILE), "utf8"));
    return read.ok ? read.profile : null;
  } catch {
    return null;
  }
}
