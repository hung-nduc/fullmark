import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryInit } from "../src/cli/library-init";
import { realGitExec } from "../src/library/git";
import { capture } from "./helpers/cli";
import { cleanTemps, git, libraryEnv, NOW, quizCli, tempDir, writeTree } from "./helpers/library";

afterEach(cleanTemps);

/**
 * `library init`, `status` and `path` as programs, with real git in a temporary folder (the owner's git config never
 * leaks in: TECHNICAL_DESIGN.md, section 11). The golden cases under test/golden/library/ cover the text without a
 * repository; these cover what depends on git's state.
 */
function setup(options: { identity?: boolean } = {}) {
  const dir = tempDir();
  const env = libraryEnv(dir, options);
  const run = (...args: string[]) => quizCli(args, dir, env);
  return { dir, env, run, lib: join(dir, "lib") };
}

describe("library init and status, with git", () => {
  it("makes a library, commits it as the user and reports a clean one", async () => {
    const { dir, env, run, lib } = setup();
    const init = await run("library", "init", "lib");
    expect(init.exit).toBe(0);
    expect(init.stderr).toBe("");
    const hash = (await git(lib, env, "rev-parse", "--short", "HEAD")).trim();
    expect(init.stdout).toBe(
      `library ready lib (new folder, git repository)\nrecorded in config.toml\ncommitted ${hash} fullmark: init\nnext: quiz library register FILE\n`,
    );
    expect(await git(lib, env, "log", "--format=%an <%ae> | %s")).toBe(
      "Minh Tran <minh@example.com> | fullmark: init\n",
    );
    expect((await git(lib, env, "ls-files")).split("\n").filter(Boolean)).toEqual([".gitignore", "library.toml"]);
    expect(readFileSync(join(lib, ".gitignore"), "utf8")).toBe(".fullmark.lock\nquizzes/*/progress/\n*.tmp\n");
    expect(readFileSync(join(lib, "library.toml"), "utf8")).toBe(
      `format = "fullmark-library"\nversion = 2\ncreated = "${NOW}"\n`,
    );
    expect(readFileSync(join(dir, "config.toml"), "utf8")).toBe(`library = ${JSON.stringify(lib)}\n`);
    expect(existsSync(join(lib, ".fullmark.lock"))).toBe(false);

    const status = await run("library", "status");
    expect(status.exit).toBe(0);
    expect(status.stdout).toBe(
      [
        "Library    lib",
        "Config     config.toml",
        "Git        repository · clean · no remote",
        "Commits as Minh Tran <minh@example.com> (git’s own identity)",
        "Counts     0 quizzes · 0 versions · 0 attempts · 0 reports",
        "Checks     fullmark.toml: none · hashes: 0 of 0 match",
        "",
        "note git.no-remote: the library is only on this machine",
        "",
        "healthy (1 note)",
        "",
      ].join("\n"),
    );
    expect(await run("library", "path")).toMatchObject({ stdout: `${lib}\n`, exit: 0 });
  });

  it("counts uncommitted changes and a remote, and names the folder they share", async () => {
    const { env, run, lib } = setup();
    await run("library", "init", "lib");
    writeTree(lib, { "fullmark.toml": '[check]\nprofile = "default"\n' });
    writeFileSync(join(lib, ".gitignore"), `${readFileSync(join(lib, ".gitignore"), "utf8")}*.bak\n`);
    const two = await run("library", "status");
    expect(two.stdout).toBe(
      [
        "Library    lib",
        "Config     config.toml",
        "Git        repository · 2 uncommitted changes · no remote",
        "Commits as Minh Tran <minh@example.com> (git’s own identity)",
        "Counts     0 quizzes · 0 versions · 0 attempts · 0 reports",
        "Checks     fullmark.toml: ok · hashes: 0 of 0 match",
        "",
        "note git.uncommitted: 2 files not committed",
        "    see: git -C lib status",
        "note git.no-remote: the library is only on this machine",
        "",
        "healthy (2 notes)",
        "",
      ].join("\n"),
    );
    await git(lib, env, "add", "-A");
    await git(lib, env, "commit", "-q", "-m", "mine");
    await git(lib, env, "remote", "add", "origin", "https://example.invalid/quiz-library.git");
    writeTree(lib, { "scratch/a.txt": "a\n", "scratch/b.txt": "b\n" });
    const remote = await run("library", "status", "--json");
    const body = JSON.parse(remote.stdout);
    expect(body.git).toEqual({ repository: true, uncommitted: 2, remote: "origin" });
    expect(body.notes).toEqual([
      { code: "git.uncommitted", path: "scratch", message: "2 files not committed" },
      { code: "library.orphan", path: null, message: "2 files outside the library's layout, such as scratch/a.txt" },
    ]);
    const text = (await run("library", "status")).stdout;
    expect(text).toContain("Git        repository · 2 uncommitted changes · remote origin\n");
    expect(text).toContain("scratch: note git.uncommitted: 2 files not committed\n    see: git -C lib status\n");
    expect(text).not.toContain("git.no-remote");
  });

  it("with no git identity: commits as fullmark, says how to set one, and leaves git's config alone", async () => {
    const { env, run, lib } = setup({ identity: false });
    const init = await run("library", "init", "lib");
    expect(init.exit).toBe(0);
    expect(init.stdout).toBe(
      [
        "library ready lib (new folder, git repository)",
        "recorded in config.toml",
        "note git has no identity here: commits are made as fullmark <fullmark@localhost>",
        '    set one: git -C lib config user.name "Your Name"',
        "             git -C lib config user.email you@example.com",
        `committed ${(await git(lib, env, "rev-parse", "--short", "HEAD")).trim()} fullmark: init`,
        "next: quiz library register FILE",
        "",
      ].join("\n"),
    );
    expect(await git(lib, env, "log", "--format=%an <%ae>")).toBe("fullmark <fullmark@localhost>\n");
    expect(readFileSync(join(lib, ".git", "config"), "utf8")).not.toMatch(/\[user\]/);
    const status = await run("library", "status");
    expect(status.stdout).toContain("Commits as fullmark <fullmark@localhost> (git has no identity here)\n");
    expect(status.stdout).toContain(
      'note git.identity: commits are made as fullmark <fullmark@localhost>\n    set one: git -C lib config user.name "Your Name"\n',
    );
    expect(JSON.parse((await run("library", "init", "lib", "--json")).stdout)).toMatchObject({
      status: "adopted",
      git: true,
      identity: null,
      committed: null,
    });
  });

  it("gives a folder inside another repository its own, with a note, and the outer one is left alone", async () => {
    const { dir, env, run } = setup();
    const outer = join(dir, "outer");
    writeTree(outer, { "readme.txt": "x\n" });
    await git(outer, env, "init", "-q");
    await git(outer, env, "add", "-A");
    await git(outer, env, "commit", "-q", "-m", "outer");
    const init = await run("library", "init", "outer/lib");
    expect(init.exit).toBe(0);
    expect(init.stdout).toContain(
      "note outer/lib is inside the repository at outer and has its own: add it to that repository's .gitignore\n",
    );
    const lib = join(outer, "lib");
    expect((await git(lib, env, "rev-parse", "--show-toplevel")).trim()).toBe(lib);
    expect((await git(lib, env, "log", "--format=%s")).trim()).toBe("fullmark: init");
    expect((await git(outer, env, "log", "--format=%s")).trim()).toBe("outer");
    // the outer repository did not take the library's files
    expect((await git(outer, env, "ls-files")).trim()).toBe("readme.txt");
  });

  it("adopts a folder that holds only a repository, keeping it", async () => {
    const { env, run, lib } = setup();
    mkdirSync(lib);
    await git(lib, env, "init", "-q");
    const init = await run("library", "init", "lib");
    expect(init.exit).toBe(0);
    expect(init.stdout).toContain("library ready lib (existing repository, git repository)\n");
    expect((await git(lib, env, "log", "--format=%s")).trim()).toBe("fullmark: init");
    expect(await run("library", "init", "lib")).toMatchObject({ exit: 0 });
  });

  it("sets up an empty folder", async () => {
    const { run, lib } = setup();
    mkdirSync(lib);
    const init = await run("library", "init", "lib");
    expect(init.stdout).toContain("library ready lib (empty folder, git repository)\n");
    expect(readdirSync(lib).sort()).toEqual([".git", ".gitignore", "library.toml", "quizzes"]);
  });

  it("switches libraries with --force, and refuses without it", async () => {
    const { dir, run } = setup();
    await run("library", "init", "one");
    const refused = await run("library", "init", "two");
    expect(refused).toMatchObject({ exit: 2, stdout: "" });
    expect(refused.stderr).toBe("error: a library is already set: one\n    fix: add --force to switch\n");
    expect(existsSync(join(dir, "two"))).toBe(false);
    expect((await run("library", "init", "two", "--force")).exit).toBe(0);
    expect(readFileSync(join(dir, "config.toml"), "utf8")).toBe(`library = ${JSON.stringify(join(dir, "two"))}\n`);
    expect((await run("library", "path")).stdout).toBe(`${join(dir, "two")}\n`);
  });

  it("FULLMARK_LIBRARY overrides the config, relative to the working directory", async () => {
    const { dir, env } = setup();
    await quizCli(["library", "init", "one"], dir, env);
    await quizCli(["library", "init", "two", "--force", "--no-git"], dir, env);
    const viaEnv = await quizCli(["library", "path"], dir, { ...env, FULLMARK_LIBRARY: "one" });
    expect(viaEnv.stdout).toBe(`${join(dir, "one")}\n`);
    const status = await quizCli(["library", "status"], dir, { ...env, FULLMARK_LIBRARY: "one" });
    expect(status.stdout).toContain("Library    one (from FULLMARK_LIBRARY)\n");
    expect(status.stdout).toContain(`note env.library: FULLMARK_LIBRARY is set; the config’s library is two\n`);
  });

  it("status removes a lock left by a process that is gone, and says so; a lock of a running one is left", async () => {
    const { run, lib } = setup();
    await run("library", "init", "lib");
    const dead = '{"pid":999999999,"command":"quiz library take signals","started":"2026-11-18T14:00:00.000Z"}\n';
    writeFileSync(join(lib, ".fullmark.lock"), dead);
    const status = await run("library", "status");
    expect(status.stdout).toContain(
      "note lock.stale: removed a lock left by pid 999999999 (quiz library take signals)\n",
    );
    expect(existsSync(join(lib, ".fullmark.lock"))).toBe(false);
    writeFileSync(join(lib, ".fullmark.lock"), `{"pid":${process.pid},"command":"x","started":"t"}\n`);
    expect((await run("library", "status")).stdout).not.toContain("lock.stale");
    expect(existsSync(join(lib, ".fullmark.lock"))).toBe(true);
  });

  it("status reads and changes nothing in git: no commit, no staged file", async () => {
    const { env, run, lib } = setup();
    await run("library", "init", "lib");
    writeTree(lib, { "x.txt": "x\n" });
    const before = await git(lib, env, "status", "--porcelain");
    await run("library", "status");
    expect(await git(lib, env, "status", "--porcelain")).toBe(before);
    expect((await git(lib, env, "rev-list", "--count", "HEAD")).trim()).toBe("1");
  });

  it("path names a quiz's folder by name, then id, and an unknown quiz exits 2 (stdout stays empty)", async () => {
    const { run, lib } = setup();
    await run("library", "init", "lib");
    writeFileSync(
      join(lib, "library.toml"),
      `format = "fullmark-library"\nversion = 2\ncreated = "${NOW}"\n\n[quizzes.signals-intro]\nid = "signals"\ntitle = "S"\nsource = "/s.md"\ncurrent = "${"a".repeat(64)}"\nversions = [{ hash = "${"a".repeat(64)}", added = "${NOW}" }]\nshelves = []\n`,
    );
    expect((await run("library", "path", "signals-intro")).stdout).toBe(`${join(lib, "quizzes", "signals")}\n`);
    expect((await run("library", "path", "signals")).stdout).toBe(`${join(lib, "quizzes", "signals")}\n`);
    const unknown = await run("library", "path", "signal");
    expect(unknown).toMatchObject({ exit: 2, stdout: "" });
    expect(unknown.stderr).toContain("fix: did you mean `signals`?");
  });
});

