import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { loadQuestions } from "../src/cli/brief-questions";
import { briefEn, briefVi } from "../src/core/i18n/brief";
import { differing } from "../test/helpers/vi-scan";
import { noViolations, root, type Served, serveProcess, watch } from "./helpers";

/**
 * `quiz brief --web` as a subprocess (STEP3.md, slice 3h, "Done when"): the form driven by Playwright through the mouse
 * and the keys, then the file on disk compared with a golden and read back by `quiz check`. Ctrl+C is Linux and macOS
 * only (Windows has no SIGINT for a child), as in e2e/review.spec.ts.
 */
const cli = join(root, "dist", "cli.js");
const SCOPE = "lectures 3 to 5, the Fourier transform";

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});

function folder(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-brief-"));
  mkdirSync(join(dir, ".git"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

/** `quiz brief d --web --no-open ...args`, with the machine config the suite points `FULLMARK_CONFIG` at (or another). */
async function brief(dir: string, args: string[] = [], machine?: string): Promise<Served> {
  const was = process.env.FULLMARK_CONFIG;
  if (machine !== undefined) {
    const path = join(dir, "machine.toml");
    writeFileSync(path, machine);
    process.env.FULLMARK_CONFIG = path;
  }
  try {
    const s = await serveProcess(dir, ["brief", "d", "--web", "--no-open", ...args]);
    served.push(s);
    return s;
  } finally {
    process.env.FULLMARK_CONFIG = was;
  }
}

const open = async (page: Page, server: Served, size = { width: 1280, height: 940 }): Promise<void> => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(size);
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
};

const card = (page: Page, key: string) => page.locator(`section[data-qkey="${key}"]`);
const choice = (page: Page, key: string, value: string) => card(page, key).locator(`[data-choice="${value}"]`);
const finish = (page: Page) => page.locator("[data-action=finish]");
const mark = (page: Page, key: string) => card(page, key).locator("[data-testid=mark]");
const written = (dir: string) => readFileSync(join(dir, "d", "brief.yaml"), "utf8");

/** The written file with the golden's name: `e2e/golden/<name>.yaml`; FULLMARK_GOLDEN_UPDATE=1 rewrites it. */
function expectFile(name: string, text: string): void {
  const file = join(root, "e2e", "golden", `${name}.yaml`);
  if (process.env.FULLMARK_GOLDEN_UPDATE === "1") writeFileSync(file, text);
  else expect(text).toBe(readFileSync(file, "utf8"));
}

/** `quiz check` on a quiz beside the brief: no `brief.invalid`, which is what a file this command wrote must not draw. */
function checkReadsIt(dir: string): void {
  copyFileSync(join(root, "examples", "rust", "quiz.md"), join(dir, "d", "quiz.md"));
  const r = spawnSync(process.execPath, [cli, "check", "d/quiz.md", "--json"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  expect(r.stdout).not.toContain("brief.invalid");
}

async function write(page: Page): Promise<void> {
  await finish(page).click();
  await page.locator("[data-dialog=summary] [data-action=write]").click();
}

test("answering every question by mouse, then Write the brief, writes brief.yaml that quiz check reads", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir);
  const seen = watch(page);
  await open(page, server);
  expect(await page.locator("section[data-qkey]").count()).toBe(13);
  await expect(page.locator(".bf-status")).toContainText("Answered 12 of 14");
  await expect(page.locator(".bf-status")).toContainText("2 to answer");
  await choice(page, "purpose", "exam-prep").click();
  await card(page, "scope").locator("input").fill(SCOPE);
  await choice(page, "content.kinds", "lecture-slides").click();
  await choice(page, "content.kinds", "other").click();
  await card(page, "content.kinds").locator("input[type=text]").fill("a field journal: week 4");
  await card(page, "content.elsewhere").locator("input[type=text]").fill("the reserve copy, pp. 3 to 9");
  await card(page, "count").locator("[data-action=inc]").click();
  await card(page, "minutes").locator("input").fill("37.5");
  await card(page, "minutes").locator("input").blur();
  await choice(page, "mix", "code").click();
  await choice(page, "difficulty", "harder").click();
  await choice(page, "mode", "timed-exam").click();
  await choice(page, "language", "vi").click();
  await choice(page, "weak_topics", "yes").click();
  await card(page, "commitment").locator("[data-action=inc]").click();
  await card(page, "request").locator("textarea").fill("Match the 2024 midterm.\nNo proofs. # not a comment");
  await page.locator("[data-action=more]").click();
  await choice(page, "profile", "draft").click();
  await expect(page.locator(".bf-status")).toContainText("Ready to finish");
  await finish(page).click();
  const dialog = page.locator("[data-dialog=summary]");
  await expect(dialog).toContainText("Write the brief?");
  await expect(dialog).toContainText("14 answers: 14 yours, 0 pre-filled for you, 0 defaults.");
  await dialog.locator("[data-action=write]").click();
  const done = page.locator("[data-ended=written]");
  await expect(done).toContainText("Brief written");
  await expect(done).toContainText("d/brief.yaml");
  await expect(done).toContainText("The server has stopped");
  const end = await server.end();
  expect(end.code).toBe(0);
  expect(end.lines[1]).toMatchObject({
    status: "written",
    brief: "d/brief.yaml",
    warnings: [{ rule: "brief.no-history" }],
  });
  expectFile("brief-web-all", written(dir));
  checkReadsIt(dir);
  expect(existsSync(join(dir, "d", "content"))).toBe(true);
  expect(seen.problems).toEqual([]);
});

test("the keys: N goes to the next question to answer, Q opens and closes the sidebar, Esc closes it; none while typing", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir);
  await open(page, server);
  const side = page.locator("[data-action=sidebar]");
  await expect(side).toHaveAttribute("aria-keyshortcuts", "Q");
  await expect(side).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("q");
  await expect(side).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Q");
  await expect(side).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(side).toHaveAttribute("aria-expanded", "false");
  // the purpose is the first question to answer: N goes there, and Space picks the choice it focused
  await page.keyboard.press("n");
  await expect(choice(page, "purpose", "self-study")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(choice(page, "purpose", "self-study")).toHaveAttribute("aria-pressed", "true");
  await expect(mark(page, "purpose")).toContainText("Your answer");
  // the scope is next, and a key typed in its field is the field's
  await page.keyboard.press("n");
  const scope = card(page, "scope").locator("input");
  await expect(scope).toBeFocused();
  await page.keyboard.type("n q lectures one two");
  await expect(scope).toHaveValue("n q lectures one two");
  await expect(side).toHaveAttribute("aria-expanded", "false");
  await scope.fill("");
  await scope.fill(SCOPE);
  // nothing is left: N does nothing, and Finish opens the summary on the keyboard
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("n");
  await finish(page).focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("[data-dialog=summary]");
  await expect(dialog).toBeVisible();
  // a key is not the page's while a dialog is open; Esc closes the dialog and the focus goes back to Finish
  await page.keyboard.press("q");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(finish(page)).toBeFocused();
  await finish(page).press("Enter");
  await page.locator("[data-dialog=summary] [data-action=go-back]").press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-ended=written]")).toBeVisible();
  expect((await server.end()).code).toBe(0);
  expect(written(dir)).toContain("purpose: self-study");
});

