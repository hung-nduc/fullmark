import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryPublish } from "../src/cli/library-publish";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";
import { folderBytes, publishOptions } from "./helpers/library-publish";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/**
 * The same library state always gives the same shelf, byte for byte (STEP5.md, Goal: "Determinism"; TECHNICAL_DESIGN.md,
 * section 11): the pages' `built_at` is the version's `added` time, the manifest holds no time of publishing, and the
 * index page holds none either.
 */
afterEach(cleanTemps);

async function publishing() {
  const t = await buildHistory();
  for (const name of ["study-fixture", "limits-and-continuity", "tidy"]) {
    const c = t.at();
    expect(await runLibraryPublish(name, publishOptions({ on: true }), c.io)).toBe(0);
  }
  const publish = async (dir: string, o: Parameters<typeof publishOptions>[0] = {}, now?: () => Date) => {
    const c = t.at();
    const exit = await runLibraryPublish(dir, publishOptions(o), { ...c.io, ...(now === undefined ? {} : { now }) });
    return { exit, out: c.out, err: c.err };
  };
  return { ...t, publish };
}

describe("the shelf is deterministic", () => {
  it("two publishes of the same library state into two empty folders are byte-identical, whatever the clock says", async () => {
    const t = await publishing();
    // the folders have the same name (the index page is headed by it), and sit in different places
    const a = join(t.dir, "one", "shelf");
    const b = join(t.dir, "two", "shelf");
    expect((await t.publish(a, {}, () => new Date("2026-11-19T08:00:00+00:00"))).exit).toBe(0);
    expect((await t.publish(b, {}, () => new Date("2031-05-05T23:59:59+00:00"))).exit).toBe(0);
    const left = folderBytes(a);
    const right = folderBytes(b);
    expect([...left.keys()]).toEqual([...right.keys()]);
    expect(left.size).toBe(8);
    for (const [path, bytes] of left) expect(right.get(path) === bytes, path).toBe(true);
  });

  it("a second publish into the same folder is unchanged: it writes nothing (mtimes kept) and commits nothing", async () => {
    const t = await publishing();
    const dir = join(t.dir, "site");
    mkdirSync(dir);
    await git(dir, t.env, "init", "-q");
    const first = await t.publish(dir);
    expect(first.exit).toBe(0);
    const stamps = new Map([...folderBytes(dir).keys()].map((f) => [f, statSync(join(dir, f)).mtimeMs]));
    const commits = (await git(dir, t.env, "rev-list", "--count", "HEAD")).trim();
    expect(commits).toBe("1");
    await new Promise((r) => setTimeout(r, 20));
    const again = await t.publish(dir, {}, () => new Date("2031-05-05T23:59:59+00:00"));
    expect(again.exit).toBe(0);
    expect(again.out).toEqual([`unchanged: ${dir} already matches the library (3 quizzes)`]);
    for (const [f, ms] of stamps) expect(statSync(join(dir, f)).mtimeMs, f).toBe(ms);
    expect((await git(dir, t.env, "rev-list", "--count", "HEAD")).trim()).toBe("1");
    expect(await git(dir, t.env, "status", "--porcelain")).toBe("");
  });
});
