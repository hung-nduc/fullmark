import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type LibraryTakeOptions, runLibraryTake, type TakeIo } from "../src/cli/library-take";
import type { Attempt } from "../src/core/attempt";
import { readIndex } from "../src/library/index-file";
import { realLockEnv } from "../src/library/lock";
import { cleanTemps, git } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";
import { newLibrary, quizText } from "./helpers/library-register";

/**
 * `library take`, in-process: the server binds 127.0.0.1 on port 0 and is driven with `fetch`; the clock, the timers,
 * Ctrl+C, the opener and the lock's wait are injected, so no test waits for a real one. Git is real, in a temp folder.
 */
afterEach(cleanTemps);

const SIGNALS = quizText("signals", "Signals", [
  ["q1", "First question"],
  ["q2", "Second question"],
]);
/** the clock of every take: local time, so that the stamp does not depend on the machine's zone */
const CLOCK = new Date(2026, 10, 18, 14, 22, 10);
const STAMP = "20261118-142210";

type T = Awaited<ReturnType<typeof newLibrary>>;
const indexOf = (t: T) => {
  const read = readIndex(readFileSync(join(t.lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  return read.index;
};
const quizOf = (t: T, name = "signals") => indexOf(t).quizzes.find((q) => q.name === name)!;

const options = (extra: Partial<LibraryTakeOptions> = {}): LibraryTakeOptions => ({
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
  ...extra,
});

/** A take in progress: its output, the url once it listens, and the hands that end it. */
function take(t: T, name: string, extra: Partial<LibraryTakeOptions> = {}, io: Partial<TakeIo> = {}) {
  const c = t.at();
  let interrupt: (() => void) | undefined;
  let fire: (() => void) | undefined;
  const opened: string[] = [];
  const full: TakeIo = {
    ...c.io,
    now: () => CLOCK,
    open: (url) => {
      opened.push(url);
    },
    onInterrupt: (h) => {
      interrupt = h;
      return () => undefined;
    },
    setTimer: (f) => {
      fire = f;
      return () => undefined;
    },
    lock: { ...realLockEnv(), waitMs: 0 },
    autosaveClock: { now: () => 0, setTimer: () => () => undefined },
    ...io,
  };
  const done = runLibraryTake(name, options(extra), full);
  return {
    done,
    out: c.out,
    err: c.err,
    opened,
    interrupt: () => interrupt?.(),
    timeout: () => fire?.(),
    async url(): Promise<string> {
      for (let i = 0; i < 300; i++) {
        const line = c.out.find((l) => l.startsWith('{"status":"listening"'));
        if (line) return (JSON.parse(line) as { url: string }).url;
        await Promise.race([done, new Promise((r) => setTimeout(r, 10))]);
      }
      throw new Error(`never listened: ${c.err.join(" | ")}`);
    },
  };
}

const attemptOf = (hash: string, extra: Partial<Attempt> = {}, ids = ["q1", "q2"]): Attempt => ({
  quizHash: hash,
  plan: { source: "full", questions: ids },
  state: {
    answers: Object.fromEntries(ids.map((id, i) => [id, { choice: i === 0 ? 0 : 1 }])),
    startedAt: "2026-11-18T14:00:00",
    submittedAt: "2026-11-18T14:20:00",
    timeUsed: 60,
    sectionTime: {},
    flagged: [],
    checked: [],
    timedOut: false,
  },
  phase: "submitted",
  ...extra,
});

const postTo = (url: string, path: "submit" | "progress", body: unknown) =>
  fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${new URL(url).port}` },
    body: JSON.stringify(body),
  });

const dataOf = async (url: string): Promise<Record<string, unknown>> => {
  const html = await (await fetch(url)).text();
  return JSON.parse(/<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "");
};

async function library(text = SIGNALS) {
  const t = await newLibrary();
  t.write({ "notes/signals.md": text });
  await t.register(["notes/signals.md"]);
  return t;
}
const progressDir = (t: T, id = "signals") => join(t.lib, "quizzes", id, "progress");
const names = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);

describe("library take", () => {
  it("serves the current version, files the submit under the lock as results/<stamp>.json and commits once", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const run = take(t, "signals", { open: true });
    const url = await run.url();
    expect(run.opened).toEqual([url]);
    // the serving file names this process and the url while it serves
    const serving = JSON.parse(readFileSync(join(progressDir(t), `${hash}.serving.json`), "utf8"));
    expect(serving).toMatchObject({ pid: process.pid, url });
    expect((await dataOf(url)).served).toBe(true);
    expect((await postTo(url, "submit", { quizId: "signals", attempt: attemptOf(hash) })).status).toBe(200);
    expect(await run.done).toBe(0);

    const filed = JSON.parse(run.out.at(-1) ?? "");
    expect(filed).toMatchObject({
      status: "filed",
      results: `results/${STAMP}.json`,
      plan: { source: "full", questions: ["q1", "q2"] },
      gone: 0,
    });
    expect(filed.score.earned).toBe(1);
    const results = join(t.lib, "quizzes", "signals", "results", `${STAMP}.json`);
    expect(JSON.parse(readFileSync(results, "utf8"))).toMatchObject({ quizHash: hash, phase: "submitted" });
    // nothing is left in progress/, no lock, and one commit holds only the result
    expect(names(progressDir(t))).toEqual([]);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
    const log = (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");
    expect(log).toEqual(["fullmark: take signals", "fullmark: register signals", "fullmark: init"]);
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim()).toBe(
      `quizzes/signals/results/${STAMP}.json`,
    );
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
  });

  it("says what it files in the words of COMMANDS.md", async () => {
    const t = await library();
    const run = take(t, "signals", { json: false });
    // no listening line without --json: the human lines name the url
    for (let i = 0; i < 300 && !run.out.some((l) => l.startsWith("serving ")); i++)
      await new Promise((r) => setTimeout(r, 10));
    const url = /^serving (\S+)/.exec(run.out.find((l) => l.startsWith("serving ")) ?? "")?.[1] ?? "";
    expect(run.out[0]).toBe(
      `signals · Signals · version ${quizOf(t).current.slice(0, 4)} · 2 questions · no time limit`,
    );
    expect(run.out).toContain("progress is saved: close the tab or press Ctrl+C, and take resumes it");
    await postTo(url, "submit", { quizId: "signals", attempt: attemptOf(quizOf(t).current) });
    expect(await run.done).toBe(0);
    expect(run.out.slice(-2)).toEqual([
      `filed results/${STAMP}.json · 50% (1 of 2 points)`,
      expect.stringMatching(/^committed [0-9a-f]+ fullmark: take signals$/),
    ]);
  });

  it("keeps the progress on Ctrl+C and on the timeout, commits nothing, and exits 2", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const first = take(t, "signals");
    const url = await first.url();
    const partial = attemptOf(hash, { phase: "answering" }, ["q1", "q2"]);
    partial.state.submittedAt = null;
    expect((await postTo(url, "progress", { quizId: "signals", attempt: partial })).status).toBe(204);
    first.interrupt();
    expect(await first.done).toBe(2);
    expect(JSON.parse(first.out.at(-1) ?? "")).toEqual({ status: "interrupted" });
    expect(first.err.join("\n")).toContain("progress is saved: run take again to continue");
    expect(names(progressDir(t))).toEqual([`${hash}.json`]);
    expect(await git(t.lib, t.env, "log", "--format=%s", "-1")).toBe("fullmark: register signals\n");

    const second = take(t, "signals", { timeout: "30" });
    await second.url();
    second.timeout();
    expect(await second.done).toBe(2);
    expect(JSON.parse(second.out.at(-1) ?? "")).toEqual({ status: "timeout" });
    expect(second.err.join("\n")).toContain("progress is saved: run take again to continue");
    expect(names(progressDir(t))).toEqual([`${hash}.json`]);
  });

  it("resumes a saved attempt: the page holds it, and the heading says so", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const first = take(t, "signals");
    const partial = attemptOf(hash, { phase: "answering" }, ["q1", "q2"]);
    partial.state.answers.q2 = null;
    partial.state.submittedAt = null;
    await postTo(await first.url(), "progress", { quizId: "signals", attempt: partial });
    first.interrupt();
    await first.done;

    const run = take(t, "signals", { json: true });
    const url = await run.url();
    const data = (await dataOf(url)) as { saved: { attempt: Attempt } };
    expect(data.saved.attempt.state.answers.q1).toEqual({ choice: 0 });
    expect(run.err.join("\n")).toContain("resuming your attempt of 18 Nov 14:00 (1 of 2 answered)");
    await postTo(url, "submit", { quizId: "signals", attempt: attemptOf(hash) });
    expect(await run.done).toBe(0);
    // the progress file went with the filing
    expect(names(progressDir(t))).toEqual([]);
  });

  it("resumes an attempt started on an old version, builds it from that version's source, files it against that version, and the next take uses the current one", async () => {
    const t = await library();
    const v1 = quizOf(t).current;
    const first = take(t, "signals");
    const partial = attemptOf(v1, { phase: "answering" }, ["q1", "q2"]);
    partial.state.submittedAt = null;
    await postTo(await first.url(), "progress", { quizId: "signals", attempt: partial });
    first.interrupt();
    await first.done;
    // the quiz is updated, from a file with another name: version 2 is current
    t.write({
      "notes/week2.md": quizText("signals", "Signals", [
        ["q1", "First question, edited"],
        ["q2", "Second question"],
        ["q3", "Third question"],
      ]),
    });
    await t.register(["notes/week2.md"], { update: "signals" });
    const v2 = quizOf(t).current;
    expect(v2).not.toBe(v1);

    const run = take(t, "signals");
    const url = await run.url();
    expect(run.err.join("\n")).toMatch(
      new RegExp(
        `resuming your attempt of 18 Nov 14:00 \\(2 of 2 answered\\); the quiz has been updated since \\(now ${v2.slice(0, 4)}\\)`,
      ),
    );
    expect(run.err.join("\n")).toContain(`version ${v1.slice(0, 4)}`);
    // the page is the old version: two questions, not three
    const data = (await dataOf(url)) as { quizzes: { hash: string; sections: { questions: unknown[] }[] }[] };
    expect(data.quizzes[0]?.hash).toBe(v1);
    expect(data.quizzes[0]?.sections.reduce((n, s) => n + s.questions.length, 0)).toBe(2);
    await postTo(url, "submit", { quizId: "signals", attempt: attemptOf(v1) });
    expect(await run.done).toBe(0);
    const results = JSON.parse(readFileSync(join(t.lib, "quizzes", "signals", "results", `${STAMP}.json`), "utf8"));
    expect(results.quizHash).toBe(v1);

    // nothing saved any more: the next take serves the current version
    const next = take(t, "signals");
    const nextUrl = await next.url();
    expect(next.err.join("\n")).not.toContain("resuming");
    const nextData = (await dataOf(nextUrl)) as { quizzes: { hash: string }[] };
    expect(nextData.quizzes[0]?.hash).toBe(v2);
    next.interrupt();
    await next.done;
  });

  it("resumes the oldest of several saved attempts", async () => {
    const t = await library();
    const v1 = quizOf(t).current;
    t.write({
      "notes/signals.md": quizText("signals", "Signals", [
        ["q1", "First question, edited"],
        ["q2", "Second question"],
      ]),
    });
    await t.register(["notes/signals.md"], { update: "signals" });
    const v2 = quizOf(t).current;
    const dir = progressDir(t);
    mkdirSync(dir, { recursive: true });
    const saved = (hash: string, startedAt: string) => {
      const a = attemptOf(hash, { phase: "answering" });
      a.state.startedAt = startedAt;
      a.state.submittedAt = null;
      return `${JSON.stringify({ format: "fullmark-results", version: 2, ...a })}\n`;
    };
    writeFileSync(join(dir, `${v2}.json`), saved(v2, "2026-11-18T10:00:00"));
    writeFileSync(join(dir, `${v1}.json`), saved(v1, "2026-11-17T09:00:00"));
    const run = take(t, "signals");
    await run.url();
    expect(run.err.join("\n")).toContain("resuming your attempt of 17 Nov 09:00");
    run.interrupt();
    await run.done;
  });

  it("is refused while another take of the quiz is open: exit 2 with its url; a dead process's file is removed", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const dir = progressDir(t);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${hash}.serving.json`);
    writeFileSync(file, `${JSON.stringify({ pid: process.pid, url: "http://127.0.0.1:52811/tok/", started: "x" })}\n`);
    const refused = take(t, "signals");
    expect(await refused.done).toBe(2);
    expect(refused.err).toEqual([
      "error: signals is already open in another take (pid " + process.pid + ")",
      "    open: http://127.0.0.1:52811/tok/",
    ]);
    expect(JSON.parse(refused.out[0] ?? "")).toMatchObject({ status: "error", url: "http://127.0.0.1:52811/tok/" });
    expect(readFileSync(file, "utf8")).toContain("52811");

    // the same file, its process gone: removed, and the take goes ahead
    const gone = take(t, "signals", {}, { lock: { ...realLockEnv(), waitMs: 0, alive: () => false } });
    await gone.url();
    expect(JSON.parse(readFileSync(file, "utf8")).pid).toBe(process.pid);
    gone.interrupt();
    expect(await gone.done).toBe(2);
    expect(existsSync(file)).toBe(false);
  });

  it("when the lock is busy at filing, the answers stay in progress/<version>.submitted.json and the next take files them first", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const lock = join(t.lib, ".fullmark.lock");
    const run = take(t, "signals");
    const url = await run.url();
    writeFileSync(
      lock,
      `${JSON.stringify({ pid: process.pid, command: "quiz library grade signals", started: CLOCK.toISOString() })}\n`,
    );
    expect((await postTo(url, "submit", { quizId: "signals", attempt: attemptOf(hash) })).status).toBe(200);
    expect(await run.done).toBe(2);
    expect(run.err.join("\n")).toContain(`your answers are safe in progress/${hash}.submitted.json`);
    expect(run.err.join("\n")).toContain("run `quiz library take signals` again to file them");
    expect(names(progressDir(t))).toEqual([`${hash}.submitted.json`]);
    expect(existsSync(join(t.lib, "quizzes", "signals", "results"))).toBe(false);

    rmSync(lock);
    const next = take(t, "signals");
    expect(await next.done).toBe(0);
    expect(JSON.parse(next.out.at(-1) ?? "")).toMatchObject({
      status: "filed",
      results: expect.stringMatching(/^results\/\d{8}-\d{6}\.json$/),
    });
    expect(names(progressDir(t))).toEqual([]);
    expect(readdirSync(join(t.lib, "quizzes", "signals", "results"))).toHaveLength(1);
    expect((await git(t.lib, t.env, "log", "--format=%s", "-1")).trim()).toBe("fullmark: take signals");
  });

  it("--section serves one section as a new attempt and leaves a saved one alone", async () => {
    const text = `---\ntitle: Signals\nid: signals\n---\n\n# Part one {id=one}\n\n## One {type=single id=a1}\n\n- [x] Yes\n- [ ] No\n\n# Part two {id=two}\n\n## Two {type=single id=b1}\n\n- [x] Yes\n- [ ] No\n`;
    const t = await library(text);
    const hash = quizOf(t).current;
    const first = take(t, "signals");
    const partial = attemptOf(hash, { phase: "answering" }, ["a1", "b1"]);
    partial.state.submittedAt = null;
    await postTo(await first.url(), "progress", { quizId: "signals", attempt: partial });
    first.interrupt();
    await first.done;
    const saved = readFileSync(join(progressDir(t), `${hash}.json`), "utf8");

    const run = take(t, "signals", { section: "two" });
    const url = await run.url();
    expect(run.err.join("\n")).toContain("1 question");
    expect(run.err.join("\n")).not.toContain("resuming");
    expect((await dataOf(url)).section).toBe("two");
    const attempt = attemptOf(hash, { plan: { source: "section", section: "two", questions: ["b1"] } }, ["b1"]);
    attempt.state.answers = { b1: { choice: 0 } };
    attempt.state.startedAt = "2026-11-18T15:00:00";
    await postTo(url, "submit", { quizId: "signals", attempt });
    expect(await run.done).toBe(0);
    expect(JSON.parse(run.out.at(-1) ?? "").plan).toEqual({ source: "section", questions: ["b1"] });
    // the saved attempt on the same version is untouched
    expect(readFileSync(join(progressDir(t), `${hash}.json`), "utf8")).toBe(saved);

    const unknown = take(t, "signals", { section: "three" });
    expect(await unknown.done).toBe(2);
    expect(unknown.err.join("\n")).toContain(
      'unknown section "three"; the sections are: one (Part one), two (Part two)',
    );
  });

  it("exits 2 for an unknown quiz, and for a bad --timeout, --port or --fonts", async () => {
    const t = await library();
    const unknown = take(t, "signls");
    expect(await unknown.done).toBe(2);
    expect(unknown.err.join("\n")).toContain("no quiz named signls");
    for (const bad of [{ timeout: "-1" }, { port: "0" }, { fonts: "huge" }] as const) {
      const run = take(t, "signals", bad);
      expect(await run.done).toBe(2);
    }
  });
});

