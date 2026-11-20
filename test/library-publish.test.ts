import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryInfo } from "../src/cli/library-info";
import { runLibraryList } from "../src/cli/library-list";
import { type LibraryPublishOptions, type PublishIo, runLibraryPublish } from "../src/cli/library-publish";
import { readIndex } from "../src/library/index-file";
import { realLockEnv } from "../src/library/lock";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, NOW } from "./helpers/library";
import { publishOptions } from "./helpers/library-publish";
import { newLibrary, quizText } from "./helpers/library-register";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/** `library publish NAME --on | --off`, in-process with real git in a temp folder (STEP5.md, slice 5a). The goldens are in test/golden/library/publish-*. */
afterEach(cleanTemps);

async function twoQuizzes() {
  const t = await newLibrary();
  t.write({
    "notes/rust.md": quizText("rust", "Rust basics", [["own", "Who owns it?"]]),
    "notes/limits.md": quizText("calculus-limits", "Limits", [["limit", "What is a limit?"]]),
  });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  await t.register(["notes/limits.md"], { name: "limits" });
  const publish = async (
    target: string | null,
    o: Partial<LibraryPublishOptions> = {},
    extra: Partial<PublishIo> = {},
  ) => {
    const c = t.at();
    const exit = await runLibraryPublish(target, publishOptions(o), { ...c.io, ...extra });
    return { exit, out: c.out, err: c.err };
  };
  return { ...t, publish };
}

