import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { expectGolden, noViolations, root, run, type Served, serveProcess, watch } from "./helpers";

/**
 * `quiz grade --web` as a subprocess (STEP3.md, slice 3f): the form driven by Playwright with the mouse and by typing a
 * value, Finish, then the written files read back by `quiz grade --grades` (the same report) and `quiz replay` (the box
 * shows them). The input is the golden `rubrics-grades-all`: one essay of each mode and a code question.
 */
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
const cli = join(root, "dist", "cli.js");

/** The golden's folder, with `extra` front matter lines on the quiz, the results re-keyed to the new hash. */
function folder(extra: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-grade-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  return dir;
}

const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});
async function web(dir: string, ...args: string[]): Promise<Served> {
  const s = await serveProcess(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web", ...args]);
  served.push(s);
  return s;
}
async function open(page: Page, server: Served): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
}

const ctl = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] [data-ctl]`);
const value = (page: Page, crit: string) => ctl(page, crit).locator("input");
const note = (page: Page, crit: string) => page.locator(`[data-crit="${crit}"] textarea`);
const total = (page: Page) => page.locator("[data-ctl=total], [data-ctl=score]").first();
const finish = (page: Page) => page.locator("[data-action=finish]");
const next = (page: Page) => page.locator("[data-action=next]").click();
const withName = (dir: string) => dir;

/** Grades the five questions: by mouse where it can be, by typing where a value is typed. */
async function gradeAll(page: Page): Promise<void> {
  // additive: the full-mark box, + then − from empty, a typed value
  await ctl(page, "defs").locator("[data-act=full]").click();
  await expect(value(page, "defs")).toHaveValue("0.5");
  await ctl(page, "derive").locator("[data-act=more]").click();
  await expect(value(page, "derive")).toHaveValue("1.5");
  await ctl(page, "derive").locator("[data-act=less]").click();
  await expect(value(page, "derive")).toHaveValue("1.25");
  await value(page, "interp").fill("0.5");
  await note(page, "derive").fill("Skips the zero initial-conditions assumption.");
  await note(page, "interp").fill("Does not link the result to stability.");
  await expect(total(page)).toContainText("2.25");
  await next(page);
  // banded (IELTS): an empty band starts at the middle on the first press; then typed
  await ctl(page, "TR").locator("[data-act=more]").click();
  await expect(value(page, "TR")).toHaveValue("4.5");
  for (const [crit, band] of [
    ["TR", "6"],
    ["CC", "6.5"],
    ["LR", "6.5"],
    ["GRA", "6"],
  ] as const) {
    await value(page, crit).fill(band);
    await note(page, crit).fill("Room to improve here.");
  }
  await expect(page.locator(".fm-box-total")).toContainText("mean 6.25, IELTS rounding to 6.5");
  await next(page);
  // banded, rounded down
  await value(page, "content").fill("5");
  await note(page, "content").fill("One comparison is missing.");
  await ctl(page, "style").locator("[data-act=full]").click();
  await expect(page.locator(".fm-box-total")).toContainText("mean 5.33, rounded down to 5");
  await next(page);
  // holistic: the score typed, two verdicts, the reason
  await page.locator("[data-ctl=score] input").fill("3");
  await page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=met]').click();
  await page.locator('[data-crit="gives-an-example"] [data-verdict=partly]').click();
  await page.locator("textarea[aria-label='Why this score']").fill("Explains aliasing with an example.");
  await next(page);
  // code: points per criterion
  await ctl(page, "works").locator("[data-act=full]").click();
  await value(page, "style").fill("0.5");
  await note(page, "style").fill("A little long.");
}

const CRITS = ["names-the-nyquist-rate", "gives-an-example"];

test("grades an additive, a banded, a holistic and a code question, saves, and the files read back", async ({
  page,
}) => {
  const dir = folder();
  const server = await web(dir, "--name", "Lan");
  const seen = watch(page);
  await open(page, server);
  // the form opens at the first question to grade, in the quiz's look
  await expect(page.locator("article[data-qid=add]")).toBeVisible();
  await gradeAll(page);
  await finish(page).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Save your grades?");
  await expect(dialog).toContainText("5 of 5 questions graded");
  await expect(dialog).toContainText("Graded as Lan (from --name).");
  await dialog.locator("[data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText("Grades saved");
  await expect(page.locator("[data-grade-saved]")).toContainText("results-grades.json");
  await expect(page.locator("[data-grade-saved]")).toContainText("The server has stopped");
  const end = await server.end();
  expect(end.code).toBe(0);
  expect(end.lines[1]).toEqual({
    status: "written",
    grades: "results-grades.json",
    report: "results-report.md",
    graded: 5,
    pending: 0,
  });
  expect(seen.problems).toEqual([]);
  expect(seen.requests.filter((u) => !u.startsWith(new URL(server.url).origin))).toEqual([]);

  // the written file, with the time masked, against its golden
  const file = JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8"));
  expect(file.grader).toMatchObject({ kind: "human", name: "Lan" });
  expect(file.grader.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  file.grader.at = "<at>";
  expectGolden("grade-web-written", `${JSON.stringify(file, null, 2)}\n`);

  // read back by `quiz grade --grades`: the same report
  const again = join(dir, "again.md");
  run(dir, "grade", "results.json", "--quiz", "quiz.md", "--grades", "results-grades.json", "-o", again);
  expect(readFileSync(again, "utf8")).toBe(readFileSync(join(dir, "results-report.md"), "utf8"));
  // and by `quiz replay`: the box shows the grades, with no option
  run(dir, "replay", "results.json", "--quiz", "quiz.md", "--no-open");
  const replay = await page.context().newPage();
  await replay.goto(`file:///${join(dir, "results-replay.html").replaceAll("\\", "/")}`);
  await expect(replay.locator(".fm-box")).toHaveCount(5);
  await expect(replay.locator('article[data-qid="add"] .fm-box-who')).toContainText("Graded by Lan");
  await expect(replay.locator('article[data-qid="add"] .fm-box-total')).toContainText("2.25");
  void CRITS;
});

