import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryInit } from "../src/cli/library-init";
import { capture } from "./helpers/cli";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, libraryEnv, tempDir } from "./helpers/library";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

afterEach(cleanTemps);

/** The lock's clock and sleep, so that a second writer waits by yielding, never by a real timer. */
const lock = () => ({
  now: () => new Date(),
  sleep: () => new Promise<void>((done) => setImmediate(done)),
  alive: () => true,
  pid: process.pid,
  host: "TEST-PC",
  boot: "2026-11-18T08:00:00.000Z",
  waitMs: 120_000,
  pollMs: 1,
});

describe("two inits of one new folder started together (STEP4.md, G21)", () => {
  it("one sets it up and the other adopts it, with one commit", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    const a = capture(dir, env);
    const b = capture(dir, env);
    const opts = { force: false, noGit: false, json: true, plain: true };
    const [x, y] = await Promise.all([
      runLibraryInit("lib", opts, { ...a.io, lock: lock() }),
      runLibraryInit("lib", opts, { ...b.io, lock: lock() }),
    ]);
    expect([x, y]).toEqual([0, 0]);
    const statuses = [a, b].map((c) => JSON.parse(c.out[0] as string).status as string).sort();
    expect(statuses).toEqual(["adopted", "created"]);
    const lib = join(dir, "lib");
    expect((await git(lib, env, "rev-list", "--count", "HEAD")).trim()).toBe("1");
    expect(existsSync(join(lib, ".fullmark.lock"))).toBe(false);
    expect(readdirSync(lib).sort()).toEqual([".git", ".gitignore", "library.toml", "quizzes"]);
  });

  it("a folder that is plainly refused is not touched: no lock file is left in it", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    const c = capture(dir, env);
    const code = await runLibraryInit(
      ".",
      { force: false, noGit: false, json: false, plain: true },
      { ...c.io, lock: lock() },
    );
    expect(code).toBe(2);
    expect(existsSync(join(dir, ".fullmark.lock"))).toBe(false);
  });
});
