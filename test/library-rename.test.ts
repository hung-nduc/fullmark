import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type LibraryRenameOptions, runLibraryRename } from "../src/cli/library-rename";
import { readIndex } from "../src/library/index-file";
import { realLockEnv } from "../src/library/lock";
import { cleanTemps, git } from "./helpers/library";
import { newLibrary, quizText } from "./helpers/library-register";

/** `library rename`, in-process with real git in a temp folder (STEP4.md, slice 4f; G13). The goldens are in test/golden/library/rename-*. */
afterEach(cleanTemps);

const opts = (o: Partial<LibraryRenameOptions> = {}): LibraryRenameOptions => ({ json: false, plain: true, ...o });

async function twoQuizzes() {
  const t = await newLibrary();
  t.write({
    "notes/rust.md": quizText("rust", "Rust basics", [["own", "Who owns it?"]]),
    "notes/limits.md": quizText("calculus-limits", "Limits", [["limit", "What is a limit?"]]),
  });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  await t.register(["notes/limits.md"], { name: "limits" });
  const rename = async (from: string, to: string, o: Partial<LibraryRenameOptions> = {}, extra = {}) => {
    const c = t.at();
    const exit = await runLibraryRename(from, to, opts(o), { ...c.io, ...extra });
    return { exit, out: c.out, err: c.err };
  };
  return { ...t, rename };
}

const indexOf = (lib: string) => {
  const read = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  return read.index;
};
const subjects = async (t: { lib: string; env: Record<string, string> }) =>
  (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");

describe("library rename", () => {
  it("changes only the name: the id and the folder stay, the table moves to keep the file sorted, one commit holds library.toml", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const r = await t.rename("rust-basics", "zig");
    expect(r.exit).toBe(0);
    const head = (await git(t.lib, t.env, "rev-parse", "--short", "HEAD")).trim();
    expect(r.out).toEqual([
      "renamed rust-basics to zig · id and folder unchanged (quizzes/rust)",
      `committed ${head} fullmark: rename rust-basics zig`,
    ]);
    const quizzes = indexOf(t.lib).quizzes;
    // sorted by name: limits, zig
    expect(quizzes.map((q) => [q.name, q.id])).toEqual([
      ["limits", "calculus-limits"],
      ["zig", "rust"],
    ]);
    expect(existsSync(join(t.lib, "quizzes", "rust", "versions"))).toBe(true);
    const after = await subjects(t);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toBe("fullmark: rename rust-basics zig");
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim()).toBe("library.toml");
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("names the quiz by its id as well; --json is {status, old, new, id, committed}", async () => {
    const t = await twoQuizzes();
    const r = await t.rename("calculus-limits", "lim", { json: true });
    expect(r.exit).toBe(0);
    expect(JSON.parse(r.out[0] ?? "")).toEqual({
      status: "renamed",
      old: "limits",
      new: "lim",
      id: "calculus-limits",
      committed: expect.stringMatching(/^[0-9a-f]+$/),
    });
    expect(r.err[0]).toBe("renamed limits to lim · id and folder unchanged (quizzes/calculus-limits)");
  });

  it("a name may equal the quiz's own id; it may not be another quiz's name or id, and the next free name is offered (exit 1)", async () => {
    const t = await twoQuizzes();
    expect((await t.rename("rust-basics", "rust")).exit).toBe(0);
    const byName = await t.rename("limits", "rust");
    expect(byName.exit).toBe(1);
    expect(byName.err).toEqual(["error: the name rust is taken", "    fix: quiz library rename limits rust-2"]);
    const byId = await t.rename("limits", "rust");
    expect(byId.exit).toBe(1);
    // another quiz's id
    const other = await t.rename("rust", "calculus-limits");
    expect(other.exit).toBe(1);
    expect(other.err[0]).toBe("error: the name calculus-limits is taken");
    const json = await t.rename("limits", "rust", { json: true });
    expect(JSON.parse(json.out[0] ?? "")).toEqual({
      status: "refused",
      message: "the name rust is taken",
      fix: "quiz library rename limits rust-2",
    });
    const same = await t.rename("limits", "limits");
    expect(same.exit).toBe(1);
    expect(same.err[0]).toBe("error: limits is already the name of this quiz");
    expect(indexOf(t.lib).quizzes.map((q) => q.name)).toEqual(["limits", "rust"]);
  });

  it("an unknown quiz exits 2 with the near names; a name that is no slug exits 2", async () => {
    const t = await twoQuizzes();
    const unknown = await t.rename("rustbasics", "zig");
    expect(unknown.exit).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named rustbasics", "    did you mean: rust-basics"]);
    const bad = await t.rename("rust-basics", "Rust Basics");
    expect(bad.exit).toBe(2);
    expect(bad.err).toEqual([
      "error: Rust Basics is not a valid name",
      "    fix: a name is a slug: a to z, 0 to 9 and -, starting with a letter, 1 to 64 characters",
    ]);
  });

  it("waits for the lock and fails with the busy error, changing nothing; once free it makes exactly one commit", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const lock = join(t.lib, ".fullmark.lock");
    const { writeFileSync, rmSync } = await import("node:fs");
    writeFileSync(
      lock,
      `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-18T14:20:00.000Z" })}\n`,
    );
    const busy = await t.rename("rust-basics", "zig", {}, { lock: { ...realLockEnv(), waitMs: 0 } });
    expect(busy.exit).toBe(2);
    expect(busy.err[0]).toMatch(
      /^error: the library is busy: quiz library register notes\/\*\.md \(pid \d+\) has held it for \d+ s$/,
    );
    expect(busy.err[1]).toBe("    fix: run the command again when it finishes");
    expect(indexOf(t.lib).quizzes.map((q) => q.name)).toEqual(["limits", "rust-basics"]);
    expect(await subjects(t)).toEqual(before);
    rmSync(lock);
    expect((await t.rename("rust-basics", "zig")).exit).toBe(0);
    expect(await subjects(t)).toHaveLength(before.length + 1);
  });

  it("a writer that dies mid-way leaves library.toml as it was and commits nothing", async () => {
    const t = await twoQuizzes();
    const before = await subjects(t);
    const text = readFileSync(join(t.lib, "library.toml"), "utf8");
    await expect(
      t.rename(
        "rust-basics",
        "zig",
        {},
        {
          atomic: async () => {
            throw new Error("killed");
          },
        },
      ),
    ).rejects.toThrow("killed");
    expect(readFileSync(join(t.lib, "library.toml"), "utf8")).toBe(text);
    expect(await subjects(t)).toEqual(before);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });
});
