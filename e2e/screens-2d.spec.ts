import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { buildIn, fixScreens, pageShot, root, SCREENS_TIME, SCREENS_USE, submitAttempt } from "./helpers";

/**
 * Screenshots of slice 2d for the owner to compare with the Design canvas. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-2d.spec.ts --project=chromium. They land in docs/screens/2d/, which is committed for the owner's review.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: { width: 1280, height: 940 } });

const parts = buildIn("test/fixtures/page/parts.md", "parts.md");
const timed = buildIn("test/fixtures/page/timed.md", "timed.md");
const out = (name: string) => join(root, "docs", "screens", "2d", `${name}.png`);

test("start screen with parts, without parts, Continue, the Start over dialog, storage blocked", async ({ page }) => {
  await page.goto(parts.url);
  await pageShot(page, out("1-start-with-parts"));

  await page.goto(timed.url);
  await pageShot(page, out("2-start-without-parts-timed"));

  await page.goto(parts.url);
  await page.getByRole("button", { name: "Start" }).click();
  const first = await page.locator("article.fm-question").first().getAttribute("data-qid");
  await page.getByLabel(`right ${first}`).check();
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await pageShot(page, out("3-start-continue-or-start-over"));
  await page.getByRole("button", { name: "Start over" }).click();
  await page.screenshot({ path: out("4-start-over-dialog") });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.screenshot({ path: out("5-answering-untimed-line"), clip: { x: 0, y: 0, width: 1280, height: 520 } });
});

test("the timer line, and the results after reopening", async ({ page }) => {
  await page.goto(timed.url);
  await page.clock.pauseAt(new Date(Date.parse(SCREENS_TIME) + 10_000));
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByLabel("right t1").check();
  await page.clock.runFor(35_000);
  await page.screenshot({ path: out("6-timer-line-timed"), clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await submitAttempt(page);
  await page.clock.resume();
  await page.reload();
  await expect(page.locator(".fm-total")).toBeVisible();
  await pageShot(page, out("7-results-after-reopening"));
});

test("storage blocked notice", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await page.goto(parts.url);
  await pageShot(page, out("8-start-storage-blocked"));
  await page.getByRole("button", { name: "Start" }).click();
  await page.screenshot({ path: out("9-answering-storage-blocked"), clip: { x: 0, y: 0, width: 1280, height: 520 } });
});
