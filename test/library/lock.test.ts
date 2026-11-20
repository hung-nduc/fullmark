import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LockBusy, type LockEnv, type LockHolder, processAlive, withLock } from "../../src/library/lock";
import { cleanTemps, tempDir } from "../helpers/library";

afterEach(cleanTemps);

/** A lock environment with a clock that only the fake sleep moves: no test waits for real. */
function fakeEnv(start = "2026-11-18T14:00:00.000Z", alive: (pid: number) => boolean = () => true) {
  let t = Date.parse(start);
  const sleeps: number[] = [];
  const env: LockEnv = {
    now: () => new Date(t),
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    alive,
    pid: 4242,
    waitMs: 10_000,
    pollMs: 100,
  };
  return { env, sleeps, advance: (ms: number) => (t += ms) };
}

const holderFile = (root: string, h: LockHolder) =>
  writeFileSync(join(root, ".fullmark.lock"), `${JSON.stringify(h)}\n`);

describe("the library lock", () => {
  it("is held while the command runs and removed after, with who and when in it", async () => {
    const root = tempDir();
    const { env } = fakeEnv();
    let inside: LockHolder | null = null;
    const result = await withLock(root, "quiz library register a.md", env, {}, async () => {
      inside = JSON.parse(readFileSync(join(root, ".fullmark.lock"), "utf8")) as LockHolder;
      return 7;
    });
    expect(result).toBe(7);
    expect(inside).toEqual({ pid: 4242, command: "quiz library register a.md", started: "2026-11-18T14:00:00.000Z" });
    expect(existsSync(join(root, ".fullmark.lock"))).toBe(false);
  });

  it("is released when the command throws", async () => {
    const root = tempDir();
    await expect(
      withLock(root, "x", fakeEnv().env, {}, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(existsSync(join(root, ".fullmark.lock"))).toBe(false);
  });

  it("makes a second writer wait, says so once, and goes ahead when the first is done", async () => {
    const root = tempDir();
    const f = fakeEnv();
    holderFile(root, { pid: 48300, command: "quiz library register notes/*.md", started: "2026-11-18T14:00:00.000Z" });
    const waiting: LockHolder[] = [];
    let polls = 0;
    const env: LockEnv = {
      ...f.env,
      sleep: async (ms) => {
        await f.env.sleep(ms);
        // the holder finishes after the third look
        if (++polls === 3) {
          const { rmSync } = await import("node:fs");
          rmSync(join(root, ".fullmark.lock"));
        }
      },
    };
    await withLock(root, "second", env, { waiting: (h) => waiting.push(h) }, async () => undefined);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.pid).toBe(48300);
    expect(f.sleeps).toEqual([100, 100, 100]);
  });

  it("gives up after 10 seconds with the holder named, never sleeping 10 real seconds", async () => {
    const root = tempDir();
    const f = fakeEnv();
    holderFile(root, { pid: 48300, command: "quiz library register notes/*.md", started: "2026-11-18T14:00:00.000Z" });
    const waiting: LockHolder[] = [];
    const error = await withLock(
      root,
      "second",
      f.env,
      { waiting: (h) => waiting.push(h) },
      async () => undefined,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LockBusy);
    expect((error as LockBusy).message).toBe(
      "the library is busy: quiz library register notes/*.md (pid 48300) has held it for 10 s",
    );
    expect(waiting).toHaveLength(1);
    expect(f.sleeps).toHaveLength(100);
    expect(f.sleeps.reduce((a, b) => a + b, 0)).toBe(10_000);
    // the holder's lock is left alone
    expect(existsSync(join(root, ".fullmark.lock"))).toBe(true);
  });

  it("removes a lock whose process is not running, says so, and goes ahead at once", async () => {
    const root = tempDir();
    const f = fakeEnv(undefined, (pid) => pid !== 48211);
    holderFile(root, { pid: 48211, command: "quiz library take signals", started: "2026-11-18T13:00:00.000Z" });
    const stale: LockHolder[] = [];
    let ran = false;
    await withLock(root, "me", f.env, { stale: (h) => stale.push(h) }, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(stale).toEqual([{ pid: 48211, command: "quiz library take signals", started: "2026-11-18T13:00:00.000Z" }]);
    expect(f.sleeps).toEqual([]);
  });

  it("a lock with no pid in it (a writer killed between create and write) is cleared after the wait", async () => {
    const root = tempDir();
    const f = fakeEnv();
    writeFileSync(join(root, ".fullmark.lock"), "");
    let ran = false;
    await withLock(root, "me", f.env, {}, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(f.sleeps.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("two commands started together both finish, one after the other", async () => {
    const root = tempDir();
    const order: string[] = [];
    const env: LockEnv = { ...fakeEnv().env, sleep: () => new Promise((done) => setImmediate(done)), waitMs: 1e9 };
    const run = (name: string) =>
      withLock(root, name, env, {}, async () => {
        order.push(`${name} in`);
        await new Promise((done) => setImmediate(done));
        order.push(`${name} out`);
      });
    await Promise.all([run("a"), run("b")]);
    expect(order.filter((_, i) => i % 2 === 0).every((l) => l.endsWith(" in"))).toBe(true);
    expect(order.filter((_, i) => i % 2 === 1).every((l) => l.endsWith(" out"))).toBe(true);
    expect(order).toHaveLength(4);
  });

  it("treats an EPERM or EBUSY on the create as a taken lock and tries again (Windows, while the holder deletes it)", async () => {
    const root = tempDir();
    const f = fakeEnv();
    for (const code of ["EPERM", "EBUSY"]) {
      let creates = 0;
      let ran = false;
      await withLock(
        root,
        "me",
        f.env,
        {},
        async () => {
          ran = true;
        },
        async (file, text) => {
          if (creates++ === 0) throw Object.assign(new Error(code), { code });
          writeFileSync(file, text, { flag: "wx" });
        },
      );
      expect(ran).toBe(true);
      expect(creates).toBe(2);
    }
    expect(f.sleeps).toEqual([100, 100]);
  });

  it("gives up with the error when an EPERM create finds no lock to wait for, once the wait is up", async () => {
    const root = tempDir();
    const f = fakeEnv();
    await expect(
      withLock(
        root,
        "me",
        f.env,
        {},
        async () => undefined,
        async () => {
          throw Object.assign(new Error("denied"), { code: "EPERM" });
        },
      ),
    ).rejects.toThrow("denied");
    expect(f.sleeps.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("asks the operating system whether a process is running", () => {
    expect(processAlive(process.pid)).toBe(true);
    expect(processAlive(999_999_999)).toBe(false);
  });
});
