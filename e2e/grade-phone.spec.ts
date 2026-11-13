import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { noViolations, root, type Served, serveProcess } from "./helpers";

/**
 * The grading form on a phone, below 760 px (STEP3.md, slice 3p; G79 and G89, the RubricPhone board): on a 390 x 844
 * touch screen an additive, a banded, a holistic and a code question are graded by touch, Finish is on the foot bar, the
 * sidebar takes the screen and gives it back, and nothing scrolls sideways. Chromium runs as a touch phone; Firefox has
 * no mobile mode, so it runs as a narrow window with touch.
 */
const test = base.extend({
  page: async ({ browser, browserName }, use) => {
    const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...touch });
    await use(await context.newPage());
    await context.close();
  },
});

const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const cli = ["grade", "results.json", "--quiz", "quiz.md", "--web"];

function folder(extra: string[] = [], blankCode = false): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-grade-phone-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  if (blankCode) results.state.answers.code = null;
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  return dir;
}

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});
async function open(page: Page, dir = folder(), ...args: string[]): Promise<Served> {
  const server = await serveProcess(dir, [...cli, ...args]);
  served.push(server);
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  return server;
}

const press = async (page: Page, target: Locator): Promise<void> => {
  if (await page.evaluate(() => "ontouchstart" in window)) await target.tap();
  else await target.click();
};
const ctl = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] [data-ctl]`);
const value = (page: Page, crit: string) => ctl(page, crit).locator("input");
const note = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] textarea`);
const toggle = (page: Page) => page.locator("[data-action=sidebar]");
const side = (page: Page) => page.locator("aside.fm-side");
const foot = (page: Page) => page.locator("[data-footbar]");
const noSideways = async (page: Page): Promise<void> => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
};
/** every button, field and summary in `root` that is drawn is at least 44 px in both ways (a text area is a field, not a target) */
async function targets(page: Page, rootSel: string): Promise<void> {
  const small = await page.locator(rootSel).evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>("button, input, summary, [role=radio]")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => ({
        what: `${e.tagName}.${e.className}`,
        h: e.getBoundingClientRect().height,
        w: e.getBoundingClientRect().width,
      }))
      .filter((x) => x.h < 43.5 || x.w < 43.5),
  );
  expect(small).toEqual([]);
}

test("opens as a phone's form: the compact bar, the stacked card, the foot bar, the sidebar closed", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".fm-phone-head .fm-title")).toHaveText("Grade: Rubric modes");
  await expect(page.locator("[data-compact]")).toHaveText("Graded 0 of 5 · Question 2");
  await expect(page.locator(".fm-status")).toHaveCount(0);
  await expect(side(page)).toHaveCount(0);
  // the top bar holds the sidebar's icon (with its name) and Appearance; Finish is on the foot bar alone
  await expect(toggle(page)).toHaveAccessibleName("Questions");
  await expect(toggle(page)).toHaveText("");
  await expect(page.locator("[data-action=finish]")).toHaveCount(1);
  await expect(foot(page).locator("[data-action=finish]")).toBeVisible();
  await expect(foot(page).locator("[data-action=prev]")).toBeDisabled();
  await expect(foot(page).locator("[data-action=prev]")).toHaveAccessibleName("Previous question");
  await expect(foot(page).locator("[data-action=next]")).toHaveAccessibleName("Next question");
  // the card has no foot of its own, and no G96 button: the answer open and the sample closed, each a `details`
  await expect(page.locator(".fm-grade-foot")).toHaveCount(0);
  await expect(page.locator("[data-action=sample]")).toHaveCount(0);
  await expect(page.locator("details[data-fold=answer]")).toHaveJSProperty("open", true);
  await expect(page.locator("details[data-fold=sample]")).toHaveJSProperty("open", false);
  await expect(page.locator("details[data-fold=answer] summary")).toHaveText("Answer · 32 words");
  await expect(page.locator("details[data-fold=sample] summary")).toHaveText("Sample answer");
  // the answer, the sample and the box are stacked, in that order
  const ys = await page
    .locator("details[data-fold=answer], details[data-fold=sample], .fm-box")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y));
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
  await noSideways(page);
  await targets(page, "article.fm-grade-card");
  await targets(page, ".fm-dock");
  await targets(page, "[data-footbar]");
});

