import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Git, type GitExec } from "../../src/library/git";
import { gitHeavy } from "../helpers/git-timeout";
import { cleanTemps, git, libraryEnv, tempDir, writeTree } from "../helpers/library";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

afterEach(cleanTemps);

/** A library folder with a repository of its own and one commit, in a temp folder with the git environment of the tests. */
async function repo(options: { identity?: boolean } = {}) {
  const dir = tempDir();
  const env = libraryEnv(dir, options);
  const root = join(dir, "lib");
  writeTree(root, { "library.toml": "a\n", ".gitignore": "*.tmp\n" });
  const runner = new Git(root, { env });
  expect((await runner.init()).ok).toBe(true);
  expect((await runner.commit(["library.toml", ".gitignore"], "fullmark: init")).status).toBe("committed");
  return { dir, env, root, runner };
}

describe("the git runner, against real git", () => {
  it("makes a commit of the same hash on every run (fixed author, committer and dates)", async () => {
    const a = await repo();
    const b = await repo();
    const hash = async (r: typeof a) => (await git(r.root, r.env, "rev-parse", "HEAD")).trim();
    expect(await hash(a)).toBe(await hash(b));
    expect((await git(a.root, a.env, "log", "-1", "--format=%an <%ae> %s %ad")).trim()).toBe(
      "Minh Tran <minh@example.com> fullmark: init Wed Nov 18 14:22:10 2026 +0000",
    );
  });

  it("commits only the given paths: the user's own staged and unstaged changes stay out", async () => {
    const { root, env, runner } = await repo();
    writeTree(root, { "mine.txt": "staged by me\n", "quizzes/a/results/1.json": "{}\n" });
    await git(root, env, "add", "mine.txt");
    writeFileSync(join(root, "library.toml"), "changed by me, not committed\n");
    writeTree(root, { "quizzes/a/results/2.json": "{}\n" });
    const result = await runner.commit(["quizzes/a/results/1.json"], "fullmark: take a");
    expect(result).toMatchObject({ status: "committed", fallbackIdentity: false });
    expect((await git(root, env, "show", "--name-only", "--format=%s", "HEAD")).trim().split("\n")).toEqual([
      "fullmark: take a",
      "",
      "quizzes/a/results/1.json",
    ]);
    // my staged file is still staged, my edit still unstaged, the other result untracked
    expect(
      (await git(root, env, "status", "--porcelain", "--untracked-files=all")).trimEnd().split("\n").sort(),
    ).toEqual([" M library.toml", "?? quizzes/a/results/2.json", "A  mine.txt"]);
  });

  it("commits a deleted path, and says when there is nothing to commit", async () => {
    const { root, runner } = await repo();
    const { rmSync } = await import("node:fs");
    rmSync(join(root, ".gitignore"));
    expect((await runner.commit([".gitignore"], "fullmark: rm x")).status).toBe("committed");
    expect(await runner.uncommitted()).toEqual([]);
    expect(await runner.commit(["library.toml"], "fullmark: unchanged")).toEqual({ status: "nothing" });
  });

  it("passes the fallback identity to that one commit when git has none, and never writes git's config", async () => {
    const { root, env, runner } = await repo({ identity: false });
    expect(await runner.identity()).toBeNull();
    writeTree(root, { "b.txt": "b\n" });
    const result = await runner.commit(["b.txt"], "fullmark: take b");
    expect(result).toMatchObject({ status: "committed", fallbackIdentity: true });
    expect((await git(root, env, "log", "-1", "--format=%an <%ae>")).trim()).toBe("fullmark <fullmark@localhost>");
    expect(await runner.identity()).toBeNull();
    expect(existsSync(join(root, ".git", "config"))).toBe(true);
    expect(readFileSync(join(root, ".git", "config"), "utf8")).not.toMatch(/user|fullmark/);
    expect(readFileSync(env.GIT_CONFIG_GLOBAL as string, "utf8")).not.toMatch(/fullmark/);
  });

  it("uses git's own identity when there is one", async () => {
    const { root, runner } = await repo();
    expect(await runner.identity()).toEqual({ name: "Minh Tran", email: "minh@example.com" });
    writeTree(root, { "b.txt": "b\n" });
    expect(await runner.commit(["b.txt"], "m")).toMatchObject({ fallbackIdentity: false });
  });

  it("counts uncommitted paths one by one (untracked files too, a rename once), and finds the remote", async () => {
    const { root, env, runner } = await repo();
    expect(await runner.uncommitted()).toEqual([]);
    expect(await runner.remote()).toBeNull();
    writeTree(root, { "new dir/a b.txt": "x\n", "new dir/c.txt": "x\n" });
    writeFileSync(join(root, "library.toml"), "edited\n");
    await git(root, env, "mv", ".gitignore", "ignore.txt");
    expect((await runner.uncommitted()).sort()).toEqual([
      "ignore.txt",
      "library.toml",
      "new dir/a b.txt",
      "new dir/c.txt",
    ]);
    await git(root, env, "remote", "add", "origin", "https://example.invalid/x.git");
    await git(root, env, "remote", "add", "other", "https://example.invalid/y.git");
    expect(await runner.remote()).toBe("origin");
  });

  it("finds a repository that contains the library without being it", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    const outer = join(dir, "outer");
    writeTree(outer, { "x.txt": "x\n" });
    await git(outer, env, "init", "-q");
    const inner = join(outer, "lib");
    writeTree(inner, { "y.txt": "y\n" });
    const runner = new Git(inner, { env });
    expect(await runner.outerRepository()).toBe(outer.replaceAll("\\", "/")); // shown with `/` on Windows too (G1)
    expect(runner.hasRepository()).toBe(false);
    // no repository of its own: a commit never lands in the outer one
    expect(await runner.commit(["y.txt"], "m")).toEqual({ status: "no-repository" });
    expect(await new Git(outer, { env }).outerRepository()).toBeNull();
    await runner.init();
    expect(runner.hasRepository()).toBe(true);
    // with a repository of its own the library is a root, and nothing contains it
    expect(await runner.outerRepository()).toBeNull();
  });
});

