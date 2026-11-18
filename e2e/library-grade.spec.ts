// biome-ignore-all lint/suspicious/noExplicitAny: a test reads the grades file loosely
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { historyLibrary, root, type Served, serveProcess } from "./helpers";

/**
 * `quiz library grade --web` as a subprocess (STEP4.md, slice 4e): on the history library, an attempt with an essay
 * waiting, graded first by an AI through `--grades`; the form opens pre-filled from those grades, one score is adjusted,
 * the name is given and **Save grades** keeps a second file (`kind: human`, `reviewed`), writes the report and commits.
 * The form is `quiz grade --web`'s own (e2e/grade-prefilled.spec.ts); this covers where the grades go.
 */
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

const STAMP = "20261116-201412";
const AI = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-11-18T14:00:00+00:00" };

test("library grade --web is pre-filled from the AI's grades, and Save keeps a human's file, the report and one commit", async ({
  page,
}) => {
  const t = historyLibrary();
  const env = { ...process.env, ...t.env };
  const quiz = (...args: string[]) =>
    execFileSync(process.execPath, [join(root, "dist", "cli.js"), "library", ...args], {
      cwd: t.dir,
      env,
      encoding: "utf8",
    });
  const gitOut = (...args: string[]) => execFileSync("git", ["-C", t.lib, ...args], { env, encoding: "utf8" });

  // the AI's grades first, kept through `--grades`
  copyFileSync(join(root, "test", "golden", "library", "grade-grades", "input", "grades.json"), join(t.dir, "ai.json"));
  quiz("grade", "study-fixture", "--grades", "ai.json", "--plain");

  const server = await serveProcess(
    t.dir,
    ["library", "grade", "study-fixture", "--web", "--no-open", "--attempt", STAMP, "--name", "Minh Tran"],
    t.env,
  );
  served.push(server);
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();

  // pre-filled from the AI's grades: the pill says so, and the derive row shows the AI's mark
  await expect(page.locator(".fm-status-pill")).toHaveText("Pre-filled · 1 as given, 0 adjusted");
  await expect(page.locator(".fm-status-pill")).toHaveAttribute("title", "Pre-filled from Claude Opus 5.5 (1)");
  const derive = page.locator('[data-crit="derive"]');
  await expect(derive.locator("input.fm-ctl-value")).toHaveValue("1");
  // one score adjusted
  await derive.locator("[data-act=more]").click();
  await expect(page.locator(".fm-status-pill")).toHaveText("Pre-filled · 0 as given, 1 adjusted");
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText("Grades saved");

  const end = await server.end();
  expect(end.code).toBe(0);
  const written = end.lines.at(-1) as Record<string, unknown>;
  expect(written).toMatchObject({
    status: "written",
    attempt: STAMP,
    report: `reports/${STAMP}-report.md`,
    template: null,
    graded: 1,
    pending: 0,
  });
  // the AI's file kept first (second :10), the person's next (the next free second)
  const kept = String(written.grades);
  expect(kept).toBe(`grades/${STAMP}-20261118-142211-grades.json`);
  const quizDir = join(t.lib, "quizzes", "study");
  expect(readdirSync(join(quizDir, "grades")).filter((f) => f.startsWith(STAMP))).toEqual([
    `${STAMP}-20261118-142210-grades.json`,
    `${STAMP}-20261118-142211-grades.json`,
  ]);
  const file = JSON.parse(readFileSync(join(quizDir, kept), "utf8"));
  expect(file.grader).toMatchObject({ kind: "human", name: "Minh Tran" });
  expect(file.grades.add.criteria.derive.score).toBe(1.25);
  expect(file.grades.add.reviewed).toMatchObject({ kind: "ai", name: AI.name });

  // the report is the person's, and one commit holds the kept file and the report
  const report = JSON.parse(readFileSync(join(quizDir, "reports", `${STAMP}-report.json`), "utf8"));
  expect(report.open.find((o: any) => o.id === "add").grade.graded_by).toMatchObject({
    kind: "human",
    name: "Minh Tran",
  });
  expect(gitOut("log", "--format=%s", "-1")).toBe("fullmark: grade study-fixture\n");
  expect(gitOut("show", "--name-only", "--format=", "HEAD").trim().split("\n")).toEqual([
    `quizzes/study/${kept}`,
    `quizzes/study/reports/${STAMP}-report.json`,
    `quizzes/study/reports/${STAMP}-report.md`,
  ]);
  expect(gitOut("status", "--porcelain")).toBe("");
  expect(existsSync(join(quizDir, "progress", `${STAMP}.grades.json`))).toBe(false);
  expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  expect(end.stderr).toContain(`grades kept ${kept} · human, Minh Tran`);
});

test("when the library is busy at Save, the card says the grades are saved but not filed, and names the command (G32)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const t = historyLibrary();
  const env = { ...process.env, ...t.env };
  copyFileSync(join(root, "test", "golden", "library", "grade-grades", "input", "grades.json"), join(t.dir, "ai.json"));
  execFileSync(
    process.execPath,
    [join(root, "dist", "cli.js"), "library", "grade", "study-fixture", "--grades", "ai.json", "--plain"],
    {
      cwd: t.dir,
      env,
      encoding: "utf8",
    },
  );
  const before = execFileSync("git", ["-C", t.lib, "rev-parse", "HEAD"], { env, encoding: "utf8" });

  const server = await serveProcess(
    t.dir,
    ["library", "grade", "study-fixture", "--web", "--no-open", "--attempt", STAMP, "--name", "Minh Tran"],
    t.env,
  );
  served.push(server);
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  await page.locator('[data-crit="derive"] [data-act=more]').click();
  await page.locator("[data-action=finish]").click();
  // another command holds the library (this process, which is alive) for the whole 10 s the server waits
  writeFileSync(
    join(t.lib, ".fullmark.lock"),
    `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: new Date().toISOString() })}\n`,
  );
  await page.locator("dialog[open] [data-action=save]").click();
  const card = page.locator("[data-grade-saved]");
  await expect(card).toContainText("Grades saved", { timeout: 30_000 });
  await expect(card.locator("[data-grade-unfiled]")).toHaveText(
    "Your grades are saved, but not filed yet: the library was busy. Run `quiz library grade study-fixture` to file them.",
  );
  // no file is named: none was written
  await expect(card.locator(".fm-grade-files")).toHaveCount(0);

  const end = await server.end();
  expect(end.code).toBe(2);
  expect(existsSync(join(t.lib, "quizzes", "study", "progress", `${STAMP}.grades.json`))).toBe(true);
  expect(execFileSync("git", ["-C", t.lib, "rev-parse", "HEAD"], { env, encoding: "utf8" })).toBe(before);
});
