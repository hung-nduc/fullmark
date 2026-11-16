import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { PHONE, PHONES, root, type Served, serveProcess } from "./helpers";

/**
 * Screenshots of slice 3h2 (`quiz brief --web` on a phone, 390 x 844), for the owner to set beside the BriefPhone,
 * BriefPhoneSide and BriefPhoneFinish boards: the form pre-filled, the sidebar, the summary, the blocked dialog, the
 * profile's rows, the done and Cancelled cards, dark, Vietnamese, and one at 360 px. Not part of `npm run check`: run
 * with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3h2.spec.ts --project=chromium. They land in docs/screens/3h2/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

const out = (name: string) => join(root, "docs", "screens", "3h2", `${name}.png`);
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

async function open(
  page: Page,
  args: string[],
  opts: { dark?: boolean; size?: { width: number; height: number } } = {},
): Promise<Served> {
  const dir = mkdtempSync(join(tmpdir(), "fm-screens-"));
  mkdirSync(join(dir, ".git"));
  const server = await serveProcess(dir, ["brief", "signals-midterm", "--web", "--no-open", ...args]);
  served.push(server);
  if (opts.size) await page.setViewportSize(opts.size);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: opts.dark ? "dark" : "light" });
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return server;
}

const shot = (page: Page, name: string) => page.screenshot({ path: out(name) });

test("BriefPhone: the form pre-filled, the compact bar and the foot bar", async ({ page }) => {
  await open(page, AGENT);
  await shot(page, "01-phone-form");
  await page.locator("section[data-qkey=count] [data-action=inc]").tap();
  await page.locator("section[data-qkey=count]").scrollIntoViewIfNeeded();
  await shot(page, "01b-phone-changed-card");
});

test("BriefPhoneSide: the sidebar over the whole screen", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-action=sidebar]").tap();
  await page.locator("[data-side]").waitFor();
  await shot(page, "02-phone-sidebar");
});

test("BriefPhoneFinish: the summary", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-footbar] [data-action=finish]").tap();
  await page.locator("[data-dialog=summary]").waitFor();
  await shot(page, "03-phone-finish");
});

test("The blocked dialog", async ({ page }) => {
  await open(page, []);
  await page.locator("[data-footbar] [data-action=finish]").tap();
  await page.locator("[data-dialog=blocked]").waitFor();
  await shot(page, "04-phone-blocked");
});

test("The profile's rows, stacked", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-action=more]").tap();
  await page.locator("[data-profile-box]").scrollIntoViewIfNeeded();
  await shot(page, "05-phone-profile");
});

test("The done card", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-footbar] [data-action=finish]").tap();
  await page.locator("[data-dialog=summary] [data-action=write]").tap();
  await page.locator("[data-ended=written]").waitFor();
  await shot(page, "06-phone-done");
});

test("The Cancelled card", async ({ page }) => {
  await open(page, AGENT);
  await page.locator("[data-footbar] [data-action=cancel]").tap();
  await page.locator("[data-ended=cancelled]").waitFor();
  await shot(page, "07-phone-cancelled");
});

test("Dark, Sans, with the Appearance menu", async ({ page }) => {
  await open(page, AGENT, { dark: true });
  await page.locator("[data-action=appearance]").tap();
  await page.locator('[data-font-pick="sans"]').tap();
  await shot(page, "08-phone-dark-appearance");
  await page.locator("[data-action=appearance]").tap();
  await shot(page, "08b-phone-dark");
});

test("Vietnamese: the form and the summary", async ({ page }) => {
  await open(page, AGENT_VI);
  await shot(page, "09-phone-vi");
  await page.locator("[data-footbar] [data-action=finish]").tap();
  await page.locator("[data-dialog=summary]").waitFor();
  await shot(page, "09b-phone-vi-finish");
});

test("360 px: the form and the Cancelled card", async ({ page }) => {
  await open(page, AGENT, { size: PHONES[0] });
  await shot(page, "10-phone-360");
  await page.locator("[data-footbar] [data-action=cancel]").tap();
  await page.locator("[data-ended=cancelled]").waitFor();
  await shot(page, "10b-phone-360-cancelled");
});
