import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { historyLibrary, type Served, serveProcess } from "./helpers";

/**
 * `quiz library review` as a subprocess (STEP4.md, slice 4f): on the history library, the form for the current version of
 * the quiz, one verdict changed and the rest kept, **Finish**, then `review.json` filed and committed. Its `--json`
 * contract is read from the process's own lines. The form is `quiz review`'s (e2e/review.spec.ts); this covers where
 * the review goes.
 */
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

const card = (page: import("@playwright/test").Page, id: string) => page.locator(`article[data-qid="${id}"]`);

test("judging one question and keeping the rest files review.json in the library and commits it alone", async ({
  page,
}) => {
  const t = historyLibrary();
  const env = { ...process.env, ...t.env };
  const gitOut = (...args: string[]) => execFileSync("git", ["-C", t.lib, ...args], { env, encoding: "utf8" });
  const before = gitOut("rev-parse", "HEAD");

  const server = await serveProcess(t.dir, ["library", "review", "study-fixture", "--no-open"], t.env);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  const ids = await page
    .locator("article[data-qid]")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.qid as string));
  expect(ids.length).toBeGreaterThan(2);

  // one verdict changed: a fix with a reason, on the first question
  const first = card(page, ids[0] as string);
  await first.locator("[data-pick=fix]").click();
  await first.locator("[data-reason=unclear]").click();
  // the rest kept: the dialog asks first
  await page.locator("[data-action=keep-rest]").click();
  await page.locator("dialog[open] [data-action=mark-keep]").click();
  const saved = page.locator("[data-review-saved]");
  await expect(saved).toContainText("Review saved");
  await expect(saved).toContainText(
    `review.json: ${ids.length - 1} keep (${ids.length - 1} not looked at), 1 fix, 0 drop.`,
  );
  await expect(saved).toContainText("quiz library register FILE --update study-fixture");

  const end = await server.end();
  expect(end.code).toBe(0);
  expect(end.lines[0]).toMatchObject({ status: "listening" });
  expect(end.lines[1]).toMatchObject({
    status: "written",
    review: "review.json",
    keep: ids.length - 1,
    fix: 1,
    drop: 0,
  });
  expect(String((end.lines[1] as Record<string, unknown>).committed)).toMatch(/^[0-9a-f]{7,}$/);
  expect(end.stderr).toContain(
    `written review.json: ${ids.length - 1} keep (${ids.length - 1} not looked at), 1 fix, 0 drop`,
  );

  // review.json is the quiz's, with the fix on the first question; one commit holds it alone, and the library is clean
  const file = JSON.parse(readFileSync(join(t.lib, "quizzes", "study", "review.json"), "utf8"));
  expect(file.quizId).toBe("study");
  expect(file.questions[ids[0] as string]).toMatchObject({ verdict: "fix", reasons: ["unclear"] });
  expect(Object.keys(file.questions)).toHaveLength(ids.length);
  expect(gitOut("log", "--format=%s", "-1")).toBe("fullmark: review study-fixture\n");
  expect(gitOut("rev-list", "--count", `${before.trim()}..HEAD`)).toBe("1\n");
  expect(gitOut("show", "--name-only", "--format=", "HEAD").trim()).toBe("quizzes/study/review.json");
  expect(gitOut("status", "--porcelain")).toBe("");
  expect(existsSync(join(t.lib, "quizzes", "study", "progress", "review.json"))).toBe(false);
  expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
});

test("when the library is busy at Finish, the card says the review is saved but not filed, and names the command (G34)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const t = historyLibrary();
  const env = { ...process.env, ...t.env };
  const before = execFileSync("git", ["-C", t.lib, "rev-parse", "HEAD"], { env, encoding: "utf8" });
  const server = await serveProcess(t.dir, ["library", "review", "study-fixture", "--no-open"], t.env);
  served.push(server);
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  // another command holds the library (this process, which is alive) for the whole 10 s the server waits
  writeFileSync(
    join(t.lib, ".fullmark.lock"),
    `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: new Date().toISOString() })}\n`,
  );
  await page.locator("[data-action=keep-rest]").click();
  await page.locator("dialog[open] [data-action=mark-keep]").click();
  const saved = page.locator("[data-review-saved]");
  await expect(saved).toContainText("Review saved", { timeout: 30_000 });
  await expect(saved.locator("[data-review-unfiled]")).toHaveText(
    "Your review is saved, but not filed yet: the library was busy. Run `quiz library review study-fixture` to file it.",
  );
  const end = await server.end();
  expect(end.code).toBe(2);
  expect(existsSync(join(t.lib, "quizzes", "study", "progress", "review.json"))).toBe(true);
  expect(existsSync(join(t.lib, "quizzes", "study", "review.json"))).toBe(false);
  expect(execFileSync("git", ["-C", t.lib, "rev-parse", "HEAD"], { env, encoding: "utf8" })).toBe(before);
});