describe("library register beside a take", () => {
  it("does not take the serving or the submitted file for an attempt in progress", async () => {
    const t = await library();
    const hash = quizOf(t).current;
    const dir = progressDir(t);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${hash}.serving.json`), "{}\n");
    writeFileSync(join(dir, `${hash}.submitted.json`), "{}\n");
    t.write({ "notes/signals.md": quizText("signals", "Signals", [["q1", "First question, edited"]]) });
    const r = await t.register(["notes/signals.md"], { update: "signals" });
    expect(r.exit).toBe(0);
    expect(r.out.join("\n")).not.toContain("warning");
  });
});

describe("library take --missed", () => {
  it("serves only the missed questions of the history library, marks the changed one, and files a plan of source missed", async () => {
    const t = (await buildHistory()) as unknown as T;
    const run = take(t, "study-fixture", { missed: true });
    const url = await run.url();
    expect(run.err[0]).toBe(
      "study-fixture · missed questions · 4 from 7 attempts · 1 changed since you missed them · 1 no longer in the quiz",
    );
    const data = (await dataOf(url)) as {
      plan: { source: string; questions: string[] };
      changed: string[];
      quizzes: { sections: { id: string; questions: { id: string }[] }[]; timeLimit?: number }[];
    };
    expect(data.plan).toEqual({ source: "missed", questions: ["prime", "even", "add", "ielts"] });
    expect(data.changed).toEqual(["even"]);
    expect(data.quizzes[0]?.sections.map((s) => [s.id, s.questions.map((q) => q.id)])).toEqual([
      ["part-one", ["prime", "even"]],
      ["part-two", ["add", "ielts"]],
    ]);
    const hash = quizOf(t, "study-fixture").current;
    const attempt = attemptOf(hash, {}, ["prime", "even"]);
    attempt.plan = { source: "missed", questions: ["prime", "even", "add", "ielts"] };
    attempt.state.answers = { prime: { choice: 1 }, even: { value: true }, add: null, ielts: null };
    expect((await postTo(url, "submit", { quizId: "study", attempt })).status).toBe(200);
    expect(await run.done).toBe(0);
    const filed = JSON.parse(run.out.at(-1) ?? "");
    expect(filed).toMatchObject({
      status: "filed",
      plan: { source: "missed", questions: ["prime", "even", "add", "ielts"] },
      gone: 1,
    });
    expect(run.err.join("\n")).toMatch(/filed results\/\d{8}-\d{6}\.json · 2 of 4 right · /);
    expect(names(progressDir(t, "study"))).toEqual([]);
  });

  it("with --section keeps the missed questions of that section", async () => {
    const t = (await buildHistory()) as unknown as T;
    const run = take(t, "study-fixture", { missed: true, section: "part-two" });
    const url = await run.url();
    expect(run.err[0]).toBe("study-fixture · missed questions of part-two · 2 from 7 attempts");
    expect(((await dataOf(url)) as { plan: { questions: string[] } }).plan.questions).toEqual(["add", "ielts"]);
    run.interrupt();
    await run.done;
  });

  it("says nothing missed, serves nothing, and exits 0 (with --json: {status: nothing_missed})", async () => {
    const t = await library();
    const none = take(t, "signals", { missed: true, json: false });
    expect(await none.done).toBe(0);
    expect(none.out).toEqual(["nothing missed: there is no attempt yet"]);
    // an attempt with everything right: nothing is missed
    const hash = quizOf(t).current;
    const run = take(t, "signals");
    await postTo(await run.url(), "submit", { quizId: "signals", attempt: attemptOf(hash, {}, ["q1"]) });
    expect(await run.done).toBe(0);
    const again = take(t, "signals", { missed: true });
    expect(await again.done).toBe(0);
    expect(again.out).toEqual(['{"status":"nothing_missed"}']);
    expect(again.err).toEqual(["nothing missed: every question you got wrong has been answered right since"]);
  });
});
