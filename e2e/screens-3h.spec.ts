import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { fixScreens, root, SCREENS_USE, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3h (`quiz brief --web` at 1280 x 940), for the owner to set beside the Brief boards: Brief (empty),
 * BriefAgent (pre-filled, the count changed), BriefVague (a scope of one word), BriefVi, BriefFinish (the summary),
 * BriefBlocked, BriefDone and BriefDark (dark, Sans). Not part of `npm run check`: run with
 * FULLMARK_SCREENS=1 npx playwright test e2e/screens-3h.spec.ts --project=chromium. They land in docs/screens/3h/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));
test.use({ viewport: { width: 1280, height: 940 } });

const out = (name: string) => join(root, "docs", "screens", "3h", `${name}.png`);
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

/** What the agent pre-filled on the boards (`AGENT` in Brief.dc.html), as flags. */
const AGENT = [
  ...["--purpose", "exam-prep"],
  ...["--scope", "lectures 3 to 5, the Fourier transform and its properties"],
  ...["--kinds", "lecture-slides,past-exams"],
  ...["--count", "30", "--minutes", "90", "--mode", "timed-exam"],
  ...["--request", "Match the style of the 2024 midterm. No proofs."],
];
const AGENT_VI = [
  ...["--purpose", "exam-prep"],
  ...["--scope", "bài giảng 3 đến 5, phép biến đổi Fourier và các tính chất"],
  ...["--kinds", "lecture-slides,past-exams"],
  ...["--count", "30", "--minutes", "90", "--mode", "timed-exam", "--language", "vi"],
  ...["--request", "Theo dạng đề giữa kỳ năm 2024. Không có câu chứng minh."],
];

async function open(page: Page, args: string[], opts: { dark?: boolean } = {}): Promise<Served> {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const server = await serveProcess(dir, ["brief", "signals-midterm", "--web", "--no-open", ...args]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: opts.dark ? "dark" : "light" });
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return server;
}

const shot = async (page: Page, name: string): Promise<void> => {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(".bf-main")) el.scrollTop = 0;
  });
  await page.screenshot({ path: out(name) });
};

test("Brief: the form with nothing pre-filled", async ({ page }) => {
  await open(page, []);
  await shot(page, "01-brief");
  // the profile under More options, with its box, for the part of the board that scrolls
  await page.locator("[data-action=more]").click();
  await page.locator("[data-profile-box]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out("01b-brief-more") });
});

test("BriefAgent: pre-filled by the agent, the count changed", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("section[data-qkey=count] input[type=number]").fill("25");
  await page.locator("section[data-qkey=count] input[type=number]").blur();
  await shot(page, "02-brief-agent");
  await page.locator("section[data-qkey=count]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out("02b-brief-agent-changed-card") });
});

test("BriefVague: a scope of one word", async ({ page }) => {
  await open(page, ["--purpose", "self-study", "--scope", "signals"]);
  await page.locator("section[data-qkey=scope]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out("03-brief-vague") });
});

test("BriefVi: the Vietnamese form", async ({ page }) => {
  await open(page, AGENT_VI);
  await shot(page, "04-brief-vi");
  // the profile box in Vietnamese: the longest tag (Cảnh báo) and the exam card's lines
  await page.locator("[data-action=more]").click();
  await page.locator("[data-profile-box]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out("04b-brief-vi-more") });
});

test("BriefFinish: the summary", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-action=finish]").click();
  await page.locator("[data-dialog=summary]").waitFor();
  await page.screenshot({ path: out("05-brief-finish") });
});

test("BriefBlocked: Finish with the purpose and the scope missing", async ({ page }) => {
  await open(page, []);
  await page.locator("[data-action=finish]").click();
  await page.locator("[data-dialog=blocked]").waitFor();
  await page.screenshot({ path: out("06-brief-blocked") });
});

test("BriefDone: written", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-action=finish]").click();
  await page.locator("[data-dialog=summary] [data-action=write]").click();
  await page.locator("[data-ended=written]").waitFor();
  await page.screenshot({ path: out("07-brief-done") });
});

test("Cancelled: the card with the command to start again", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-action=cancel]").click();
  await page.locator("[data-ended=cancelled]").waitFor();
  await page.screenshot({ path: out("08-brief-cancelled") });
});

test("BriefDark: dark, Sans", async ({ page }) => {
  await open(page, AGENT, { dark: true });
  await page.locator("[data-action=appearance]").click();
  await page.locator('[data-font-pick="sans"]').click();
  await page.keyboard.press("Escape");
  await shot(page, "09-brief-dark");
});
