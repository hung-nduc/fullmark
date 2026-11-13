import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { root, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3r (G101's states, G100's frame) as 3r2 has them (G103: the frame with no bar of its own, in the
 * form's look), for the owner to set beside the boards: at 1280 x 940 GradeFinish, GradeDone and RubricC's left column,
 * at 390 x 844 RubricPhone. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3r.spec.ts --project=chromium. They land in docs/screens/3r/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use({ viewport: { width: 1280, height: 940 } });

const out = (name: string) => join(root, "docs", "screens", "3r", `${name}.png`);
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

async function open(page: Page, extra: string[] = [], ...rest: string[]): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await serveProcess(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web", ...rest]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
}
const value = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] [data-ctl] input`);
const note = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] textarea`);
const frame = (page: Page) => page.frameLocator("iframe[data-frame=marked]");

/** The first question half done: one criterion given. */
const half = (page: Page) => value(page, "defs").fill("0.5");
/** Two criteria with a lost mark and no note yet. */
async function needsNote(page: Page): Promise<void> {
  await half(page);
  await value(page, "derive").fill("1");
  await value(page, "interp").fill("0.5");
}
/** The first question graded: every lost mark has its note. */
async function graded(page: Page): Promise<void> {
  await needsNote(page);
  await note(page, "derive").fill("Skips the zero initial-conditions assumption.");
  await note(page, "interp").fill("Does not link the result to stability.");
}
async function showFrame(page: Page, narrow = false): Promise<void> {
  if (narrow) {
    await page.locator("[data-action=sidebar]").click();
    await page.locator("[data-auto]").click();
  } else await page.locator("[data-auto]").click();
  await frame(page).locator("[data-results]").waitFor();
}

// -- wide ------------------------------------------------------------------------------------------------------------

test("G101: the first question half graded (the badge, the head)", async ({ page }) => {
  await open(page);
  await half(page);
  await page.screenshot({ path: out("1-wide-half-graded") });
});

test("G101: a lost mark with no note: the badge, the dot, the red line", async ({ page }) => {
  await open(page);
  await needsNote(page);
  await page.screenshot({ path: out("2-wide-needs-a-note") });
});

test("G101: the question graded: the result badge (Wrong, Partly right or Correct, with the score)", async ({
  page,
}) => {
  await open(page);
  await graded(page);
  await page.screenshot({ path: out("3-wide-graded") });
});

test("G101: the sidebar, its rows, legend and keys", async ({ page }) => {
  await open(page);
  await graded(page);
  await page.locator(".fm-grade-side").screenshot({ path: out("4-wide-sidebar-keys") });
});

test("G100, G103: the Scored by fullmark row, the replay in the frame on Missed, no bar of its own", async ({
  page,
}) => {
  await open(page, [], "--name", "Lan");
  await graded(page);
  await showFrame(page);
  await page.screenshot({ path: out("5-wide-frame-missed") });
});

test("G100, G103: the frame on All, after its filter was chosen", async ({ page }) => {
  await open(page, [], "--name", "Lan");
  await graded(page);
  await showFrame(page);
  await frame(page).locator("[data-filter=all]").click();
  await page.screenshot({ path: out("6-wide-frame-all") });
});

test("G101: the saved card", async ({ page }) => {
  await open(page, [], "--name", "Lan");
  await graded(page);
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-action=save]").click();
  await page.locator("[data-grade-saved]").waitFor();
  await page.screenshot({ path: out("7-wide-saved") });
});

test("G103: the frame in the form's dark", async ({ page }) => {
  await open(page, [], "--name", "Lan");
  await graded(page);
  await page.locator("[data-action=appearance]").click();
  await page.locator("[data-theme-pick=dark]").click();
  await page.keyboard.press("Escape");
  await showFrame(page);
  await page.screenshot({ path: out("13-wide-frame-dark") });
});

// -- the phone -------------------------------------------------------------------------------------------------------

const phone = { width: 390, height: 844 };

test("phone: a question waiting for a grade", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await page.screenshot({ path: out("8-phone-waiting") });
});

test("phone: half graded", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await half(page);
  await page.screenshot({ path: out("9-phone-half-graded") });
});

test("phone: a lost mark with no note", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await needsNote(page);
  await page.evaluate(() => window.scrollBy(0, 330));
  await page.screenshot({ path: out("10-phone-needs-a-note") });
});

test("phone: the sidebar over the screen", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await graded(page);
  await page.locator("[data-action=sidebar]").click();
  await page.screenshot({ path: out("11-phone-sidebar") });
});

test("phone, G103: the frame on Missed, the form's bar only", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, [], "--name", "Lan");
  await graded(page);
  await showFrame(page, true);
  await page.screenshot({ path: out("12-phone-frame-missed") });
});

test("phone, G103: the frame in the form's dark", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, [], "--name", "Lan");
  await graded(page);
  await page.locator("[data-action=appearance]").click();
  await page.locator("[data-theme-pick=dark]").click();
  await page.keyboard.press("Escape");
  await showFrame(page, true);
  await page.screenshot({ path: out("14-phone-frame-dark") });
});
