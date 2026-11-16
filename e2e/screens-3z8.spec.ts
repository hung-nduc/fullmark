import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import {
  buildFolder,
  fixScreens,
  PHONES,
  root,
  SCREENS_USE,
  type Served,
  serveProcess,
  submitAttempt,
} from "./helpers";

/**
 * Screenshots of slice 3z8, at 360 x 780 (the narrowest common phone), English, light: the start screen, the answering
 * page with the sidebar open, the results, and the `review`, `grade --web` and `brief --web` forms. Not part of
 * `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3z8.spec.ts --project=chromium. They land
 * in docs/screens/3z8/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

const dir = join(root, "docs", "screens", "3z8");
mkdirSync(dir, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

async function serve(folder: string, args: string[], page: Page, ready: string): Promise<void> {
  const s = await serveProcess(folder, args);
  served.push(s);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(s.url);
  await page.locator(ready).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test("the page: the start screen, answering with the sidebar open, the results", async ({ page }) => {
  const quiz = buildFolder("test/fixtures/page", "materials.md");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(quiz.url);
  await shot(page, "01-start");
  await page.getByRole("button", { name: "Start" }).click();
  await page.locator("[data-action=sidebar]").tap();
  await shot(page, "02-answering-sidebar");
  await page.locator("[data-action=close-sidebar]").tap();
  await page.getByLabel(/right m1$/).check();
  await submitAttempt(page);
  await page.locator(".fm-results").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "03-results");
});

test("review", async ({ page }) => {
  const d = mkdtempSync(join(tmpdir(), "fm-screens-3z8-"));
  mkdirSync(join(d, ".git"));
  cpSync(join(root, "test/fixtures/page/materials.md"), join(d, "quiz.md"));
  cpSync(join(root, "test/fixtures/page/materials"), join(d, "materials"), { recursive: true });
  await serve(d, ["review", "quiz.md"], page, "[data-quiz]");
  await shot(page, "04-review");
});

test("grade --web", async ({ page }) => {
  const input = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
  const d = mkdtempSync(join(tmpdir(), "fm-screens-3z8-"));
  mkdirSync(join(d, ".git"));
  const source = readFileSync(join(input, "quiz.md"), "utf8");
  writeFileSync(join(d, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(input, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(d, "results.json"), JSON.stringify(results));
  await serve(d, ["grade", "results.json", "--quiz", "quiz.md", "--web"], page, "[data-quiz]");
  await shot(page, "05-grade");
});

test("brief --web", async ({ page }) => {
  const d = mkdtempSync(join(tmpdir(), "fm-screens-3z8-"));
  mkdirSync(join(d, ".git"));
  await serve(
    d,
    [
      ...["brief", "signals-midterm", "--web", "--no-open"],
      ...["--purpose", "exam-prep", "--scope", "lectures 3 to 5, the Fourier transform and its properties"],
      ...["--kinds", "lecture-slides,past-exams", "--count", "30", "--minutes", "90", "--mode", "timed-exam"],
    ],
    page,
    ".bf",
  );
  await shot(page, "06-brief");
});
