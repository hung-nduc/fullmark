import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { historyLibrary, root, submitAttempt } from "./helpers";

/**
 * A shelf, as a learner meets it (STEP5.md, slices 5a and 5b): the history library published to a folder with the real
 * CLI; the shelf's `index.html` opened from the file system, which lists the quizzes; then a quiz's link followed, again
 * from the file system with no server (the links name `ID/index.html`, G13), the quiz loads and answers, and its page
 * carries no server code (no `connect-src`).
 */
const cli = join(root, "dist", "cli.js");
function publishedShelf(): { shelf: string; env: Record<string, string> } {
  const t = historyLibrary();
  // its own machine config: the shelf's folder is remembered there, never in the one the tests share
  const config = join(t.dir, "config.toml");
  writeFileSync(config, "");
  const env = { ...process.env, ...t.env, FULLMARK_CONFIG: config, NO_COLOR: "1" };
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: t.dir, env, encoding: "utf8" });
  run("library", "publish", "study-fixture", "--on");
  run("library", "publish", "limits-and-continuity", "--on");
  const shelf = join(t.dir, "shelf");
  mkdirSync(shelf);
  run("library", "publish", shelf);
  return { shelf, env };
}

test("the shelf's index page opens from the file system and lists the quizzes, with no script and no network", async ({
  page,
}) => {
  const { shelf } = publishedShelf();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  await page.goto(`file:///${join(shelf, "index.html").replaceAll("\\", "/")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("shelf");
  const links = page.locator("ul a");
  await expect(links).toHaveText(["Limits and continuity", "Study fixture"]);
  await expect(links.nth(0)).toHaveAttribute("href", "calculus-limits/index.html");
  await expect(links.nth(1)).toHaveAttribute("href", "study/index.html");
  await expect(page.locator("li").first()).toContainText("EN");
  await expect(page.locator("li").first()).toContainText("2 questions");
  expect(await page.locator("script").count()).toBe(0);
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("script-src 'none'");
  expect(policy).not.toContain("connect-src");
  expect(problems).toEqual([]);
});

test("following a quiz's link from the file system opens the quiz, which loads and answers; its page has no connect-src", async ({
  page,
}) => {
  const { shelf } = publishedShelf();
  const home = `file:///${join(shelf, "index.html").replaceAll("\\", "/")}`;
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  await page.goto(home);
  await page.getByRole("link", { name: "Limits and continuity" }).click();
  await expect(page).toHaveURL(home.replace(/index\.html$/, "calculus-limits/index.html"));
  await expect(page.locator(".fm-start")).toBeVisible();
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).not.toContain("connect-src");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".fm-question")).toHaveCount(2);
  await page.locator(".fm-question").first().getByLabel("The right one").check();
  await submitAttempt(page);
  const total = page.locator(".fm-total");
  await expect(total).toHaveAttribute("data-earned", "1");
  await expect(total).toHaveAttribute("data-points", "2");
  expect(problems).toEqual([]);
});
