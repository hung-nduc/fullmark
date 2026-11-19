import { join } from "node:path";
import { test } from "@playwright/test";
import { fixScreens, pageShot, root, SCREENS_USE } from "./helpers";
import { fiveQuizzes, longShelf, writeShelf } from "./shelf-fixture";

/**
 * Screenshots of slice 5c (the shelf's index page as a table, STEP5.md): five quizzes in light and dark, `--ui-lang vi`,
 * a phone at 390 x 844 in light and dark, a long shelf of 24 scrolled half-way (the headings at the top), and an empty
 * shelf. Not part of `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-5c.spec.ts
 * --project=chromium. They land in docs/screens/5c/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));

const out = (name: string) => join(root, "docs", "screens", "5c", `${name}.png`);
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

for (const scheme of ["light", "dark"] as const) {
  test(`five quizzes, desktop (${scheme})`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(writeShelf(fiveQuizzes()));
    await pageShot(page, out(`01-five-desktop-${scheme}`));
  });

  test(`five quizzes, phone (${scheme})`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(writeShelf(fiveQuizzes()));
    await pageShot(page, out(`02-five-phone-${scheme}`));
  });
}

test("--ui-lang vi, desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(writeShelf(fiveQuizzes(), "vi"));
  await pageShot(page, out("03-vi-desktop"));
});

test("a long shelf scrolled half-way: the headings stay at the top", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(writeShelf(longShelf()));
  await page.evaluate(() => window.scrollTo(0, Math.floor((document.documentElement.scrollHeight - innerHeight) / 2)));
  await pageShot(page, out("04-long-desktop"), { fullPage: false });
});

test("a long shelf on a phone, scrolled half-way", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(writeShelf(longShelf()));
  await page.evaluate(() => window.scrollTo(0, Math.floor((document.documentElement.scrollHeight - innerHeight) / 2)));
  await pageShot(page, out("05-long-phone"), { fullPage: false });
});

test("an empty shelf", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(writeShelf([]));
  await pageShot(page, out("06-empty-desktop"), { fullPage: false });
});
