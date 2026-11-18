import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import {
  card,
  fixScreens,
  historyLibrary,
  pageShot,
  root,
  SCREENS_USE,
  type Served,
  serveProcess,
  shotOf,
} from "./helpers";

/**
 * Screenshots of slice 4d (`quiz library take --missed`, STEP4.md): the start screen that names the plan, and the
 * question marked "changed since you missed it", light, on a desktop and on a phone. Not part of `npm run check`: run
 * with FULLMARK_SCREENS=1 npx playwright test e2e/screens-4d.spec.ts --project=chromium. They land in docs/screens/4d/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use(SCREENS_USE);
test.beforeEach(({ page }) => fixScreens(page));

const out = (name: string) => join(root, "docs", "screens", "4d", `${name}.png`);
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

async function open(page: Page): Promise<void> {
  const t = historyLibrary();
  const server = await serveProcess(t.dir, ["library", "take", "study-fixture", "--missed", "--no-open"], t.env);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(server.url);
  await page.locator("[data-plan=missed]").waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const SIZES = [
  { name: "desktop", viewport: { width: 1280, height: 900 }, touch: false },
  { name: "phone", viewport: { width: 390, height: 844 }, touch: true },
] as const;

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 2 });

    test("the start screen names the plan", async ({ page }) => {
      await open(page);
      await page.screenshot({ path: out(`01-start-${size.name}`) });
    });

    test("a card marked changed since you missed it", async ({ page }) => {
      await open(page);
      await page.getByRole("button", { name: /^Start$/ }).click();
      await card(page, "even").waitFor();
      await shotOf(card(page, "even"), out(`02-changed-card-${size.name}`));
      await pageShot(page, out(`03-questions-${size.name}`), { fullPage: false });
    });
  });
}
