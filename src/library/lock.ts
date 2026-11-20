import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LOCK_FILE } from "./layout";

/** What `.fullmark.lock` holds, as JSON: who has the library, and since when. */
export type LockHolder = { pid: number; command: string; started: string };

/**
 * What the lock needs from the machine, so that a test never waits 10 real seconds: the clock, a sleep, and whether a
 * process is running.
 */
export type LockEnv = {
  now(): Date;
  sleep(ms: number): Promise<void>;
  alive(pid: number): boolean;
  pid: number;
  /** how long a second writer waits before giving up (default 10 s) */
  waitMs: number;
  /** how often it looks again (default 100 ms) */
  pollMs: number;
};

export function realLockEnv(): LockEnv {
  return {
    now: () => new Date(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    alive: processAlive,
    pid: process.pid,
    waitMs: 10_000,
    pollMs: 100,
  };
}

/** Whether a process with this id is running: signal 0 only asks. A process that exists but is not ours is alive. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Another command holds the library, and still did after the wait. */
export class LockBusy extends Error {
  constructor(
    readonly holder: LockHolder | null,
    /** whole seconds the holder has held it, by the clock */
    readonly heldSeconds: number,
  ) {
    super(
      holder === null
        ? "the library is busy: another command holds it"
        : `the library is busy: ${holder.command} (pid ${holder.pid}) has held it for ${heldSeconds} s`,
    );
  }
}

export type LockHooks = {
  /** called once, when the library is held by a running command and the wait begins */
  waiting?(holder: LockHolder): void;
  /** called when a lock left by a process that is gone was removed */
  stale?(holder: LockHolder): void;
};

async function readHolder(file: string): Promise<{ holder: LockHolder | null; text: string | null }> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return { holder: null, text: null };
  }
  try {
    const value = JSON.parse(text) as Partial<LockHolder>;
    if (typeof value.pid === "number" && typeof value.command === "string" && typeof value.started === "string")
      return { holder: { pid: value.pid, command: value.command, started: value.started }, text };
  } catch {
    // half-written, or not ours
  }
  return { holder: null, text };
}

/**
 * The exclusive create found the lock taken. On Windows a create made while its holder is still deleting the file fails
 * with `EPERM` or `EBUSY` instead of `EEXIST` (STEP6-GAPS.md, G3); all three mean "taken, look again".
 */
const isTaken = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST" || code === "EPERM" || code === "EBUSY";
};

/**
 * Runs `fn` holding the library's lock (TECHNICAL_DESIGN.md, section 7): `.fullmark.lock` in `root`, made with an
 * exclusive create. A second writer looks again every `pollMs` for up to `waitMs`, then throws `LockBusy`; a lock whose
 * process is no longer running is removed (`hooks.stale`) and the command goes ahead. Released in a `finally`.
 */
export async function withLock<T>(
  root: string,
  command: string,
  env: LockEnv,
  hooks: LockHooks,
  fn: () => Promise<T>,
  /** the exclusive create, injected so that a test makes it fail as Windows does */
  create: (file: string, text: string) => Promise<void> = (f, text) => writeFile(f, text, { flag: "wx" }),
): Promise<T> {
  const file = join(root, LOCK_FILE);
  const mine: LockHolder = { pid: env.pid, command, started: env.now().toISOString() };
  const began = env.now().getTime();
  let told = false;
  for (;;) {
    let refused: unknown = null;
    try {
      await create(file, `${JSON.stringify(mine)}\n`);
      break;
    } catch (error) {
      if (!isTaken(error)) throw error;
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") refused = error;
    }
    const { holder, text } = await readHolder(file);
    const waited = env.now().getTime() - began;
    if (text === null) {
      // it went away between the two calls; but an EPERM or EBUSY with no lock to read is a real refusal once the wait is up
      if (refused !== null) {
        if (waited >= env.waitMs) throw refused;
        await env.sleep(env.pollMs);
      }
      continue;
    }
    if (holder !== null && !env.alive(holder.pid)) {
      // stale: remove it only if it is still the lock we read, so a lock made since is not swept away
      if ((await readHolder(file)).text === text) {
        await rm(file, { force: true });
        hooks.stale?.(holder);
      }
      continue;
    }
    if (waited >= env.waitMs) {
      if (holder === null) {
        // no one has written a pid into it: left by a writer killed between creating and writing
        await rm(file, { force: true });
        continue;
      }
      throw new LockBusy(holder, Math.max(0, Math.round((env.now().getTime() - Date.parse(holder.started)) / 1000)));
    }
    if (holder !== null && !told) {
      told = true;
      hooks.waiting?.(holder);
    }
    await env.sleep(env.pollMs);
  }
  try {
    return await fn();
  } finally {
    await rm(file, { force: true });
  }
}
