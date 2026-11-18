import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryGrade } from "../src/cli/library-grade";
import { runLibraryInit } from "../src/cli/library-init";
import { runLibraryRename } from "../src/cli/library-rename";
import { runLibraryRm } from "../src/cli/library-rm";
import { runLibraryTake, type TakeIo } from "../src/cli/library-take";
import type { LockEnv } from "../src/library/lock";
import { capture } from "./helpers/cli";
import { cleanTemps, git, libraryEnv, NOW, tempDir } from "./helpers/library";
import { fileAttempt, gradeOptions, quizOf, type T, writingLibrary } from "./helpers/library-grade";
import { quizText } from "./helpers/library-register";
import { finish, KEEP, webReview } from "./helpers/library-review";

/**
 * Every command that changes the library takes the lock and commits once (STEP4.md, step 4's "Done when"; TECHNICAL_DESIGN.md,
 * "Library and shelf writes take a lock"). For each of `init`, `register`, `take`, `grade`, `review`, `rename` and `rm`,
 * in-process with real git in a temp folder: with the lock held by a live process the command waits (the lock's clock and
 * sleep are injected, so no test waits for a real one), then fails with the library-busy error and changes nothing; and
 * once the lock is free it makes exactly one commit.
 */
afterEach(cleanTemps);

const START = "2026-11-18T14:20:00.000Z";
const HOLDER = { pid: 4242, command: "quiz library register notes/*.md", started: START };

/** A lock held by process 4242, which is alive: a writer polls for 10 s of the injected clock, then gives up. */
function held() {
  let elapsed = 0;
  const sleeps: number[] = [];
  const env: LockEnv = {
    now: () => new Date(Date.parse(START) + elapsed),
    sleep: async (ms) => {
      sleeps.push(ms);
      elapsed += ms;
    },
    alive: (pid) => pid === 4242,
    pid: 1,
    waitMs: 10_000,
    pollMs: 100,
  };
  return { env, sleeps };
}

const lockIn = (dir: string) => join(dir, ".fullmark.lock");
const hold = (dir: string) => writeFileSync(lockIn(dir), `${JSON.stringify(HOLDER)}\n`);
const commits = async (t: { lib: string; env: Record<string, string> }) =>
  Number((await git(t.lib, t.env, "rev-list", "--count", "HEAD")).trim());

/** What a busy library says (COMMANDS.md, "How library commands print"). */
const BUSY = "error: the library is busy: quiz library register notes/*.md (pid 4242) has held it for 10 s";
/** the busy line, which `take`, `grade` and `review` follow with where the work is kept */
const busyIn = (lines: readonly string[]): boolean => lines.some((l) => l.startsWith(BUSY));

async function writing(): Promise<T> {
  const t = await writingLibrary();
  await fileAttempt(t, "20261115-093012", quizOf(t, "writing").current, "An answer.");
  return t;
}