test("the name is asked in the Finish dialog, and Save grades waits for it", async ({ page }) => {
  const dir = folder();
  const server = await web(dir);
  await open(page, server);
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await finish(page).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("1 of 5 questions graded");
  await expect(dialog.locator("[data-action=save]")).toBeDisabled();
  await expect(dialog).toContainText("Written into the grades file as who graded. Required.");
  await expect(dialog).toContainText("stay pending");
  await dialog.locator("[data-field=name]").fill("Minh");
  await dialog.locator("[data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText(
    "1 question graded by Minh; Question 3, Question 4, Question 5, Question 6 still pending.",
  );
  const end = await server.end();
  expect(end.lines[1]).toEqual({
    status: "written",
    grades: "results-grades.json",
    report: "results-report.md",
    graded: 1,
    pending: 4,
  });
  expect(JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8")).grader.name).toBe("Minh");
});

test("a lost mark with no note, a half-graded question and a score with no reason hold Finish", async ({ page }) => {
  const server = await web(folder());
  await open(page, server);
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1");
  await value(page, "interp").fill("1");
  // a lost mark: the field says so and is outlined
  await expect(note(page, "derive")).toHaveAttribute("data-missing", "");
  await expect(page.locator('[data-crit="derive"] .fm-note-missing')).toHaveText("Required: a mark was lost, say why");
  await expect(page.locator("article[data-qid=add] .fm-grade-badge")).toHaveText("Needs a note");
  await next(page);
  // a half-graded question
  await value(page, "TR").fill("6");
  await expect(page.locator("article[data-qid=ielts] .fm-grade-badge")).toContainText("Half graded");
  await next(page);
  await next(page);
  // a holistic score with no reason
  await page.locator("[data-ctl=score] input").fill("3");
  await expect(page.locator("article[data-qid=holistic] .fm-grade-badge")).toHaveText("Needs a note");
  await finish(page).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Some grades are not finished");
  await expect(dialog.locator("[data-problem]")).toHaveCount(3);
  await expect(dialog.locator("[data-action=save]")).toHaveCount(0);
  // each is a link to its question
  await dialog.locator("[data-problem=add]").click();
  await expect(page.locator("article[data-qid=add]")).toBeVisible();
  // fixed: Finish offers to save
  await note(page, "derive").fill("Lost a mark.");
  await finish(page).click();
  await expect(page.locator("dialog[open]")).toContainText("Some grades are not finished");
  await expect(page.locator("dialog[open] [data-problem]")).toHaveCount(2);
});

test("the erasers and Clear this question clear values, and a note stays", async ({ page }) => {
  const server = await web(folder());
  await open(page, server);
  await ctl(page, "defs").locator("[data-act=full]").click();
  await note(page, "defs").fill("typed work");
  await ctl(page, "defs").locator("[data-act=erase]").click();
  await expect(value(page, "defs")).toHaveValue("");
  await expect(note(page, "defs")).toHaveValue("typed work");
  await value(page, "derive").fill("1.5");
  await page.locator("[data-action=clear]").click();
  await expect(value(page, "derive")).toHaveValue("");
  await expect(note(page, "defs")).toHaveValue("");
  // a value off the steps is outlined and not counted
  await value(page, "derive").fill("1.3");
  await expect(ctl(page, "derive").locator(".fm-ctl-group")).toHaveAttribute("data-state", "bad");
  await expect(page.locator("article[data-qid=add] .fm-grade-badge")).toContainText("Half graded");
  // a holistic verdict is a radio group: the arrows move within it
  await page.locator("[data-row=holistic]").click();
  await expect(page.locator("article[data-qid=holistic]")).toBeVisible();
  const first = page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=met]');
  await first.click();
  await first.press("ArrowRight");
  await expect(page.locator('[data-crit="names-the-nyquist-rate"] [data-verdict=partly]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.locator('[data-crit="names-the-nyquist-rate"] [data-act=erase]').click();
  await expect(page.locator('[data-crit="names-the-nyquist-rate"] [aria-checked=true]')).toHaveCount(0);
});

test("the sidebar lists what to grade, the unanswered and fullmark's line; Q, N and Esc", async ({ page }) => {
  const dir = folder();
  // leave the code answer blank
  const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
  results.state.answers.code = null;
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await web(dir);
  await open(page, server);
  const side = page.locator(".fm-grade-side");
  await expect(side).toContainText("To grade");
  await expect(side.locator("[data-row]")).toHaveCount(5);
  await expect(side).toContainText("Not answered");
  await expect(page.locator("[data-auto]")).toContainText("1 question");
  await expect(page.locator("[data-auto]")).toContainText("marked on submit");
  await side.locator("[data-row=code]").click();
  await expect(page.locator("article[data-qid=code]")).toContainText("No answer · 0 / 2");
  await expect(page.locator("article[data-qid=code] [data-action=clear]")).toHaveCount(0);
  await page.keyboard.press("q");
  await expect(side).toHaveCount(0);
  await page.keyboard.press("q");
  await expect(side).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.locator("article[data-qid=add]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(side).toHaveCount(0);
  // the blank question never blocks Finish, and is not written
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await finish(page).click();
  await page.locator("dialog[open] [data-field=name]").fill("Lan");
  await page.locator("dialog[open] [data-action=save]").click();
  await server.end();
  expect(Object.keys(JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8")).grades)).toEqual([
    "add",
    "ielts",
    "banded",
    "holistic",
  ]);
});

test("a vi quiz has the form in vi", async ({ page }) => {
  const dir = folder(["ui_lang: vi"]);
  const server = await web(dir);
  await open(page, server);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator("[data-action=finish]")).toHaveText("Hoàn tất");
  await expect(page.locator(".fm-grade-side")).toContainText("Cần chấm");
  await expect(page.locator(".fm-box-by")).toContainText("Bạn chấm");
  await expect(page.locator(".fm-box-type")).toContainText("Điểm cho từng tiêu chí");
  await expect(page.locator("article[data-qid=add] .fm-grade-badge")).toHaveText("Chờ chấm");
  await value(page, "defs").fill("0,5");
  await expect(ctl(page, "defs").locator(".fm-ctl-group")).toHaveAttribute("data-state", "set");
  // every number a button writes into a slot has the decimal comma: the full-mark box, then + and −
  await ctl(page, "derive").locator("[data-act=full]").click();
  await expect(value(page, "derive")).toHaveValue("1,5");
  await ctl(page, "derive").locator("[data-act=less]").click();
  await expect(value(page, "derive")).toHaveValue("1,25");
  await ctl(page, "derive").locator("[data-act=more]").click();
  await expect(value(page, "derive")).toHaveValue("1,5");
  await ctl(page, "interp").locator("[data-act=more]").click();
  await expect(value(page, "interp")).toHaveValue("1");
  await ctl(page, "interp").locator("[data-act=less]").click();
  await expect(value(page, "interp")).toHaveValue("0,75");
  // a banded question's first + starts at the middle of the scale
  await next(page);
  await ctl(page, "TR").locator("[data-act=more]").click();
  await expect(value(page, "TR")).toHaveValue("4,5");
});

test("passes axe in light and dark, with the Finish dialog open", async ({ page }) => {
  const server = await web(folder());
  await open(page, server);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await value(page, "derive").fill("1");
    await noViolations(page);
    await finish(page).click();
    await noViolations(page);
    await page.keyboard.press("Escape");
  }
});

test.describe("Ctrl+C", () => {
  test.skip(process.platform === "win32", "a child process cannot be sent SIGINT on Windows");
  test("writes nothing and leaves an empty template as it was (exit 2)", async () => {
    const dir = folder();
    spawnSync(process.execPath, [cli, "grade", "results.json", "--quiz", "quiz.md", "--json"], { cwd: dir });
    const before = readFileSync(join(dir, "results-grades.json"), "utf8");
    const server = await web(dir);
    server.child.kill("SIGINT");
    const end = await server.end();
    expect(end.code).toBe(2);
    expect(end.lines[1]).toEqual({ status: "interrupted" });
    expect(readFileSync(join(dir, "results-grades.json"), "utf8")).toBe(before);
  });
});

test("a second --web on the same results exits 2 (G87)", async () => {
  const dir = folder();
  writeFileSync(join(dir, "results-grades.json"), readFileSync(join(INPUT, "grades.json")));
  const r = spawnSync(process.execPath, [cli, "grade", "results.json", "--quiz", "quiz.md", "--web"], {
    cwd: dir,
    encoding: "utf8",
  });
  expect(r.status).toBe(2);
  expect(r.stderr).toContain("already holds grades");
  rmSync(dir, { recursive: true, force: true });
  void copyFileSync;
  void withName;
});

test("the answer and the box span the card; the sample opens beside the answer on a button (G96)", async ({ page }) => {
  const server = await web(folder());
  await open(page, server);
  const card = page.locator("article[data-qid=add]");
  const answer = card.locator(".fm-grade-answer-text").first();
  const box = card.locator(".fm-box");
  const wide = async (l: typeof box): Promise<{ x: number; y: number; width: number; height: number }> =>
    (await l.boundingBox()) as { x: number; y: number; width: number; height: number };
  // the answer across the card, the box across the card under it
  const a = await wide(answer);
  const b = await wide(box);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(b.y).toBeGreaterThan(a.y + a.height);
  // the sample starts hidden, with a button that says so
  await expect(card.locator(".fm-grade-sample-text")).toHaveCount(0);
  const button = card.locator("[data-action=sample]");
  await expect(button).toHaveText("Show the sample answer");
  await button.click();
  const sample = card.locator(".fm-grade-sample-text");
  await expect(sample).toContainText("Define the terms, derive the result");
  const half = await wide(answer);
  const s = await wide(sample);
  expect(Math.abs(half.width - s.width)).toBeLessThan(2);
  expect(s.x).toBeGreaterThan(half.x + half.width);
  expect(Math.abs(half.y - s.y)).toBeLessThan(2);
  await expect(button).toHaveText("Hide the sample answer");
  await button.click();
  await expect(sample).toHaveCount(0);
  await expect(button).toHaveText("Show the sample answer");
  // a question with no sample answer has no button
  await page.locator(".fm-grade-side [data-row=ielts]").click();
  await expect(page.locator("article[data-qid=ielts]")).toBeVisible();
  await expect(page.locator("[data-action=sample]")).toHaveCount(0);
  // no criterion name breaks inside a word: no name's lines are wider than its box, and none has a break the text lacks
  const broken = await page.evaluate(
    () =>
      [...document.querySelectorAll(".fm-box-title")].filter((el) => {
        const name = el.closest(".fm-box-name") as HTMLElement;
        return getComputedStyle(name).overflowWrap === "anywhere" || el.scrollWidth > el.clientWidth + 1;
      }).length,
  );
  expect(broken).toBe(0);
});

test("the sidebar draws the states as icons, tints the rows, folds its groups and has a legend", async ({ page }) => {
  const dir = folder();
  const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
  results.state.answers.code = null;
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await web(dir);
  await open(page, server);
  const side = page.locator(".fm-grade-side");
  const row = (id: string) => side.locator(`[data-row=${id}]`);
  // a graded row, a half-graded one (one criterion given) and a row with a lost mark and no note
  await value(page, "defs").fill("0.5");
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await next(page);
  await value(page, "TR").fill("6");
  await expect(row("add")).toHaveAttribute("data-condition", "done");
  await expect(row("ielts")).toHaveAttribute("data-condition", "half");
  const half = await row("ielts").locator(".fm-grade-mark").innerHTML();
  for (const crit of ["CC", "LR", "GRA"]) await value(page, crit).fill("6");
  await expect(row("ielts")).toHaveAttribute("data-condition", "note");
  // the marks are SVG, never a text glyph, and each state's is its own
  for (const id of ["add", "ielts"]) {
    await expect(row(id).locator(".fm-grade-mark svg")).toHaveCount(1);
    await expect(row(id).locator(".fm-grade-mark")).toHaveText("");
  }
  expect(await row("ielts").locator(".fm-grade-mark").innerHTML()).not.toBe(half);
  await expect(row("banded").locator(".fm-grade-mark svg")).toHaveCount(0);
  const tint = (id: string) => row(id).evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await tint("add")).not.toBe(await tint("banded"));
  expect(await tint("ielts")).not.toBe(await tint("banded"));
  expect(await tint("ielts")).not.toBe(await tint("add"));
  // the close button's icon has a size (a flex child can shrink to nothing)
  expect(
    ((await side.locator("[data-action=close-sidebar] svg").boundingBox()) as { width: number }).width,
  ).toBeGreaterThan(12);
  // the groups, with their counts, and the legend
  await expect(side.locator("[data-group=grade]")).toContainText("To grade");
  await expect(side.locator("[data-group=grade]")).toContainText("1 of 4 graded");
  await expect(side.locator("[data-group=blank]")).toContainText("Not answered");
  await expect(side.locator("[data-group=auto]")).toContainText("Scored by fullmark");
  await expect(side.locator("[data-group=auto]")).toContainText("1 / 1");
  await expect(row("code")).toContainText("0 / 2");
  await expect(side.locator("[data-legend]")).toContainText("Graded");
  await expect(side.locator("[data-legend]")).toContainText("Half graded");
  await expect(side.locator("[data-legend]")).toContainText("Needs a note");
  await expect(side.locator("[data-legend]")).toContainText("Not graded");
  await expect(side.locator("[data-legend]")).toContainText("current");
  await expect(side.locator("[data-legend]")).toContainText("required");
  // a group folds under its head
  const head = side.locator("[data-group=grade]");
  await expect(head).toHaveAttribute("aria-expanded", "true");
  await head.click();
  await expect(head).toHaveAttribute("aria-expanded", "false");
  await expect(row("add")).toHaveCount(0);
  await expect(side.locator("[data-group=blank]")).toBeVisible();
  await head.click();
  await expect(row("add")).toBeVisible();
});

