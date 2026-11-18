import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FALLBACK_IDENTITY } from "../library/git";
import { emptyIndex, writeIndex } from "../library/index-file";
import { GITIGNORE_FILE, GITIGNORE_TEXT, INDEX_FILE, QUIZZES_DIR } from "../library/layout";
import { LockBusy, withLock } from "../library/lock";
import { writeFileAtomic } from "./atomic";
import { loadUserConfig } from "./config";
import { recordLibrary } from "./config-write";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  configFail,
  gitFor,
  type LibraryIo,
  libraryFail,
  lockEnvOf,
  machineOf,
  nowOf,
  openIndex,
  painterFor,
  refusal,
} from "./library-common";
import { shownPath } from "./paths";
import { localIso } from "./time";

export type LibraryInitOptions = { force: boolean; noGit: boolean; json: boolean; plain: boolean };

/** Files under a folder, `.git` left out, counted for "N files". */
function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

type FolderKind = "new" | "empty" | "repository" | "library";

/**
 * `quiz library init [PATH] [--force] [--no-git] [--json]` (COMMANDS.md). A missing, empty or `.git`-only folder is set
 * up; a 1.0 library is adopted; anything else is refused. Records the library in `config.toml` (absolute path).
 */
export async function runLibraryInit(
  pathArg: string | null,
  opts: LibraryInitOptions,
  io: LibraryIo,
): Promise<ExitCode> {
  const machine = machineOf(io);
  const target = resolve(machine.cwd, pathArg ?? ".");
  const shown = shownPath(target, machine.cwd);
  const fail = (message: string, fix: string): ExitCode => libraryFail(io, opts.json, message, { fix });

  const config = loadUserConfig(machine);
  if (config.errors.length > 0) return configFail(io, opts.json, config.errors);
  const already = config.data?.library ? resolve(resolve(config.path, ".."), config.data.library) : null;
  if (already !== null && already !== target && !opts.force)
    return fail(`a library is already set: ${shownPath(already, machine.cwd)}`, "add --force to switch");

  // what the folder is
  let kind: FolderKind;
  let stat: ReturnType<typeof statSync> | null = null;
  try {
    stat = statSync(target);
  } catch {
    stat = null;
  }
  if (stat === null) kind = "new";
  else if (!stat.isDirectory()) return fail(`${shown} is a file, not a folder`, "choose an empty or new folder");
  else {
    const entries = readdirSync(target);
    if (entries.includes(INDEX_FILE)) {
      const refused = refusal(target, openIndex(target), machine.cwd);
      if (refused) return fail(refused.message, refused.fix);
      kind = "library";
    } else if (entries.length === 0) kind = "empty";
    else if (entries.length === 1 && entries[0] === ".git") kind = "repository";
    else {
      const n = countFiles(target);
      return fail(
        `${shown} is not empty and is not a library (${n} file${n === 1 ? "" : "s"})`,
        "choose an empty or new folder",
      );
    }
  }

  const p = painterFor(io, opts);
  const git = gitFor(io, target, config.data?.git ?? null);
  /** warnings and notes made while setting up, in order */
  const found: string[] = [];
  const stale: string[] = [];
  let committed: string | null = null;
  let repository = existsSync(join(target, ".git"));

  const setUp = async (): Promise<void> => {
    await writeIndex(join(target, INDEX_FILE), emptyIndex(localIso(nowOf(io))), writeFileAtomic);
    await writeFileAtomic(join(target, GITIGNORE_FILE), new TextEncoder().encode(GITIGNORE_TEXT));
    await mkdir(join(target, QUIZZES_DIR), { recursive: true });
    if (opts.noGit) return;
    if (!(await git.available())) {
      found.push(`${p.yellow("warning")} git was not found: the library has no repository (rm will need --force)`);
      return;
    }
    if (kind !== "repository") {
      const outer = await git.outerRepository();
      const made = await git.init();
      if (!made.ok) {
        found.push(`${p.yellow("warning")} git init failed (${made.message}): the library has no repository`);
        return;
      }
      repository = true;
      if (outer !== null)
        found.push(
          `${p.cyan("note")} ${shown} is inside the repository at ${shownPath(outer, machine.cwd)} and has its own: add it to that repository's .gitignore`,
        );
    }
    const result = await git.commit([INDEX_FILE, GITIGNORE_FILE], "fullmark: init");
    if (result.status === "committed") committed = result.hash;
    else if (result.status === "failed")
      found.push(`${p.yellow("warning")} the first commit failed: ${result.message}; the files are written`);
  };

  if (kind !== "library") {
    try {
      await mkdir(target, { recursive: true });
      await withLock(
        target,
        `quiz library init${pathArg ? ` ${pathArg}` : ""}`,
        lockEnvOf(io),
        {
          waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
          stale: (h) => stale.push(`${p.cyan("note")} removed a lock left by pid ${h.pid} (${h.command})`),
        },
        setUp,
      );
    } catch (error) {
      if (error instanceof LockBusy)
        return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
      throw error;
    }
  }

  await recordLibrary(config.path, target);

  // who commits: git's own identity, or the fallback
  const id = repository && !opts.noGit && (await git.available()) ? await git.identity() : null;
  const fallback = repository && !opts.noGit && id === null && (await git.available());
  const identity = id ? `${id.name} <${id.email}>` : null;

  if (opts.json) {
    io.out(
      JSON.stringify({
        status: kind === "library" ? "adopted" : "created",
        library: target,
        config: config.path,
        git: repository,
        identity,
        committed,
      }),
    );
  }
  const what =
    kind === "library"
      ? "existing library"
      : kind === "new"
        ? "new folder"
        : kind === "empty"
          ? "empty folder"
          : "existing repository";
  const lines = [
    ...stale,
    `${p.green("library ready")} ${shown} (${what}, ${repository ? "git repository" : "no git repository"})`,
    `recorded in ${shownPath(config.path, machine.cwd)}`,
    ...found,
  ];
  if (fallback) {
    lines.push(
      `${p.cyan("note")} git has no identity here: commits are made as ${FALLBACK_IDENTITY.name} <${FALLBACK_IDENTITY.email}>`,
      `    set one: git -C ${shown} config user.name "Your Name"`,
      `             git -C ${shown} config user.email you@example.com`,
    );
  }
  if (committed !== null) lines.push(p.dim(`committed ${committed} fullmark: init`));
  lines.push(p.dim("next: quiz library register FILE"));
  for (const line of lines) (opts.json ? io.err : io.out)(line);
  return EXIT.done;
}
