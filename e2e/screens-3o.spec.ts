import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { fixScreens, root, run, SCREENS_USE } from "./helpers";

/**
 * Screenshots of slice 3o for the owner to set beside RubricC's replay side (its left column) and RubricPhoneReplay:
 * the rubric box of each mode at 1280 px in light, one in dark, one in paper with the serif font, one in vi, one at
 * 390 px. Not part of `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3o.spec.ts
 * --project=chromium. They land in docs/screens/3o/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
// tall, so the page never scrolls and its sticky bars stay clear of the card
test.use({ viewport: { width: 1280, height: 4200 } });

const out = (name: string) => join(root, "docs", "screens", "3o", `${name}.png`);
const FIXTURE = join(root, "test", "fixtures", "replay");
const STAMP = ["--built-at", "2026-10-28T10:00:00+07:00"];

/** The essay fixture's replay with `extra` front matter lines, re-keyed to the new hash; `uiLang` builds it in vi. */
function replayOf(extra: string[], name: string, uiLang = "en"): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(FIXTURE, "essay.md"), "utf8").replace(/^---\n/, `---\n${extra.join("\n")}\n`);
  writeFileSync(join(dir, "essay.md"), source);
  const results = JSON.parse(readFileSync(join(FIXTURE, "essay-results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(results, null, 2)}\n`);
  const grades = JSON.parse(readFileSync(join(FIXTURE, "essay-results-grades.json"), "utf8"));
  grades.results_hash = resultsHash(results);
  writeFileSync(join(dir, `${name}-grades.json`), JSON.stringify(grades));
  run(dir, "replay", `${name}.json`, "--quiz", "essay.md", "--no-open", "--ui-lang", uiLang, ...STAMP);
  return `file:///${join(dir, `${name}-replay.html`).replaceAll("\\", "/")}`;
}

const card = async (page: Page, id: string, name: string) => {
  const article = page.locator(`article[data-qid="${id}"]`);
  await expect(article.locator(".fm-box")).toBeVisible();
  await article.screenshot({ path: out(name) });
};

test("each mode in light at 1280 px", async ({ page }) => {
  await page.goto(replayOf([], "light"));
  await card(page, "add", "1-additive-light");
  await card(page, "ielts", "2-banded-light");
  await card(page, "holistic", "3-holistic-light");
  await card(page, "code", "4-code-light");
});

test("dark, paper with the serif font, and vi", async ({ page }) => {
  await page.goto(replayOf([], "dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await card(page, "add", "5-additive-dark");
  await page.goto(replayOf(["theme: paper", "font: serif"], "paper"));
  await card(page, "ielts", "6-banded-paper-serif");
  await page.goto(replayOf([], "vi", "vi"));
  await card(page, "holistic", "7-holistic-vi");
  await card(page, "add", "8-additive-vi");
});

test("on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 5200 });
  await page.goto(replayOf(["theme: paper", "font: serif"], "phone"));
  await card(page, "add", "9-additive-phone");
  await card(page, "holistic", "10-holistic-phone");
});