test("a scope of three words holds Finish at the blocked dialog, and its link goes to the scope", async ({ page }) => {
  const dir = folder();
  const server = await brief(dir, ["--purpose", "self-study"]);
  await open(page, server);
  const scope = card(page, "scope").locator("input");
  await scope.fill("lectures three four");
  await expect(card(page, "scope").locator("[data-error=vague]")).toContainText("Too short: 3 of the 4 words needed");
  await expect(card(page, "scope")).toContainText("For example: lectures 3 to 5, the Fourier transform");
  await expect(page.locator(".bf-status")).toContainText("1 to answer");
  await finish(page).click();
  const blocked = page.locator("[data-dialog=blocked]");
  await expect(blocked).toContainText("Some answers are missing");
  await expect(blocked).toContainText("Scope: too short, give at least 4 words");
  await expect(page.locator("[data-dialog=summary]")).toHaveCount(0);
  await blocked.locator("[data-miss=scope]").click();
  await expect(blocked).toHaveCount(0);
  await expect(scope).toBeFocused();
  // a fourth word and it is accepted
  await scope.fill("lectures three four five");
  await expect(card(page, "scope").locator("[data-error]")).toHaveCount(0);
  await expect(page.locator(".bf-status")).toContainText("Ready to finish");
  // an empty scope and no purpose: both are listed
  await scope.fill("");
  await finish(page).click();
  await expect(blocked).toContainText("Scope: say what the quiz covers");
  await page.locator("[data-dialog=blocked] [data-action=go-back]").click();
  await expect(card(page, "scope").locator("[data-error=needed]")).toContainText(
    "Needed: the agent cannot start without it.",
  );
  // Cancel, so the process ends: nothing was written
  await page.locator("[data-action=cancel]").click();
  const end = await server.end();
  expect(end.code).toBe(2);
  expect(existsSync(join(dir, "d"))).toBe(false);
});

