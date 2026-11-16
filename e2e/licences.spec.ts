import { expect, test } from "@playwright/test";
import { buildWith, noViolations } from "./helpers";

/**
 * The Information & Licences button and its popup (TECHNICAL_DESIGN.md, section 3, "Licences"): at the foot of the start screen and of
 * the page, never floating; Esc or a click outside closes it and the focus returns to the button; absent in Focus mode.
 */
const quiz = buildWith("test/fixtures/page/singles.md", "lic.md", ["font: serif"]);

const button = (page: import("@playwright/test").Page) => page.locator("[data-action=licences]");
const dialog = (page: import("@playwright/test").Page) => page.locator("dialog#fm-licences");

test("the button sits at the foot of the start screen and opens the popup with the notices", async ({ page }) => {
  await page.goto(quiz.url);
  await expect(button(page)).toBeVisible();
  await expect(button(page)).toHaveAccessibleName("Information & Licences");
  await expect(button(page)).toHaveAttribute("title", "Information & Licences");
  await expect(button(page)).toHaveText("");
  // a 44 px target at the bottom right of the foot
  const box = await button(page).boundingBox();
  expect(box?.width).toBe(44);
  expect(box?.height).toBe(44);
  // at the right end of the foot, which spans the main area, not the content column (owner, 2026-11-02)
  const foot = await button(page).evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().right);
  expect(Math.abs((box?.x ?? 0) + 44 - (foot - 16))).toBeLessThan(1);
  const main = await page
    .locator(".fm-main")
    .first()
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(Math.abs(foot - main)).toBeLessThan(1);
  const column = await page
    .locator(".fm-header")
    .first()
    .evaluate((el) => el.getBoundingClientRect().right);
  expect((box?.x ?? 0) > column).toBe(true); // clear of the column, away from the test
  await expect(dialog(page)).toBeHidden();
  // in the flow, not floating: scrolled to the bottom it is below the Start button
  const [b, s] = [await button(page).boundingBox(), await page.getByRole("button", { name: "Start" }).boundingBox()];
  expect(b && s && b.y > s.y).toBe(true);
  expect(await button(page).evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).position)).toBe(
    "static",
  );
  await button(page).click();
  await expect(dialog(page)).toBeVisible();
  // the Information tab comes first; the notices are on the Licences tab
  await expect(dialog(page).getByRole("tab", { name: "Information" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog(page).getByRole("tabpanel")).toContainText("Quiz version");
  await dialog(page).getByRole("tab", { name: "Licences" }).click();
  await expect(dialog(page).getByRole("tabpanel")).toContainText("MIT License");
  const text = ((await dialog(page).locator("[data-info-panel=licences]").textContent()) ?? "").replace(/\s+/g, " ");
  for (const name of ["Preact", "Zod", "Source Serif 4", "MIT License", "SIL Open Font License"]) {
    expect(text).toContain(name);
  }
  expect(text).not.toContain("KaTeX");
  expect(text).not.toContain("Lexend");
});

