import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { buildFolder, PHONES, replayOf, root, type Served, serveProcess, submitAttempt, watch } from "./helpers";

/**
 * The layout checks at the three phone sizes (STEP3.md, slice 3z8; TECHNICAL_DESIGN.md, foundation 8, "Phone sizes"):
 * 360 x 780, 390 x 844 and 430 x 932. For the page (start screen, Materials pop-up, answering with the sidebar shut and
 * open, results, replay) and the `review`, `grade --web` (with and without `--grades`) and `brief --web` forms: the
 * page does not scroll sideways, the foot bar is never over the last card, every control is 44 px, and the pop-up and
 * the phone sidebar fill the screen. Behaviour is tested once, at 390 x 844, in the specs of each surface.
 */
for (const phone of PHONES) {
  const test = base.extend({
    page: async ({ browser, browserName }, use) => {
      const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
      const context = await browser.newContext({ viewport: { width: phone.width, height: phone.height }, ...touch });
      await use(await context.newPage());
      await context.close();
    },
  });

  const press = async (page: Page, target: Locator): Promise<void> => {
    if (await page.evaluate(() => "ontouchstart" in window)) await target.tap();
    else await target.click();
  };

  /** Nothing is wider than the screen: the page does not scroll sideways. */
  const noSideways = async (page: Page): Promise<void> => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(phone.width);
  };

  /** Every drawn button, tab, summary and field (a text area is not a target) is at least 44 px high. */
  const targets = async (page: Page): Promise<void> => {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, summary, [role=tab], select, input:not([type=hidden])")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const style = getComputedStyle(e);
          const input = e as HTMLInputElement;
          const hiddenInput =
            e.tagName === "INPUT" && (["checkbox", "radio"].includes(input.type) || e.classList.contains("fm-sr"));
          return (
            r.width > 0 &&
            r.height > 0 &&
            style.visibility !== "hidden" &&
            !e.closest("[inert]") &&
            !e.closest(".fm-sr") &&
            !hiddenInput
          );
        })
        .map(
          (e) =>
            `${e.tagName}.${e.className} ${(e.textContent ?? "").trim().slice(0, 16)} ${Math.round(e.getBoundingClientRect().height * 10) / 10}`,
        )
        .filter((x) => Number(x.split(" ").at(-1)) < 43.5),
    );
    expect(small).toEqual([]);
  };

  /** The foot bar is in the screen's bottom edge and the last card can be scrolled clear of it. */
  const footClear = async (page: Page, lastCard: string): Promise<void> => {
    const bar = page.locator("[data-footbar], .fm-footbar").first();
    await expect(bar).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      // a form that scrolls in a box of its own (the brief's main column)
      for (const e of document.querySelectorAll<HTMLElement>("*")) {
        if (e.scrollHeight > e.clientHeight && ["auto", "scroll"].includes(getComputedStyle(e).overflowY))
          e.scrollTop = e.scrollHeight;
      }
    });
    const b = (await bar.boundingBox()) as { y: number; height: number };
    const last = (await page.locator(lastCard).last().boundingBox()) as { y: number; height: number };
    expect(last.y + last.height).toBeLessThanOrEqual(b.y + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(phone.height + 0.5);
    expect(b.y + b.height).toBeGreaterThan(phone.height - 2);
  };

  /** The sidebar (or the pop-up) takes the whole width, and reaches the screen's bottom. */
  const fills = async (page: Page, selector: string, fromTop = false): Promise<void> => {
    const box = (await page.locator(selector).first().boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(phone.width, 0);
    expect(box.y + box.height).toBeCloseTo(phone.height, 0);
    if (fromTop) expect(box.y).toBeCloseTo(0, 0);
  };

  /** The phone gutter (foundation 8): a card is 8 px from each edge of the screen. */
  const gutter = async (page: Page, selector: string): Promise<void> => {
    const box = (await page.locator(selector).first().boundingBox()) as { x: number; width: number };
    expect(box.x).toBeCloseTo(8, 0);
    expect(box.x + box.width).toBeCloseTo(phone.width - 8, 0);
  };

  const all = async (page: Page): Promise<void> => {
    await noSideways(page);
    await targets(page);
  };

  test.describe(`${phone.width} x ${phone.height} (${phone.name})`, () => {
    // -- the page -----------------------------------------------------------------------------------------------------
    const quiz = buildFolder("test/fixtures/page", "materials.md");
    const side = (page: Page) => page.locator("aside.fm-side");
    const toggle = (page: Page) => page.locator("[data-action=sidebar]");

    test("the page: start screen, the Materials pop-up, answering with the sidebar shut and open, the results", async ({
      page,
    }) => {
      const seen = watch(page);
      await page.goto(quiz.url);
      await all(page);
      await gutter(page, ".fm-parts");
      // "The whole quiz": the title whole on its own line, "Recommended" under it, then the counts
      const rows = await page.locator(".fm-part-whole").evaluate((el) => {
        const box = (sel: string) => {
          const e = el.querySelector(sel) as HTMLElement;
          const r = e.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, scrollW: e.scrollWidth, clientW: e.clientWidth };
        };
        return {
          title: box(".fm-part-name strong"),
          rec: box(".fm-recommend"),
          meta: box(".fm-part-meta"),
          row: el.scrollHeight <= el.clientHeight,
        };
      });
      expect(rows.row).toBe(true);
      expect(rows.title.scrollW).toBeLessThanOrEqual(rows.title.clientW + 1);
      expect(rows.rec.top).toBeGreaterThanOrEqual(rows.title.bottom - 1);
      expect(rows.meta.top).toBeGreaterThanOrEqual(rows.rec.bottom - 1);
      await press(page, page.locator("[data-action=materials]"));
      await fills(page, "dialog.fm-materials-dialog", true);
      await all(page);
      await press(page, page.locator("[data-action=close-materials]"));
      await page.getByRole("button", { name: "Start" }).click();
      await all(page);
      await gutter(page, "article[data-qid]");
      // the page's foot is in the flow: the last card ends above it
      const foot = (await page.locator("[data-action=licences]").boundingBox()) as { y: number };
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = (await page.locator("article[data-qid]").last().boundingBox()) as { y: number; height: number };
      expect(last.y + last.height).toBeLessThanOrEqual(foot.y + (await page.evaluate(() => window.scrollY)) + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await press(page, toggle(page));
      await expect(side(page)).toBeVisible();
      await fills(page, "aside.fm-side");
      await all(page);
      await press(page, page.getByRole("tab", { name: "Materials", exact: true }));
      await all(page);
      await press(page, page.locator("[data-action=close-sidebar]"));
      await page.getByLabel(/right m1$/).check();
      await submitAttempt(page);
      await expect(page.locator(".fm-results")).toBeVisible();
      await all(page);
      await gutter(page, ".fm-results");
      // "By part" is close under the tiles, at the left edge, with no rule beside it
      const part = await page.locator(".fm-by-part").evaluate((el) => ({
        border: getComputedStyle(el).borderLeftWidth,
        pad: getComputedStyle(el).paddingLeft,
        x: el.getBoundingClientRect().x,
        top: el.getBoundingClientRect().top,
      }));
      const facts = (await page.locator(".fm-facts").boundingBox()) as { x: number; y: number; height: number };
      expect(part.border).toBe("0px");
      expect(part.pad).toBe("0px");
      expect(part.x).toBeCloseTo(facts.x, 0);
      expect(part.top - (facts.y + facts.height)).toBeLessThanOrEqual(16);
      await press(page, toggle(page));
      await fills(page, "aside.fm-side");
      await all(page);
      expect(seen.problems).toEqual([]);
    });

    test("the replay of a graded attempt", async ({ page }) => {
      await page.goto(replayOf([], `sizes-${phone.width}`));
      await expect(page.locator(".fm-results")).toBeVisible();
      await all(page);
      await press(page, toggle(page));
      await fills(page, "aside.fm-side");
      await all(page);
    });

    // -- the review form ----------------------------------------------------------------------------------------------
    const served: Served[] = [];
    test.afterEach(() => {
      for (const s of served.splice(0)) s.child.kill("SIGKILL");
    });
    async function serve(dir: string, args: string[], page: Page, ready: string): Promise<void> {
      const s = await serveProcess(dir, args);
      served.push(s);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(s.url);
      await page.locator(ready).waitFor();
    }

    test("review: the compact bar, the foot bar, the sidebar", async ({ page }) => {
      const dir = mkdtempSync(join(tmpdir(), "fm-sizes-review-"));
      mkdirSync(join(dir, ".git"));
      cpSync(join(root, "test/fixtures/page/materials.md"), join(dir, "quiz.md"));
      cpSync(join(root, "test/fixtures/page/materials"), join(dir, "materials"), { recursive: true });
      await serve(dir, ["review", "quiz.md"], page, "[data-quiz]");
      await all(page);
      await gutter(page, "article[data-qid]");
      await footClear(page, "article[data-qid]");
      // the verdict is on a line of its own under the head line, at the left; the option's label under its text
      const first = page.locator("article[data-qid]").first();
      const meta = (await first.locator(".fm-question-meta").boundingBox()) as { x: number; y: number; height: number };
      const verdict = (await first.locator(".fm-review-status").boundingBox()) as { x: number; y: number };
      expect(verdict.y).toBeGreaterThanOrEqual(meta.y + meta.height - 1);
      expect(verdict.x).toBeCloseTo(meta.x, 0);
      const opt = first.locator(".fm-choice[data-correct=true] label");
      const text = (await opt.locator(".fm-choice-text").boundingBox()) as { y: number; height: number };
      const badge = (await opt.locator(".fm-badge").boundingBox()) as { y: number };
      expect(badge.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
      await page.locator("article[data-qid]").first().locator("[data-pick=fix]").tap();
      await all(page);
      await press(page, page.locator("[data-action=sidebar]"));
      await fills(page, "aside[data-review-side]");
      await all(page);
    });

    // -- the grading form ---------------------------------------------------------------------------------------------
    const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
    function gradeFolder(withGrades: boolean): string {
      const dir = mkdtempSync(join(tmpdir(), "fm-sizes-grade-"));
      mkdirSync(join(dir, ".git"));
      const source = readFileSync(join(INPUT, "quiz.md"), "utf8");
      writeFileSync(join(dir, "quiz.md"), source);
      const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
      results.quizHash = quizHash(source, []);
      writeFileSync(join(dir, "results.json"), JSON.stringify(results));
      if (withGrades) {
        const grades = JSON.parse(readFileSync(join(INPUT, "grades.json"), "utf8"));
        grades.results_hash = resultsHash(results);
        grades.grader = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-10-24T09:00:00" };
        writeFileSync(join(dir, "agent.json"), JSON.stringify(grades, null, 2));
      }
      return dir;
    }

    for (const withGrades of [false, true]) {
      test(`grade --web ${withGrades ? "with" : "without"} --grades: the card, the foot bar, the sidebar`, async ({
        page,
      }) => {
        const args = ["grade", "results.json", "--quiz", "quiz.md", "--web"];
        if (withGrades) args.push("--grades", "agent.json", "--name", "Lan");
        await serve(gradeFolder(withGrades), args, page, "[data-quiz]");
        await all(page);
        await gutter(page, "article.fm-grade-card");
        await footClear(page, "article.fm-grade-card");
        await press(page, page.locator("[data-action=sidebar]"));
        await fills(page, "aside.fm-side");
        await all(page);
      });
    }

    // -- the brief form -----------------------------------------------------------------------------------------------
    test("brief --web: the form, the foot bar, the sidebar, the summary", async ({ page }) => {
      const dir = mkdtempSync(join(tmpdir(), "fm-sizes-brief-"));
      mkdirSync(join(dir, ".git"));
      await serve(
        dir,
        [
          "brief",
          "d",
          "--web",
          "--no-open",
          "--purpose",
          "exam-prep",
          "--scope",
          "lectures 3 to 5, the Fourier transform",
        ],
        page,
        ".bf",
      );
      await all(page);
      await gutter(page, ".bf section[data-qkey]");
      await footClear(page, ".bf section[data-qkey]");
      await press(page, page.locator("[data-action=sidebar]"));
      await fills(page, ".bf-side");
      await all(page);
      await press(page, page.locator("[data-action=close-sidebar]"));
      await press(page, page.locator("[data-footbar] [data-action=finish]"));
      await all(page);
    });

    test("brief --web: a choice never moves the next card's first control (G139)", async ({ page }) => {
      const dir = mkdtempSync(join(tmpdir(), "fm-sizes-brief-"));
      mkdirSync(join(dir, ".git"));
      await serve(dir, ["brief", "d", "--web", "--no-open"], page, ".bf");
      const choice = page.locator('section[data-qkey="weak_topics"] [data-choice="no"]');
      const next = page.locator('section[data-qkey="commitment"] [data-action=inc]');
      await next.scrollIntoViewIfNeeded();
      const box = (await next.boundingBox()) as { x: number; y: number };
      const before = { x: box.x, y: box.y };
      // the control's box at the moment of the second tap's click, before the form reacts to it
      await page.evaluate(() => {
        const w = window as unknown as { __at?: { x: number; y: number } };
        document.addEventListener(
          "click",
          (e) => {
            if ((e.target as HTMLElement).closest("[data-action=inc]")) {
              const r = (e.target as HTMLElement).closest("[data-action=inc]")?.getBoundingClientRect() as DOMRect;
              w.__at = { x: r.x, y: r.y };
            }
          },
          true,
        );
      });
      await press(page, choice);
      await press(page, next);
      const at = await page.evaluate(() => (window as unknown as { __at: { x: number; y: number } }).__at);
      expect(at).toEqual(before);
    });
  });
}
