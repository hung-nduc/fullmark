import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { buildWith, fixScreens, root, SCREENS_USE } from "./helpers";

/**
 * Screenshots of slice 7c, the start screen's bar. Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-7c.spec.ts --project=chromium. They land in docs/screens/7c/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));

const SOURCE = "test/fixtures/page/mockup.md";
const out = (name: string) => join(root, "docs", "screens", "7c", `${name}.png`);
const quiz = (name: string, extra: string[]) => buildWith(SOURCE, `${name}.md`, extra, ["--fonts", "all"]);
const menu = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Appearance" }).click();
  await expect(page.locator("[data-look-menu]")).toBeVisible();
};

test("the start screen with the menu open, light", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(quiz("light", ["theme: light"]).url);
  await menu(page);
  await page.screenshot({ path: out("1-start-menu-light") });
});

test("the start screen with the menu open, dark", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(quiz("dark", ["theme: dark"]).url);
  await menu(page);
  await page.screenshot({ path: out("2-start-menu-dark") });
});

test("the locked page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(quiz("locked", ["theme: paper", "look: locked"]).url);
  await page.screenshot({ path: out("3-start-locked") });
});

test.describe("a phone, 360 x 780", () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test("the bar and its menu", async ({ page }) => {
    await page.goto(quiz("phone", ["theme: light"]).url);
    await page.screenshot({ path: out("4-phone-bar") });
    await menu(page);
    await page.screenshot({ path: out("5-phone-menu") });
  });
});