test("grades an additive question by touch: the slot's parts are 44 px and stacked under the name", async ({
  page,
}) => {
  await open(page);
  const defs = ctl(page, "defs");
  // each section stacks: the name over the slot over the note, the slot the card's width
  const name = await page.locator('[data-crit="derive"] .fm-box-name').boundingBox();
  const slot = await ctl(page, "derive").boundingBox();
  const noteBox = await note(page, "derive").boundingBox();
  expect(slot?.y).toBeGreaterThan((name?.y ?? 0) + (name?.height ?? 0) - 1);
  expect(noteBox?.y).toBeGreaterThan((slot?.y ?? 0) + (slot?.height ?? 0) - 1);
  expect(slot?.width).toBeGreaterThan(260);
  for (const sel of [".fm-ctl-group", ".fm-ctl-max"]) {
    expect((await defs.locator(sel).boundingBox())?.height).toBeCloseTo(44, 0);
  }
  await press(page, defs.locator("[data-act=full]"));
  await expect(value(page, "defs")).toHaveValue("0.5");
  await press(page, ctl(page, "derive").locator("[data-act=more]"));
  await expect(value(page, "derive")).toHaveValue("1.5");
  await press(page, ctl(page, "derive").locator("[data-act=less]"));
  await expect(value(page, "derive")).toHaveValue("1.25");
  await note(page, "derive").fill("Skips the zero initial-conditions assumption.");
  await value(page, "interp").fill("0.5");
  await note(page, "interp").fill("No link to stability.");
  await expect(page.locator("[data-ctl=total]")).toContainText("2.25");
  await expect(page.locator("article[data-qid=add] .fm-grade-badge")).toContainText("Graded");
  await expect(page.locator("[data-compact]")).toHaveText("Graded 1 of 5 · Question 2");
  await press(page, page.locator("details[data-fold=sample] summary"));
  await expect(page.locator("details[data-fold=sample]")).toHaveJSProperty("open", true);
  await noSideways(page);
  // the foot bar's arrow goes on, and back
  await press(page, foot(page).locator("[data-action=next]"));
  await expect(page.locator("article[data-qid=ielts]")).toBeVisible();
  await press(page, foot(page).locator("[data-action=prev]"));
  await expect(page.locator("article[data-qid=add]")).toBeVisible();
});

test("grades a banded, a holistic and a code question by touch, with no sideways scroll", async ({ page }) => {
  await open(page);
  await press(page, foot(page).locator("[data-action=next]"));
  // banded: the first + starts at the middle, then typed
  await press(page, ctl(page, "TR").locator("[data-act=more]"));
  await expect(value(page, "TR")).toHaveValue("4.5");
  for (const [crit, band] of [
    ["TR", "6"],
    ["CC", "6.5"],
    ["LR", "6.5"],
    ["GRA", "6"],
  ] as const) {
    await value(page, crit).fill(band);
    await note(page, crit).fill("Room to improve here.");
  }
  await expect(page.locator(".fm-box-total")).toContainText("mean 6.25, IELTS rounding to 6.5");
  await noSideways(page);
  await targets(page, "article.fm-grade-card");
  // holistic: the verdicts are a row of three under the name, the score is a slot
  await press(page, foot(page).locator("[data-action=next]"));
  await press(page, foot(page).locator("[data-action=next]"));
  await expect(page.locator("article[data-qid=holistic]")).toBeVisible();
  const verdicts = page.locator('[data-crit="names-the-nyquist-rate"] .fm-ctl-verdicts');
  expect((await verdicts.boundingBox())?.height).toBeCloseTo(44, 0);
  await press(page, page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=met]'));
  await press(page, page.locator('[data-crit="gives-an-example"] [data-verdict=partly]'));
  await expect(page.locator('[data-crit="gives-an-example"] [data-verdict=partly]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.locator("[data-ctl=score] input").fill("3");
  await page.locator("textarea[aria-label='Why this score']").fill("Explains aliasing with an example.");
  await targets(page, "article.fm-grade-card");
  await noSideways(page);
  // code
  await press(page, foot(page).locator("[data-action=next]"));
  await expect(page.locator("article[data-qid=code]")).toBeVisible();
  await expect(page.locator("details[data-fold=answer] pre")).toContainText("def double");
  await press(page, ctl(page, "works").locator("[data-act=full]"));
  await value(page, "style").fill("0.5");
  await note(page, "style").fill("A little long.");
  await noSideways(page);
});

test("Finish on the foot bar: the blocked dialog, then the save dialog and the saved card", async ({ page }) => {
  const server = await open(page, folder());
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1");
  await value(page, "interp").fill("1");
  await press(page, foot(page).locator("[data-action=finish]"));
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Some grades are not finished");
  await noSideways(page);
  await noViolations(page);
  await press(page, dialog.locator("[data-problem=add]"));
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(note(page, "derive")).toHaveAttribute("data-missing", "tried");
  await note(page, "derive").fill("Lost a mark.");
  await press(page, foot(page).locator("[data-action=finish]"));
  await expect(dialog).toContainText("Save your grades?");
  await press(page, dialog.locator("[data-action=dialog-back]"));
  await expect(dialog).toHaveCount(0);
  await expect(foot(page).locator("[data-action=finish]")).toBeFocused();
  void server;
});

test("Finish with one question graded: the save dialog, the name, the saved card", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir);
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await press(page, foot(page).locator("[data-action=finish]"));
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Save your grades?");
  // the buttons are 44 px, and the dialog fits the screen
  await targets(page, "dialog[open]");
  const box = await dialog.boundingBox();
  expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 999) <= 390).toBe(true);
  await noViolations(page);
  await dialog.locator("[data-field=name]").fill("Lan");
  await press(page, dialog.locator("[data-action=save]"));
  const saved = page.locator("[data-grade-saved]");
  await expect(saved).toContainText("Grades saved");
  await expect(saved).toContainText("results-grades.json");
  await expect(foot(page)).toHaveCount(0);
  await noSideways(page);
  await noViolations(page);
  const end = await server.end();
  expect(end.code).toBe(0);
});

