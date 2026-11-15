// biome-ignore-all lint/suspicious/noExplicitAny: a test edits the grades file freely
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { noViolations, root, type Served, serveProcess } from "./helpers";

/**
 * `quiz grade --web --grades` on a phone, below 760 px (STEP3.md, slice 3p3; G111): each pre-filled box is on a line of
 * its own above its control, at its own size and wholly on screen; the card's foot stacks the restore over Clear this
 * question; the pill is at the top of the sidebar's sheet. At 390 px and 360 px, for each rubric type; a lit box does
 * nothing and a press restores, as wide.
 */
type Json = Record<string, any>;
const WIDTHS = [390, 360] as const;
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const OPUS = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-10-24T09:00:00" };

let width = 390;
const test = base.extend({
  page: async ({ browser, browserName }, use) => {
    const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
    const context = await browser.newContext({ viewport: { width, height: 844 }, ...touch });
    await use(await context.newPage());
    await context.close();
  },
});

function folder(extra: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-prefilled-phone-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const grades = JSON.parse(readFileSync(join(INPUT, "grades.json"), "utf8")) as Json;
  grades.results_hash = resultsHash(results);
  grades.grader = OPUS;
  writeFileSync(join(dir, "agent.json"), JSON.stringify(grades, null, 2));
  return dir;
}

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});
async function open(page: Page, extra: string[] = []): Promise<void> {
  const s = await serveProcess(folder(extra), [
    "grade",
    "results.json",
    "--quiz",
    "quiz.md",
    "--web",
    "--grades",
    "agent.json",
    "--name",
    "Lan",
  ]);
  served.push(s);
  await page.goto(s.url);
  await page.locator("[data-quiz]").waitFor();
}

const press = async (page: Page, target: Locator): Promise<void> => {
  if (await page.evaluate(() => "ontouchstart" in window)) await target.tap();
  else await target.click();
};
const crit = (page: Page, id: string) => page.locator(`[data-crit="${id}"]`);
const chip = (page: Page, id: string) => crit(page, id).locator(".fm-given");
const toggle = (page: Page) => page.locator("[data-action=sidebar]");
const goto = async (page: Page, id: string): Promise<void> => {
  await press(page, toggle(page));
  await press(page, page.locator(`.fm-grade-side [data-row=${id}]`));
  await expect(page.locator(`article[data-qid=${id}]`)).toBeVisible();
};
const noSideways = async (page: Page): Promise<void> => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
  const card = await page.locator("article.fm-grade-card").evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(card).toBeLessThanOrEqual(0);
};
/** the box is `w` wide, `h` tall, inside the screen, and on a line of its own above `below` */
async function boxAbove(box: Locator, below: Locator, w: number): Promise<void> {
  const b = await box.boundingBox();
  const c = await below.boundingBox();
  expect(b?.width).toBeCloseTo(w, 0);
  expect(b?.height).toBeCloseTo(44, 0);
  expect(b?.x).toBeGreaterThanOrEqual(0);
  expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(width);
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual((c?.y ?? 0) + 0.5);
  // left-aligned with the control
  expect(b?.x).toBeCloseTo(c?.x ?? 0, 0);
}

