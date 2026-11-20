import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type LibraryRmIo, type LibraryRmOptions, runLibraryRm } from "../src/cli/library-rm";
import { runLibraryStatus } from "../src/cli/library-status";
import { readIndex } from "../src/library/index-file";
import { slashed } from "../src/library/layout";
import { realLockEnv } from "../src/library/lock";
import { cleanTemps, git } from "./helpers/library";
import { fileAttempt, grade, quizOf, type T, writingLibrary } from "./helpers/library-grade";

/**
 * `library rm`, in-process with real git in a temp folder (STEP4.md, slice 4f; G10, G37). The prompt, the lock's wait and
 * the removal of a folder are injected; a real `git revert` brings a deleted quiz back. The goldens are in
 * test/golden/library/rm-*.
 */
afterEach(cleanTemps);

const opts = (o: Partial<LibraryRmOptions> = {}): LibraryRmOptions => ({
  yes: false,
  force: false,
  json: false,
  plain: true,
  ...o,
});

/** `writing`, in two versions, with two attempts and one report (graded), committed. */
async function writing() {
  const t = await writingLibrary();
  const hash = quizOf(t, "writing").current;
  await fileAttempt(t, "20261115-093012", hash, "An answer.");
  await fileAttempt(t, "20261116-093012", hash, "Another answer.");
  await grade(t, "writing", { attempt: "20261115-093012" });
  const rm = async (o: Partial<LibraryRmOptions> = {}, extra: Partial<LibraryRmIo> = {}, name = "writing") => {
    const c = t.at();
    const asked: string[] = [];
    const io: LibraryRmIo = {
      ...c.io,
      ask: async (q) => {
        asked.push(q);
        return true;
      },
      ...extra,
    };
    const exit = await runLibraryRm(name, opts(o), io);
    return { exit, out: c.out, err: c.err, asked };
  };
  return { ...t, rm, hash };
}