test("picking a purpose, then another: the defaults that follow it change, a changed one does not", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir);
  await open(page, server);
  const ticked = async (): Promise<string[]> =>
    page
      .locator('section[data-qkey="mix"] input[type=checkbox]')
      .evaluateAll((els) =>
        els.filter((e) => (e as HTMLInputElement).checked).map((e) => e.getAttribute("data-choice") ?? ""),
      );
  // until a purpose is picked the defaults are Self-study's
  expect(await ticked()).toEqual(["recall", "understanding", "calculation"]);
  await expect(card(page, "purpose")).toContainText("Nothing is picked for you");
  await choice(page, "purpose", "exam-prep").click();
  expect(await ticked()).toEqual(["understanding", "calculation", "essay"]);
  await expect(card(page, "mix")).toContainText(
    "The default for Exam preparation. It follows the purpose until you change it.",
  );
  await expect(mark(page, "mix")).toContainText("Default");
  await choice(page, "purpose", "survey").click();
  expect(await ticked()).toEqual([]);
  await choice(page, "purpose", "classmates").click();
  expect(await ticked()).toEqual(["recall", "understanding"]);
  // a changed answer stays when the purpose changes again, and is the user's
  await choice(page, "mix", "code").click();
  await expect(mark(page, "mix")).toContainText("Your answer");
  await choice(page, "purpose", "exam-prep").click();
  expect(await ticked()).toEqual(["recall", "understanding", "code"]);
  // the profile follows the purpose too, until it is chosen
  await page.locator("[data-action=more]").click();
  await expect(card(page, "profile")).toContainText("Follows the purpose (Exam preparation).");
  await expect(choice(page, "profile", "exam")).toHaveAttribute("aria-pressed", "true");
  await choice(page, "purpose", "survey").click();
  await expect(choice(page, "profile", "survey")).toHaveAttribute("aria-pressed", "true");
  await choice(page, "profile", "draft").click();
  await expect(card(page, "profile")).toContainText("Chosen by you, whatever the purpose.");
  await choice(page, "purpose", "exam-prep").click();
  await expect(choice(page, "profile", "draft")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-action=cancel]").click();
  await server.end();
});

test("the machine config's defaults of a purpose are the form's defaults once that purpose is picked", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(
    dir,
    [],
    '[brief.purpose.exam-prep]\ncount = 30\nminutes = 90\nmix = ["calculation", "essay"]\n',
  );
  await open(page, server);
  await expect(card(page, "count").locator("input")).toHaveValue("20");
  await choice(page, "purpose", "exam-prep").click();
  await expect(card(page, "count").locator("input")).toHaveValue("30");
  await expect(card(page, "minutes").locator("input")).toHaveValue("90");
  await expect(mark(page, "count")).toContainText("Default");
  await page.locator("[data-action=cancel]").click();
  await server.end();
});