test("the dialogs' buttons are at the right, and Go back is outlined in the blocked one", async ({ page }) => {
  const server = await web(folder());
  await open(page, server);
  const atRight = async (dialog: ReturnType<Page["locator"]>) => {
    const box = (await dialog.boundingBox()) as { x: number; width: number };
    const buttons = dialog.locator(".fm-dialog-actions button");
    const last = (await buttons.last().boundingBox()) as { x: number; width: number };
    const first = (await buttons.first().boundingBox()) as { x: number; width: number };
    // the last button ends at the dialog's right padding; the first is nearer the right than the left edge
    expect(box.x + box.width - (last.x + last.width)).toBeLessThan(40);
    expect(first.x - box.x).toBeGreaterThan(box.width / 3);
  };
  // blocked: a half-graded question
  await value(page, "defs").fill("0.5");
  await finish(page).click();
  const blocked = page.locator("dialog[open][data-grade-dialog=blocked]");
  await expect(blocked).toContainText("Some grades are not finished");
  await atRight(blocked);
  await expect(blocked.locator("[data-action=dialog-back]")).not.toHaveClass(/fm-primary/);
  await expect(blocked.locator("[data-action=dialog-back]")).toBeFocused();
  await blocked.locator("[data-action=dialog-back]").click();
  // finish: Go back and Save grades, the second the primary
  await value(page, "derive").fill("1.5");
  await value(page, "interp").fill("1");
  await finish(page).click();
  const ok = page.locator("dialog[open][data-grade-dialog=finish]");
  await atRight(ok);
  await expect(ok.locator("[data-action=dialog-back]")).not.toHaveClass(/fm-primary/);
  await expect(ok.locator("[data-action=save]")).toHaveClass(/fm-primary/);
});

