import { test as base, expect, type Page } from "@playwright/test";
import { buildIn, card, PHONE, submitAttempt } from "./helpers";

/**
 * The result badge is a pill (G94; TECHNICAL_DESIGN.md section 8, "Results (after Submit)"): the state's icon, the
 * word and the points on one line, in the state's colours, and on a phone the card's header wraps so the pill is the
 * second line under the meta. Wide and at 390 px, in en and in vi.
 */
const types = buildIn("test/fixtures/page/types.md", "types.md");
const typesVi = buildIn("test/fixtures/page/types-vi.md", "types-vi.md");

const test = base;
const phone = base.extend({
  page: async ({ browser, browserName }, use) => {
    const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
    const context = await browser.newContext({ viewport: PHONE, ...touch });
    await use(await context.newPage());
    await context.close();
  },
});

type Look = { color: string; background: string; border: string; wrap: string; svg: number; icon: string };

/** What a pill looks like, and what the state's tokens resolve to on this page. */
async function look(page: Page, id: string, token: string, wash: string): Promise<{ pill: Look; want: Look }> {
  return card(page, id)
    .locator(".fm-result")
    .evaluate(
      (el, [tk, ws]) => {
        const probe = document.createElement("span");
        document.body.append(probe);
        const resolve = (v: string, prop: "color" | "backgroundColor") => {
          probe.style.cssText = `${prop === "color" ? "color" : "background-color"}:${v}`;
          return getComputedStyle(probe)[prop];
        };
        const wantColor = resolve(`var(${tk})`, "color");
        const wantFill = resolve(ws.startsWith("--") ? `var(${ws})` : ws, "backgroundColor");
        probe.remove();
        const s = getComputedStyle(el);
        const svg = el.querySelector("svg");
        return {
          pill: {
            color: s.color,
            background: s.backgroundColor,
            border: s.borderTopColor,
            wrap: s.whiteSpace,
            svg: svg?.getBoundingClientRect().width ?? 0,
            icon: svg?.getAttribute("aria-hidden") ?? "",
          },
          want: {
            color: wantColor,
            background: wantFill,
            border: wantColor,
            wrap: "nowrap",
            svg: 0,
            icon: "true",
          },
        };
      },
      [token, wash] as [string, string],
    );
}

async function answerTypes(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start" }).click();
  await card(page, "s1").getByRole("radio").nth(1).check(); // correct
  await card(page, "n2").locator("input.fm-text").fill("9"); // wrong
  await card(page, "m1").getByRole("checkbox").nth(0).check(); // partly right
  await card(page, "c1").getByRole("radio").nth(3).check(); // not scored
  await card(page, "e1").locator("textarea").fill("a cache saves work"); // waiting
  // h2 stays empty: not answered
  await submitAttempt(page);
  await expect(page.locator(".fm-total")).toBeVisible();
}

async function expectPills(page: Page, narrow: boolean): Promise<void> {
  const states: [string, string, string, string][] = [
    ["s1", "--ok", "--ok-wash", "correct"],
    ["n2", "--bad", "--bad-wash", "incorrect"],
    ["m1", "--warn", "--surface", "partial"],
    ["h2", "--muted", "--sunken", "unanswered"],
    ["e1", "--info", "--info-wash", "pending"],
    ["c1", "--muted", "--sunken", "ungraded"],
  ];
  for (const [id, token, wash, status] of states) {
    const pill = card(page, id).locator(".fm-result");
    await expect(pill).toHaveAttribute("data-status", status);
    const { pill: got, want } = await look(page, id, token, wash);
    expect(got.color, `${id} colour`).toBe(want.color);
    expect(got.background, `${id} fill`).toBe(want.background);
    if (status === "partial") expect(got.border, `${id} border`).toBe(want.border);
    expect(got.wrap).toBe("nowrap");
    expect(got.icon).toBe("true");
    expect(got.svg).toBe(narrow ? 14 : 16);
    // one line, and the header at most two
    const box = (await pill.boundingBox()) as { height: number };
    expect(box.height, `${id} pill height`).toBeLessThan(40);
    const head = await card(page, id)
      .locator(".fm-question-head")
      .evaluate((h) => {
        return { h: h.getBoundingClientRect().height };
      });
    expect(head.h, `${id} header height`).toBeLessThan(90);
  }
  // the points as the boards write them
  await expect(card(page, "s1").locator(".fm-result")).toHaveText(/^Correct · [\d.]+ \/ [\d.]+$/);
  await expect(card(page, "m1").locator(".fm-result")).toHaveText(/^Partly right · [\d.]+ \/ [\d.]+$/);
  await expect(card(page, "e1").locator(".fm-result")).toHaveText(/^Waiting for a grader · 0 \/ 4$/);
  await expect(card(page, "c1").locator(".fm-result")).toHaveText("Not scored");
}

test("wide: every state is a pill in its colours", async ({ page }) => {
  await page.goto(types.url);
  await answerTypes(page);
  await expectPills(page, false);
});

phone("at 390 px: the header is two lines at most, the pill one", async ({ page }) => {
  await page.goto(types.url);
  await answerTypes(page);
  await expectPills(page, true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const narrow of [false, true]) {
  (narrow ? phone : test)(
    `vi ${narrow ? "at 390 px" : "wide"}: the longest word stays on one line`,
    async ({ page }) => {
      await page.goto(typesVi.url);
      await page.getByRole("button", { name: /Bắt đầu/ }).click();
      await card(page, "e1").locator("textarea").fill("một hai ba");
      await submitAttempt(page);
      await expect(page.locator(".fm-total")).toBeVisible();
      const pill = card(page, "e1").locator(".fm-result");
      await expect(pill).toHaveAttribute("data-status", "pending");
      await expect(pill).toContainText("Đang chờ chấm");
      const box = (await pill.boundingBox()) as { height: number };
      expect(box.height).toBeLessThan(40);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    },
  );
}