test("the sidebar takes the whole screen and a back link gives it back", async ({ page }) => {
  await open(page, folder([], true));
  await press(page, toggle(page));
  const s = side(page);
  expect(await s.boundingBox()).toMatchObject({ x: 0, width: 390 });
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(s.locator("[data-action=close-sidebar]")).toHaveText("Back to question 2");
  await expect(s.locator("[data-row]")).toHaveCount(5);
  await expect(s).toContainText("Not answered");
  await expect(s.locator(".fm-grade-keys")).toBeVisible();
  // what is under it is neither seen nor reachable, and the foot bar is gone with it
  await expect(page.locator("main.fm-main")).toHaveCSS("visibility", "hidden");
  await expect(foot(page)).toBeHidden();
  await noSideways(page);
  await targets(page, "aside.fm-side");
  // the back link closes it and puts the focus back on its button
  await press(page, s.locator("[data-action=close-sidebar]"));
  await expect(side(page)).toHaveCount(0);
  await expect(toggle(page)).toBeFocused();
  await expect(foot(page)).toBeVisible();
  // a row opens its question and closes the sidebar
  await press(page, toggle(page));
  await press(page, side(page).locator("[data-row=holistic]"));
  await expect(side(page)).toHaveCount(0);
  await expect(page.locator("article[data-qid=holistic]")).toBeVisible();
  await expect(page.locator("[data-compact]")).toHaveText("Graded 0 of 4 · Question 5");
  // Esc closes it too
  await press(page, toggle(page));
  await page.keyboard.press("Escape");
  await expect(side(page)).toHaveCount(0);
});

test("resizing from 390 to 1280 gives the wide form, and back to 390 closes the sidebar", async ({ page }) => {
  await open(page);
  await press(page, toggle(page));
  await expect(side(page)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 940 });
  await expect(page.locator(".fm-status")).toBeVisible();
  await expect(foot(page)).toHaveCount(0);
  await expect(page.locator(".fm-grade-foot")).toBeVisible();
  await expect(side(page)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(side(page)).toHaveCount(0);
  await expect(foot(page)).toBeVisible();
});

test("passes axe on a phone in light and dark, the sidebar open and shut", async ({ page }) => {
  await open(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await value(page, "derive").fill("1");
    await noViolations(page);
    await press(page, toggle(page));
    await noViolations(page);
    await press(page, side(page).locator("[data-action=close-sidebar]"));
  }
});

test("a vi quiz has the phone's words in vi", async ({ page }) => {
  await open(page, folder(["ui_lang: vi"]));
  await expect(page.locator(".fm-phone-head .fm-title")).toHaveText("Chấm: Rubric modes");
  await expect(foot(page).locator("[data-action=finish]")).toHaveText("Hoàn tất");
  await expect(foot(page).locator("[data-action=next]")).toHaveAccessibleName("Câu sau");
  await expect(page.locator("details[data-fold=answer] summary")).toContainText("Câu trả lời");
  await press(page, toggle(page));
  await expect(side(page).locator("[data-action=close-sidebar]")).toContainText("Quay lại câu 2");
});

test("G101: the badge has its icon and wash and the head reads points before the kind, on a phone", async ({
  page,
}) => {
  await open(page);
  const badge = page.locator("article[data-qid=add] .fm-grade-badge");
  await expect(page.locator("article[data-qid=add] .fm-grade-meta")).toHaveText(/^Question \d+ · 3 points · essay$/);
  await expect(badge.locator("svg")).toHaveCount(1);
  const wash = await badge.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(wash).not.toBe("rgba(0, 0, 0, 0)");
  await press(page, ctl(page, "defs").locator("[data-act=full]"));
  await expect(badge).toContainText("Half graded");
  expect(await badge.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("dashed");
  // one line, inside the card, nothing sideways
  const height = (await badge.boundingBox())?.height ?? 99;
  expect(height).toBeLessThan(30);
  await noSideways(page);
  // the amber dot beside a note the validator will ask for
  await value(page, "derive").fill("1");
  await expect(page.locator('[data-crit="derive"] .fm-note-dot')).toBeVisible();
  await noSideways(page);
});
