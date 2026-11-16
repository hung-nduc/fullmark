// biome-ignore-all lint/suspicious/noExplicitAny: a test edits the grades file freely
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { fixScreens, root, SCREENS_USE, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3p2 (`grade --web --grades` at 1280 px), for the owner to set beside the GradeAI board and its
 * Tweaks: `q` (additive, banded, holistic, code), `start` (unchanged, adjusted) and `graders` (one, two), in light, in
 * dark and in vi. Taken at 1280 x 1500, the board's preview size, since the card is tall. The board's questions are
 * its own (21, 24, 27, 30); here they are the golden `rubrics-grades-all`'s: `add` (additive), `ielts` (banded),
 * `holistic` and `code`. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3p2.spec.ts --project=chromium. They land in docs/screens/3p2/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: { width: 1280, height: 1500 } });

const out = (name: string) => join(root, "docs", "screens", "3p2", `${name}.png`);
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

const OPUS = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-11-05T14:40:00" };
const SONNET = { kind: "ai", name: "Claude Sonnet 5.5", model: "claude-sonnet-5-5", at: "2026-11-05T14:41:00" };
const LAN = { kind: "human", name: "Lan Nguyen", at: "2026-11-05T15:00:00" };

type Scene = {
  /** the board's `q`: which question is open */
  q: "add" | "ielts" | "holistic" | "code";
  /** the board's `start`: `adjusted` has the grader's change on the open question already */
  start: "unchanged" | "adjusted";
  /** the board's `graders`: one AI, or two (Sonnet the additive and the code, Opus the others) */
  graders: "one" | "two" | "person";
  theme?: string;
  vi?: boolean;
};

async function open(page: Page, scene: Scene): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const extra = [...(scene.theme ? [`theme: ${scene.theme}`] : []), ...(scene.vi ? ["ui_lang: vi"] : [])];
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const grades = JSON.parse(readFileSync(join(INPUT, "grades.json"), "utf8")) as any;
  grades.results_hash = resultsHash(results);
  grades.grader = scene.graders === "person" ? LAN : OPUS;
  if (scene.graders === "two") for (const id of ["add", "code"]) grades.grades[id].grader = SONNET;
  writeFileSync(join(dir, "agent.json"), JSON.stringify(grades, null, 2));
  const server = await serveProcess(dir, [
    "grade",
    "results.json",
    "--quiz",
    "quiz.md",
    "--web",
    "--grades",
    "agent.json",
    "--name",
    "Lan",
  ]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  if (scene.q !== "add") await page.locator(`.fm-grade-side [data-row=${scene.q}]`).click();
  if (scene.start === "adjusted") await adjust(page, scene.q);
}

/** The board's `ADJ`: one question already changed by the grader. */
async function adjust(page: Page, q: Scene["q"]): Promise<void> {
  const less = (crit: string) => page.locator(`[data-crit="${crit}"] [data-act=less]`).click();
  if (q === "add") {
    await less("derive");
    await page.locator('[data-crit="derive"] textarea').fill("Uses zero initial conditions without saying so.");
  } else if (q === "ielts") {
    await less("TR");
    await page
      .locator('[data-crit="TR"] textarea')
      .fill("Under 250 words, and the useful-subjects view is one sentence.");
  } else if (q === "holistic") {
    await page.locator("[data-ctl=score] [data-act=less]").click();
    await page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=partly]').click();
  } else await less("style");
}

const wide = (page: Page, name: string) => page.screenshot({ path: out(name) });

test("q additive, graded by two, unchanged (the board's `q` additive, `start` unchanged, `graders` two)", async ({
  page,
}) => {
  await open(page, { q: "add", start: "unchanged", graders: "two" });
  await wide(page, "01-additive-unchanged-two");
});

test("q additive, adjusted (the board's default props)", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "two" });
  await wide(page, "02-additive-adjusted-two");
});

test("q additive, adjusted, one AI grader", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "one" });
  await wide(page, "03-additive-adjusted-one");
});

test("q banded, unchanged", async ({ page }) => {
  await open(page, { q: "ielts", start: "unchanged", graders: "two" });
  await wide(page, "04-banded-unchanged");
});

test("q banded, adjusted", async ({ page }) => {
  await open(page, { q: "ielts", start: "adjusted", graders: "two" });
  await wide(page, "05-banded-adjusted");
});

test("q holistic, unchanged", async ({ page }) => {
  await open(page, { q: "holistic", start: "unchanged", graders: "two" });
  await wide(page, "06-holistic-unchanged");
});

test("q holistic, adjusted", async ({ page }) => {
  await open(page, { q: "holistic", start: "adjusted", graders: "two" });
  await wide(page, "07-holistic-adjusted");
});

test("q code, unchanged", async ({ page }) => {
  await open(page, { q: "code", start: "unchanged", graders: "two" });
  await wide(page, "08-code-unchanged");
});

test("q code, adjusted", async ({ page }) => {
  await open(page, { q: "code", start: "adjusted", graders: "two" });
  await wide(page, "09-code-adjusted");
});

test("dark, additive adjusted", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "two", theme: "dark" });
  await wide(page, "10-additive-adjusted-dark");
});

test("dark, holistic adjusted", async ({ page }) => {
  await open(page, { q: "holistic", start: "adjusted", graders: "two", theme: "dark" });
  await wide(page, "11-holistic-adjusted-dark");
});

test("vi, additive adjusted", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "two", vi: true });
  await wide(page, "12-additive-adjusted-vi");
});

test("vi, holistic unchanged", async ({ page }) => {
  await open(page, { q: "holistic", start: "unchanged", graders: "two", vi: true });
  await wide(page, "13-holistic-unchanged-vi");
});

test("pre-filled by a person: the words and the marks", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "person" });
  await wide(page, "14-person-additive-adjusted");
});

test("the sidebar's marks and legend: AI as given, AI adjusted, a person's, a needs-a-note row", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "two" });
  // a second row changed (the AI's, adjusted), a third left half done (needs-a-note keeps its mark)
  await page.locator(".fm-grade-side [data-row=ielts]").click();
  await page.locator('[data-crit="TR"] [data-act=less]').click();
  await page.locator(".fm-grade-side [data-row=banded]").click();
  await page.locator("[data-action=clear]").click();
  await page.locator('[data-crit="content"] input.fm-ctl-value').fill("2");
  await page.locator(".fm-grade-side [data-row=add]").click();
  await page.locator(".fm-grade-side").screenshot({ path: out("15-sidebar-marks") });
});

test("saved: the card's line", async ({ page }) => {
  await open(page, { q: "add", start: "adjusted", graders: "two" });
  await page.locator("[data-action=finish]").click();
  await page.locator("dialog[open]").screenshot({ path: out("16-finish-dialog") });
  await page.locator("dialog[open] [data-action=save]").click();
  await page.locator("[data-grade-saved]").waitFor();
  await wide(page, "17-saved");
});
