import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryGradeIo, LibraryGradeOptions } from "../src/cli/library-grade";
import { runLibraryGrade } from "../src/cli/library-grade";
import type { GradeData } from "../src/grade-form/data";
import { realLockEnv } from "../src/library/lock";
import { cleanTemps, git } from "./helpers/library";
import {
  fileAttempt,
  filledGrades,
  GRADE_CLOCK,
  gradeOptions,
  names,
  quizOf,
  type T,
  writingLibrary,
} from "./helpers/library-grade";

/**
 * `library grade --web`, in-process: the server binds 127.0.0.1 on port 0 and is driven with `fetch`; the clock, the
 * timer, Ctrl+C, the opener and the lock's wait are injected, so no test waits for a real one. Git is real, in a temp
 * folder. The form is `quiz grade --web`'s (test/grade/web.test.ts); these cover where the grades go.
 */
afterEach(cleanTemps);

const STAMP = "20261115-093012";
const AI = { kind: "ai" as const, name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-11-18T14:00:00+00:00" };

type Doc = { format: string; version: number; grader: unknown; grades: Record<string, Record<string, unknown>> };

const dirs = (t: T) => {
  const q = join(t.lib, "quizzes", "writing");
  return { q, grades: join(q, "grades"), reports: join(q, "reports"), progress: join(q, "progress") };
};

/** The page runtime: stand-ins, since a unit test reads the served page's data block and never runs it. */
function runtimeIn(t: T): string {
  const runtime = join(t.dir, "runtime");
  mkdirSync(runtime, { recursive: true });
  for (const f of ["grade.js", "page.js", "page.css", "grade.css"]) writeFileSync(join(runtime, f), `/* ${f} */`);
  return runtime;
}

/** A form in progress: its output, the url once it listens, and the hands that end it. */
function web(t: T, extra: Partial<LibraryGradeOptions> = {}, io: Partial<LibraryGradeIo> = {}) {
  const c = t.at();
  let interrupt: (() => void) | undefined;
  let fire: (() => void) | undefined;
  const opened: string[] = [];
  const full: LibraryGradeIo = {
    ...c.io,
    now: () => GRADE_CLOCK,
    runtimeDir: runtimeIn(t),
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
    ...io,
  };
  const done = runLibraryGrade("writing", gradeOptions({ web: true, json: true, ...extra }), full);
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

const post = (url: string, body: unknown) =>
  fetch(`${url}submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${new URL(url).port}` },
    body: JSON.stringify(body),
  });

async function dataOf(url: string): Promise<GradeData> {
  const html = await (await fetch(url)).text();
  return JSON.parse(/<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "");
}

/** What the form sends: the grades document and the quiz and version it is for. */
async function save(url: string, doc: Doc) {
  const data = await dataOf(url);
  return post(url, { quizId: data.quizId, quizHash: data.quizHash, grades: doc });
}

/** The template through the command (`--json`), filled; the form's document. */
async function docOf(t: T, scores = { a: 2, b: 1 }, name = "Minh Tran"): Promise<Doc> {
  const c = t.at();
  const exit = await runLibraryGrade("writing", gradeOptions({ attempt: STAMP, json: true }), {
    ...c.io,
    now: () => GRADE_CLOCK,
  });
  expect(exit).toBe(0);
  const path = join(t.dir, `writing-${STAMP}-grades.json`);
  const template = JSON.parse(readFileSync(path, "utf8"));
  rmSync(path);
  const doc = JSON.parse(filledGrades(template, { kind: "human", name }, scores)) as Doc;
  doc.grader = null;
  return doc;
}

async function oneAttempt() {
  const t = await writingLibrary();
  await fileAttempt(t, STAMP, quizOf(t, "writing").current, "A long answer.");
  return t;
}

