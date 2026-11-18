import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { parseResults } from "../src/core/attempt";
import { card, historyLibrary, type Served, serveProcess, submitAttempt } from "./helpers";

/**
 * `quiz library take` as a subprocess (STEP4.md, slice 4d): started with `--json`, its `listening` line read, the page
 * driven, then the exit code, the line it ends with, the file it filed and the commit it made.
 */
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

async function take(args: string[]) {
  const t = historyLibrary();
  const server = await serveProcess(t.dir, ["library", "take", "study-fixture", "--no-open", ...args], t.env);
  served.push(server);
  return { ...t, server };
}

test("take --missed on the history library serves the missed questions, marks the changed one, and files plan.source missed", async ({
  page,
}) => {
  const t = await take(["--missed"]);
  await page.goto(t.server.url);

  // the start screen names the plan and counts only its questions
  await expect(page.locator("[data-plan=missed]")).toHaveText("missed questions · 4");
  await expect(page.locator("[data-fact=questions] .fm-tile-value")).toHaveText("4");
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(page.locator("article.fm-question")).toHaveCount(4);
  expect(
    await page.locator("article.fm-question").evaluateAll((els) => els.map((e) => e.getAttribute("data-qid"))),
  ).toEqual(["prime", "even", "add", "ielts"]);

  // only `even` was reworded since it was missed, and its card says so after the number
  await expect(page.locator("[data-changed-mark]")).toHaveCount(1);
  await expect(card(page, "even").locator("[data-changed-mark]")).toHaveText("changed since you missed it");
  await expect(card(page, "prime").locator("[data-changed-mark]")).toHaveCount(0);

  await page.getByLabel(/Seven$/).check();
  await submitAttempt(page);
  await expect(page.locator("[data-sent]")).toHaveText("Sent");
  const end = await t.server.end();
  expect(end.code).toBe(0);
  const filed = end.lines.at(-1) as {
    status: string;
    results: string;
    plan: { source: string; questions: string[] };
    gone: number;
  };
  expect(filed).toMatchObject({
    status: "filed",
    plan: { source: "missed", questions: ["prime", "even", "add", "ielts"] },
    gone: 1,
  });

  // the file is in the quiz's results, a results-v2 whose plan says missed, and one commit holds it
  const file = join(t.lib, "quizzes", "study", filed.results);
  const read = parseResults(readFileSync(file, "utf8"));
  expect(read.ok && read.results.plan.source).toBe("missed");
  expect(readdirSync(join(t.lib, "quizzes", "study", "progress"))).toEqual([]);
  const log = execFileSync("git", ["-C", t.lib, "log", "--format=%s", "-1"], {
    env: { ...process.env, ...t.env },
  }).toString();
  expect(log).toBe("fullmark: take study-fixture\n");
  expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
});

test("take, answered and submitted, files a full attempt", async ({ page }) => {
  const t = await take([]);
  await page.goto(t.server.url);
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.getByRole("button", { name: /^Start$/ }).click();
  await page.getByLabel(/Seven$/).check();
  await submitAttempt(page);
  await expect(page.locator("[data-sent]")).toHaveText("Sent");
  const end = await t.server.end();
  expect(end.code).toBe(0);
  expect(end.lines.at(-1)).toMatchObject({ status: "filed", plan: { source: "full" } });
});