test("Esc closes the popup and the focus returns to the button; so does a click outside", async ({ page }) => {
  await page.goto(quiz.url);
  await button(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(button(page)).toBeFocused();

  await button(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(dialog(page)).toBeHidden();
  await expect(button(page)).toBeFocused();

  // a click inside does not close it; the close button does
  await button(page).click();
  await dialog(page).getByRole("heading", { name: "Information & Licences" }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(button(page)).toBeFocused();
});

test("the button is also at the foot of the questions, and absent in Focus mode until it ends", async ({ page }) => {
  await page.goto(quiz.url);
  await page.getByRole("button", { name: "Start" }).click();
  const last = page.locator("article[data-qid]").last();
  const [b, q] = [await button(page).boundingBox(), await last.boundingBox()];
  expect(b && q && b.y >= q.y + q.height - 1).toBe(true);
  await page.getByRole("button", { name: "Focus mode" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await expect(button(page)).toHaveCount(0);
  await page.keyboard.press("f");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(false);
  await expect(button(page)).toBeVisible();
});

test("axe: the page with the popup open has no violations", async ({ page }) => {
  await page.goto(quiz.url);
  await button(page).click();
  await expect(dialog(page)).toBeVisible();
  await noViolations(page);
  await dialog(page).getByRole("tab", { name: "Licences" }).click();
  await noViolations(page);
});

test("the tabs: Information first; click, arrows, Home and End move between them; opening again starts at Information", async ({
  page,
}) => {
  await page.goto(quiz.url);
  await button(page).click();
  const info = dialog(page).getByRole("tab", { name: "Information" });
  const lic = dialog(page).getByRole("tab", { name: "Licences" });
  await expect(dialog(page).getByRole("tab")).toHaveCount(2);
  await expect(info).toHaveAttribute("aria-selected", "true");
  await expect(dialog(page).locator("[data-info-panel=licences]")).toBeHidden();
  await info.focus();
  await page.keyboard.press("ArrowRight");
  await expect(lic).toHaveAttribute("aria-selected", "true");
  await expect(lic).toBeFocused();
  await expect(dialog(page).locator("[data-info-panel=info]")).toBeHidden();
  await page.keyboard.press("Home");
  await expect(info).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(lic).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await button(page).click();
  await expect(info).toHaveAttribute("aria-selected", "true");
});

test("Information lists build inputs only, in two groups: this quiz, and how it was built (G130, G132)", async ({
  page,
}) => {
  await page.goto(quiz.url);
  await button(page).click();
  const groups = await dialog(page)
    .locator(".fm-info-group")
    .evaluateAll((els) =>
      els.map((g) => ({
        heading: g.querySelector("h3")?.textContent ?? "",
        rows: [...g.querySelectorAll(".fm-info-row")].map((e) =>
          [...e.children].map((c) => c.textContent ?? "").join(" "),
        ),
      })),
    );
  expect(groups.map((g) => g.heading)).toEqual(["This quiz", "How it was built"]);
  const [mine, built] = [groups[0]?.rows ?? [], groups[1]?.rows ?? []];
  expect(mine).toHaveLength(6);
  expect(mine[0]).toMatch(/^Quiz version [0-9a-f]{4}$/);
  // the page formats the build time when the dialog opens, in the reader's time zone (fixed to Hanoi's below)
  expect(mine[1]).toMatch(/^Built at \d{1,2} [A-Z][a-z]{2} \d{4}, \d\d:\d\d$/);
  expect(mine.slice(2)).toEqual([
    "Theme auto (default)",
    "Look free (default)",
    "Fonts quiz (default)",
    "Interface language en (default)",
  ]);
  expect(built).toHaveLength(4);
  expect(built[0]).toMatch(/^fullmark 1\./);
  expect(built[1]).toMatch(/Preact 1\d\.\d+\.\d+/);
  expect(built[1]).toContain("Source Serif 4");
  expect(built[1]).not.toContain("KaTeX");
  expect(built.slice(2)).toEqual(["Profile default (default)", "Strict off (default)"]);
  // a rule between the groups
  const [g1, rule, g2] = await Promise.all([
    dialog(page).locator(".fm-info-group").first().boundingBox(),
    dialog(page).locator(".fm-info-rule").boundingBox(),
    dialog(page).locator(".fm-info-group").last().boundingBox(),
  ]);
  expect(g1 && rule && g2 && g1.y + g1.height <= rule.y && rule.y + rule.height <= g2.y).toBe(true);
  // never the machine: no Node version, system or path
  const text = (await dialog(page).textContent()) ?? "";
  expect(text).not.toMatch(/node|linux|windows|darwin|\/home\/|\/Users\//i);
});

test.describe("the build time in the reader's own time zone (G132)", () => {
  // the quiz is built at a fixed instant: 2026-10-28T10:00:00+07:00 is 03:00 UTC
  const at = quiz;
  const vi = buildWith("test/fixtures/page/singles.md", "lic-time-vi.md", ["ui_lang: vi"]);

  test.describe("Hanoi", () => {
    test.use({ timezoneId: "Asia/Ho_Chi_Minh" });
    test("en: 28 Oct 2026, 10:00; the bytes keep the ISO string", async ({ page }) => {
      await page.goto(at.url);
      await expect(page.locator("[data-built-at]")).toHaveText("2026-10-28T10:00:00+07:00");
      await button(page).click();
      await expect(page.locator("[data-built-at]")).toHaveText("28 Oct 2026, 10:00");
    });
  });

  test.describe("Hanoi, vi", () => {
    test.use({ timezoneId: "Asia/Ho_Chi_Minh" });
    test("vi: 28 thg 10 2026, 10:00", async ({ page }) => {
      await page.goto(vi.url);
      await button(page).click();
      await expect(page.locator("[data-built-at]")).toHaveText("28 thg 10 2026, 10:00");
    });
  });

  test.describe("New York", () => {
    test.use({ timezoneId: "America/New_York" });
    test("the same instant shows its local day and time", async ({ page }) => {
      await page.goto(at.url);
      await button(page).click();
      await expect(page.locator("[data-built-at]")).toHaveText("27 Oct 2026, 23:00");
    });
  });
});

test("the first licence text is 20 px below the list, and two texts are 12 px apart (G130)", async ({ page }) => {
  await page.goto(quiz.url);
  await button(page).click();
  await dialog(page).getByRole("tab", { name: "Licences" }).click();
  const list = await dialog(page).locator(".fm-licences-list").boundingBox();
  const texts = await dialog(page).locator(".fm-licences-texts").boundingBox();
  expect(list && texts && Math.round(texts.y - (list.y + list.height))).toBe(20);
  const gap = await dialog(page)
    .locator(".fm-licences-texts")
    .evaluate((el) => {
      const pres = el.querySelectorAll("pre");
      const heads = el.querySelectorAll("h3");
      const first = pres[0]?.getBoundingClientRect();
      const second = heads[1]?.getBoundingClientRect();
      return first && second ? Math.round(second.top - first.bottom) : null;
    });
  expect(gap).toBe(12);
});