describe("library grade --web", () => {
  it("serves the form for the attempt; Save keeps the grades as a human's, writes the report and makes one commit", async () => {
    const t = await oneAttempt();
    const hash = quizOf(t, "writing").current;
    const doc = await docOf(t);
    const run = web(t, { open: true, name: "Minh Tran" });
    const url = await run.url();
    expect(run.opened).toEqual([url]);
    expect(run.err[0]).toBe(`writing · attempt ${STAMP} · version ${hash.slice(0, 4)}`);
    expect(run.err[1]).toBe(`serving ${url}  (opened in your browser)`);
    const data = await dataOf(url);
    expect(data.items.map((i) => i.id)).toEqual(["desc"]);
    expect(data.files).toEqual({
      grades: `grades/${STAMP}-….json`.replace("….json", "…-grades.json"),
      report: `reports/${STAMP}-report.md`,
    });
    const before = (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n").length;
    expect((await save(url, doc)).status).toBe(200);
    expect(await run.done).toBe(0);

    const kept = `grades/${STAMP}-20261118-150212-grades.json`;
    const file = JSON.parse(readFileSync(join(dirs(t).q, kept), "utf8"));
    expect(file.grader).toMatchObject({ kind: "human", name: "Minh Tran" });
    expect(JSON.parse(run.out.at(-1) ?? "")).toMatchObject({
      status: "written",
      attempt: STAMP,
      grades: kept,
      template: null,
      graded: 1,
      pending: 0,
    });
    expect(run.err.slice(-4, -1)).toEqual([
      "",
      `grades kept ${kept} · human, Minh Tran`,
      "report reports/20261115-093012-report.md · 80% · nothing pending",
    ]);
    expect(run.err.at(-1)).toMatch(/^committed [0-9a-f]+ fullmark: grade writing$/);
    // the progress file is gone, the report is there, and one commit holds the three files
    expect(names(dirs(t).progress)).toEqual([]);
    expect(names(dirs(t).reports)).toEqual([`${STAMP}-report.json`, `${STAMP}-report.md`]);
    const log = (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");
    expect(log).toHaveLength(before + 1);
    expect(log[0]).toBe("fullmark: grade writing");
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim().split("\n")).toEqual([
      `quizzes/writing/${kept}`,
      `quizzes/writing/reports/${STAMP}-report.json`,
      `quizzes/writing/reports/${STAMP}-report.md`,
    ]);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("is pre-filled from the newest grades kept, names their grader in the heading, and marks each question it keeps as reviewed", async () => {
    const t = await oneAttempt();
    const doc = await docOf(t);
    const aiFile = join(t.dir, "ai.json");
    const ai = JSON.parse(JSON.stringify(doc)) as Doc;
    ai.grader = AI;
    writeFileSync(aiFile, `${JSON.stringify({ ...ai, results_hash: await resultsHashOf(t) }, null, 2)}\n`);
    const kept = await runLibraryGrade("writing", gradeOptions({ grades: aiFile }), {
      ...t.at().io,
      now: () => GRADE_CLOCK,
    });
    expect(kept).toBe(0);

    const run = web(t, { name: "Minh Tran" });
    const url = await run.url();
    expect(run.err[0]).toMatch(/ · pre-filled from Claude Opus 5\.5’s grades$/);
    const data = await dataOf(url);
    expect(JSON.stringify(data.items[0])).toContain("Claude Opus 5.5");
    // saved as it came: the person is the grader, the question names the AI it was pre-filled from
    expect((await save(url, doc)).status).toBe(200);
    expect(await run.done).toBe(0);
    expect(names(dirs(t).grades)).toEqual([
      `${STAMP}-20261118-150212-grades.json`,
      `${STAMP}-20261118-150213-grades.json`,
    ]);
    const second = JSON.parse(readFileSync(join(dirs(t).grades, `${STAMP}-20261118-150213-grades.json`), "utf8"));
    expect(second.grader.kind).toBe("human");
    expect(second.grades.desc.reviewed).toMatchObject({ kind: "ai", name: "Claude Opus 5.5" });
  });

  it("answers 400 to a submit with a problem and keeps waiting; the next good one is kept", async () => {
    const t = await oneAttempt();
    const doc = await docOf(t);
    const run = web(t, { name: "Minh Tran" });
    const url = await run.url();
    const bad = JSON.parse(JSON.stringify(doc)) as Doc;
    (bad.grades.desc?.criteria as Record<string, { score: number }>).a = { score: 99 } as never;
    const reply = await save(url, bad);
    expect(reply.status).toBe(400);
    expect(names(dirs(t).progress)).toEqual([]);
    expect(names(dirs(t).grades)).toEqual([]);
    expect((await save(url, doc)).status).toBe(200);
    expect(await run.done).toBe(0);
    expect(names(dirs(t).grades)).toHaveLength(1);
  });

  it("keeps the grades in progress/ when the lock is busy (exit 2); the next library grade keeps them first, and ends with the next step (G29)", async () => {
    const t = await oneAttempt();
    const doc = await docOf(t);
    const before = (await git(t.lib, t.env, "rev-parse", "HEAD")).trim();
    const run = web(t, { name: "Minh Tran" });
    const url = await run.url();
    const lock = join(t.lib, ".fullmark.lock");
    writeFileSync(
      lock,
      `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-18T14:22:10.000Z" })}\n`,
    );
    expect((await save(url, doc)).status).toBe(200);
    expect(await run.done).toBe(2);
    const errors = run.err.join("\n");
    expect(errors).toContain(`your grades are safe in progress/${STAMP}.grades.json`);
    expect(errors).toContain("run `quiz library grade writing` again to keep them");
    expect(names(dirs(t).progress)).toEqual([`${STAMP}.grades.json`]);
    expect(names(dirs(t).grades)).toEqual([]);
    expect((await git(t.lib, t.env, "rev-parse", "HEAD")).trim()).toBe(before);

    rmSync(lock);
    // with or without --web, the leftover is kept first and nothing is served
    const next = web(t, {}, {});
    expect(await next.done).toBe(0);
    expect(next.err).toEqual([
      `writing · attempt ${STAMP} · version ${quizOf(t, "writing").current.slice(0, 4)}`,
      `note keeping the grades an earlier form saved in progress/${STAMP}.grades.json`,
      `grades kept grades/${STAMP}-20261118-150212-grades.json · human, Minh Tran`,
      "report reports/20261115-093012-report.md · 80% · nothing pending",
      expect.stringMatching(/^committed [0-9a-f]+ fullmark: grade writing$/),
      "next: quiz library grade writing",
    ]);
    expect(next.out.some((l) => l.includes("listening"))).toBe(false);
    expect(names(dirs(t).progress)).toEqual([]);
    expect(names(dirs(t).grades)).toHaveLength(1);
    expect((await git(t.lib, t.env, "log", "--format=%s", "-1")).trim()).toBe("fullmark: grade writing");
  });

  it("writes nothing and commits nothing on the timeout and on Ctrl+C (exit 2)", async () => {
    const t = await oneAttempt();
    const head = (await git(t.lib, t.env, "rev-parse", "HEAD")).trim();
    const first = web(t, { timeout: "30" });
    await first.url();
    first.timeout();
    expect(await first.done).toBe(2);
    expect(JSON.parse(first.out.at(-1) ?? "")).toEqual({ status: "timeout" });
    expect(first.err.join("\n")).toContain("timed out after 30 seconds without Save grades; nothing was written");
    const second = web(t);
    await second.url();
    second.interrupt();
    expect(await second.done).toBe(2);
    expect(JSON.parse(second.out.at(-1) ?? "")).toEqual({ status: "interrupted" });
    expect(names(dirs(t).progress)).toEqual([]);
    expect(names(dirs(t).grades)).toEqual([]);
    expect(names(dirs(t).reports)).toEqual([]);
    expect((await git(t.lib, t.env, "rev-parse", "HEAD")).trim()).toBe(head);
  });

  it("says there is nothing to grade, serves nothing and exits 0, for an attempt with no essay answered", async () => {
    const t = await writingLibrary();
    await fileAttempt(t, STAMP, quizOf(t, "writing").current, null);
    const run = web(t, { json: false });
    expect(await run.done).toBe(0);
    expect(run.out.at(-1)).toBe(
      "nothing to grade: no essay or code question was answered; quiz library grade writing writes the report",
    );
    expect(names(dirs(t).reports)).toEqual([]);
  });

  it("checks --timeout and --port before it serves, as take does", async () => {
    const t = await oneAttempt();
    const bad = web(t, { timeout: "soon" });
    expect(await bad.done).toBe(2);
    expect(bad.err.join("\n")).toContain("--timeout soon is not a number of seconds (0 waits forever)");
    const port = web(t, { port: "0" });
    expect(await port.done).toBe(2);
    expect(port.err.join("\n")).toContain("--port 0 is not a port number (1 to 65535)");
  });
});

async function resultsHashOf(t: T): Promise<string> {
  const { resultsHash } = await import("../src/core/rubric/grades");
  return resultsHash(JSON.parse(readFileSync(join(dirs(t).q, "results", `${STAMP}.json`), "utf8")));
}
