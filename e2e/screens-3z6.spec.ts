import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { buildFolder, buildWith, root, run } from "./helpers";

/**
 * Screenshots of slice 3z6: the Information & Licences dialog on each tab, in English and Vietnamese, dark (the
 * Information tab in its two groups, the Licences tab with its texts below the list), and the ⓘ at the window's bottom
 * on a short start screen and after a long page. The time zone is fixed, so the build time reads the same every run.
 * Not part of `npm run check`: run with FULLMARK_SCREENS=1 npx playwright test e2e/screens-3z6.spec.ts
 * --project=chromium. They land in docs/screens/3z6/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");
test.use({ timezoneId: "Asia/Ho_Chi_Minh", colorScheme: "dark" });

const dir = join(root, "docs", "screens", "3z6");
mkdirSync(dir, { recursive: true });
const out = (name: string) => join(dir, `${name}.png`);

for (const lang of ["en", "vi"] as const) {
  for (const tab of ["Information", "Licences"] as const) {
    test(`the dialog's ${tab} tab, ${lang}, dark`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 940 });
      const built = buildFolder("examples/calculus");
      const file = join(built.dir, "quiz.md");
      writeFileSync(file, readFileSync(file, "utf8").replace(/^---\n/, "---\ntheme: dark\nlook: locked\n"));
      run(built.dir, "build", "quiz.md", "--built-at", "2026-10-28T10:00:00+07:00", "--ui-lang", lang);
      await page.goto(built.url);
      await page.locator("[data-action=licences]").click();
      await expect(page.locator("dialog#fm-licences")).toBeVisible();
      if (tab === "Licences") await page.getByRole("tab", { name: lang === "vi" ? "Giấy phép" : "Licences" }).click();
      await page.screenshot({ path: out(`${tab.toLowerCase()}-${lang}-dark`) });
    });
  }
}

test("the ⓘ at the window's bottom: a short start screen, 1280 x 940 and 390 x 844", async ({ page }) => {
  const short = buildWith("test/fixtures/page/tiny.md", "foot-screen.md", ["theme: dark", "look: locked"]);
  for (const [name, width, height] of [
    ["desktop", 1280, 940],
    ["phone", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(short.url);
    await page.screenshot({ path: out(`foot-start-${name}`) });
  }
});
