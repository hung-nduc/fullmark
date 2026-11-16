import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { PHONE, root, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3p for the owner to set beside the boards: at 1280 x 940 G98's states (GradeFinish, GradeDone,
 * RubricC's right column), at 390 x 844 the phone (RubricPhone, GradePhone). Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3p.spec.ts --project=chromium. They land in docs/screens/3p/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use({ viewport: { width: 1280, height: 940 } });

const out = (name: string) => join(root, "docs", "screens", "3p", `${name}.png`);
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

/** `--blank-code` (the screens' own flag, not the CLI's) leaves the code answer blank, so the "Not answered" group shows. */
async function open(page: Page, extra: string[] = [], ...rest: string[]): Promise<void> {
  const blank = rest.includes("--blank-code");
  const args = rest.filter((a) => a !== "--blank-code");
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  if (blank) results.state.answers.code = null;
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await serveProcess(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web", ...args]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
}
const value = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] [data-ctl] input`);
const note = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] textarea`);

/** The first question half done: one criterion with a lost mark and no note yet. */
async function someOfAdditive(page: Page): Promise<void> {
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.25");
  await note(page, "derive").fill("Uses zero initial conditions without saying so.");
}

test("G98: the card, the sidebar's icon, key row and fullmark's row, the empty required note", async ({ page }) => {
  await open(page, [], "--blank-code");
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.25");
  await page.screenshot({ path: out("1-grade-wide") });
});

test("G98: the Finish dialog from the top, and the saved card with its chips", async ({ page }) => {
  await open(page, [], "--blank-code");
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-field=name]").waitFor();
  await page.screenshot({ path: out("2-finish-wide") });
  await page.locator("dialog[open] [data-field=name]").fill("T. Lan");
  await page.locator("dialog[open] [data-action=save]").click();
  await page.locator("[data-grade-saved]").waitFor();
  await page.screenshot({ path: out("3-saved-wide") });
});

test("G98: the sample open, its head level with the answer's", async ({ page }) => {
  await open(page);
  await someOfAdditive(page);
  await page.locator("[data-action=sample]").click();
  await page.screenshot({ path: out("4-sample-open") });
});

test("G98: Finish tried with a note missing: the note turns red", async ({ page }) => {
  await open(page, [], "--blank-code");
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1");
  await value(page, "interp").fill("1");
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-action=dialog-back]").click();
  await page.screenshot({ path: out("5-blocked-then-back") });
});

// -- the phone -------------------------------------------------------------------------------------------------------

const phone = PHONE;

test("phone: an additive question, half graded (RubricPhone, additive)", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await someOfAdditive(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out("6-phone-additive-top") });
  // the box's top under the sticky bar: scroll by its offset from the viewport, not to it
  await page.evaluate(() =>
    window.scrollBy(0, (document.querySelector(".fm-box")?.getBoundingClientRect().top ?? 0) - 72),
  );
  await page.screenshot({ path: out("7-phone-additive-box") });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: out("8-phone-additive-foot") });
  await page.screenshot({ path: out("8b-phone-additive-whole"), fullPage: true });
});

test("phone: a banded question (RubricPhone, banded), dark", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, ["theme: dark"]);
  await page.locator("[data-action=sidebar]").click();
  await page.locator("[data-row=ielts]").click();
  await value(page, "TR").fill("6");
  await value(page, "CC").fill("6.5");
  await note(page, "TR").fill("Under 250 words; one side of the debate is thin.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out("9a-phone-banded-top") });
  await page.evaluate(() => window.scrollTo(0, document.querySelector(".fm-box")?.getBoundingClientRect().top ?? 0));
  await page.screenshot({ path: out("9-phone-banded-box") });
  await page.screenshot({ path: out("9b-phone-banded-whole"), fullPage: true });
});

test("phone: a holistic question (RubricPhone, holistic)", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await page.locator("[data-action=sidebar]").click();
  await page.locator("[data-row=holistic]").click();
  await page.locator("[data-ctl=score] input").fill("3");
  await page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=met]').click();
  await page.locator('[data-crit="gives-an-example"] [data-verdict=partly]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out("10-phone-holistic-top") });
  await page.evaluate(() => window.scrollTo(0, document.querySelector(".fm-box")?.getBoundingClientRect().top ?? 0));
  await page.screenshot({ path: out("10c-phone-holistic-box") });
  await page.screenshot({ path: out("10b-phone-holistic-whole"), fullPage: true });
});

test("phone: a code question", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page);
  await page.locator("[data-action=sidebar]").click();
  await page.locator("[data-row=code]").click();
  await page.screenshot({ path: out("11-phone-code-top") });
});

test("phone: the sidebar over the screen, with its back link", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, [], "--blank-code");
  await someOfAdditive(page);
  await page.locator("[data-action=sidebar]").click();
  await page.screenshot({ path: out("12-phone-sidebar") });
});

test("phone: Finish, the dialog and the saved card", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, [], "--blank-code");
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-field=name]").waitFor();
  await page.screenshot({ path: out("13-phone-finish") });
  await page.locator("dialog[open] [data-field=name]").fill("T. Lan");
  await page.locator("dialog[open] [data-action=save]").click();
  await page.locator("[data-grade-saved]").waitFor();
  await page.screenshot({ path: out("14-phone-saved") });
});

test("phone: the form in vi", async ({ page }) => {
  await page.setViewportSize(phone);
  await open(page, ["ui_lang: vi"], "--name", "T. Lan");
  await someOfAdditive(page);
  await page.screenshot({ path: out("15-phone-vi") });
});
