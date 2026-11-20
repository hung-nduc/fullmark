import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git } from "./helpers/library";
import {
  fileAttempt,
  filledGrades,
  GRADE_STAMP,
  grade,
  names,
  quizOf,
  type T,
  WRITING,
  writingLibrary,
} from "./helpers/library-grade";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/**
 * `library grade`, in-process, with real git in a temp folder, the fixed clock and a lock that never waits. The
 * subprocess contract tests of `--json` are in library-grade-cli.test.ts.
 */
afterEach(cleanTemps);

const AI = { kind: "ai" as const, name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-11-18T14:00:00+00:00" };
const HUMAN = { kind: "human" as const, name: "Minh Tran", at: "2026-11-18T16:00:00+00:00" };
const ESSAY = "A long answer.";

const dirs = (t: T) => {
  const q = join(t.lib, "quizzes", "writing");
  return { q, grades: join(q, "grades"), reports: join(q, "reports"), progress: join(q, "progress") };
};

/** The empty template of an attempt, through the command (`--json`), read back and removed. */
async function templateOf(t: T, stamp: string) {
  const run = await grade(t, "writing", { attempt: stamp, json: true });
  expect(run.exit).toBe(0);
  const path = join(t.dir, `writing-${stamp}-grades.json`);
  const text = readFileSync(path, "utf8");
  return { run, path, template: JSON.parse(text) as Record<string, unknown> };
}

/** A library with one attempt taken on version 1, an essay answered. */
async function oneAttempt() {
  const t = await writingLibrary();
  const hash = quizOf(t, "writing").current;
  await fileAttempt(t, "20261115-093012", hash, ESSAY);
  return { t, hash, stamp: "20261115-093012" };
}

describe("library grade: which attempt (G28)", () => {
  it("is the newest with an essay waiting for a grade, else the newest", async () => {
    const t = await writingLibrary();
    const hash = quizOf(t, "writing").current;
    await fileAttempt(t, "20261115-093012", hash, ESSAY);
    await fileAttempt(t, "20261116-100000", hash, null);
    // the essay of the first attempt waits; the second has none answered
    const first = await grade(t, "writing");
    expect(first.exit).toBe(0);
    expect(first.out[0]).toBe(`writing · attempt 20261115-093012 · version ${hash.slice(0, 4)}`);
    expect(first.out[1]).toBe("report reports/20261115-093012-report.md · 100%* · 1 essay waiting for a grade");
    // nothing waits for a grade once it is graded: the newest attempt is taken
    const { template } = await templateOf(t, "20261115-093012");
    const file = join(t.dir, "ai.json");
    writeFileSync(file, filledGrades(template, AI, { a: 2, b: 1 }));
    expect((await grade(t, "writing", { grades: file })).exit).toBe(0);
    const next = await grade(t, "writing");
    expect(next.out[0]).toBe(`writing · attempt 20261116-100000 · version ${hash.slice(0, 4)}`);
    expect(next.out[1]).toBe("report reports/20261116-100000-report.md · 20% · nothing pending");
  });

  it("takes a stamp or a prefix of 4 or more characters; an unknown one, a short or an ambiguous one exits 2", async () => {
    const t = await writingLibrary();
    const hash = quizOf(t, "writing").current;
    await fileAttempt(t, "20261115-093012", hash, ESSAY);
    await fileAttempt(t, "20261115-100000", hash, ESSAY);
    const ok = await grade(t, "writing", { attempt: "20261115-0930" });
    expect(ok.exit).toBe(0);
    expect(ok.out[0]).toContain("attempt 20261115-093012");
    const ambiguous = await grade(t, "writing", { attempt: "2026111" });
    expect(ambiguous.exit).toBe(2);
    expect(ambiguous.err).toEqual([
      "error: 2026111 matches 2 attempts: 20261115-093012, 20261115-100000",
      "    fix: give more of the stamp",
    ]);
    for (const wanted of ["202", "20261201-000000"]) {
      const run = await grade(t, "writing", { attempt: wanted });
      expect(run.exit).toBe(2);
      expect(run.err[0]).toBe(`error: no attempt ${wanted} of writing`);
    }
  });

  it("exits 2 for a quiz with no attempts and for an unknown quiz", async () => {
    const t = await writingLibrary();
    const none = await grade(t, "writing");
    expect(none.exit).toBe(2);
    expect(none.err).toEqual(["error: writing has no attempt yet", "    fix: quiz library take writing"]);
    const unknown = await grade(t, "writng");
    expect(unknown.exit).toBe(2);
    expect(unknown.err[0]).toBe("error: no quiz named writng");
  });
});

describe("library grade: the grades used", () => {
  it("--grades: the file is kept as given (its bytes) under the injected clock, the report is written, one commit holds the three files", async () => {
    const { t, hash, stamp } = await oneAttempt();
    const { template, path } = await templateOf(t, stamp);
    const file = join(t.dir, "downloads.json");
    // odd spacing: kept byte for byte, never rewritten
    const text = filledGrades(template, AI, { a: 2, b: 1 }).replace('"format": ', '"format":  ');
    writeFileSync(file, text);
    expect(existsSync(path)).toBe(true);
    const before = (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n").length;
    const run = await grade(t, "writing", { grades: file });
    expect(run.exit).toBe(0);
    const kept = `${stamp}-${GRADE_STAMP}-grades.json`;
    expect(readFileSync(join(dirs(t).grades, kept), "utf8")).toBe(text);
    expect(run.out.slice(0, 3)).toEqual([
      `writing · attempt ${stamp} · version ${hash.slice(0, 4)}`,
      `grades kept grades/${kept} · ai, Claude Opus 5.5`,
      "report reports/20261115-093012-report.md · 80% · nothing pending",
    ]);
    expect(run.out[3]).toMatch(/^committed [0-9a-f]+ fullmark: grade writing$/);
    const log = (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");
    expect(log).toHaveLength(before + 1);
    expect(log[0]).toBe("fullmark: grade writing");
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim().split("\n")).toEqual([
      `quizzes/writing/grades/${kept}`,
      `quizzes/writing/reports/${stamp}-report.json`,
      `quizzes/writing/reports/${stamp}-report.md`,
    ]);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
    const report = JSON.parse(readFileSync(join(dirs(t).reports, `${stamp}-report.json`), "utf8"));
    expect(report.score).toMatchObject({ earned: 4, points: 5, pending: 0 });
    expect(report.quiz.hash).toBe(hash);
  });

  it("keeps every grades file: two in one second get the next free second, and none is overwritten", async () => {
    const { t, stamp } = await oneAttempt();
    const { template } = await templateOf(t, stamp);
    const one = join(t.dir, "one.json");
    const two = join(t.dir, "two.json");
    writeFileSync(one, filledGrades(template, AI, { a: 2, b: 1 }));
    writeFileSync(two, filledGrades(template, HUMAN, { a: 1, b: 1 }, "Adjusted."));
    expect((await grade(t, "writing", { grades: one })).exit).toBe(0);
    expect((await grade(t, "writing", { grades: two })).exit).toBe(0);
    expect(names(dirs(t).grades)).toEqual([
      `${stamp}-20261118-150212-grades.json`,
      `${stamp}-20261118-150213-grades.json`,
    ]);
    expect(readFileSync(join(dirs(t).grades, `${stamp}-20261118-150212-grades.json`), "utf8")).toContain("Claude Opus");
    // the newest counts: the report is the person's
    const report = JSON.parse(readFileSync(join(dirs(t).reports, `${stamp}-report.json`), "utf8"));
    expect(report.score).toMatchObject({ earned: 3, points: 5, percent: 60 });
    expect(report.open[0].grade.graded_by).toMatchObject({ kind: "human", name: "Minh Tran" });
  });

  it("without --grades, the newest kept file of the attempt counts and nothing new is kept; with none kept, the essay stays pending", async () => {
    const { t, stamp } = await oneAttempt();
    const none = await grade(t, "writing", { attempt: stamp });
    expect(none.out[1]).toContain("100%* · 1 essay waiting for a grade");
    expect(names(dirs(t).grades)).toEqual([]);
    const { template } = await templateOf(t, stamp);
    const file = join(t.dir, "ai.json");
    writeFileSync(file, filledGrades(template, AI, { a: 2, b: 2 }));
    await grade(t, "writing", { grades: file });
    const again = await grade(t, "writing", { attempt: stamp });
    expect(again.exit).toBe(0);
    expect(again.out).toEqual([
      `writing · attempt ${stamp} · version ${quizOf(t, "writing").current.slice(0, 4)}`,
      "report reports/20261115-093012-report.md · 100% · nothing pending",
    ]);
    expect(names(dirs(t).grades)).toHaveLength(1);
  });

  it("replaces the report each time: ungraded, then graded, as the report of the newest grades", async () => {
    const { t, stamp } = await oneAttempt();
    await grade(t, "writing");
    const first = readFileSync(join(dirs(t).reports, `${stamp}-report.md`), "utf8");
    const { template } = await templateOf(t, stamp);
    const file = join(t.dir, "ai.json");
    writeFileSync(file, filledGrades(template, AI, { a: 1, b: 1 }));
    await grade(t, "writing", { grades: file });
    const second = readFileSync(join(dirs(t).reports, `${stamp}-report.md`), "utf8");
    expect(second).not.toBe(first);
    expect(second).toContain("Claude Opus 5.5");
    expect(names(dirs(t).reports)).toEqual([`${stamp}-report.json`, `${stamp}-report.md`]);
  });

  it("an invalid --grades file exits 1 with every problem, and writes and commits nothing", async () => {
    const { t, stamp } = await oneAttempt();
    const { template } = await templateOf(t, stamp);
    const bad = JSON.parse(filledGrades(template, AI, { a: 9, b: 9 }));
    bad.grades.nope = { mode: "additive" };
    const file = join(t.dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    const head = await git(t.lib, t.env, "rev-parse", "HEAD");
    const reports = names(dirs(t).reports);
    const run = await grade(t, "writing", { grades: file });
    expect(run.exit).toBe(1);
    expect(run.err[0]).toBe("error: bad.json: invalid grades");
    expect(run.err.length).toBeGreaterThan(2);
    expect(names(dirs(t).grades)).toEqual([]);
    expect(names(dirs(t).reports)).toEqual(reports);
    expect(await git(t.lib, t.env, "rev-parse", "HEAD")).toBe(head);
    // an unreadable file is a usage error, a grades file of another format a problem
    expect((await grade(t, "writing", { grades: join(t.dir, "missing.json") })).exit).toBe(2);
    writeFileSync(file, "{}");
    expect((await grade(t, "writing", { grades: file })).exit).toBe(1);
  });

  it("grades an attempt on an old version against that version, not the current one", async () => {
    const { t, hash, stamp } = await oneAttempt();
    // version 2 renames the criteria: grades made for the first would not fit it
    t.write({ "notes/writing.md": WRITING.replace("Part A", "Part One") });
    await t.register(["notes/writing.md"], { update: "writing" });
    const second = quizOf(t, "writing").current;
    expect(second).not.toBe(hash);
    const { template } = await templateOf(t, stamp);
    const file = join(t.dir, "old.json");
    writeFileSync(file, filledGrades(template, AI, { a: 2, b: 2 }));
    const run = await grade(t, "writing", { grades: file });
    expect(run.exit).toBe(0);
    expect(run.out[0]).toBe(`writing · attempt ${stamp} · version ${hash.slice(0, 4)}`);
    const report = JSON.parse(readFileSync(join(dirs(t).reports, `${stamp}-report.json`), "utf8"));
    expect(report.quiz.hash).toBe(hash);
  });
});

describe("library grade --json and the template (G27)", () => {
  it("writes the empty template into the working directory, never into grades/, and skips an existing one with a warning", async () => {
    const { t, stamp } = await oneAttempt();
    const run = await grade(t, "writing", { json: true });
    expect(run.exit).toBe(0);
    const written = JSON.parse(run.out[0] ?? "");
    expect(written).toMatchObject({
      status: "written",
      attempt: stamp,
      grades: null,
      template: `writing-${stamp}-grades.json`,
      graded: 0,
      pending: 1,
    });
    expect(written.committed).toMatch(/^[0-9a-f]+$/);
    const path = join(t.dir, `writing-${stamp}-grades.json`);
    const template = JSON.parse(readFileSync(path, "utf8"));
    expect(template).toMatchObject({ format: "fullmark-grades", version: 2, grader: null });
    expect(Object.keys(template.grades)).toEqual(["desc"]);
    expect(names(dirs(t).grades)).toEqual([]);

    // a grader's work in progress is never overwritten
    writeFileSync(path, "mine");
    const again = await grade(t, "writing", { json: true });
    expect(JSON.parse(again.out[0] ?? "").template).toBeNull();
    expect(again.err.join("\n")).toContain(
      `warning: writing-${stamp}-grades.json already exists, so no grades template was written; delete it for a fresh template`,
    );
    expect(readFileSync(path, "utf8")).toBe("mine");
  });

  it("writes no template for an attempt with no essay answered, nor with --grades", async () => {
    const t = await writingLibrary();
    const hash = quizOf(t, "writing").current;
    await fileAttempt(t, "20261115-093012", hash, null);
    const run = await grade(t, "writing", { json: true });
    expect(JSON.parse(run.out[0] ?? "")).toMatchObject({ template: null, pending: 0 });
    expect(existsSync(join(t.dir, "writing-20261115-093012-grades.json"))).toBe(false);
  });
});

describe("library grade: the lock", () => {
  it("exits 2 when the library is busy, and writes nothing", async () => {
    const { t } = await oneAttempt();
    writeFileSync(
      join(t.lib, ".fullmark.lock"),
      `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-18T14:22:10.000Z" })}\n`,
    );
    const run = await grade(t, "writing");
    expect(run.exit).toBe(2);
    expect(run.err[0]).toMatch(
      /^error: the library is busy: quiz library register notes\/\*\.md \(pid \d+\) has held it for/,
    );
    expect(run.err[1]).toBe("    fix: run the command again when it finishes");
    expect(names(dirs(t).reports)).toEqual([]);
  });

  it("refuses --name without --web, and --grades with --web", async () => {
    const { t } = await oneAttempt();
    expect((await grade(t, "writing", { name: "Minh" })).err).toEqual(["error: --name names the grader of --web"]);
    const both = await grade(t, "writing", { web: true, grades: "x.json" });
    expect(both.exit).toBe(2);
    expect(both.err[0]).toContain("--web takes no --grades");
  });
});