describe("the git runner, with failures injected", () => {
  const exec =
    (handler: (args: string[]) => { code: number; stdout?: string; stderr?: string; missing?: true }): GitExec =>
    async (_bin, args) => {
      const r = handler(args.slice(2));
      return {
        code: r.code,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
        ...(r.missing ? { missing: true as const } : {}),
      };
    };

  it("reports no git on the path as unavailable", async () => {
    const runner = new Git(tempDir(), { exec: exec(() => ({ code: -1, missing: true })) });
    expect(await runner.available()).toBe(false);
    expect((await runner.init()).ok).toBe(false);
  });

  it("runs the git of config.toml, with -C ROOT and names after --", async () => {
    const dir = tempDir();
    writeTree(dir, { ".git/HEAD": "ref: refs/heads/main\n" });
    const seen: { bin: string; args: string[] }[] = [];
    const runner = new Git(dir, {
      bin: "/opt/git/bin/git",
      exec: async (bin, args) => {
        seen.push({ bin, args });
        // `diff --cached --quiet` finds changes; `config --get` finds no identity
        return { code: args.includes("--quiet") || args.includes("config") ? 1 : 0, stdout: "abc1234\n", stderr: "" };
      },
    });
    await runner.commit(["a b.txt", "-weird"], "fullmark: take x");
    expect(seen.every((s) => s.bin === "/opt/git/bin/git")).toBe(true);
    expect(seen.every((s) => s.args[0] === "-C" && s.args[1] === dir)).toBe(true);
    expect(seen[0]?.args.slice(2)).toEqual(["add", "-A", "--", "a b.txt", "-weird"]);
    const commit = seen.find((s) => s.args.includes("commit"));
    expect(commit?.args.slice(2)).toEqual(
      expect.arrayContaining(["-c", "user.name=fullmark", "-c", "user.email=fullmark@localhost"]),
    );
    expect(commit?.args.slice(-3)).toEqual(["--", "a b.txt", "-weird"]);
  });

  it("a commit that fails is a result with git's own first line, never a throw", async () => {
    const dir = tempDir();
    writeTree(dir, { ".git/HEAD": "x\n" });
    const runner = new Git(dir, {
      exec: exec((args) =>
        args[0] === "commit"
          ? { code: 1, stderr: "\nerror: gpg failed to sign the data\nmore\n" }
          : { code: args[0] === "diff" ? 1 : 0, stdout: "x\n" },
      ),
    });
    expect(await runner.commit(["a"], "m")).toEqual({
      status: "failed",
      message: "error: gpg failed to sign the data",
    });
  });

  it("a failing git add is a failure too", async () => {
    const dir = tempDir();
    writeTree(dir, { ".git/HEAD": "x\n" });
    const runner = new Git(dir, {
      exec: exec((args) => (args[0] === "add" ? { code: 128, stderr: "fatal: pathspec" } : { code: 0 })),
    });
    expect(await runner.commit(["a"], "m")).toEqual({ status: "failed", message: "fatal: pathspec" });
  });
});
