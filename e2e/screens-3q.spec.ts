import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import {
  buildWith,
  card,
  fixScreens,
  pageShot,
  replayOf,
  root,
  run,
  SCREENS_USE,
  type Served,
  serveProcess,
  shotOf,
  submitAttempt,
} from "./helpers";

/**
 * Screenshots of slice 3q for the owner to set beside ResultsReplay and RubricPhoneReplay: the result pill in the five
 * states, the "YOUR ANSWER" panel for an essay, a code answer and an unanswered one, in paper with the serif font, in
 * light, in dark, in vi, at 390 px, and in the grader's frame. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3q.spec.ts --project=chromium. They land in docs/screens/3q/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
// tall, so the page never scrolls and its sticky bars stay clear of the cards
test.use({ viewport: { width: 1280, height: 3200 } });

const out = (name: string) => join(root, "docs", "screens", "3q", `${name}.png`);
const STAMP = ["--built-at", "2026-10-28T10:00:00+07:00"];

/** The types quiz answered (five states and a waiting essay; the code and the essay empty when `empty`), submitted, replayed. */
async function typesReplay(page: Page, extra: string[], opts: { empty?: boolean; vi?: boolean } = {}): Promise<string> {
  const file = opts.vi ? "types-vi.md" : "types.md";
  const built = buildWith(`test/fixtures/page/${file}`, file, extra);
  await page.goto(built.url);
  // an earlier attempt of the same quiz id is stored for the file origin: start clean
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: opts.vi ? "Bắt đầu" : "Start" }).click();
  await card(page, "s1").getByRole("radio").nth(1).check(); // correct
  await card(page, "n2").locator("input.fm-text").fill("9"); // wrong
  await card(page, "m1").getByRole("checkbox").nth(0).check(); // partly right
  await card(page, "c1").getByRole("radio").nth(3).check(); // not scored
  if (!opts.empty) {
    await card(page, "e1").locator("textarea").fill("a cache saves work,\nbut it can go stale");
    await card(page, "k1")
      .locator("textarea")
      .fill("fn zqlargest(v: &[i32]) -> i32 {\n    *v.iter().max().unwrap()\n}");
  }
  await submitAttempt(page);
  await expect(page.locator(".fm-total")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: opts.vi ? "Tải kết quả về" : "Download results" }).click();
  const saved = await download;
  await saved.saveAs(join(built.dir, "attempt.json"));
  run(built.dir, "replay", "attempt.json", "--quiz", file, "--no-open", ...STAMP);
  return `file:///${join(built.dir, "attempt-replay.html").replaceAll("\\", "/")}`;
}

/** The cards in these ids, one under the other, as the page draws them. */
async function cards(page: Page, ids: string[], name: string): Promise<void> {
  for (const id of ids) await expect(card(page, id)).toBeVisible();
  const boxes = await Promise.all(ids.map((id) => card(page, id).boundingBox()));
  const top = Math.min(...boxes.map((b) => b?.y ?? 0));
  const bottom = Math.max(...boxes.map((b) => (b?.y ?? 0) + (b?.height ?? 0)));
  const x = boxes[0]?.x ?? 0;
  const width = boxes[0]?.width ?? 0;
  // the five states are not next to each other in the quiz: one shot of the column holds them
  await pageShot(page, out(name), { clip: { x, y: top, width, height: bottom - top } });
}
const STATES = ["s1", "n2", "m1", "h2", "e1", "c1"];

test("paper, serif: the five states, and the waiting essay", async ({ page }) => {
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"]));
  await cards(page, STATES, "1-replay-states-paper-serif");
  await card(page, "e1").screenshot({ path: out("2-essay-waiting-paper-serif") });
});

test("a graded essay, paper, serif", async ({ page }) => {
  await page.goto(replayOf(["theme: paper", "font: serif"], "graded"));
  await shotOf(card(page, "add"), out("3-essay-graded-paper-serif"));
});

test("light and dark", async ({ page }) => {
  await page.goto(await typesReplay(page, ["theme: light"]));
  await cards(page, STATES, "4-replay-states-light");
  await page.goto(await typesReplay(page, ["theme: dark"]));
  await cards(page, STATES, "5-replay-states-dark");
});

test("a code answer, and an unanswered essay and code", async ({ page }) => {
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"]));
  await card(page, "k1").screenshot({ path: out("6-code-answer") });
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"], { empty: true }));
  await card(page, "e1").screenshot({ path: out("7-essay-no-answer") });
  await card(page, "k1").screenshot({ path: out("8-code-no-answer") });
});

test("vi", async ({ page }) => {
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"], { vi: true }));
  await cards(page, STATES, "9-replay-states-vi");
});

test("at 390 px: a graded essay, and the longest pending badge in en and in vi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 5200 });
  await page.goto(replayOf(["theme: paper", "font: serif"], "phone"));
  await shotOf(card(page, "add"), out("10-phone-essay-graded"));
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"]));
  await cards(page, ["s1", "m1", "e1"], "11-phone-states-en");
  await page.goto(await typesReplay(page, ["theme: paper", "font: serif"], { vi: true }));
  await cards(page, ["s1", "m1", "e1"], "12-phone-states-vi");
});

// -- the grader's frame ----------------------------------------------------------------------------------------------

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

test("the grader's frame shows the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  const input = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(input, "quiz.md"), "utf8");
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(input, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await serveProcess(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web", "--name", "Lan"]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
  await page.locator("[data-auto]").click();
  const frame = page.frameLocator("iframe[data-frame=marked]");
  await frame.locator("[data-results]").waitFor();
  await frame.locator("[data-filter=all]").click();
  await frame.locator(".fm-answer-panel").first().waitFor();
  await page.screenshot({ path: out("13-grader-frame-panel") });
});
