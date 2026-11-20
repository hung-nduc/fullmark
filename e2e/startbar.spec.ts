import { expect, type Page, test } from "@playwright/test";
import { SETS } from "../src/core/themes";
import { buildWith, noViolations, watch } from "./helpers";

/**
 * Slice 7c: the start screen's bar (TECHNICAL_DESIGN.md, section 8, "The look", "Where they are"): the version, A- / A+
 * and Appearance before Start, one look with the top bar after it.
 */
const SOURCE = "test/fixtures/page/map.md";
const open = (extra: string[], name: string, flags: string[] = []) => buildWith(SOURCE, `${name}.md`, extra, flags);

const bar = (page: Page) => page.locator("[data-startbar]");
const appearance = (page: Page) => page.getByRole("button", { name: "Appearance" });
const menu = (page: Page) => page.locator("[data-look-menu]");
const start = (page: Page) => page.getByRole("button", { name: "Start" }).click();
const rootSize = (page: Page) =>
  page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
const family = (page: Page) => page.evaluate(() => getComputedStyle(document.body).fontFamily);
const bg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());

test("the start screen has the bar: the version, A- / A+ and Appearance; the bar scrolls with the page", async ({
  page,
}) => {
  const quiz = open([], "bar");
  const seen = watch(page);
  await page.goto(quiz.url);
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toContainText("version");
  await expect(bar(page).getByRole("button", { name: "Smaller text" })).toBeVisible();
  await expect(bar(page).getByRole("button", { name: "Larger text" })).toBeVisible();
  await expect(bar(page).getByRole("button", { name: "Appearance" })).toBeVisible();
  expect(await bar(page).evaluate((el) => getComputedStyle(el).position)).toBe("static");
  await start(page);
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator("[data-dock]")).toBeVisible();
  expect(seen.problems).toEqual([]);
});

test("Readable and A+ chosen before Start are the font and size after Start, and after a reload", async ({ page }) => {
  const quiz = open(["theme: paper"], "before", ["--fonts", "all"]);
  await page.goto(quiz.url);
  await appearance(page).click();
  await page.locator('[data-font-pick="readable"]').click();
  await page.locator('[data-theme-pick="dark"]').click();
  await page.getByRole("button", { name: "Larger text" }).click();
  expect(await family(page)).toMatch(/^"?Lexend"?,/);
  expect(await rootSize(page)).toBe(19);
  expect(await bg(page)).toBe(SETS.dark.tokens.bg);
  await start(page);
  expect(await family(page)).toMatch(/^"?Lexend"?,/);
  expect(await rootSize(page)).toBe(19);
  expect(await bg(page)).toBe(SETS.dark.tokens.bg);
  // both places show the current choice: the top bar's menu has the same pills pressed
  await appearance(page).click();
  await expect(page.locator('[data-font-pick="readable"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-theme-pick="dark"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-action=reset-size]")).toHaveText("1.12×");
  await page.reload();
  expect(await family(page)).toMatch(/^"?Lexend"?,/);
  expect(await rootSize(page)).toBe(19);
  await expect(bar(page).locator("[data-action=reset-size]")).toHaveText("1.12×");
});

test("a choice made after Start shows on the start screen of a resumed attempt, and Default look resets both", async ({
  page,
}) => {
  const quiz = open(["theme: paper"], "resumed", ["--fonts", "all"]);
  await page.goto(quiz.url);
  await start(page);
  await page.getByRole("button", { name: "Larger text" }).click();
  await appearance(page).click();
  await page.locator('[data-font-pick="serif"]').click();
  await page.reload();
  // the quiz offers to continue: the start screen's bar shows the stored choice
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(bar(page).locator("[data-action=reset-size]")).toHaveText("1.12×");
  await appearance(page).click();
  await expect(page.locator('[data-font-pick="serif"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Default look" }).click();
  expect(await rootSize(page)).toBe(17);
  expect(await family(page)).toContain("Segoe UI");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-dock]")).toBeVisible();
  expect(await rootSize(page)).toBe(17);
  await appearance(page).click();
  await expect(page.getByRole("button", { name: "Default look" })).toHaveCount(0);
});

test("look: locked shows A- / A+ and no Appearance, and the size still holds after Start", async ({ page }) => {
  const quiz = open(["theme: paper", "look: locked"], "locked");
  await page.goto(quiz.url);
  await expect(bar(page).getByRole("button", { name: "Smaller text" })).toBeVisible();
  await expect(appearance(page)).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Larger text" }).click();
  expect(await rootSize(page)).toBe(19);
  await start(page);
  expect(await rootSize(page)).toBe(19);
  expect(await bg(page)).toBe(SETS.paper.tokens.bg);
});

test("the Font row lists only the embedded fonts", async ({ page }) => {
  const none = open([], "fonts-none", ["--fonts", "none"]);
  await page.goto(none.url);
  await appearance(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.locator("[data-font-row]")).toHaveCount(0);
  const all = open([], "fonts-all", ["--fonts", "all"]);
  await page.goto(all.url);
  await appearance(page).click();
  await expect(page.locator("[data-font-row] .fm-pill")).toHaveText(["System", "Sans", "Serif", "Readable"]);
});

test("the menu closes with the button, a click outside and Escape", async ({ page }) => {
  const quiz = open([], "closing");
  await page.goto(quiz.url);
  for (const how of ["button", "outside", "Escape"] as const) {
    await appearance(page).click();
    await expect(menu(page)).toBeVisible();
    await expect(appearance(page)).toHaveAttribute("aria-expanded", "true");
    if (how === "button") await appearance(page).click();
    else if (how === "outside") await page.locator(".fm-header").click({ position: { x: 5, y: 5 } });
    else await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(appearance(page)).toHaveAttribute("aria-expanded", "false");
  }
  await appearance(page).click();
  await page.keyboard.press("Escape");
  await expect(appearance(page)).toBeFocused();
});

test("the start screen has no axe violations with the menu open", async ({ page }) => {
  const quiz = open([], "axe", ["--fonts", "all"]);
  await page.goto(quiz.url);
  await appearance(page).click();
  await expect(menu(page)).toBeVisible();
  await noViolations(page);
});

for (const width of [360, 390]) {
  for (const look of ["free", "locked"]) {
    test(`at ${width} px nothing leaves the screen and every target is 44 px (look: ${look})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      const quiz = open([`look: ${look}`], `phone-${look}-${width}`, ["--fonts", "all"]);
      await page.goto(quiz.url);
      const check = async (): Promise<void> => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const out = await page.evaluate(() =>
          [...document.querySelectorAll("[data-startbar] button, [data-look-menu] button")]
            .map((b) => ({ name: (b.textContent ?? "").trim(), r: b.getBoundingClientRect() }))
            .filter(({ r }) => r.left < -0.5 || r.right > window.innerWidth + 0.5 || r.height < 43.5)
            .map(({ name, r }) => `${name} ${r.left} ${r.right} ${r.height}`),
        );
        expect(out).toEqual([]);
      };
      await check();
      await expect(bar(page).getByRole("button", { name: "Larger text" })).toBeVisible();
      if (look === "free") {
        await appearance(page).click();
        await check();
      }
      // the largest size, the worst case for the bar
      for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Larger text" }).click();
      await check();
    });
  }
}
