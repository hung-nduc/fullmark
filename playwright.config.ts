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
  reporter: [["list"]],
  projects: [
    // the page budget test measures the page, not the machine (G97): it runs first, alone (Firefox's after Chromium's),
    // and every other project depends on it
    { name: "budget-chromium", testMatch: "**/budget.spec.ts", use: { browserName: "chromium" } },
    {
      name: "budget-firefox",
      testMatch: "**/budget.spec.ts",
      timeout: 60_000,
      dependencies: ["budget-chromium"],
      use: { browserName: "firefox" },
    },
    {
      name: "chromium",
      testIgnore: "**/budget.spec.ts",
      dependencies: ["budget-chromium", "budget-firefox"],
      use: { browserName: "chromium", ...screens },
    },
    // axe is slow in Firefox under parallel load: it gets 60 s a test; no retries
    {
      name: "firefox",
      testIgnore: "**/budget.spec.ts",
      timeout: 60_000,
      dependencies: ["budget-chromium", "budget-firefox"],
      use: { browserName: "firefox" },
    },
  ],
});