for (const w of WIDTHS) {
  test.describe(`${w} px`, () => {
    test.beforeAll(() => {
      width = w;
    });
    test.beforeEach(() => {
      width = w;
    });

    test("additive: each box over its control, the max box 44 px, the total's box over the total, the foot stacked", async ({
      page,
    }) => {
      await open(page);
      await noSideways(page);
      for (const id of ["defs", "derive", "interp"]) {
        const slot = crit(page, id).locator("[data-ctl]");
        await boxAbove(chip(page, id), slot.locator(".fm-ctl-group"), 76);
        const g = await slot.locator(".fm-ctl-group").boundingBox();
        const m = await slot.locator(".fm-ctl-max").boundingBox();
        expect(g?.height).toBeGreaterThanOrEqual(43.5);
        expect(m?.height).toBeGreaterThanOrEqual(43.5);
        expect(m?.width).toBeGreaterThanOrEqual(43.5);
        expect(m?.y).toBeCloseTo(g?.y ?? 0, 0);
      }
      const total = page.locator("[data-ctl=total]");
      await boxAbove(total.locator(".fm-given"), total.locator(".fm-ctl-calc-value"), 76);
      // the foot: while unchanged, Clear alone; changed, the restore first and over it, each the card's full width
      await expect(page.locator("[data-action=restore]")).toHaveCount(0);
      await press(page, crit(page, "derive").locator("[data-act=more]"));
      const restore = page.locator("[data-action=restore]");
      const clear = page.locator("[data-action=clear]");
      const [r, c, card] = await Promise.all([
        restore.boundingBox(),
        clear.boundingBox(),
        page.locator(".fm-grade-rubric").boundingBox(),
      ]);
      expect(r?.y).toBeLessThan(c?.y ?? 0);
      for (const b of [r, c]) {
        expect(b?.width).toBeCloseTo(card?.width ?? 0, 0);
        expect(b?.height).toBeGreaterThanOrEqual(43.5);
      }
      await noSideways(page);
    });

    test("a lit box does nothing; a change makes it plain and a press restores the row, its note and the question", async ({
      page,
    }) => {
      await open(page);
      const derive = chip(page, "derive");
      await press(page, derive);
      await expect(derive).toHaveAttribute("aria-pressed", "true");
      await press(page, crit(page, "derive").locator("[data-act=more]"));
      await expect(derive).toHaveAttribute("aria-pressed", "false");
      await expect(derive).toHaveText("1.25");
      await crit(page, "derive").locator("textarea").fill("Other.");
      await press(page, derive);
      await expect(crit(page, "derive").locator("input.fm-ctl-value")).toHaveValue("1.25");
      await expect(crit(page, "derive").locator("textarea")).toHaveValue(
        "Skips the zero initial-conditions assumption.",
      );
      // the text's "AI's" stays by its label
      const why = page.locator(".fm-box-label-row .fm-given").first();
      const label = await page.locator(".fm-box-label-line").first().boundingBox();
      const wb = await why.boundingBox();
      expect(wb?.y).toBeLessThan((label?.y ?? 0) + (label?.height ?? 0) + 8);
      expect((wb?.x ?? 0) + (wb?.width ?? 0)).toBeLessThanOrEqual(width);
      // the whole question, from the foot
      await press(page, crit(page, "defs").locator("[data-act=less]"));
      await press(page, page.locator("[data-action=restore]"));
      await expect(crit(page, "defs").locator("input.fm-ctl-value")).toHaveValue("0.5");
      await expect(page.locator("[data-action=restore]")).toHaveCount(0);
    });

    test("banded, holistic (a verdict box over its group, the one score's box over its control) and code", async ({
      page,
    }) => {
      await open(page);
      await goto(page, "ielts");
      await noSideways(page);
      await boxAbove(chip(page, "TR"), crit(page, "TR").locator(".fm-ctl-group"), 76);
      const total = page.locator("[data-ctl=total]");
      await boxAbove(total.locator(".fm-given"), total.locator(".fm-ctl-calc-value"), 76);
      await goto(page, "holistic");
      await noSideways(page);
      const v = crit(page, "names-the-nyquist-rate");
      await boxAbove(v.locator(".fm-given"), v.locator(".fm-ctl-verdicts"), 88);
      const verdicts = await v.locator(".fm-ctl-verdicts").boundingBox();
      const rowBox = await v.locator(".fm-box-row").boundingBox();
      expect(verdicts?.width).toBeCloseTo(rowBox?.width ?? 0, 0);
      const score = page.locator("[data-ctl=score]").first();
      await boxAbove(score.locator(".fm-given"), score.locator(".fm-ctl-group"), 76);
      await press(page, v.locator("[data-verdict=missed]"));
      await expect(v.locator(".fm-given")).toHaveAttribute("aria-pressed", "false");
      await press(page, v.locator(".fm-given"));
      await expect(v.locator("[data-verdict=met]")).toHaveAttribute("aria-checked", "true");
      await goto(page, "code");
      await noSideways(page);
      const code = page.locator("article[data-qid=code] [data-crit]").first();
      await boxAbove(code.locator(".fm-given"), code.locator(".fm-ctl-group"), 76);
    });

    test("the pill is at the top of the sidebar's sheet, not in the compact bar", async ({ page }) => {
      await open(page);
      await expect(page.locator(".fm-status-pill")).toHaveCount(0);
      await expect(page.locator("[data-compact]")).toHaveText("Graded 5 of 5 · Question 2");
      await press(page, toggle(page));
      const pill = page.locator(".fm-grade-side .fm-status-pill");
      await expect(pill).toHaveText("Pre-filled · 5 as given, 0 adjusted");
      await expect(pill).toHaveAttribute("title", "Pre-filled from Claude Opus 5.5 (5)");
      const [t, p, body] = await Promise.all([
        page.locator(".fm-side-title").boundingBox(),
        pill.boundingBox(),
        page.locator(".fm-grade-side-body").boundingBox(),
      ]);
      expect(p?.y).toBeGreaterThan((t?.y ?? 0) + (t?.height ?? 0) - 1);
      expect(p?.y).toBeLessThan(body?.y ?? 0);
      expect((p?.x ?? 0) + (p?.width ?? 0)).toBeLessThanOrEqual(width);
      await noSideways(page);
    });

    test("the vi words fit their boxes", async ({ page }) => {
      await open(page, ["ui_lang: vi"]);
      await press(page, crit(page, "derive").locator("[data-act=more]"));
      await noSideways(page);
      // the box (still 76 px) and the "✦ Về điểm của AI" restore inside the card
      const b = await chip(page, "derive").evaluate((e) => ({ s: e.scrollWidth, c: e.clientWidth }));
      expect(b.s).toBeLessThanOrEqual(b.c);
      const restore = page.locator("[data-action=restore]");
      await expect(restore).toContainText("Về điểm của AI");
      const r = await restore.evaluate((e) => ({ s: e.scrollWidth, c: e.clientWidth }));
      expect(r.s).toBeLessThanOrEqual(r.c);
      await press(page, toggle(page));
      const pill = page.locator(".fm-grade-side .fm-status-pill");
      await expect(pill).toContainText("Điền sẵn · 4 giữ nguyên, 1 đã sửa");
      const pb = await pill.boundingBox();
      expect((pb?.x ?? 0) + (pb?.width ?? 0)).toBeLessThanOrEqual(width);
    });
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe passes on a phone in ${scheme}: as given, adjusted, the sidebar`, async ({ page }) => {
    width = 390;
    await open(page);
    await page.emulateMedia({ colorScheme: scheme });
    await noViolations(page);
    await press(page, crit(page, "derive").locator("[data-act=more]"));
    await noViolations(page);
    await press(page, toggle(page));
    await noViolations(page);
    await press(page, page.locator(".fm-grade-side [data-row=holistic]"));
    await noViolations(page);
  });
}