const textOf = (lib: string) => readFileSync(join(lib, "library.toml"), "utf8");
const indexOf = (lib: string) => {
  const read = readIndex(textOf(lib));
  if (!read.ok) throw new Error("bad index");
  return read.index;
};
const subjects = async (t: { lib: string; env: Record<string, string> }) =>
  (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");

describe("library publish NAME --on | --off", () => {
  it("--on writes the shelf entry as a table, with one commit holding library.toml and nothing else", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const r = await t.publish("rust-basics", { on: true });
    expect(r.exit).toBe(0);
    const head = (await git(t.lib, t.env, "rev-parse", "--short", "HEAD")).trim();
    expect(r.out).toEqual([
      "rust-basics is on the public shelf",
      `committed ${head} fullmark: publish rust-basics --on`,
      "next: quiz library publish",
    ]);
    expect(textOf(t.lib)).toContain('shelves = [{ shelf = "public", kind = "quiz" }]');
    expect(indexOf(t.lib).quizzes.find((q) => q.name === "limits")?.shelves).toEqual([]);
    const after = await subjects(t);
    expect(after).toEqual(["fullmark: publish rust-basics --on", ...before]);
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim()).toBe("library.toml");
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("--on twice says so, commits nothing and exits 0; --off twice too", async () => {
    const t = await twoQuizzes();
    expect((await t.publish("rust-basics", { on: true })).exit).toBe(0);
    const before = await subjects(t);
    const text = textOf(t.lib);
    const again = await t.publish("rust-basics", { on: true });
    expect(again.exit).toBe(0);
    expect(again.out).toEqual(["rust-basics is already on the public shelf"]);
    expect(textOf(t.lib)).toBe(text);
    expect(await subjects(t)).toEqual(before);
    const off = await t.publish("rust-basics", { off: true });
    expect(off.out.slice(0, 1)).toEqual(["rust-basics is off the public shelf"]);
    expect(textOf(t.lib)).toContain("shelves = []");
    const offAgain = await t.publish("rust-basics", { off: true });
    expect(offAgain.exit).toBe(0);
    expect(offAgain.out).toEqual(["rust-basics is already not on the public shelf"]);
    expect(await subjects(t)).toHaveLength(before.length + 1);
    // a quiz never put on the shelf, taken off
    const never = await t.publish("limits", { off: true });
    expect(never.exit).toBe(0);
    expect(never.out).toEqual(["limits is already not on the public shelf"]);
  });

  it("names the quiz by its id too; --json is {status, name, committed}, with the words on stderr", async () => {
    const t = await twoQuizzes();
    const r = await t.publish("calculus-limits", { on: true, json: true });
    expect(r.exit).toBe(0);
    expect(JSON.parse(r.out[0] ?? "")).toEqual({
      status: "on",
      name: "limits",
      committed: expect.stringMatching(/^[0-9a-f]+$/),
    });
    expect(r.out).toHaveLength(1);
    expect(r.err[0]).toBe("limits is on the public shelf");
    const again = await t.publish("limits", { on: true, json: true });
    expect(JSON.parse(again.out[0] ?? "")).toEqual({ status: "unchanged", name: "limits", committed: null });
    const off = await t.publish("limits", { off: true, json: true });
    expect(JSON.parse(off.out[0] ?? "")).toMatchObject({ status: "off", name: "limits" });
  });

  it("keeps the entries it does not know, field for field, through --on and --off", async () => {
    const t = await twoQuizzes();
    const other = '{ shelf = "notes", kind = "bundle", items = ["a", "b"] }, { shelf = "public", kind = "bundle" }';
    writeFileSync(
      join(t.lib, "library.toml"),
      textOf(t.lib).replace(/(\[quizzes\.rust-basics\][\s\S]*?shelves = )\[\]/, `$1[${other}]`),
    );
    expect(textOf(t.lib)).toContain(`shelves = [${other}]`);
    expect((await t.publish("rust-basics", { on: true })).exit).toBe(0);
    expect(textOf(t.lib)).toContain(`shelves = [${other}, { shelf = "public", kind = "quiz" }]`);
    expect((await t.publish("rust-basics", { off: true })).exit).toBe(0);
    expect(textOf(t.lib)).toContain(`shelves = [${other}]`);
    // an entry of another kind on `public` is not a published quiz
    const again = await t.publish("rust-basics", { off: true });
    expect(again.out).toEqual(["rust-basics is already not on the public shelf"]);
  });

  it("an unknown name exits 2 with the near names; --on with --off, a missing name and the sync's options exit 2", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const unknown = await t.publish("rustbasics", { on: true });
    expect(unknown.exit).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named rustbasics", "    did you mean: rust-basics"]);
    const both = await t.publish("rust-basics", { on: true, off: true });
    expect(both.exit).toBe(2);
    expect(both.err[0]).toBe("error: --on and --off cannot be given together");
    const none = await t.publish(null, { on: true });
    expect(none.exit).toBe(2);
    expect(none.err[0]).toBe("error: --on needs a quiz's name or id");
    const mixed = await t.publish("rust-basics", { on: true, dryRun: true, fonts: "all" });
    expect(mixed.exit).toBe(2);
    expect(mixed.err[0]).toBe("error: --fonts, --dry-run goes with the sync, not with --on");
    expect(await subjects(t)).toEqual(before);
    expect(textOf(t.lib)).not.toContain("public");
  });

  it("waits for the lock and fails busy changing nothing; once free it makes exactly one commit", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const lock = join(t.lib, ".fullmark.lock");
    writeFileSync(
      lock,
      `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-18T14:20:00.000Z" })}\n`,
    );
    const text = textOf(t.lib);
    const busy = await t.publish("rust-basics", { on: true }, { lock: { ...realLockEnv(), waitMs: 0 } });
    expect(busy.exit).toBe(2);
    expect(busy.err[0]).toMatch(/^error: the library is busy: quiz library register notes\/\*\.md \(pid \d+\)/);
    expect(textOf(t.lib)).toBe(text);
    expect(await subjects(t)).toEqual(before);
    const { rmSync } = await import("node:fs");
    rmSync(lock);
    expect((await t.publish("rust-basics", { on: true })).exit).toBe(0);
    expect(await subjects(t)).toHaveLength(before.length + 1);
  });

  it("shows on `list` (the public mark, `shelves` as names) and on `info` (the Shelves row)", async () => {
    const t = await twoQuizzes();
    await t.publish("rust-basics", { on: true });
    const c = t.at();
    const io = { ...c.io, now: () => new Date(NOW) };
    expect(runLibraryList({ json: false, plain: true }, io)).toBe(0);
    const row = (name: string) => c.out.find((l) => l.startsWith(name)) ?? "";
    expect(row("rust-basics")).toMatch(/public\s*$/);
    expect(row("limits")).not.toContain("public");
    const j = t.at();
    runLibraryList({ json: true, plain: true }, { ...j.io, now: () => new Date(NOW) });
    const rows = (JSON.parse(j.out[0] ?? "") as { quizzes: { name: string; shelves: string[] }[] }).quizzes;
    expect(rows.map((r) => [r.name, r.shelves])).toEqual([
      ["limits", []],
      ["rust-basics", ["public"]],
    ]);
    const i = t.at();
    expect(
      runLibraryInfo("rust-basics", { json: false, plain: true, version: null }, { ...i.io, now: () => new Date(NOW) }),
    ).toBe(0);
    expect(i.out.some((l) => /^Shelves\s+public$/.test(l))).toBe(true);
  });
});
