import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { noViolations, PHONE, PHONES, root, type Served, serveProcess, watch } from "./helpers";

/**
 * The brief form on a phone, below 760 px (STEP3.md, slice 3h2; G112 to G117, the BriefPhone, BriefPhoneSide and
 * BriefPhoneFinish boards): on a 390 x 844 touch screen every question is answered by touch and written from the foot
 * bar's Finish (the same bytes as 3h's wide form), the pre-filled answers come back one by one and all at once, a vague
 * scope holds Finish, the summary's rows and the sidebar's rows go to their questions, Cancel leaves the command in
 * reach, and nothing scrolls sideways at 390 or 360 px. Chromium runs as a touch phone; Firefox has no mobile mode, so it
 * runs as a narrow window with touch.
 */
const test = base.extend({
  page: async ({ browser, browserName }, use) => {
    const touch = browserName === "chromium" ? { hasTouch: true, isMobile: true } : { hasTouch: true };
    const context = await browser.newContext({ viewport: PHONE, ...touch });
    await use(await context.newPage());
    await context.close();
  },
});

const SCOPE = "lectures 3 to 5, the Fourier transform";

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-brief-phone-"));
  mkdirSync(join(dir, ".git"));
  return dir;
}

async function open(
  page: Page,
  dir: string,
  args: string[] = [],
  size: { width: number; height: number } = PHONE,
): Promise<Served> {
  const server = await serveProcess(dir, ["brief", "d", "--web", "--no-open", ...args]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(size);
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
  return server;
}

const press = async (page: Page, target: Locator): Promise<void> => {
  if (await page.evaluate(() => "ontouchstart" in window)) await target.tap();
  else await target.click();
};
const card = (page: Page, key: string) => page.locator(`section[data-qkey="${key}"]`);
const choice = (page: Page, key: string, value: string) => card(page, key).locator(`[data-choice="${value}"]`);
const mark = (page: Page, key: string) => card(page, key).locator("[data-testid=mark]");
const finish = (page: Page) => page.locator("[data-footbar] [data-action=finish]");
const cancel = (page: Page) => page.locator("[data-footbar] [data-action=cancel]");
const side = (page: Page) => page.locator("[data-action=sidebar]");
const written = (dir: string) => readFileSync(join(dir, "d", "brief.yaml"), "utf8");

/** 3h's golden: the same answers, given wide, write the same bytes. */
const golden = (name: string) => readFileSync(join(root, "e2e", "golden", `${name}.yaml`), "utf8");

/** Nothing runs off the screen: the page, the form's scrollers and every box's right edge. */
async function noSideways(page: Page): Promise<void> {
  const wide = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const bad: string[] = [];
    if (document.documentElement.scrollWidth > width) bad.push("html");
    for (const el of document.querySelectorAll<HTMLElement>(".bf-main, .bf-side-body, .bf-sum, .bf-dialog, .bf-bar")) {
      if (el.scrollWidth > el.clientWidth + 1) bad.push(`${el.className} scrolls`);
    }
    for (const el of document.querySelectorAll<HTMLElement>(".bf *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > width + 1 || r.left < -1))
        bad.push(`${el.className || el.tagName} ${r.left}..${r.right}`);
    }
    return bad.slice(0, 5);
  });
  expect(wide).toEqual([]);
}