describe("a library command that changes the library waits for the lock, fails busy, and once free commits once", () => {
  it("init", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    mkdirSync(join(dir, "fresh"));
    hold(join(dir, "fresh"));
    const { env: lock, sleeps } = held();
    const run = async () => {
      const c = capture(dir, env);
      const exit = await runLibraryInit(
        "fresh",
        { force: false, noGit: false, json: false, plain: true },
        { ...c.io, now: () => new Date(NOW), lock },
      );
      return { exit, err: c.err, out: c.out };
    };
    const busy = await run();
    expect(busy.exit).toBe(2);
    expect(busyIn(busy.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(existsSync(join(dir, "fresh", "library.toml"))).toBe(false);
    rmSync(lockIn(join(dir, "fresh")));
    expect((await run()).exit).toBe(0);
    expect((await git(join(dir, "fresh"), env, "rev-list", "--count", "HEAD")).trim()).toBe("1");
    expect((await git(join(dir, "fresh"), env, "log", "--format=%s")).trim()).toBe("fullmark: init");
  });

  it("register", async () => {
    const t = await writing();
    t.write({ "notes/other.md": quizText("other", "Other", [["a", "A?"]]) });
    const before = await commits(t);
    hold(t.lib);
    const { env: lock, sleeps } = held();
    const busy = await t.register(["notes/other.md"], {}, { lock });
    expect(busy.exit).toBe(2);
    expect(busyIn(busy.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(await commits(t)).toBe(before);
    expect(existsSync(join(t.lib, "quizzes", "other"))).toBe(false);
    rmSync(lockIn(t.lib));
    expect((await t.register(["notes/other.md"], {})).exit).toBe(0);
    expect(await commits(t)).toBe(before + 1);
  });

  it("take", async () => {
    const t = await writing();
    const hash = quizOf(t, "writing").current;
    const before = await commits(t);
    const { env: lock, sleeps } = held();
    const c = t.at();
    const io: TakeIo = {
      ...c.io,
      now: () => new Date(2026, 10, 18, 14, 22, 10),
      lock,
      setTimer: () => () => undefined,
      onInterrupt: () => () => undefined,
      open: () => undefined,
      autosaveClock: { now: () => 0, setTimer: () => () => undefined },
    };
    const options = {
      section: null,
      missed: false,
      focus: false,
      open: false,
      timeout: null,
      port: null,
      fonts: null,
      json: true,
      plain: true,
      version: "1.0.0-test",
    };
    const run = runLibraryTake("writing", options, io);
    let url = "";
    for (let i = 0; i < 400 && url === ""; i++) {
      const line = c.out.find((l) => l.startsWith('{"status":"listening"'));
      if (line) url = (JSON.parse(line) as { url: string }).url;
      else await new Promise((r) => setTimeout(r, 10));
    }
    hold(t.lib);
    const attempt = {
      quizHash: hash,
      plan: { source: "full", questions: ["q1", "desc"] },
      state: {
        answers: { q1: { choice: 0 }, desc: { text: "x" } },
        startedAt: "2026-11-18T14:00:00",
        submittedAt: "2026-11-18T14:20:00",
        timeUsed: 60,
        sectionTime: {},
        flagged: [],
        checked: [],
        timedOut: false,
      },
      phase: "submitted",
    };
    const reply = await fetch(`${url}submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${new URL(url).port}` },
      body: JSON.stringify({ quizId: "writing", attempt }),
    });
    expect(reply.status).toBe(200);
    expect(await run).toBe(2);
    expect(busyIn(c.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(await commits(t)).toBe(before);
    rmSync(lockIn(t.lib));
    // the answers waited in progress/; the next take files them first, in one commit
    const next = t.at();
    const again = await runLibraryTake("writing", options, {
      ...next.io,
      now: () => new Date(2026, 10, 18, 14, 22, 10),
      lock: { ...lock, waitMs: 0 },
    });
    expect(again).toBe(0);
    expect(await commits(t)).toBe(before + 1);
    expect((await git(t.lib, t.env, "log", "--format=%s", "-1")).trim()).toBe("fullmark: take writing");
  });

  it("grade", async () => {
    const t = await writing();
    const before = await commits(t);
    hold(t.lib);
    const { env: lock, sleeps } = held();
    const run = async (io = {}) => {
      const c = t.at();
      const exit = await runLibraryGrade("writing", gradeOptions({ attempt: "20261115-093012" }), {
        ...c.io,
        now: () => new Date(2026, 10, 18, 15, 2, 12),
        ...io,
      });
      return { exit, err: c.err };
    };
    const busy = await run({ lock });
    expect(busy.exit).toBe(2);
    expect(busyIn(busy.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(await commits(t)).toBe(before);
    expect(existsSync(join(t.lib, "quizzes", "writing", "reports"))).toBe(false);
    rmSync(lockIn(t.lib));
    expect((await run()).exit).toBe(0);
    expect(await commits(t)).toBe(before + 1);
  });

  it("review", async () => {
    const t = await writing();
    const before = await commits(t);
    const { env: lock, sleeps } = held();
    const form = webReview(t, "writing", {}, { lock });
    const url = await form.url();
    hold(t.lib);
    const reply = await finish(url, { q1: KEEP, desc: KEEP });
    expect(reply.status).toBe(200);
    expect(await form.done).toBe(2);
    expect(busyIn(form.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(await commits(t)).toBe(before);
    expect(existsSync(join(t.lib, "quizzes", "writing", "review.json"))).toBe(false);
    rmSync(lockIn(t.lib));
    // the review waited in progress/; the next library review files it first, in one commit
    const next = webReview(t, "writing", { json: false });
    expect(await next.done).toBe(0);
    expect(await commits(t)).toBe(before + 1);
    expect(readFileSync(join(t.lib, "quizzes", "writing", "review.json"), "utf8")).toContain('"fullmark-review"');
  });

  it("rename", async () => {
    const t = await writing();
    const before = await commits(t);
    hold(t.lib);
    const { env: lock, sleeps } = held();
    const c = t.at();
    expect(await runLibraryRename("writing", "essays", { json: false, plain: true }, { ...c.io, lock })).toBe(2);
    expect(busyIn(c.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(await commits(t)).toBe(before);
    rmSync(lockIn(t.lib));
    expect(await runLibraryRename("writing", "essays", { json: false, plain: true }, t.at().io)).toBe(0);
    expect(await commits(t)).toBe(before + 1);
  });

  it("rm", async () => {
    const t = await writing();
    const before = await commits(t);
    hold(t.lib);
    const { env: lock, sleeps } = held();
    const c = t.at();
    expect(
      await runLibraryRm("writing", { yes: true, force: false, json: false, plain: true }, { ...c.io, lock }),
    ).toBe(2);
    expect(busyIn(c.err)).toBe(true);
    expect(sleeps).toHaveLength(100);
    expect(existsSync(join(t.lib, "quizzes", "writing"))).toBe(true);
    expect(await commits(t)).toBe(before);
    rmSync(lockIn(t.lib));
    expect(await runLibraryRm("writing", { yes: true, force: false, json: false, plain: true }, t.at().io)).toBe(0);
    expect(await commits(t)).toBe(before + 1);
  });
});
