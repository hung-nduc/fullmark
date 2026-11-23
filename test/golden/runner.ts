import { execFile, execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Golden-file contract tests (TECHNICAL_DESIGN.md, section 11). A case is a folder `test/golden/<command>/<case>/`:
 *
 * - `cmd.txt`      the arguments, one per line, paths relative to the working directory
 * - `input/`       files copied into the working directory (optional)
 * - `input-extra/` files copied over `input/` (optional): what a fixture cannot keep in git, such as a lock file that
 *                  the fixture's own `.gitignore` ignores
 * - `copy.txt`     `repo/path => dest` lines: a file or folder of the repository copied in (optional)
 * - `env.txt`      `KEY=VALUE` lines added to the environment; `<dir>` is the working directory (optional)
 * - `pre.txt`      commands run first, one per line, its arguments split at spaces (optional): `library publish` builds
 *                  a shelf with the current build, so a case that needs a shelf never reads another case's output.
 *                  Leading `KEY=VALUE` words are added to that command's environment (`<dir>` as in `env.txt`). They run after `copy.txt` and `env.txt`, in the case's working directory with its environment, and
 *                  must exit 0. Their output is not recorded, and what they write is part of the case's starting state,
 *                  so it is not in `files/`
 * - `git.txt`      folders (relative to the working directory) made a git repository with one commit of everything in
 *                  them before the command runs, with the dates of `env.txt`, so a command that commits has a repository
 *                  to commit to and its hashes are reproducible (optional)
 * - `stdout.txt`, `stderr.txt`, `exit.txt`    the expected output
 * - `files/`       every file the command wrote or changed, by its path in the working directory
 *
 * The command is `node dist/cli.js` run as a subprocess in a temporary copy of the inputs. The only normalisation
 * is the temporary folder's path (`<dir>`) and, in paths below it, Windows backslashes (`/`).
 */

export const ROOT = resolve(import.meta.dirname, "..", "..");
export const GOLDEN = join(ROOT, "test", "golden");

export type Run = { stdout: string; stderr: string; exit: number; files: Map<string, Buffer> };

export type Case = { name: string; dir: string };

export function findCases(): Case[] {
  const cases: Case[] = [];
  for (const command of readdirSync(GOLDEN).sort()) {
    const folder = join(GOLDEN, command);
    if (!statSync(folder).isDirectory()) continue;
    for (const name of readdirSync(folder).sort()) {
      const dir = join(folder, name);
      if (existsSync(join(dir, "cmd.txt"))) cases.push({ name: `${command}/${name}`, dir });
    }
  }
  return cases;
}

const lines = (path: string): string[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((l) => l !== "")
    : [];

/** Replaces the temporary folder's path with `<dir>` (raw, JSON-escaped and with `/`), and `\` with `/` below it. */
export function normalise(text: string, tmp: string, slashes = true): string {
  const forms = [tmp, tmp.replaceAll("\\", "\\\\"), tmp.replaceAll("\\", "/")];
  let out = text;
  for (const f of new Set(forms)) out = out.split(f).join("<dir>");
  if (!slashes) return out;
  return out.replace(
    /<dir>([^\s"'`<>,;()]*)/g,
    (_m, tail: string) => `<dir>${tail.replaceAll("\\\\", "/").replaceAll("\\", "/")}`,
  );
}

function walk(dir: string, base = dir, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, base, out);
    else out.push(relative(base, path).split("\\").join("/"));
  }
  return out.sort();
}

function snapshot(dir: string): Map<string, Buffer> {
  return new Map(walk(dir).map((rel) => [rel, readFileSync(join(dir, rel))]));
}

/** `node dist/cli.js ARGS` in `cwd`: its output and exit code, whatever the code. */
function runNode(
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exit: number }> {
  return new Promise((done, fail) => {
    const child = execFile(
      process.execPath,
      [join(ROOT, "dist", "cli.js"), ...args],
      { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = (error as { code?: unknown } | null)?.code;
        if (error && typeof code !== "number") fail(error);
        else done({ stdout, stderr, exit: error ? (code as number) : 0 });
      },
    );
    child.stdin?.end();
  });
}

/** Runs a case once in a fresh temporary folder. */
export async function runCase(c: Case): Promise<Run> {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "fm-golden-")));
  try {
    if (existsSync(join(c.dir, "input"))) cpSync(join(c.dir, "input"), tmp, { recursive: true });
    if (existsSync(join(c.dir, "input-extra"))) cpSync(join(c.dir, "input-extra"), tmp, { recursive: true });
    for (const l of lines(join(c.dir, "copy.txt"))) {
      const [from, to] = l.split(" => ");
      if (!from || !to) throw new Error(`${c.name}: bad copy.txt line: ${l}`);
      mkdirSync(dirname(join(tmp, to)), { recursive: true });
      cpSync(join(ROOT, from), join(tmp, to), { recursive: true });
    }
    // a `.git` folder stops the search for fullmark.toml here, so nothing above the case is ever read
    mkdirSync(join(tmp, ".git"), { recursive: true });

    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && !k.startsWith("FULLMARK_") && k !== "NO_COLOR") env[k] = v;
    }
    env.NO_COLOR = "1";
    // the user's own config is never read: the places it would be found point into the case, where nothing is
    const home = join(tmp, "no-home");
    for (const k of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"]) env[k] = home;
    // Windows keeps the user config in %APPDATA%\fullmark; the cases hold it at no-home/.config/fullmark, as Linux does
    env.APPDATA = join(home, ".config");
    if (existsSync(join(tmp, "user-config.toml"))) env.FULLMARK_CONFIG = join(tmp, "user-config.toml");
    for (const l of lines(join(c.dir, "env.txt"))) {
      const i = l.indexOf("=");
      env[l.slice(0, i)] = l.slice(i + 1).replaceAll("<dir>", tmp);
    }

    // `pre.txt`: commands that make the starting state (a shelf built by the current build), run before the snapshot
    for (const l of lines(join(c.dir, "pre.txt"))) {
      const words = l.split(" ");
      const own: Record<string, string> = {};
      while (/^[A-Z_]+=/.test(words[0] ?? "")) {
        const word = (words.shift() as string).replaceAll("<dir>", tmp);
        own[word.slice(0, word.indexOf("="))] = word.slice(word.indexOf("=") + 1);
      }
      const pre = await runNode(words, tmp, { ...env, ...own });
      if (pre.exit !== 0) throw new Error(`${c.name}: pre.txt "${l}" exited ${pre.exit}: ${pre.stderr}${pre.stdout}`);
    }

    // `git.txt`: the repositories the command commits to, made before the snapshot (`.git` is not part of it)
    for (const folder of lines(join(c.dir, "git.txt"))) {
      const cwd = join(tmp, folder);
      for (const args of [
        ["init", "-q"],
        ["add", "-A"],
        ["-c", "user.name=fullmark", "-c", "user.email=fullmark@localhost", "commit", "-q", "-m", "fullmark: init"],
      ])
        execFileSync("git", args, { cwd, env, stdio: "ignore" });
    }
    const before = snapshot(tmp);

    const args = lines(join(c.dir, "cmd.txt"));
    const result = await runNode(args, tmp, env);

    const after = snapshot(tmp);
    const files = new Map<string, Buffer>();
    for (const [rel, bytes] of after) {
      const was = before.get(rel);
      if (was === undefined || !was.equals(bytes)) {
        files.set(rel, Buffer.from(normalise(bytes.toString("utf8"), tmp, false), "utf8"));
      }
    }
    return {
      stdout: normalise(result.stdout, tmp),
      stderr: normalise(result.stderr, tmp),
      exit: result.exit,
      files,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

export function readExpected(c: Case): Run {
  const text = (name: string) => (existsSync(join(c.dir, name)) ? readFileSync(join(c.dir, name), "utf8") : null);
  const files = new Map<string, Buffer>();
  const root = join(c.dir, "files");
  if (existsSync(root)) for (const rel of walk(root)) files.set(rel, readFileSync(join(root, rel)));
  return {
    stdout: text("stdout.txt") ?? "<missing>",
    stderr: text("stderr.txt") ?? "<missing>",
    exit: Number((text("exit.txt") ?? "-1").trim()),
    files,
  };
}

export function writeExpected(c: Case, run: Run): void {
  writeFileSync(join(c.dir, "stdout.txt"), run.stdout);
  writeFileSync(join(c.dir, "stderr.txt"), run.stderr);
  writeFileSync(join(c.dir, "exit.txt"), `${run.exit}\n`);
  rmSync(join(c.dir, "files"), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const [rel, bytes] of run.files) {
    mkdirSync(dirname(join(c.dir, "files", rel)), { recursive: true });
    writeFileSync(join(c.dir, "files", rel), bytes);
  }
}

/** A run as a comparable object (files as text, with their names). */
export function view(run: Run): unknown {
  return {
    exit: run.exit,
    stdout: run.stdout,
    stderr: run.stderr,
    files: Object.fromEntries([...run.files].map(([k, v]) => [k, v.toString("utf8")])),
  };
}