test("answering every question by touch, then Write from the foot bar: the wide form's bytes", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir);
  const seen = watch(page);
  // the compact bar and the foot bar, no top bar buttons, no status line
  await expect(page.locator(".bf-phone-line")).toHaveText("Answered 12 of 14 · 2 to answer");
  await expect(page.locator(".bf-title")).toHaveText("Brief: d");
  await expect(page.locator(".bf-status")).toHaveCount(0);
  await expect(page.locator(".bf-header [data-action=finish]")).toHaveCount(0);
  await expect(page.locator("[data-side]")).toHaveCount(0);
  await expect(finish(page)).toBeVisible();
  await expect(cancel(page)).toBeVisible();
  await noSideways(page);
  await press(page, choice(page, "purpose", "exam-prep"));
  await card(page, "scope").locator("input").fill(SCOPE);
  await press(page, choice(page, "content.kinds", "lecture-slides"));
  await press(page, choice(page, "content.kinds", "other"));
  await card(page, "content.kinds").locator("input[type=text]").fill("a field journal: week 4");
  await card(page, "content.elsewhere").locator("input[type=text]").fill("the reserve copy, pp. 3 to 9");
  await press(page, card(page, "count").locator("[data-action=inc]"));
  await card(page, "minutes").locator("input").fill("37.5");
  await card(page, "minutes").locator("input").blur();
  await press(page, choice(page, "mix", "code"));
  await press(page, choice(page, "difficulty", "harder"));
  await press(page, choice(page, "mode", "timed-exam"));
  await press(page, choice(page, "language", "vi"));
  await press(page, choice(page, "weak_topics", "yes"));
  await card(page, "commitment").scrollIntoViewIfNeeded();
  // tapped at once, as a finger would: nothing above the button moves when the choice above it loses its focus
  await press(page, card(page, "commitment").locator("[data-action=inc]"));
  await card(page, "request").locator("textarea").fill("Match the 2024 midterm.\nNo proofs. # not a comment");
  await press(page, page.locator("[data-action=more]"));
  await press(page, choice(page, "profile", "draft"));
  await expect(page.locator(".bf-phone-line")).toHaveText("Answered 14 of 14 · Ready to finish");
  await press(page, finish(page));
  const dialog = page.locator("[data-dialog=summary]");
  await expect(dialog).toContainText("14 answers: 14 yours, 0 pre-filled for you, 0 defaults.");
  // the foot bar is out of the way while the dialog is open
  await expect(page.locator("[data-footbar]")).toBeHidden();
  await press(page, dialog.locator("[data-action=write]"));
  await expect(page.locator("[data-ended=written]")).toContainText("Brief written");
  await expect(page.locator("[data-footbar]")).toHaveCount(0);
  const end = await server.end();
  expect(end.code).toBe(0);
  expect(written(dir)).toBe(golden("brief-web-all"));
  expect(seen.problems).toEqual([]);
});

test("pre-filled answers: change and restore one, then all", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, [
    ...["--purpose", "exam-prep"],
    ...["--scope", SCOPE],
    ...["--count", "25"],
    ...["--mode", "timed-exam"],
  ]);
  const note = page.locator("[data-agent-note]");
  await expect(note).toContainText("Pre-filled for you");
  await expect(page.locator(".bf-phone-line")).toHaveText("Answered 14 of 14 · Ready to finish");
  await press(page, card(page, "count").locator("[data-action=inc]"));
  await expect(mark(page, "count")).toContainText("Your answer");
  await card(page, "scope").locator("input").fill("signals and systems chapters one to four");
  await press(page, choice(page, "difficulty", "harder"));
  await expect(note.locator("[data-action=revert]")).toContainText("Back to every pre-filled answer (2 changed)");
  const back = card(page, "count").locator("[data-action=revert]");
  await expect(back).toContainText("Back to the pre-filled answer: 25 questions");
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await press(page, back);
  await expect(mark(page, "count")).toContainText("Pre-filled for you");
  await expect(note.locator("[data-action=revert]")).toContainText("(1 changed)");
  await press(page, note.locator("[data-action=revert]"));
  await expect(card(page, "scope").locator("input")).toHaveValue(SCOPE);
  await expect(mark(page, "difficulty")).toContainText("Your answer");
  await noSideways(page);
  await press(page, finish(page));
  await press(page, page.locator("[data-dialog=summary] [data-action=write]"));
  await expect(page.locator("[data-ended=written]")).toBeVisible();
  const end = await server.end();
  expect(end.code).toBe(0);
  const text = written(dir);
  for (const key of ["purpose", "scope", "count", "mode", "difficulty"]) expect(text).toContain(`\n  ${key}: user\n`);
});

test("a vague scope holds Finish at the blocked dialog, and its link goes to the scope", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, ["--purpose", "self-study"]);
  const scope = card(page, "scope").locator("input");
  await scope.fill("lectures three four");
  await expect(card(page, "scope").locator("[data-error=vague]")).toContainText("Too short: 3 of the 4 words needed");
  await expect(page.locator(".bf-phone-line")).toContainText("1 to answer");
  await press(page, finish(page));
  const blocked = page.locator("[data-dialog=blocked]");
  await expect(blocked).toContainText("Some answers are missing");
  const box = await blocked.boundingBox();
  expect(box?.width).toBe(366);
  expect(box?.y).toBeGreaterThanOrEqual(39);
  await noSideways(page);
  await press(page, blocked.locator("[data-miss=scope]"));
  await expect(blocked).toHaveCount(0);
  await expect(scope).toBeFocused();
  await expect(page.locator("[data-footbar]")).toBeVisible();
  await press(page, cancel(page));
  const end = await server.end();
  expect(end.code).toBe(2);
});