describe("library init, with a commit that fails", () => {
  it("is a warning: the files stay written, the exit is 0, and no commit is reported", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    const c = capture(dir, env);
    const io = {
      ...c.io,
      gitExec: (bin: string, args: string[], e: Record<string, string | undefined>) =>
        args.includes("commit")
          ? Promise.resolve({ code: 1, stdout: "", stderr: "error: gpg failed to sign the data\n" })
          : realGitExec(bin, args, e),
    };
    const code = await runLibraryInit("lib", { force: false, noGit: false, json: true, plain: true }, io);
    expect(code).toBe(0);
    expect(JSON.parse(c.out[0] as string)).toMatchObject({ status: "created", git: true, committed: null });
    expect(c.err).toContain(
      "warning the first commit failed: error: gpg failed to sign the data; the files are written",
    );
    expect(existsSync(join(dir, "lib", "library.toml"))).toBe(true);
    expect(readFileSync(join(dir, "config.toml"), "utf8")).toContain("library =");
  });

  it("no git on the path is a warning too, and the folder is made without a repository", async () => {
    const dir = tempDir();
    const c = capture(dir, libraryEnv(dir));
    const io = {
      ...c.io,
      gitExec: () => Promise.resolve({ code: -1, stdout: "", stderr: "", missing: true as const }),
    };
    const code = await runLibraryInit("lib", { force: false, noGit: false, json: false, plain: true }, io);
    expect(code).toBe(0);
    expect(c.out).toEqual([
      "library ready lib (new folder, no git repository)",
      "recorded in config.toml",
      "warning git was not found: the library has no repository (rm will need --force)",
      "next: quiz library register FILE",
    ]);
    expect(existsSync(join(dir, "lib", ".git"))).toBe(false);
  });
});
