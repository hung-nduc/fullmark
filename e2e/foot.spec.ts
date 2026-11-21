import { expect, test } from "@playwright/test";
import { buildWith, PHONES } from "./helpers";

/**
 * The page's foot (TECHNICAL_DESIGN.md, section 3, "Licences"; G131): the page fills the window's height and the
 * foot follows the content, so on a short page the ⓘ button is at the window's bottom right, and on a long page it
 * follows the last question. Always in the flow, never over content.
 */
const short = buildWith("test/fixtures/page/tiny.md", "foot-short.md", []);
const long = buildWith("test/fixtures/page/types.md", "foot-long.md", []);

const button = (page: import("@playwright/test").Page) => page.locator("[data-action=licences]");

for (const size of [{ width: 1280, height: 940 }, ...PHONES]) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("on the start screen the button is at the window's bottom, under the content", async ({ page }) => {
      await page.goto(short.url);
      const [b, start] = [
        await button(page).boundingBox(),
        await page.getByRole("button", { name: "Start" }).boundingBox(),
      ];
      if (b === null || start === null) throw new Error("no box");
      // on a desktop the page is not taller than the window, and the button's bottom is within 24 px of it; on a phone
      // the start screen, with its bar, may be taller than the window: then the button is at the page's end (step 7, G14)
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      if (!("name" in size)) expect(total).toBeLessThanOrEqual(size.height);
      const bottom = Math.max(total, size.height);
      expect(bottom - (b.y + b.height)).toBeLessThanOrEqual(24);
      expect(bottom - (b.y + b.height)).toBeGreaterThanOrEqual(0);
      // never over content
      expect(b.y).toBeGreaterThanOrEqual(start.y + start.height);
      // at the page's right edge
      expect(size.width - (b.x + b.width)).toBeLessThanOrEqual(24);
    });

    test("a short quiz, answering: the button is at the window's bottom", async ({ page }) => {
      await page.goto(short.url);
      await page.getByRole("button", { name: "Start" }).click();
      const last = await page.locator("article[data-qid]").last().boundingBox();
      const b = await button(page).boundingBox();
      if (b === null || last === null) throw new Error("no box");
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      // if the questions leave room, the foot is at the window's bottom; else it follows the last question
      if (total <= size.height) expect(size.height - (b.y + b.height)).toBeLessThanOrEqual(24);
      expect(b.y).toBeGreaterThanOrEqual(last.y + last.height - 1);
    });

    test("a long quiz: the button follows the last question, at the end of the page", async ({ page }) => {
      await page.goto(long.url);
      await page.getByRole("button", { name: "Start" }).click();
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(size.height);
      await button(page).scrollIntoViewIfNeeded();
      const last = await page.locator("article[data-qid]").last().boundingBox();
      const b = await button(page).boundingBox();
      if (b === null || last === null) throw new Error("no box");
      expect(b.y).toBeGreaterThanOrEqual(last.y + last.height - 1);
      const gap = await page.evaluate(
        (bottom) => document.documentElement.scrollHeight - (bottom + window.scrollY),
        b.y + b.height,
      );
      expect(gap).toBeLessThanOrEqual(24);
    });
  });
}

test("in Focus mode there is no foot", async ({ page }) => {
  await page.goto(short.url);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Focus mode" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await expect(page.locator(".fm-foot")).toHaveCount(0);
});
