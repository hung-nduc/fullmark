import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { fixScreens, root, SCREENS_USE, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3z9 (the brief form on a phone: the card's mark under the head line, G140), `en`, light, at
 * 360 x 780 and 390 x 844: the pre-filled form's first card, and a card marked "Missing" after a refused Finish. Not
 * part of `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3z9.spec.ts --project=chromium.
 * They land in docs/screens/3z9/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));

const out = (name: string) => join(root, "docs", "screens", "3z9", `${name}.png`);
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

const AGENT = [
  ...["--purpose", "exam-prep"],
  ...["--scope", "lectures 3 to 5, the Fourier transform and its properties"],
  ...["--kinds", "lecture-slides,past-exams"],
  ...["--count", "30", "--minutes", "90", "--mode", "timed-exam"],
  ...["--request", "Match the style of the 2024 midterm. No proofs."],
];

async function open(page: Page, args: string[]): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const server = await serveProcess(dir, ["brief", "signals-midterm", "--web", "--no-open", ...args]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
]) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

    test("the pre-filled form's first card", async ({ page }) => {
      await open(page, AGENT);
      await page.screenshot({ path: out(`01-prefilled-${size.width}`) });
    });

    test("a card marked Missing after a refused Finish", async ({ page }) => {
      await open(page, []);
      await page.locator("[data-footbar] [data-action=finish]").tap();
      await page.locator("[data-dialog=blocked]").waitFor();
      await page.locator("[data-dialog=blocked] [data-action=go-back]").tap();
      await page.locator("[data-dialog=blocked]").waitFor({ state: "detached" });
      await page.locator('section[data-qkey="purpose"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: out(`02-missing-${size.width}`) });
    });
  });
}