const quizzesOf = (lib: string) => {
  const read = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  return read.index.quizzes.map((q) => q.name);
};
const subjects = async (t: T) => (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");
const dir = (t: T) => join(t.lib, "quizzes", "writing");

describe("library rm", () => {
  it("asks with what is lost, deletes the folder and the table, makes one commit and says how to undo it", async () => {
    const t = await writing();
    const before = await subjects(t);
    const r = await t.rm();
    expect(r.exit).toBe(0);
    expect(r.asked).toEqual(["delete writing (Writing): 1 version, 2 attempts, 1 report? [y/N] "]);
    const head = (await git(t.lib, t.env, "rev-parse", "--short", "HEAD")).trim();
    expect(r.out).toEqual(["deleted writing", `undo: git -C ${slashed(t.lib)} revert ${head}`]);
    expect(existsSync(dir(t))).toBe(false);
    expect(quizzesOf(t.lib)).toEqual([]);
    const after = await subjects(t);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toBe("fullmark: rm writing");
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    // nothing is left beside it
    expect(readdirSync(join(t.lib, "quizzes"))).toEqual([]);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("the undo line works: a real git revert brings the quiz back and library status is healthy", async () => {
    const t = await writing();
    const r = await t.rm({ yes: true });
    expect(r.exit).toBe(0);
    const hash = /revert ([0-9a-f]+)$/.exec(r.out.at(-1) ?? "")?.[1] as string;
    await git(t.lib, t.env, "revert", "--no-edit", hash);
    expect(quizzesOf(t.lib)).toEqual(["writing"]);
    expect(readdirSync(join(dir(t), "results"))).toHaveLength(2);
    const c = t.at();
    expect(await runLibraryStatus({ json: false, plain: true }, c.io)).toBe(0);
    expect(c.out.join("\n")).toContain("healthy");
  });

  it("--yes does not ask; --json prints {status, name, id, committed}, and the words go to stderr", async () => {
    const t = await writing();
    const r = await t.rm({ yes: true, json: true });
    expect(r.asked).toEqual([]);
    expect(JSON.parse(r.out[0] ?? "")).toEqual({
      status: "deleted",
      name: "writing",
      id: "writing",
      committed: expect.stringMatching(/^[0-9a-f]+$/),
    });
    expect(r.out).toHaveLength(1);
    expect(r.err[0]).toBe("deleted writing");
  });

  it("an answer other than yes deletes nothing (exit 2)", async () => {
    const t = await writing();
    const before = await subjects(t);
    const r = await t.rm({}, { ask: async () => false });
    expect(r.exit).toBe(2);
    expect(r.err).toEqual(["not deleted"]);
    expect(existsSync(dir(t))).toBe(true);
    expect(await subjects(t)).toEqual(before);
  });

  it("counts an attempt in progress in the question (G37), and deletes its progress/ with the folder", async () => {
    const t = await writing();
    mkdirSync(join(dir(t), "progress"), { recursive: true });
    writeFileSync(
      join(dir(t), "progress", `${t.hash}.json`),
      JSON.stringify({
        format: "fullmark-results",
        version: 2,
        quizHash: t.hash,
        plan: { source: "full", questions: ["q1", "desc"] },
        state: {
          answers: { q1: { choice: 0 } },
          startedAt: "2026-11-17T09:00:00",
          submittedAt: null,
          timeUsed: 0,
          sectionTime: {},
          flagged: [],
          checked: [],
          timedOut: false,
        },
        phase: "answering",
      }),
    );
    const r = await t.rm();
    expect(r.asked).toEqual([
      "delete writing (Writing): 1 version, 2 attempts, 1 report, 1 attempt in progress? [y/N] ",
    ]);
    expect(r.exit).toBe(0);
    expect(existsSync(dir(t))).toBe(false);
  });

  it("without a terminal and without --yes, and with --json and without --yes, exits 2 and asks nothing (G10)", async () => {
    const t = await writing();
    const none = await t.rm({}, { ask: undefined });
    expect(none.exit).toBe(2);
    expect(none.err).toEqual([
      "error: delete writing? pass --yes to confirm",
      "    fix: add --yes: there is no terminal to ask on",
    ]);
    const json = await t.rm({ json: true }, { ask: undefined });
    expect(json.exit).toBe(2);
    expect(JSON.parse(json.out[0] ?? "")).toEqual({
      status: "error",
      message: "delete writing? pass --yes to confirm",
      fix: "add --yes: --json never prompts",
    });
    // a terminal asks, but --json never does
    const tty = await t.rm({ json: true }, { ask: undefined, tty: true });
    expect(tty.exit).toBe(2);
    expect(existsSync(dir(t))).toBe(true);
  });

  it("refuses a library that is not a git repository (exit 1); --force deletes with no commit and says it cannot be undone", async () => {
    const t = await writing();
    rmSync(join(t.lib, ".git"), { recursive: true, force: true });
    const refused = await t.rm({ yes: true });
    expect(refused.exit).toBe(1);
    expect(refused.err).toEqual([
      "error: the library is not a git repository, so deleting writing could not be undone",
      "    fix: make it one with git init in the library, or add --force",
    ]);
    expect(refused.asked).toEqual([]);
    expect(existsSync(dir(t))).toBe(true);
    const json = await t.rm({ yes: true, json: true });
    expect(JSON.parse(json.out[0] ?? "")).toMatchObject({ status: "refused" });
    const forced = await t.rm({ yes: true, force: true });
    expect(forced.exit).toBe(0);
    expect(forced.out).toEqual([
      "deleted writing",
      "warning the library is not a git repository, so this cannot be undone",
    ]);
    expect(existsSync(dir(t))).toBe(false);
    expect(quizzesOf(t.lib)).toEqual([]);
  });

  it("refuses a quiz folder with uncommitted changes (exit 1) unless --force; changes elsewhere and in progress/ do not count", async () => {
    const t = await writing();
    writeFileSync(join(dir(t), "results", "20261117-100000.json"), "{}");
    const refused = await t.rm({ yes: true });
    expect(refused.exit).toBe(1);
    expect(refused.err).toEqual([
      "error: quizzes/writing has uncommitted changes, so deleting it could not be undone",
      "    fix: commit or discard them, or add --force",
    ]);
    expect(existsSync(dir(t))).toBe(true);
    rmSync(join(dir(t), "results", "20261117-100000.json"));
    // progress/ is git-ignored, a file elsewhere is not this quiz's
    mkdirSync(join(dir(t), "progress"), { recursive: true });
    writeFileSync(join(dir(t), "progress", "x.json"), "{}");
    writeFileSync(join(t.lib, "README.md"), "mine");
    expect((await t.rm({ yes: true })).exit).toBe(0);
  });

  it("with --force an uncommitted change goes too, in one commit of the deletion", async () => {
    const t = await writing();
    writeFileSync(join(dir(t), "results", "20261117-100000.json"), "{}");
    expect((await t.rm({ yes: true, force: true })).exit).toBe(0);
    expect(existsSync(dir(t))).toBe(false);
    expect((await subjects(t))[0]).toBe("fullmark: rm writing");
  });

  it("refuses while a take of the quiz is serving (G37), unless --force; a serving file of a dead process is not one", async () => {
    const t = await writing();
    mkdirSync(join(dir(t), "progress"), { recursive: true });
    const serving = join(dir(t), "progress", `${t.hash}.serving.json`);
    writeFileSync(
      serving,
      `${JSON.stringify({ pid: 4242, url: "http://127.0.0.1:1/?t=x", started: "2026-11-18T14:00:00Z" })}\n`,
    );
    const alive = { ...realLockEnv(), alive: (pid: number) => pid === 4242 };
    const refused = await t.rm({ yes: true }, { lock: alive });
    expect(refused.exit).toBe(1);
    expect(refused.err).toEqual([
      "error: writing is open in a take (pid 4242)",
      "    fix: finish or stop it, or add --force",
    ]);
    expect(existsSync(dir(t))).toBe(true);
    const dead = await t.rm({ yes: true }, { lock: { ...realLockEnv(), alive: () => false } });
    expect(dead.exit).toBe(0);
  });

  it("an unknown quiz exits 2 with the near names", async () => {
    const t = await writing();
    const r = await t.rm({ yes: true }, {}, "writting");
    expect(r.exit).toBe(2);
    expect(r.err).toEqual(["error: no quiz named writting", "    did you mean: writing"]);
  });

  it("waits for the lock and fails with the busy error, deleting nothing; once free, makes exactly one commit", async () => {
    const t = await writing();
    const before = await subjects(t);
    const lock = join(t.lib, ".fullmark.lock");
    writeFileSync(
      lock,
      `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-18T14:20:00.000Z" })}\n`,
    );
    const busy = await t.rm({ yes: true }, { lock: { ...realLockEnv(), waitMs: 0 } });
    expect(busy.exit).toBe(2);
    expect(busy.err[0]).toMatch(/^error: the library is busy: /);
    expect(existsSync(dir(t))).toBe(true);
    expect(await subjects(t)).toEqual(before);
    rmSync(lock);
    expect((await t.rm({ yes: true })).exit).toBe(0);
    expect(await subjects(t)).toHaveLength(before.length + 1);
  });

  it("a run killed while the folder is removed leaves the quiz gone, not half there; the next rm clears what it left aside", async () => {
    const t = await writing();
    const killed = t.rm(
      { yes: true },
      {
        removeTree: async () => {
          throw new Error("killed");
        },
      },
    );
    await expect(killed).rejects.toThrow("killed");
    // the quiz is not at its own name: neither a half-deleted folder nor an index that lists it
    expect(existsSync(dir(t))).toBe(false);
    expect(quizzesOf(t.lib)).toEqual([]);
    const aside = readdirSync(join(t.lib, "quizzes")).filter((f) => f.endsWith(".deleting"));
    expect(aside).toHaveLength(1);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
    // the work is not lost: git restores it
    await git(t.lib, t.env, "checkout", "--", "library.toml", "quizzes");
    expect(quizzesOf(t.lib)).toEqual(["writing"]);
    // and the next deletion clears what the killed one left aside
    expect((await t.rm({ yes: true })).exit).toBe(0);
    expect(readdirSync(join(t.lib, "quizzes"))).toEqual([]);
  });

  it("a run killed before the index is written puts the quiz back where it was: the old state", async () => {
    const t = await writing();
    const text = readFileSync(join(t.lib, "library.toml"), "utf8");
    const files = readdirSync(dir(t), { recursive: true });
    await expect(
      t.rm(
        { yes: true },
        {
          atomic: async () => {
            throw new Error("killed");
          },
        },
      ),
    ).rejects.toThrow("killed");
    expect(readFileSync(join(t.lib, "library.toml"), "utf8")).toBe(text);
    expect(readdirSync(dir(t), { recursive: true })).toEqual(files);
    expect(readdirSync(join(t.lib, "quizzes"))).toEqual(["writing"]);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
  });
});
