import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

// every page a test builds reads this empty machine config, never the one of the machine running the tests
// (`%APPDATA%\fullmark\config.toml` or `~/.config/fullmark/config.toml`), so a teacher's own settings cannot change a test
process.env.FULLMARK_CONFIG = resolve(import.meta.dirname, "e2e", "machine-config.toml");

// the screens are rasterised whole on every frame: with partial raster, which tiles were redrawn when the frame was
// captured moved a line of text by a pixel from one run to the next
const screens = process.env.FULLMARK_SCREENS ? { launchOptions: { args: ["--disable-partial-raster"] } } : {};

/**
 * Browser tests (TECHNICAL_DESIGN.md, section 11): Chromium and Firefox. Firefox isolates `file://` storage per file
 * (foundation 2), which is what resume has to work with; a test that cannot run in one of them says why in a `test.skip`.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // the screens are taken one at a time: under load a sticky sidebar was drawn a pixel off now and then
  workers: process.env.FULLMARK_SCREENS ? 1 : undefined,
  reporter: [["list"]],
  projects: [
    // the page budget test measures the page, not the machine (G97), so `npm run test:e2e` (scripts/test-e2e.mjs) runs
    // the two budget projects alone in one call with one worker, so Firefox's runs after Chromium's, then the other
    // projects in a second call. No project depends on another: a budget that fails (Firefox's, on a slow laptop) must
    // skip nothing (step 6, G6 and G10)
    { name: "budget-chromium", testMatch: "**/budget.spec.ts", use: { browserName: "chromium" } },
    {
      name: "budget-firefox",
      testMatch: "**/budget.spec.ts",
      timeout: 60_000,
      use: { browserName: "firefox" },
    },
    {
      name: "chromium",
      testIgnore: "**/budget.spec.ts",
      use: { browserName: "chromium", ...screens },
    },
    // axe is slow in Firefox under parallel load: it gets 60 s a test; no retries
    {
      name: "firefox",
      testIgnore: "**/budget.spec.ts",
      timeout: 60_000,
      use: { browserName: "firefox" },
    },
  ],
});
