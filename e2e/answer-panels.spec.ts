import { expect, test } from "@playwright/test";
import { THEME_NAMES } from "../src/core/themes";
import { noViolations, replayOf } from "./helpers";

/**
 * The explanation panel, the rubric box's frame, and the box on a phone (3o) (STEP2.md, slice 2j3; TECHNICAL_DESIGN.md,
 * section 8, row "Answer panels"). The fixture is the replay of the `essay` quiz with its grades, built with `extra`
 * front matter lines (the lines change the hash, so the results and grades files are re-keyed to it).
 */
const style = (page: import("@playwright/test").Page, selector: string, props: string[]) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, ps) => {
      const cs = getComputedStyle(el);
      return Object.fromEntries(ps.map((p) => [p, cs.getPropertyValue(p)]));
    }, props);

for (const theme of THEME_NAMES) {
  test(`the explanation panel and the rubric box in ${theme}: bar, fills, rules, and axe`, async ({ page }) => {
    await page.goto(replayOf([`theme: ${theme}`], `p-${theme}`));
    const explanation = await style(page, ".fm-explanation", [
      "border-left-width",
      "border-top-width",
      "border-top-left-radius",
      "border-top-right-radius",
      "padding-top",
      "padding-left",
    ]);
    expect(explanation).toMatchObject({
      "border-left-width": "3px",
      "border-top-width": "0px",
      "border-top-left-radius": "0px",
      "border-top-right-radius": "8px",
      "padding-top": "12px",
      "padding-left": "16px",
    });
    // the grader's words are no longer a panel: the box holds them (TECHNICAL_DESIGN.md, section 6, "The rubric box")
    await expect(page.locator(".fm-feedback")).toHaveCount(0);
    const box = await page.evaluate(() => {
      const c = (sel: string) => getComputedStyle(document.querySelector(`article[data-qid="add"] ${sel}`) as Element);
      return {
        fill: c(".fm-box").backgroundColor,
        head: c(".fm-box-head").backgroundColor,
        total: c(".fm-box-total").backgroundColor,
        rule: c(".fm-box-head").borderBottomWidth,
        totalRule: c(".fm-box-total").borderTopWidth,
        radius: c(".fm-box").borderTopLeftRadius,
        card: getComputedStyle(document.documentElement).getPropertyValue("--card-radius"),
        type: c(".fm-box-type").color,
        hint: getComputedStyle(document.documentElement).getPropertyValue("--hint"),
        slot: c(".fm-slot").height,
      };
    });
    // the surface fill and the card fill are one colour in the white theme only
    if (theme !== "white") expect(box.fill).not.toBe(box.head);
    expect(box.head).toBe(box.total);
    expect(box.rule).toBe("2px");
    expect(box.totalRule).toBe("2px");
    expect(box.slot).toBe("44px");
    // 8 px, or the card's own radius when that is smaller (the white theme's 4 px)
    expect(parseFloat(box.radius)).toBe(Math.min(8, parseFloat(box.card)));
    const sections = page.locator('article[data-qid="add"] .fm-box-sec');
    await expect(sections).toHaveCount(5);
    await expect(sections.nth(3)).toContainText("Why this score");
    await noViolations(page);
  });
}

test.describe("the rubric box on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("each section stacks, nothing is cut or scrolls sideways, and the slots are named in words", async ({
    page,
  }) => {
    await page.goto(replayOf([], "phone"));
    const add = page.locator('article[data-qid="add"]');
    await add.scrollIntoViewIfNeeded();
    const wide = await page.evaluate(() => {
      const box = document.querySelector('article[data-qid="add"]')?.getBoundingClientRect();
      const over = [...document.querySelectorAll("article[data-qid] .fm-box *")].filter(
        (el) => el.getBoundingClientRect().right > (box?.right ?? 0) + 0.5,
      );
      return { page: document.documentElement.scrollWidth > window.innerWidth, over: over.map((el) => el.className) };
    });
    expect(wide).toEqual({ page: false, over: [] });
    // the head's two sides stack; a section is a name, then the slot at the column's full width, then the note
    const parts = await add.locator(".fm-box").evaluate((box) => {
      const r = (sel: string, from: Element = box) => (from.querySelector(sel) as Element).getBoundingClientRect();
      const li = box.querySelectorAll("li")[1] as Element;
      return {
        type: r(".fm-box-type"),
        by: r(".fm-box-by"),
        name: r(".fm-box-title", li),
        slot: r(".fm-slot", li),
        note: r(".fm-box-note", li),
        sec: li.getBoundingClientRect(),
      };
    });
    expect(parts.by.top).toBeGreaterThan(parts.type.bottom - 1);
    expect(parts.slot.top).toBeGreaterThan(parts.name.bottom - 1);
    expect(parts.note.top).toBeGreaterThan(parts.slot.bottom - 1);
    // full width: the section's padding is 14 px each side
    expect(Math.round(parts.slot.width)).toBe(Math.round(parts.sec.width - 28));
    // each slot says its value in words; the "/" is hidden from assistive technology
    await expect(add.locator(".fm-box-sec").nth(1).locator(".fm-slot .fm-sr")).toHaveText("1.25 of 1.5 points");
    await expect(add.locator(".fm-slot-in").first()).toHaveAttribute("aria-hidden", "true");
    await expect(add.getByRole("group", { name: "Points per criterion" })).toHaveCount(1);
    await expect(add.getByRole("listitem")).toHaveCount(3);
    const ielts = page.locator('article[data-qid="ielts"]');
    await expect(ielts.locator(".fm-slot .fm-sr").first()).toHaveText("band 6 of 9");
    await expect(page.locator('article[data-qid="holistic"] .fm-slot .fm-sr').first()).toHaveText("verdict: Met");
    await noViolations(page);
  });
});