test("the summary's rows go to their questions, each question and its mark on one line", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, ["--purpose", "self-study", "--scope", SCOPE, "--count", "25"]);
  await press(page, finish(page));
  const dialog = page.locator("[data-dialog=summary]");
  await expect(dialog.locator(".bf-sum-th")).toBeHidden();
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(366);
  const row = dialog.locator('[data-sumrow="count"]');
  const label = await row.locator(".bf-cell-label").boundingBox();
  const mk = await row.locator(".bf-cell-mark").boundingBox();
  const val = await row.locator(".bf-cell-val").boundingBox();
  expect(Math.abs((label?.y ?? 0) - (mk?.y ?? 99))).toBeLessThan(2);
  expect(val?.y).toBeGreaterThan((label?.y ?? 0) + (label?.height ?? 0) - 2);
  await expect(row).toContainText("25 questions");
  await noSideways(page);
  await press(page, dialog.locator('[data-sumrow="minutes"]'));
  await expect(dialog).toHaveCount(0);
  await expect(card(page, "minutes").locator("input")).toBeFocused();
  await press(page, cancel(page));
  await server.end();
  expect(existsSync(join(dir, "d"))).toBe(false);
});

test("Cancel from the foot bar: the Cancelled card with Copy in reach, exit 2, nothing written", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, ["--scope", SCOPE, "--count", "25"]);
  await press(page, cancel(page));
  const ended = page.locator("[data-ended=cancelled]");
  await expect(ended).toContainText("Cancelled");
  const copy = ended.locator("[data-command] button");
  await expect(copy).toBeVisible();
  const line = await ended.locator("[data-command] p").boundingBox();
  const btn = await copy.boundingBox();
  // the line and Copy share a row
  expect(btn?.y).toBeLessThan((line?.y ?? 0) + (line?.height ?? 0));
  expect(btn?.height).toBeGreaterThanOrEqual(44);
  await expect(ended.locator("[data-command] pre")).toHaveText(`quiz brief d --web --scope "${SCOPE}" --count 25`);
  await expect(page.locator("[data-footbar]")).toHaveCount(0);
  await noSideways(page);
  const end = await server.end();
  expect(end.code).toBe(2);
  expect(existsSync(join(dir, "d"))).toBe(false);
});

test("the sidebar opens from the bar, covers the screen, and a tapped row closes it and goes to its question", async ({
  page,
}) => {
  const dir = folder();
  const server = await open(page, dir, ["--purpose", "self-study", "--scope", SCOPE]);
  await expect(page.locator("[data-side]")).toHaveCount(0);
  await expect(side(page)).toHaveAttribute("aria-expanded", "false");
  await press(page, side(page));
  const panel = page.locator("[data-side]");
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.width).toBe(390);
  await expect(page.locator("[data-footbar]")).toBeHidden();
  await expect(panel.locator("[data-closes]")).toBeVisible();
  await noSideways(page);
  await press(page, panel.locator('[data-row="mode"]'));
  await expect(panel).toHaveCount(0);
  await expect(card(page, "mode")).toBeInViewport();
  await expect(page.locator("[data-footbar]")).toBeVisible();
  // opened and closed again with the close button
  await press(page, side(page));
  await press(page, page.locator("[data-action=close-sidebar]"));
  await expect(page.locator("[data-side]")).toHaveCount(0);
  await press(page, cancel(page));
  await server.end();
});

test("Appearance is in the compact bar and offers the themes and fonts", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, ["--scope", SCOPE]);
  const btn = page.locator(".bf-header [data-action=appearance]");
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  await press(page, btn);
  await expect(page.locator("[data-look-menu]")).toBeVisible();
  await noSideways(page);
  await press(page, page.locator("[data-theme-pick]").first());
  await press(page, cancel(page));
  await server.end();
});

