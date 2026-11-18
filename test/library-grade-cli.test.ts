import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanTemps, git, quizCli } from "./helpers/library";
import { fileAttempt, filledGrades, quizOf, writingLibrary } from "./helpers/library-grade";

/** `library grade` as a program with `--json`, with real git in a temporary folder (the contract of COMMANDS.md). */
afterEach(cleanTemps);

describe("library grade --json, as a subprocess", () => {
  it("writes the template, then keeps a filled file with --grades, and every line parses as the contract says", async () => {
    const t = await writingLibrary();
    const hash = quizOf(t, "writing").current;
    const stamp = "20261115-093012";
    await fileAttempt(t, stamp, hash, "A long answer.");
    const run = (...args: string[]) => quizCli(["library", "grade", "writing", ...args], t.dir, t.env);

    const first = await run("--json");
    expect(first.exit).toBe(0);
    const written = JSON.parse(first.stdout.trim());
    expect(Object.keys(written)).toEqual([
      "status",
      "attempt",
      "version",
      "report",
      "grades",
      "template",
      "graded",
      "pending",
      "committed",
    ]);
    expect(written).toMatchObject({
      status: "written",
      attempt: stamp,
      version: hash,
      report: `reports/${stamp}-report.md`,
      grades: null,
      template: `writing-${stamp}-grades.json`,
      graded: 0,
      pending: 1,
    });
    expect(first.stderr).toContain(`report reports/${stamp}-report.md · 100%* · 1 essay waiting for a grade`);
    expect((await git(t.lib, t.env, "log", "--format=%s", "-1")).trim()).toBe("fullmark: grade writing");

    const template = JSON.parse(readFileSync(join(t.dir, written.template), "utf8"));
    writeFileSync(
      join(t.dir, "filled.json"),
      filledGrades(template, { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5" }, { a: 2, b: 2 }),
    );
    const second = await run("--grades", "filled.json", "--json");
    expect(second.exit).toBe(0);
    const kept = JSON.parse(second.stdout.trim());
    expect(kept).toMatchObject({
      status: "written",
      grades: `grades/${stamp}-20261118-142210-grades.json`,
      template: null,
      graded: 1,
      pending: 0,
    });
    expect(second.stderr).toContain(`grades kept grades/${stamp}-20261118-142210-grades.json · ai, Claude Opus 5.5`);
    expect(existsSync(join(t.lib, "quizzes", "writing", kept.grades))).toBe(true);
    const files = (await git(t.lib, t.env, "show", "--name-only", "--format=%s", "HEAD")).trim().split("\n");
    expect(files[0]).toBe("fullmark: grade writing");
    expect(files.slice(1).filter(Boolean)).toEqual([
      `quizzes/writing/grades/${stamp}-20261118-142210-grades.json`,
      `quizzes/writing/reports/${stamp}-report.json`,
      `quizzes/writing/reports/${stamp}-report.md`,
    ]);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
  });

  it("exits 1 for invalid grades and 2 for an unknown attempt, with {status: error} on stdout under --json", async () => {
    const t = await writingLibrary();
    await fileAttempt(t, "20261115-093012", quizOf(t, "writing").current, "A long answer.");
    writeFileSync(join(t.dir, "bad.json"), '{"format":"fullmark-grades","version":2,"grades":{}}');
    const bad = await quizCli(["library", "grade", "writing", "--grades", "bad.json", "--json"], t.dir, t.env);
    expect(bad.exit).toBe(1);
    expect(JSON.parse(bad.stdout.trim())).toMatchObject({ status: "problems", file: "bad.json" });
    const unknown = await quizCli(
      ["library", "grade", "writing", "--attempt", "20300101-000000", "--json"],
      t.dir,
      t.env,
    );
    expect(unknown.exit).toBe(2);
    expect(JSON.parse(unknown.stdout.trim())).toMatchObject({ status: "error" });
  });
});