test("flags pre-fill the form: each kept pre-fill is marked and written as user; changed ones go back by their card and all at once", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir, [
    "--purpose",
    "exam-prep",
    "--scope",
    SCOPE,
    "--count",
    "25",
    "--mode",
    "timed-exam",
  ]);
  await open(page, server);
  const note = page.locator("[data-agent-note]");
  await expect(note).toContainText("Pre-filled for you");
  await expect(note.locator("[data-action=revert]")).toHaveCount(0);
  for (const key of ["purpose", "scope", "count", "mode"])
    await expect(mark(page, key)).toContainText("Pre-filled for you");
  await expect(mark(page, "difficulty")).toContainText("Default");
  await expect(page.locator(".bf-status")).toContainText("0 yours · 4 pre-filled · 10 default");
  await expect(page.locator(".bf-status")).toContainText("Ready to finish");
  // change two, and a question the flags did not pre-fill
  await card(page, "count").locator("[data-action=inc]").click();
  await expect(mark(page, "count")).toContainText("Your answer");
  await expect(card(page, "count").locator("[data-action=revert]")).toContainText(
    "Back to the pre-filled answer: 25 questions",
  );
  await card(page, "scope").locator("input").fill("signals and systems chapters one to four");
  await expect(card(page, "scope").locator("[data-action=revert]")).toContainText(
    `Back to the pre-filled answer: ${SCOPE}`,
  );
  await choice(page, "difficulty", "harder").click();
  await expect(note.locator("[data-action=revert]")).toContainText("Back to every pre-filled answer (2 changed)");
  // the card's button puts back its own question only
  await card(page, "count").locator("[data-action=revert]").click();
  await expect(mark(page, "count")).toContainText("Pre-filled for you");
  await expect(card(page, "count").locator("input")).toHaveValue("25");
  await expect(note.locator("[data-action=revert]")).toContainText("(1 changed)");
  await expect(card(page, "scope").locator("input")).toHaveValue("signals and systems chapters one to four");
  // all at once puts back every pre-filled answer and leaves the others as they are
  await note.locator("[data-action=revert]").click();
  await expect(card(page, "scope").locator("input")).toHaveValue(SCOPE);
  await expect(mark(page, "scope")).toContainText("Pre-filled for you");
  await expect(note.locator("[data-action=revert]")).toHaveCount(0);
  await expect(mark(page, "difficulty")).toContainText("Your answer");
  await expect(choice(page, "difficulty", "harder")).toHaveAttribute("aria-pressed", "true");
  await write(page);
  await expect(page.locator("[data-ended=written]")).toBeVisible();
  const end = await server.end();
  expect(end.code).toBe(0);
  const text = written(dir);
  for (const key of ["purpose", "scope", "count", "mode", "difficulty"]) expect(text).toContain(`\n  ${key}: user\n`);
  expect(text).toContain("\n  minutes: default\n");
  expect(end.lines[1]?.defaults_applied).not.toContain("scope");
  expect(end.lines[1]?.defaults_applied).not.toContain("count");
  expectFile("brief-web-prefilled", text);
});

test("the summary's rows go to their questions, and Go back writes nothing", async ({ page }) => {
  const dir = folder();
  const server = await brief(dir, ["--purpose", "self-study", "--scope", SCOPE, "--count", "25"]);
  await open(page, server);
  await finish(page).click();
  const dialog = page.locator("[data-dialog=summary]");
  await expect(dialog).toContainText("14 answers: 0 yours, 3 pre-filled for you, 11 defaults.");
  await expect(dialog.locator('[data-sumrow="count"]')).toContainText("25 questions");
  await expect(dialog.locator('[data-sumrow="count"] .bf-cell-mark')).toHaveText("Pre-filled");
  await expect(dialog.locator('[data-sumrow="mode"] .bf-cell-mark')).toHaveText("Default");
  await dialog.locator('[data-sumrow="minutes"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(card(page, "minutes").locator("input")).toBeFocused();
  await expect(card(page, "minutes")).toHaveAttribute("data-current", "true");
  await finish(page).click();
  await page.locator('[data-dialog=summary] [data-sumrow="profile"]').click();
  await expect(card(page, "profile")).toBeVisible();
  await finish(page).click();
  await page.locator("[data-dialog=summary] [data-action=go-back]").click();
  await expect(page.locator("[data-dialog=summary]")).toHaveCount(0);
  expect(existsSync(join(dir, "d"))).toBe(false);
  await page.locator("[data-action=cancel]").click();
  await server.end();
});

test("Cancel ends the run at once: a card with the command to start again, nothing written, exit 2", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir, ["--scope", SCOPE, "--count", "25"]);
  await open(page, server);
  await page.locator("[data-action=cancel]").click();
  const card = page.locator("[data-ended=cancelled]");
  await expect(card).toContainText("Cancelled");
  await expect(card).toContainText("Nothing was written. To start again, run:");
  await expect(card.locator("[data-command] pre")).toHaveText(`quiz brief d --web --scope "${SCOPE}" --count 25`);
  await expect(card.locator("[data-command] button")).toHaveText("Copy");
  const end = await server.end();
  expect(end.code).toBe(2);
  expect(end.lines[1]).toEqual({ status: "cancelled" });
  expect(end.stderr).toContain("cancelled: nothing was written");
  expect(existsSync(join(dir, "d"))).toBe(false);
});