test("the saved card closes the sidebar, centres the card and sets the score line in bold", async ({ page }) => {
  const server = await web(folder(), "--name", "Lan");
  await open(page, server);
  await expect(page.locator(".fm-grade-side")).toBeVisible();
  await gradeAll(page);
  await finish(page).click();
  await page.locator("dialog[open] [data-action=save]").click();
  const card = page.locator("[data-grade-saved]");
  await expect(card).toContainText("Grades saved");
  await expect(page.locator(".fm-grade-side")).toHaveCount(0);
  await expect(page.locator(".fm-body")).toHaveAttribute("data-side", "closed");
  // centred in the page
  const box = (await card.boundingBox()) as { x: number; width: number };
  const view = page.viewportSize() as { width: number };
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(24);
  // the score line is bold; the title's tick is an SVG
  const weight = await card.locator(".fm-grade-saved-score").evaluate((e) => Number(getComputedStyle(e).fontWeight));
  expect(weight).toBeGreaterThanOrEqual(700);
  await expect(card.locator("h2 svg")).toHaveCount(1);
  await server.end();
});

test("an image in a prompt and in a sample answer shows in the form", async ({ page }) => {
  const dir = folder();
  copyFileSync(join(root, "examples", "calculus", "assets", "cubic.png"), join(dir, "cubic.png"));
  const source = readFileSync(join(dir, "quiz.md"), "utf8")
    .replace(
      "## Describe the process. {type=essay id=add points=3 tags=writing}",
      "## Describe the process. {type=essay id=add points=3 tags=writing}\n\n![A cubic curve](cubic.png)",
    )
    .replace("sample_answer: |\n  Define", "sample_answer: |\n  ![The sample curve](cubic.png)\n\n  Define");
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
  results.quizHash = quizHash(source, [{ path: "cubic.png", bytes: readFileSync(join(dir, "cubic.png")) }]);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const server = await web(dir);
  const seen = watch(page);
  await open(page, server);
  const shown = async (alt: string) =>
    page.getByRole("img", { name: alt }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  await expect.poll(() => shown("A cubic curve")).toBe(true);
  await page.locator("[data-action=sample]").click();
  await expect.poll(() => shown("The sample curve")).toBe(true);
  expect(seen.problems).toEqual([]);
});

test("the note's placeholder is Note (optional), and says required once a mark is lost, in en and vi", async ({
  page,
}) => {
  for (const [extra, optional, required] of [
    [[], "Note (optional)", "Note (required: a mark was lost)"],
    [["ui_lang: vi"], "Ghi chú (không bắt buộc)", "Ghi chú (bắt buộc: bị trừ điểm)"],
  ] as const) {
    const server = await web(folder([...extra]));
    await open(page, server);
    await expect(note(page, "defs")).toHaveAttribute("placeholder", optional);
    await expect(note(page, "defs")).toHaveAttribute("aria-label", optional);
    await ctl(page, "defs").locator("[data-act=full]").click();
    await expect(note(page, "defs")).toHaveAttribute("placeholder", optional);
    await value(page, "defs").fill("0.25");
    await expect(note(page, "defs")).toHaveAttribute("placeholder", required);
    await note(page, "defs").fill("x");
    await expect(note(page, "defs")).toHaveAttribute("placeholder", required);
  }
});