test("the foot bar never covers the last card's control, and every control is 44 px", async ({ page }) => {
  const dir = folder();
  const server = await open(page, dir, ["--scope", SCOPE]);
  await page.evaluate(() => {
    const main = document.querySelector(".bf-main") as HTMLElement;
    main.scrollTop = main.scrollHeight;
  });
  const more = await page.locator("[data-action=more]").boundingBox();
  const foot = await page.locator("[data-footbar]").boundingBox();
  expect((more?.y ?? 0) + (more?.height ?? 0)).toBeLessThanOrEqual(foot?.y ?? 0);
  expect(foot?.height).toBeGreaterThanOrEqual(72);
  expect((foot?.y ?? 0) + (foot?.height ?? 0)).toBe(844);
  await press(page, page.locator("[data-action=more]"));
  await page.evaluate(() => {
    const main = document.querySelector(".bf-main") as HTMLElement;
    main.scrollTop = main.scrollHeight;
  });
  // the profile's rows are stacked, the box is as wide as the card
  const rows = page.locator("[data-profile-box] .bf-prof-row");
  expect(await rows.count()).toBeGreaterThan(2);
  const first = await rows.nth(0).boundingBox();
  const idBox = await rows.nth(0).locator(".bf-prof-id").boundingBox();
  const checks = await rows.nth(0).locator(".bf-prof-checks").boundingBox();
  expect(checks?.y).toBeGreaterThan((idBox?.y ?? 0) + (idBox?.height ?? 0) - 2);
  expect(first?.width).toBeGreaterThan(280);
  await noSideways(page);
  const small = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      ".bf button, .bf input:not(.bf-input-hidden), .bf textarea, .bf label.bf-choice",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height < 43.5) bad.push(`${el.className} ${r.height}`);
    }
    return bad;
  });
  expect(small).toEqual([]);
  await press(page, cancel(page));
  await server.end();
});

for (const size of PHONES) {
  test(`nothing scrolls sideways at ${size.width} px (${size.name}), in the form, its dialogs and its end cards (en and vi)`, async ({
    page,
  }) => {
    for (const lang of ["en", "vi"]) {
      const dir = folder();
      const server = await open(
        page,
        dir,
        ["--purpose", "exam-prep", "--scope", SCOPE, "--kinds", "lecture-slides,past-exams", "--language", lang],
        size,
      );
      await noSideways(page);
      await press(page, page.locator("[data-action=more]"));
      await noSideways(page);
      await press(page, side(page));
      await noSideways(page);
      await press(page, page.locator("[data-action=close-sidebar]"));
      await press(page, finish(page));
      await noSideways(page);
      await press(page, page.locator("[data-dialog=summary] [data-action=go-back]"));
      await card(page, "scope").locator("input").fill("one");
      await press(page, finish(page));
      await noSideways(page);
      await press(page, page.locator("[data-dialog=blocked] [data-action=go-back]"));
      await press(page, cancel(page));
      await expect(page.locator("[data-ended=cancelled]")).toBeVisible();
      await noSideways(page);
      await server.end();
    }
    // the done card
    const dir = folder();
    const server = await open(page, dir, ["--purpose", "self-study", "--scope", SCOPE], size);
    await press(page, finish(page));
    await press(page, page.locator("[data-dialog=summary] [data-action=write]"));
    await expect(page.locator("[data-ended=written]")).toBeVisible();
    await noSideways(page);
    await server.end();
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds nothing in the phone's form, sidebar, dialogs and end cards (${scheme})`, async ({ page }) => {
    const dir = folder();
    const server = await open(page, dir, ["--purpose", "exam-prep", "--scope", SCOPE]);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
    const axe = async (): Promise<void> => {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>(".bf-main, .bf-side-body, .bf-sum")) el.scrollTop = 0;
      });
      await noViolations(page);
    };
    await axe();
    await press(page, page.locator("[data-action=more]"));
    await axe();
    await press(page, page.locator(".bf-header [data-action=appearance]"));
    await axe();
    await press(page, page.locator(".bf-header [data-action=appearance]"));
    await press(page, side(page));
    await axe();
    await press(page, page.locator("[data-action=close-sidebar]"));
    await card(page, "scope").locator("input").fill("one");
    await press(page, finish(page));
    await axe();
    await press(page, page.locator("[data-dialog=blocked] [data-action=go-back]"));
    await card(page, "scope").locator("input").fill(SCOPE);
    await press(page, finish(page));
    await axe();
    await press(page, page.locator("[data-dialog=summary] [data-action=write]"));
    await expect(page.locator("[data-ended=written]")).toBeVisible();
    await axe();
    await server.end();
  });
}

test("the cancelled card under axe (light and dark)", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    const dir = folder();
    const server = await open(page, dir, ["--scope", SCOPE]);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
    await press(page, cancel(page));
    await expect(page.locator("[data-ended=cancelled]")).toBeVisible();
    await noViolations(page);
    await server.end();
  }
});