test.describe("Ctrl+C", () => {
  test.skip(process.platform === "win32", "Windows has no SIGINT for a child process");
  test("writes nothing and creates no DIR; the page says the server has stopped on its next action", async ({
    page,
  }) => {
    const dir = folder();
    const server = await brief(dir, ["--purpose", "self-study", "--scope", SCOPE]);
    await open(page, server);
    server.child.kill("SIGINT");
    const end = await server.end();
    expect(end.code).toBe(2);
    expect(end.lines[1]).toEqual({ status: "interrupted" });
    expect(existsSync(join(dir, "d"))).toBe(false);
    await finish(page).click();
    await page.locator("[data-dialog=summary] [data-action=write]").click();
    await expect(page.locator("[data-problem]").first()).toContainText("The server has stopped");
    await page.locator("[data-dialog=summary] [data-action=go-back]").click();
    await page.locator("[data-action=cancel]").click();
    await expect(page.locator("[data-problem]")).toContainText("The server has stopped");
  });
});

test("a brief that appeared while the form was open is not overwritten: the reason is shown, and the form stays", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir, ["--purpose", "self-study", "--scope", SCOPE]);
  await open(page, server);
  mkdirSync(join(dir, "d"));
  writeFileSync(join(dir, "d", "brief.yaml"), "mine\n");
  await write(page);
  await expect(page.locator("[data-dialog=summary] [data-problem]")).toContainText("d/brief.yaml already exists");
  expect(written(dir)).toBe("mine\n");
  await page
    .locator("[data-action=cancel]")
    .click({ force: true })
    .catch(() => undefined);
  server.child.kill("SIGKILL");
});

test("the closing time is shown in the sidebar, counted from when the page loaded (G113)", async ({ page }) => {
  await page.clock.install();
  const dir = folder();
  const server = await brief(dir, ["--timeout", "90"]);
  await open(page, server);
  const line = page.locator("[data-closes]");
  await expect(line).toHaveText("The form closes in 2 min if left open. Cancel writes nothing.");
  await page.clock.fastForward(60_000);
  await expect(line).toHaveText("The form closes in less than a minute if left open. Cancel writes nothing.");
  await page.locator("[data-action=cancel]").click();
  await server.end();
  const never = await brief(folder(), ["--timeout", "0"]);
  await page.goto(never.url);
  await expect(page.locator("[data-closes]")).toHaveText("Cancel writes nothing.");
  await page.locator("[data-action=cancel]").click();
  await never.end();
  const normal = await brief(folder());
  await page.goto(normal.url);
  await expect(page.locator("[data-closes]")).toHaveText(
    "The form closes in 30 min if left open. Cancel writes nothing.",
  );
  await page.clock.fastForward(60_000);
  await expect(page.locator("[data-closes]")).toHaveText(
    "The form closes in 29 min if left open. Cancel writes nothing.",
  );
  await page.locator("[data-action=cancel]").click();
  await normal.end();
});

test("the timeout ends the run: exit 2, timeout, nothing written", async () => {
  const dir = folder();
  const server = await brief(dir, ["--timeout", "1"]);
  const end = await server.end();
  expect(end.code).toBe(2);
  expect(end.lines[1]).toEqual({ status: "timeout" });
  expect(existsSync(join(dir, "d"))).toBe(false);
});

