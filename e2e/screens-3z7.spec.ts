import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PHONE, root, run } from "./helpers";

/**
 * Screenshots of slice 3z7: the start screen's Materials pop-up (G126) open at 1280 x 940, dark and light, and on a
 * phone at 390 x 844, in English and Vietnamese. Not part of `npm run check`: run with FULLMARK_SCREENS=1 npx
 * playwright test e2e/screens-3z7.spec.ts --project=chromium. They land in docs/screens/3z7/.
 */
test.skip(!process.env.FULLMARK_SCREENS, "screenshots are made on request");

const dir = join(root, "docs", "screens", "3z7");
mkdirSync(dir, { recursive: true });
const out = (name: string) => join(dir, `${name}.png`);

/** The materials fixture built in one language. */
function built(lang: "en" | "vi"): string {
  const d = mkdtempSync(join(tmpdir(), "fm-e2e-3z7-"));
  mkdirSync(join(d, ".git")); // it stops the search for fullmark.toml
  cpSync(join(root, "test", "fixtures", "page"), d, { recursive: true });
  run(d, "build", "materials.md", "--built-at", "2026-10-28T10:00:00+07:00", "--ui-lang", lang);
  return `file:///${join(d, "materials.html").replaceAll("\\", "/")}`;
}

for (const lang of ["en", "vi"] as const) {
  const url = built(lang);
  for (const scheme of ["dark", "light"] as const) {
    test(`the pop-up at 1280 x 940, ${lang}, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1280, height: 940 });
      await page.goto(url);
      await page.locator("[data-action=materials]").click();
      await expect(page.locator("dialog.fm-materials-dialog")).toBeVisible();
      await page.screenshot({ path: out(`popup-${lang}-${scheme}`) });
    });
  }
  test(`the pop-up on a phone, ${lang}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(url);
    await page.locator("[data-action=materials]").click();
    await expect(page.locator("dialog.fm-materials-dialog")).toBeVisible();
    await page.screenshot({ path: out(`popup-${lang}-phone`) });
  });
}
