import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

/** What running `git` gave: `missing` when there is no such program (as opposed to git failing). */
export type GitResult = { code: number; stdout: string; stderr: string; missing?: true };
export type GitExec = (bin: string, args: string[], env: Record<string, string | undefined>) => Promise<GitResult>;

/** `execFile` of the real thing, never through a shell. A program that cannot be started is `missing`. */
export const realGitExec: GitExec = (bin, args, env) =>
  new Promise((done) => {
    execFile(
      bin,
      args,
      { env: env as NodeJS.ProcessEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) return done({ code: 0, stdout, stderr });
        const code = (error as { code?: unknown }).code;
        if (typeof code === "number") return done({ code, stdout, stderr });
        if (code === "ENOENT" || code === "EACCES") return done({ code: -1, stdout: "", stderr: "", missing: true });
        done({ code: -1, stdout, stderr: stderr || error.message });
      },
    );
  });

/** The identity commits are made as when git has none of its own (COMMANDS.md, "Git"). */
export const FALLBACK_IDENTITY = { name: "fullmark", email: "fullmark@localhost" } as const;

export type CommitResult =
  | { status: "committed"; hash: string; fallbackIdentity: boolean }
  | { status: "nothing" }
  | { status: "no-repository" }
  | { status: "failed"; message: string };

/**
 * The one small runner every library command runs git through (STEP4-GAPS.md, G3). The library's root is always the
 * repository (`git -C ROOT`); names go after `--`. `exec` is injected so that the failures (no git, a commit that
 * fails) are tested without breaking a machine. fullmark never pushes, pulls, fetches, branches or rewrites history.
 */
export class Git {
  constructor(
    readonly root: string,
    private readonly options: {
      /** the `git` of `config.toml`, else the one on the path */
      bin?: string | null;
      exec?: GitExec;
      env?: Record<string, string | undefined>;
    } = {},
  ) {}

  private run(args: string[], config: string[] = []): Promise<GitResult> {
    const exec = this.options.exec ?? realGitExec;
    return exec(this.options.bin ?? "git", ["-C", this.root, ...config, ...args], this.options.env ?? process.env);
  }

  /** Whether `git` can be run at all. */
  async available(): Promise<boolean> {
    const r = await (this.options.exec ?? realGitExec)(
      this.options.bin ?? "git",
      ["--version"],
      this.options.env ?? process.env,
    );
    return !r.missing && r.code === 0;
  }

  /** Whether the root holds its own repository: the library is the repository's root, never inside another. */
  hasRepository(): boolean {
    return existsSync(join(this.root, ".git"));
  }

  /** The top of the repository that contains the root, when it is not the root's own (`init` notes it). */
  async outerRepository(): Promise<string | null> {
    const r = await this.run(["rev-parse", "--show-toplevel"]);
    if (r.code !== 0) return null;
    const top = r.stdout.trim();
    if (top === "") return null;
    const same = (a: string, b: string): boolean => {
      try {
        return realpathSync(a) === realpathSync(b);
      } catch {
        return a === b;
      }
    };
    return same(top, this.root) ? null : top;
  }

  async init(): Promise<{ ok: true } | { ok: false; message: string }> {
    const r = await this.run(["init", "-q"]);
    return r.code === 0 ? { ok: true } : { ok: false, message: firstLine(r.stderr) || "git init failed" };
  }

  private async setting(key: string): Promise<string | null> {
    const r = await this.run(["config", "--get", key]);
    const value = r.stdout.trim();
    return r.code === 0 && value !== "" ? value : null;
  }

  /** The identity git itself has for this repository, or null when `user.name` or `user.email` is unset. */
  async identity(): Promise<{ name: string; email: string } | null> {
    const [name, email] = [await this.setting("user.name"), await this.setting("user.email")];
    return name !== null && email !== null ? { name, email } : null;
  }

  /** The paths with changes not committed (staged, unstaged or untracked), relative to the root, with `/`. */
  async uncommitted(): Promise<string[]> {
    const r = await this.run(["status", "--porcelain", "-z", "--untracked-files=all"]);
    if (r.code !== 0) return [];
    const entries = r.stdout.split("\0").filter((e) => e !== "");
    const paths: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i] as string;
      paths.push(entry.slice(3));
      // a rename or a copy is followed by its original path
      if (entry[0] === "R" || entry[0] === "C" || entry[1] === "R" || entry[1] === "C") i++;
    }
    return paths;
  }

  /** The name of the first remote, or null when there is none. */
  async remote(): Promise<string | null> {
    const r = await this.run(["remote"]);
    return r.code === 0 ? r.stdout.split("\n")[0]?.trim() || null : null;
  }

  /**
   * Commits only `paths` (new, changed or deleted): `git add -A -- PATHS`, then `git commit -m MESSAGE -- PATHS`, so the
   * user's own staged and unstaged changes stay out. With no `user.name` or `user.email` in the repository, that one
   * command gets the fallback identity; git's config is never written. A failure is a result, not a throw: the caller
   * prints a warning and the files stay written.
   */
  async commit(paths: readonly string[], message: string): Promise<CommitResult> {
    if (!this.hasRepository()) return { status: "no-repository" };
    const add = await this.run(["add", "-A", "--", ...paths]);
    if (add.code !== 0) return { status: "failed", message: firstLine(add.stderr) || "git add failed" };
    const staged = await this.run(["diff", "--cached", "--quiet", "--", ...paths]);
    if (staged.code === 0) return { status: "nothing" };
    const fallbackIdentity = (await this.identity()) === null;
    const config = fallbackIdentity
      ? ["-c", `user.name=${FALLBACK_IDENTITY.name}`, "-c", `user.email=${FALLBACK_IDENTITY.email}`]
      : [];
    const commit = await this.run(["commit", "-q", "-m", message, "--", ...paths], config);
    if (commit.code !== 0)
      return { status: "failed", message: firstLine(commit.stderr) || firstLine(commit.stdout) || "git commit failed" };
    const head = await this.run(["rev-parse", "--short", "HEAD"]);
    return { status: "committed", hash: head.stdout.trim(), fallbackIdentity };
  }
}

const firstLine = (text: string): string =>
  text
    .split("\n")
    .find((l) => l.trim() !== "")
    ?.trim() ?? "";