test("the form starts as the system is, in the system font; Appearance offers every theme and font and keeps nothing (G114)", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir);
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, server);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).not.toHaveAttribute("data-font", /.+/);
  await page.locator("[data-action=appearance]").click();
  const menu = page.locator("[data-look-menu]");
  expect(
    await menu.locator("[data-theme-pick]").evaluateAll((els) => els.map((e) => e.getAttribute("data-theme-pick"))),
  ).toEqual(["light", "dark", "oled", "white", "paper"]);
  expect(
    await menu.locator("[data-font-pick]").evaluateAll((els) => els.map((e) => e.getAttribute("data-font-pick"))),
  ).toEqual(["system", "sans", "serif", "readable"]);
  await expect(menu.locator('[data-theme-pick="dark"]')).toHaveAttribute("aria-pressed", "true");
  await menu.locator('[data-theme-pick="paper"]').click();
  await expect(html).toHaveAttribute("data-theme", "paper");
  await menu.locator('[data-font-pick="serif"]').click();
  await expect(html).toHaveAttribute("data-font", "serif");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  // nothing is stored: a new load is as the system is again
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).not.toHaveAttribute("data-font", /.+/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await page.locator("[data-action=cancel]").click();
  await server.end();
});

test("the profile asked as choices: the built-in ones, then the configured ones, with a box that says what each checks (G115)", async ({
  page,
}) => {
  const dir = folder({ "fullmark.toml": "[profiles.signals]\nextends = 'exam'\n" });
  const server = await brief(dir, ["--purpose", "exam-prep", "--scope", SCOPE]);
  await open(page, server);
  await page.locator("[data-action=more]").click();
  const names = await card(page, "profile")
    .locator("[data-choice]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-choice")));
  expect(names).toEqual(["default", "draft", "exam", "survey", "signals"]);
  await expect(choice(page, "profile", "exam")).toHaveAttribute("aria-pressed", "true");
  await expect(choice(page, "profile", "signals")).toContainText("your own, from fullmark.toml");
  const box = page.locator("[data-profile-box]");
  await expect(box).toContainText("What each profile checks");
  await expect(box.locator('[data-profile="exam"] [data-level="fails"]')).toHaveCount(5);
  await expect(box.locator('[data-profile="exam"]')).toContainText("Every quality warning.");
  await expect(box.locator('[data-profile="survey"] [data-level="off"]')).toHaveCount(1);
  await expect(box.locator("[data-every]")).toContainText("Every profile");
  await expect(box.locator("[data-every] [data-level=fails]")).toHaveCount(1);
  await expect(box.locator("[data-every]")).toContainText("A quiz that cannot work");
  await expect(box.locator('[data-profile="exam"]')).toContainText("Chosen");
  await expect(box.locator('[data-profile="signals"]')).toContainText("your own, from fullmark.toml");
  await expect(box.locator('[data-profile="signals"] li')).toHaveCount(0);
  await choice(page, "profile", "signals").click();
  await expect(box.locator('[data-profile="signals"]')).toContainText("Chosen");
  await write(page);
  expect((await server.end()).code).toBe(0);
  expect(written(dir)).toContain('profile: "signals"');
  expect(written(dir)).toMatch(/decided_by:[\s\S]*profile: user/);
});

