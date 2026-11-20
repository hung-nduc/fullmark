// `npm run test:e2e` (STEP6-GAPS.md, G10): build, then the page budget alone, then every other browser test. The budget
// is a measurement of the page, so nothing else runs beside it (one worker); the rest runs whatever the budget gave, and
// the run fails when either part did.
import { spawnSync } from "node:child_process";

/** Runs a command to its end, with its output on ours; `shell` lets Windows find `npm` and `npx`. */
function run(command, args) {
  return spawnSync(command, args, { stdio: "inherit", shell: true }).status ?? 1;
}

const built = run("npm", ["run", "build"]);
if (built !== 0) process.exit(built);

const budget = run("npx", [
  "playwright",
  "test",
  "--project=budget-chromium",
  "--project=budget-firefox",
  "--workers=1",
]);
const rest = run("npx", ["playwright", "test", "--project=chromium", "--project=firefox"]);
process.exit(budget !== 0 ? budget : rest);
