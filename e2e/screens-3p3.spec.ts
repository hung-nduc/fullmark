// biome-ignore-all lint/suspicious/noExplicitAny: a test edits the grades file freely
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { fixScreens, PHONE, PHONES, root, SCREENS_USE, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3p3 (`grade --web --grades` on a phone), for the owner to set beside RubricPhone (the stacked box)
 * and GradeAI (the pre-filled box's values): at 390 x 844 each rubric type unchanged and adjusted, a person's pre-fill,
 * the sidebar with its marks and pill, dark, vi; and one at 360 x 740. Whole cards are taken full page. Not part of
 * `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3p3.spec.ts --project=chromium. They land
 * in docs/screens/3p3/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

const out = (name: string) => join(root, "docs", "screens", "3p3", `${name}.png`);
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

const OPUS = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-11-05T14:40:00" };
const SONNET = { kind: "ai", name: "Claude Sonnet 5.5", model: "claude-sonnet-5-5", at: "2026-11-05T14:41:00" };
const LAN = { kind: "human", name: "Lan Nguyen", at: "2026-11-05T15:00:00" };

type Q = "add" | "ielts" | "holistic" | "code";
type Scene = { q: Q; adjusted?: boolean; person?: boolean; theme?: string; vi?: boolean };

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
  grades.grader = scene.person ? LAN : OPUS;
  if (!scene.person) for (const id of ["add", "code"]) grades.grades[id].grader = SONNET;
  writeFileSync(join(dir, "agent.json"), JSON.stringify(grades, null, 2));
  const server = await serveProcess(dir, [
    ...["grade", "results.json", "--quiz", "quiz.md", "--web", "--grades", "agent.json", "--name", "Lan"],
  ]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  if (scene.q !== "add") {
    await page.locator("[data-action=sidebar]").tap();
    await page.locator(`.fm-grade-side [data-row=${scene.q}]`).tap();
  }
  if (scene.adjusted) await adjust(page, scene.q);
}

async function adjust(page: Page, q: Q): Promise<void> {
  const less = (crit: string) => page.locator(`[data-crit="${crit}"] [data-act=less]`).tap();
  if (q === "add") {
    await less("derive");
    await page.locator('[data-crit="derive"] textarea').fill("Uses zero initial conditions without saying so.");
  } else if (q === "ielts") {
    await less("TR");
    await page.locator('[data-crit="TR"] textarea').fill("Under 250 words; the useful-subjects view is one sentence.");
  } else if (q === "holistic") {
    await page.locator("[data-ctl=score] [data-act=less]").tap();
    await page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=partly]').tap();
  } else await less("style");
}

/** the page whole, then the box's top and the foot, as the phone's screens of 3p did */
async function shots(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: out(`${name}-whole`), fullPage: true });
  await page.evaluate(() =>
    window.scrollBy(0, (document.querySelector(".fm-box")?.getBoundingClientRect().top ?? 0) - 72),
  );
  await page.screenshot({ path: out(`${name}-box`) });
}

test("additive, unchanged", async ({ page }) => {
  await open(page, { q: "add" });
  await shots(page, "01-additive-unchanged");
});

test("additive, adjusted: the foot stacked", async ({ page }) => {
  await open(page, { q: "add", adjusted: true });
  await shots(page, "02-additive-adjusted");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: out("02-additive-adjusted-foot") });
});

test("banded, unchanged", async ({ page }) => {
  await open(page, { q: "ielts" });
  await shots(page, "03-banded-unchanged");
});

test("banded, adjusted", async ({ page }) => {
  await open(page, { q: "ielts", adjusted: true });
  await shots(page, "04-banded-adjusted");
});

test("holistic, unchanged", async ({ page }) => {
  await open(page, { q: "holistic" });
  await shots(page, "05-holistic-unchanged");
});

test("holistic, adjusted", async ({ page }) => {
  await open(page, { q: "holistic", adjusted: true });
  await shots(page, "06-holistic-adjusted");
});

test("code, unchanged", async ({ page }) => {
  await open(page, { q: "code" });
  await shots(page, "07-code-unchanged");
});

test("code, adjusted", async ({ page }) => {
  await open(page, { q: "code", adjusted: true });
  await shots(page, "08-code-adjusted");
});

test("pre-filled by a person, adjusted", async ({ page }) => {
  await open(page, { q: "add", adjusted: true, person: true });
  await shots(page, "09-person-adjusted");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: out("09-person-adjusted-foot") });
});

test("the sidebar with its marks and the pill", async ({ page }) => {
  await open(page, { q: "add", adjusted: true });
  await page.locator("[data-action=sidebar]").tap();
  await page.screenshot({ path: out("10-sidebar") });
});

test("dark, banded adjusted", async ({ page }) => {
  await open(page, { q: "ielts", adjusted: true, theme: "dark" });
  await shots(page, "11-dark-banded-adjusted");
});

test("vi, additive adjusted, and its sidebar", async ({ page }) => {
  await open(page, { q: "add", adjusted: true, vi: true });
  await shots(page, "12-vi-additive-adjusted");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: out("12-vi-additive-adjusted-foot") });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("[data-action=sidebar]").tap();
  await page.screenshot({ path: out("12-vi-sidebar") });
});

test.describe("360 px", () => {
  test.use({ viewport: PHONES[0] });
  test("holistic, adjusted", async ({ page }) => {
    await open(page, { q: "holistic", adjusted: true });
    await shots(page, "13-360-holistic-adjusted");
  });
  test("additive, adjusted", async ({ page }) => {
    await open(page, { q: "add", adjusted: true });
    await shots(page, "14-360-additive-adjusted");
  });
});
