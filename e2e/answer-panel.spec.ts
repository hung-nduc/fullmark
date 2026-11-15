import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { buildWith, card, replayOf, submitAttempt } from "./helpers";

/**
 * After Submit an essay's or a code question's answer is a "YOUR ANSWER" panel, not a text box (G94, G105;
 * TECHNICAL_DESIGN.md section 8, "Results (after Submit)"), on a submitted page and in `quiz replay`.
 */
const phone = base.extend({
  page: async ({ browser, browserName }, use) => {
    const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...touch });
    await use(await context.newPage());
    await context.close();
  },
});
const wide = base;

/** axe over the page: no exclusion (G106: a code block that scrolls sideways takes keyboard focus). */
async function noViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) })),
  ).toEqual([]);
}

const ESSAY = "one two\nthree\n\nfour";
const CODE = "fn zqlargest() {\n    let x = 1;\n}";

/** A submitted types.md: e1 typed over four lines, k1 typed, or left empty. */
async function submitted(page: Page, theme: string, code: boolean): Promise<void> {
  const built = buildWith("test/fixtures/page/types.md", "types.md", [`theme: ${theme}`]);
  await page.goto(built.url);
  await page.getByRole("button", { name: "Start" }).click();
  await card(page, "e1").locator("textarea").fill(ESSAY);
  if (code) await card(page, "k1").locator("textarea").fill(CODE);
  await submitAttempt(page);
  await expect(page.locator(".fm-total")).toBeVisible();
}

for (const [name, test] of [
  ["wide", wide],
  ["at 390 px", phone],
] as const) {
  for (const theme of ["light", "dark"]) {
    test(`${name}, ${theme}: a submitted page shows the panels (essay, code, no answer), and axe is clean`, async ({
      page,
    }) => {
      await submitted(page, theme, false);
      const essay = card(page, "e1");
      await expect(essay.locator("textarea")).toHaveCount(0);
      await expect(essay.locator(".fm-count")).toHaveCount(0);
      const panel = essay.locator(".fm-answer-panel");
      await expect(panel.locator(".fm-panel-label")).toHaveText("Your answer");
      expect(await panel.locator(".fm-panel-text").evaluate((e) => (e as HTMLElement).innerText)).toBe(ESSAY);
      // the panel is plain text: not a form control, not in the tab order
      await expect(panel.locator("[tabindex], textarea, input, button")).toHaveCount(0);
      expect(
        await panel.evaluate((e) => {
          const s = getComputedStyle(e);
          const label = getComputedStyle(e.querySelector(".fm-panel-label") as Element);
          return [s.borderTopWidth, s.borderTopLeftRadius, s.paddingTop, s.paddingLeft, label.textTransform];
        }),
      ).toEqual(["1px", "8px", name === "wide" ? "12px" : "10px", name === "wide" ? "16px" : "14px", "uppercase"]);
      // the sample answer stays under it
      await expect(essay.locator(".fm-sample")).toBeVisible();
      // the unanswered code question: the dashed panel and the catalog's words
      const none = card(page, "k1").locator(".fm-answer-panel");
      await expect(none).toHaveAttribute("data-empty", "true");
      await expect(none).toContainText("Your answer");
      await expect(none).toContainText("No answer");
      expect(await none.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("dashed");
      await noViolations(page);
    });
  }

  test(`${name}: a code answer is monospaced, whitespace kept, scrolling inside the panel, and axe is clean`, async ({
    page,
  }) => {
    await submitted(page, "light", true);
    const k1 = card(page, "k1");
    await expect(k1.locator("textarea")).toHaveCount(0);
    const text = k1.locator(".fm-answer-panel .fm-panel-text");
    expect(await text.evaluate((e) => (e as HTMLElement).innerText)).toBe(CODE);
    expect(await text.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre");
    expect(await text.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Cascadia|monospace|Consolas/);
    await noViolations(page);
  });
}

phone(
  "G106: a code block that scrolls sideways takes keyboard focus, and one that does not is left alone",
  async ({ page }) => {
    await submitted(page, "light", false);
    const blocks = page.locator("pre.fm-hl");
    const n = await blocks.count();
    expect(n).toBeGreaterThan(0);
    let scrolling = 0;
    for (let i = 0; i < n; i++) {
      const block = blocks.nth(i);
      const scrolls = await block.evaluate((e) => e.scrollWidth > e.clientWidth);
      if (scrolls) {
        scrolling++;
        await expect(block).toHaveAttribute("tabindex", "0");
        await expect(block).toHaveAttribute("aria-label", /.+/);
        await block.focus();
        await expect(block).toBeFocused();
      } else await expect(block).not.toHaveAttribute("tabindex", /.*/);
    }
    expect(scrolling).toBeGreaterThan(0);
    await noViolations(page);
  },
);

wide("G106: at 1280 px a code block that fits is not in the tab order", async ({ page }) => {
  await submitted(page, "light", false);
  const fits = await page.locator("pre.fm-hl").evaluateAll((all) => all.every((e) => e.scrollWidth <= e.clientWidth));
  wide.skip(!fits, "a block scrolls even at 1280 px");
  await expect(page.locator("pre.fm-hl[tabindex]")).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  for (const [name, test] of [
    ["wide", wide],
    ["at 390 px", phone],
  ] as const) {
    test(`replay with grades, ${name}, ${theme}: the panel, then the rubric box, and axe is clean`, async ({
      page,
    }) => {
      await page.goto(replayOf([`theme: ${theme}`], `panel-${theme}`));
      const add = card(page, "add");
      await expect(add.locator("textarea")).toHaveCount(0);
      await expect(add.locator(".fm-count")).toHaveCount(0);
      const panel = add.locator(".fm-answer-panel");
      expect(await panel.locator(".fm-panel-text").evaluate((e) => (e as HTMLElement).innerText)).toBe(
        "The transform maps a signal to the frequency domain. Starting from the definition we apply it to the input and divide by the transform of the output, which gives the transfer function.",
      );
      // the rubric box follows the panel
      const order = await add.evaluate((a) => {
        const p = a.querySelector(".fm-answer-panel");
        const b = a.querySelector(".fm-box");
        return p && b ? p.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
      });
      expect(order).toBeTruthy();
      // the code answer: monospace, the indentation kept
      const code = card(page, "code").locator(".fm-answer-panel .fm-panel-text");
      expect(await code.evaluate((e) => (e as HTMLElement).innerText)).toContain("\n    return x + x");
      await noViolations(page);
    });
  }
}