test("a vi form (--language vi): the question file's words and the board's, AI for the agent, no English chrome", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir, ["--language", "vi", "--scope", "bài giảng 3 đến 5, phép biến đổi Fourier"]);
  await open(page, server);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  const questions = loadQuestions();
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  for (const q of questions.questions) {
    if (q.key === "profile") continue;
    expect(body, q.key).toContain(q.label.vi);
  }
  expect(body).toContain("AI đã điền sẵn theo những gì bạn nói");
  expect(body).toContain("Điền sẵn cho bạn");
  expect(body).not.toMatch(/trợ lý/i);
  await expect(finish(page)).toHaveText("Hoàn tất");
  await expect(page.locator("[data-action=cancel]")).toHaveText("Hủy");
  await expect(page.locator("[data-closes]")).toHaveText(
    "Biểu mẫu tự đóng sau 30 phút nếu để yên. Hủy thì không ghi gì.",
  );
  // no English string of the form's own words, nor of the question file's, differs from its vi twin in what is on screen
  const on = async (): Promise<string> =>
    page.evaluate(() => {
      const names = [...document.querySelectorAll("[aria-label],[title],[placeholder]")].flatMap((el) =>
        ["aria-label", "title", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
      );
      return [document.body.innerText, ...names].join("\n").replace(/\s+/g, " ");
    });
  const english = [
    ...differing(briefEn as never, briefVi as never),
    ...questions.questions.flatMap((q) => [
      ["label", q.label.en] as [string, string],
      ["help", q.help.en] as [string, string],
      ...(q.choices ?? []).flatMap((c) => [
        ["choice", c.label.en] as [string, string],
        ["hint", c.hint.en] as [string, string],
      ]),
    ]),
  ].filter(([, text]) => text.length >= 6 && text !== "default" && !/^(en|vi)$/.test(text));
  const leaks = async (): Promise<string[]> => {
    const text = await on();
    return english.filter(([, value]) => text.includes(value)).map(([key, value]) => `${key}: "${value}"`);
  };
  expect(await leaks(), "the form").toEqual([]);
  await page.locator("[data-action=more]").click();
  expect(await leaks(), "with the profile").toEqual([]);
  await finish(page).click();
  await expect(page.locator("[data-dialog=blocked]")).toContainText("Còn thiếu câu trả lời");
  expect(await leaks(), "the blocked dialog").toEqual([]);
  await page.locator("[data-dialog=blocked] [data-miss=purpose]").click();
  await choice(page, "purpose", "self-study").click();
  await finish(page).click();
  await expect(page.locator("[data-dialog=summary]")).toContainText("Ghi bản yêu cầu?");
  expect(await leaks(), "the summary").toEqual([]);
  await page.locator("[data-dialog=summary] [data-action=write]").click();
  await expect(page.locator("[data-ended=written]")).toContainText("Đã ghi bản yêu cầu");
  expect(await leaks(), "the done card").toEqual([]);
  expect((await server.end()).code).toBe(0);
  expect(written(dir)).toContain("language: vi");
});

/**
 * axe on the page as it stands, with the form's scrolling parts back at the top: axe reads a name from an element that
 * is scrolled out of an inner scroller (the form is a frame, as the board draws it) as if it were not there, and
 * reports `label-title-only` for a field whose question has scrolled away. A screen reader reads the page, not the pixels.
 */
async function axe(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(".bf-main, .bf-side-body, .bf-sum")) el.scrollTop = 0;
  });
  await noViolations(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds nothing in the form, its dialogs and its end cards (${scheme})`, async ({ page }) => {
    const dir = folder();
    const server = await brief(dir, ["--scope", "signals"]);
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, server);
    await axe(page);
    await page.locator("[data-action=more]").click();
    await page.locator("[data-action=appearance]").click();
    await axe(page);
    await page.keyboard.press("Escape");
    await finish(page).click();
    await expect(page.locator("[data-dialog=blocked]")).toBeVisible();
    await axe(page);
    await page.locator("[data-dialog=blocked] [data-miss=purpose]").click();
    await choice(page, "purpose", "exam-prep").click();
    await card(page, "scope").locator("input").fill(SCOPE);
    await finish(page).click();
    await expect(page.locator("[data-dialog=summary]")).toBeVisible();
    await axe(page);
    await page.locator("[data-dialog=summary] [data-action=write]").click();
    await expect(page.locator("[data-ended=written]")).toBeVisible();
    await axe(page);
    await server.end();
    const again = await brief(folder(), []);
    await page.goto(again.url);
    await page.locator("[data-action=cancel]").click();
    await expect(page.locator("[data-ended=cancelled]")).toBeVisible();
    await axe(page);
    await again.end();
  });
}

test("the page carries its script and styles by hash, talks only to its own server, and takes no cookies or storage", async ({
  page,
}) => {
  const dir = folder();
  const server = await brief(dir);
  const seen = watch(page);
  await open(page, server);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("unsafe-inline");
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(seen.requests.filter((u) => !u.startsWith(new URL(server.url).origin))).toEqual([]);
  expect(seen.problems).toEqual([]);
  await page.locator("[data-action=cancel]").click();
  await server.end();
});
