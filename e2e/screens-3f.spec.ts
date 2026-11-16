import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { fixScreens, root, SCREENS_USE, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3f for the owner to set beside the Grade, GradeBanded, GradeCode, GradeFinish, GradeBlocked,
 * GradeDone and GradeVi boards (1280 x 940) and RubricC's grade side. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3f.spec.ts --project=chromium. They land in docs/screens/3f/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: { width: 1280, height: 940 } });

const out = (name: string) => join(root, "docs", "screens", "3f", `${name}.png`);
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

test("Grade: an additive question half graded, light, sidebar open", async ({ page }) => {
  await open(page, [], "--blank-code");
  await someOfAdditive(page);
  await page.screenshot({ path: out("1-grade") });
});

test("GradeBanded: the IELTS essay, dark", async ({ page }) => {
  await open(page, ["theme: dark"]);
  await page.locator("[data-row=ielts]").click();
  for (const [crit, band] of [
    ["TR", "6"],
    ["CC", "6.5"],
  ] as const) {
    await value(page, crit).fill(band);
    await note(page, crit).fill("Room to improve here.");
  }
  await page.screenshot({ path: out("2-grade-banded-dark") });
});

test("GradeCode: a code answer, white, sidebar closed", async ({ page }) => {
  await open(page, ["theme: white"]);
  await page.locator("[data-row=code]").click();
  await page.keyboard.press("q");
  await page.screenshot({ path: out("3-grade-code-white") });
});

/** The IELTS essay fully graded, every band with a note. */
async function allOfIelts(page: Page): Promise<void> {
  await page.locator("[data-row=ielts]").click();
  for (const [crit, band] of [
    ["TR", "6"],
    ["CC", "6.5"],
    ["LR", "6"],
    ["GRA", "7"],
  ] as const) {
    await value(page, crit).fill(band);
    await note(page, crit).fill("Room to improve here.");
  }
}

test("GradeFinish and GradeDone", async ({ page }) => {
  await open(page, [], "--blank-code");
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await allOfIelts(page);
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open] [data-field=name]").waitFor();
  await page.screenshot({ path: out("4-grade-finish") });
  await page.locator("dialog[open] [data-field=name]").fill("T. Lan");
  await page.locator("dialog[open] [data-action=save]").click();
  await page.locator("[data-grade-saved]").waitFor();
  await page.screenshot({ path: out("6-grade-done") });
});

test("GradeBlocked: a lost mark with no note", async ({ page }) => {
  await open(page, [], "--blank-code");
  await allOfIelts(page);
  await page.locator("[data-row=add]").click();
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1");
  await value(page, "interp").fill("1");
  await page.locator("[data-action=finish]").click();
  await expect(page.locator("dialog[open]")).toContainText("Some grades are not finished");
  await page.screenshot({ path: out("5-grade-blocked") });
});

test("GradeVi: the form in vi", async ({ page }) => {
  await open(page, ["ui_lang: vi"], "--name", "T. Lan");
  await someOfAdditive(page);
  await page.screenshot({ path: out("7-grade-vi") });
});

test("RubricC's grade side: each mode's box", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1500 });
  await open(page);
  await someOfAdditive(page);
  await page.locator("article[data-qid=add]").screenshot({ path: out("8-box-additive") });
  await page.locator("[data-row=holistic]").click();
  await page.locator("[data-ctl=score] input").fill("3");
  await page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=met]').click();
  await page.locator("article[data-qid=holistic]").screenshot({ path: out("9-box-holistic") });
});

test("G96: the sample answer opened beside the answer", async ({ page }) => {
  await open(page);
  await someOfAdditive(page);
  await page.locator("[data-action=sample]").click();
  await page.screenshot({ path: out("10-sample-open") });
});
