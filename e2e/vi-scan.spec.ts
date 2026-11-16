import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { formCatalogStrings, leaksIn, own } from "../test/helpers/vi-scan";
import { buildWith, root, run, type Served, serveProcess, submitAttempt } from "./helpers";

/**
 * The `vi` scan after Submit (STEP2.md, slice 2i2): `test/build/vi-scan.test.ts` reads the page as built, which is the
 * start screen. Here a page built with `--ui-lang vi` is used the way a learner does, and the text on screen at each
 * step (and every accessible name and title) is compared with the same catalog: no English chrome in a `vi` page.
 */
const AT = "2026-10-28T10:00:00+07:00";

/** A quiz from a folder (so sheets and images resolve), built with `--ui-lang vi`. */
function buildFolderVi(sourceDir: string, name: string): { dir: string; url: string } {
  const dir = mkdtempSync(join(tmpdir(), "fm-e2e-vi-"));
  mkdirSync(join(dir, ".git")); // it stops the search for fullmark.toml
  cpSync(join(root, sourceDir), dir, { recursive: true });
  run(dir, "build", name, "--built-at", AT, "--ui-lang", "vi");
  return { dir, url: `file:///${join(dir, name.replace(/\.md$/, ".html")).replaceAll("\\", "/")}` };
}

const subjects = [
  { name: "example exam", ...buildFolderVi("examples/exam", "quiz.md") },
  {
    name: "fixture results",
    ...buildWith("test/fixtures/page/results.md", "scan-results.md", [], ["--ui-lang", "vi"]),
  },
  { name: "fixture materials", ...buildFolderVi("test/fixtures/page", "materials.md") },
];

/**
 * The text on screen, and the names and titles that are not text.
 * The licence texts and copyright lines are the packages' own words, in English, so they are left out.
 */
async function onScreen(page: Page): Promise<string> {
  return page.evaluate(() => {
    const names = [...document.querySelectorAll("[aria-label],[title],[placeholder]")].flatMap((el) =>
      ["aria-label", "title", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
    );
    const rendered = (el: HTMLElement): string => el.innerText;
    const notices = [...document.querySelectorAll<HTMLElement>(".fm-licences-texts pre, .fm-licences-copy")];
    let text = rendered(document.body);
    for (const el of notices) text = text.replace(rendered(el), " ");
    return [text, ...names].join("\n").replace(/\s+/g, " ");
  });
}

for (const s of subjects) {
  test(`no English chrome in a vi page, from Start to the Information & Licences popup: ${s.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 940 });
    await page.goto(s.url);
    const mine = own(s.dir);
    const seen: [string, string][] = [];
    const look = async (step: string) => seen.push([step, await onScreen(page)]);

    await look("the start screen");
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    await page.locator("article[data-qid] input[type=radio], article[data-qid] input[type=checkbox]").first().check();
    await look("answering");
    await page.locator(".fm-topbar [data-action=submit]").click();
    await expect(page.locator("dialog[data-submit-dialog]")).toBeVisible();
    await look("the Submit dialog");
    await page.locator("dialog[data-submit-dialog] [data-action=keep-answering]").click();
    await submitAttempt(page);
    await expect(page.locator(".fm-results")).toBeVisible();
    await look("the results");
    for (const filter of await page
      .locator("[data-filter]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-filter")))) {
      await page.locator(`[data-filter="${filter}"]`).click();
      await look(`the filter ${filter}`);
    }
    const toggle = page.locator("[data-action=sidebar]");
    if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await look("the sidebar");
    for (const tab of await page.locator("aside.fm-side [role=tab]").all()) {
      await tab.click();
      await look("a sidebar tab");
    }
    await page.locator("[data-action=appearance]").click();
    await look("the appearance menu");
    await page.keyboard.press("Escape");
    await page.locator("[data-action=licences]").click();
    await expect(page.locator("dialog#fm-licences")).toBeVisible();
    await look("the Information tab");
    await page.locator("dialog#fm-licences [data-info-tab=licences]").click();
    await look("the Licences tab");

    const leaks = seen.flatMap(([step, text]) => leaksIn(text, mine).map((l) => `${step}: ${l}`));
    expect(leaks, `${s.name}: English chrome in a vi page`).toEqual([]);
  });
}

/**
 * A replay page built with `--ui-lang vi` (slice 2j2): the banner, the status segment, the criterion tables and the
 * grader's line, then a Retry missed left in progress and offered back through the resume banner, and its dialog.
 */
test("no English chrome in a vi replay page, with grades and with a retry left in progress", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "fm-e2e-vi-replay-"));
  mkdirSync(join(dir, ".git"));
  cpSync(join(root, "test", "fixtures", "replay"), dir, { recursive: true });
  run(dir, "replay", "essay-results.json", "--quiz", "essay.md", "--no-open", "--built-at", AT, "--ui-lang", "vi");
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(`file:///${join(dir, "essay-results-replay.html").replaceAll("\\", "/")}`);
  // the grader's own words are the author's, like the quiz: they may be English
  const mine = own(dir) + readFileSync(join(dir, "essay-results-grades.json"), "utf8").toLowerCase();
  const seen: [string, string][] = [];
  const look = async (step: string) => seen.push([step, await onScreen(page)]);

  await expect(page.locator("[data-replay-banner]")).toBeVisible();
  await expect(page.locator(".fm-box").first()).toBeVisible();
  await look("the replay");
  expect(seen[0]?.[1]).toContain("Chấm bởi");
  expect(seen[0]?.[1]).toContain("Điểm cho từng tiêu chí");
  await page.locator("[data-action=retry-missed]").click();
  await look("the Retry missed dialog");
  await page.locator("[data-action=confirm-retry]").click();
  await page.locator("article.fm-question:not([hidden]) textarea").first().fill("Một câu trả lời khác.");
  await page.reload();
  await expect(page.locator("[data-resume-banner]")).toBeVisible();
  await look("the retry offered back");
  await page.locator("[data-resume-banner] [data-action=start-over]").click();
  await look("the Start over dialog");
  await page.keyboard.press("Escape");
  await page.locator("[data-resume-banner] [data-action=continue]").click();
  await expect(page.locator(".fm-quiz")).toHaveAttribute("data-phase", "answering");
  await look("the retry continued");

  const leaks = seen.flatMap(([step, text]) => leaksIn(text, mine).map((l) => `${step}: ${l}`));
  expect(leaks, "English chrome in a vi replay page").toEqual([]);
});

// -- slice 3z: the served forms ------------------------------------------------------------------------------------

/**
 * The `review` and `grade --web` forms on a `ui_lang: vi` quiz (STEP3.md, slice 3z): every state each form has, scanned
 * as the page is, against the form's own catalog and the page's (`formCatalogStrings`). The quiz's own text, the
 * learner's answers and a grader's own words are the author's (they may be English), so they are left out as `own`
 * leaves them out. A word found is a bug in the catalogs, not an exception to add here.
 */
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
});
async function serveForm(dir: string, args: string[]): Promise<Served> {
  const s = await serveProcess(dir, args);
  served.push(s);
  return s;
}

const WIDE = { width: 1280, height: 940 };
const PHONE = { width: 390, height: 844 };

async function openForm(page: Page, server: Served, size = WIDE): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(size);
  await page.goto(server.url);
  await page.locator("[data-quiz]").waitFor();
}

/** A copy of a quiz in a folder of its own, with `lines` added to its front matter. */
function quizFolder(source: string, lines: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-e2e-vi-form-"));
  mkdirSync(join(dir, ".git"));
  const text = readFileSync(join(root, source), "utf8").replace(
    /^---\n/,
    `---\n${lines.map((l) => `${l}\n`).join("")}`,
  );
  writeFileSync(join(dir, "quiz.md"), text);
  return dir;
}

/** Collects what is on screen at each step, and the English of the forms' catalogs found in it. */
function scanner(page: Page, mine: string) {
  const seen: [string, string][] = [];
  return {
    async look(step: string, frame?: FrameLocator) {
      seen.push([step, await onScreen(page)]);
      if (frame) seen.push([`${step} (the frame)`, await frame.locator("body").evaluate(frameText)]);
    },
    leaks: () => seen.flatMap(([step, text]) => leaksIn(text, mine, formCatalogStrings).map((l) => `${step}: ${l}`)),
  };
}

/** `onScreen` inside a frame: its text, and the names and titles that are not text. */
const frameText = (body: HTMLElement): string => {
  const names = [...body.querySelectorAll("[aria-label],[title],[placeholder]")].flatMap((el) =>
    ["aria-label", "title", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
  );
  return [body.innerText, ...names].join("\n").replace(/\s+/g, " ");
};

const current = (page: Page) => page.locator("article[data-current=true]");

test("no English chrome in the vi review form: cards, reasons, sidebar, Appearance, both dialogs, the held notice, a refused submit, the saved card", async ({
  page,
}) => {
  const dir = quizFolder("test/fixtures/page/types-vi.md");
  const server = await serveForm(dir, ["review", "quiz.md"]);
  await openForm(page, server);
  const scan = scanner(page, own(dir));
  await expect(page.locator("[data-review-side]")).toBeVisible();
  await scan.look("the cards, with the sidebar open");
  await page.keyboard.press("2");
  await expect(current(page).locator("[data-error=reason]")).toBeVisible();
  await scan.look("a Fix with no reason");
  await current(page).locator("[data-reason=other]").click();
  await scan.look("Other with no note");
  await page.keyboard.press("n");
  await page.keyboard.press("3");
  await current(page).locator("[data-reason=duplicate]").click();
  await page.keyboard.press("n");
  await page.keyboard.press("1");
  await scan.look("a Fix, a Drop and a Keep");
  await page.locator("[data-action=keep-rest]").click();
  await expect(page.locator("[data-notice=held]")).toBeVisible();
  await scan.look("the held notice");
  await page.locator("article[data-qid=s1] textarea").fill("Câu hỏi chưa nói rõ.");
  await page.locator("[data-action=sidebar]").click();
  await expect(page.locator("[data-review-side]")).toHaveCount(0);
  await scan.look("the sidebar closed");
  await page.locator("[data-action=sidebar]").click();
  await page.locator("[data-action=appearance]").click();
  await expect(page.locator("[data-look-menu]")).toBeVisible();
  await scan.look("the Appearance menu");
  await page.keyboard.press("Escape");
  await page.locator("[data-action=finish]").click();
  await expect(page.locator("dialog[data-review-dialog=finish]")).toBeVisible();
  await scan.look("the Finish dialog");
  await page.locator("dialog[data-review-dialog=finish] [data-action=dialog-back]").click();
  await page.locator("[data-action=keep-rest]").click();
  await expect(page.locator("dialog[data-review-dialog=rest]")).toBeVisible();
  await scan.look("the Keep the rest dialog");
  // a review file the server refuses, then mended
  writeFileSync(join(dir, "review.json"), "{not json");
  await page.locator("[data-action=mark-keep]").click();
  await expect(page.locator("[data-problem]")).toBeVisible();
  await scan.look("a submit the server refuses");
  rmSync(join(dir, "review.json"), { force: true });
  await page.locator("[data-action=keep-rest]").click();
  await expect(page.locator("[data-review-saved]")).toBeVisible({ timeout: 10_000 });
  await scan.look("the saved card");
  expect((await server.end()).code).toBe(0);
  expect(scan.leaks(), "English chrome in the vi review form").toEqual([]);
});

test("no English chrome in the vi review form with materials: the stacked sidebar, its parts and sheets, and on a phone", async ({
  page,
}) => {
  const dir = quizFolder("test/fixtures/page/materials.md", ["lang: vi"]);
  cpSync(join(root, "test/fixtures/page/materials"), join(dir, "materials"), { recursive: true });
  const server = await serveForm(dir, ["review", "quiz.md"]);
  await openForm(page, server);
  const scan = scanner(page, own(dir));
  const side = page.locator("aside[data-review-side]");
  await expect(side).toHaveAttribute("data-form", "stacked");
  await page.locator("article[data-qid=m1] [data-pick=fix]").click();
  await page.locator("article[data-qid=m1] [data-reason=unclear]").click();
  await page.locator("article[data-qid=m2] [data-pick=drop]").click();
  await page.locator("article[data-qid=m2] [data-reason=duplicate]").click();
  await scan.look("the stacked sidebar");
  await side.locator("[data-part-tab=fourier]").click();
  await scan.look("another part");
  await side.locator("[data-sheet-tab]").nth(1).click();
  await scan.look("another sheet");
  await page.setViewportSize(PHONE);
  await scan.look("on a phone");
  await page.locator("[data-action=sidebar]").click();
  await expect(side).toHaveAttribute("data-phone", "true");
  await scan.look("the sidebar on a phone");
  await side.getByRole("tab").nth(1).click();
  await scan.look("the materials tab on a phone");
  expect(scan.leaks(), "English chrome in the vi review form with materials").toEqual([]);
});

test("no English chrome in the vi review form with --since: the asked bar, the earlier verdict, the diff, the map, the saved card", async ({
  page,
}) => {
  const dir = quizFolder("test/fixtures/page/types-vi.md");
  const first = await serveForm(dir, ["review", "quiz.md"]);
  await openForm(page, first);
  await page.locator("article[data-qid=s1] [data-pick=fix]").click();
  await page.locator("article[data-qid=s1] [data-reason=unclear]").click();
  await page.locator("[data-action=keep-rest]").click();
  await page.locator("[data-action=mark-keep]").click();
  await expect(page.locator("[data-review-saved]")).toBeVisible();
  expect((await first.end()).code).toBe(0);
  // s1 changed, m1 changed (a Keep, which stores no earlier text), and a question added
  const text = readFileSync(join(dir, "quiz.md"), "utf8");
  expect(text).toContain("## Pick the colour of the sky.");
  expect(text).toContain("## Which of these are prime?");
  writeFileSync(
    join(dir, "quiz.md"),
    `${text
      .replace("## Pick the colour of the sky.", "## Pick the colour of the clear sky.")
      .replace(
        "## Which of these are prime?",
        "## Which of these numbers are prime?",
      )}\n## Is this question new? {type=single id=brand-new}\n\n- [x] Yes\n- [ ] No\n`,
  );
  const server = await serveForm(dir, ["review", "quiz.md", "--since", "review.json"]);
  await openForm(page, server);
  const scan = scanner(page, own(dir));
  await expect(page.locator("[data-seg=asked]")).toBeVisible();
  await expect(page.locator("[data-since-box]").first()).toBeVisible();
  await scan.look("the cards asked again");
  await page.setViewportSize(PHONE);
  await scan.look("on a phone");
  await page.locator("[data-action=sidebar]").click();
  await scan.look("the sidebar on a phone");
  await page.locator("[data-action=close-sidebar]").click();
  await page.setViewportSize(WIDE);
  await page.locator("[data-action=finish]").first().click();
  await expect(page.locator("dialog[data-review-dialog=finish]")).toBeVisible();
  await scan.look("the Finish dialog");
  await page.locator("[data-action=mark-keep]").click();
  await expect(page.locator("[data-review-saved]")).toBeVisible();
  await scan.look("the saved card");
  expect((await server.end()).code).toBe(0);
  expect(scan.leaks(), "English chrome in the vi review form with --since").toEqual([]);
});

/** The golden `rubrics-grades-all` (one essay of each mode and a code question) as a `ui_lang: vi` quiz. */
function gradeFolder(): string {
  const input = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");
  const dir = mkdtempSync(join(tmpdir(), "fm-e2e-vi-grade-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(input, "quiz.md"), "utf8").replace(/^---\n/, "---\nui_lang: vi\n");
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(input, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const grades = JSON.parse(readFileSync(join(input, "grades.json"), "utf8"));
  grades.results_hash = resultsHash(results);
  writeFileSync(join(dir, "agent.json"), `${JSON.stringify(grades, null, 2)}\n`);
  return dir;
}

/** The quiz, the learner's answers and the AI grader's words: the author's own, which may be English. */
const gradeOwn = (dir: string): string =>
  own(dir) + ["results.json", "agent.json"].map((f) => readFileSync(join(dir, f), "utf8").toLowerCase()).join("\n");

const crit = (page: Page, id: string) => page.locator(`[data-crit="${id}"]`);
const next = (page: Page) => page.locator("[data-action=next]").click();

test("no English chrome in the vi grading form: each card, the sample, the sidebar, the frame, both dialogs, the saved card", async ({
  page,
}) => {
  const dir = gradeFolder();
  const server = await serveForm(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web"]);
  await openForm(page, server);
  const scan = scanner(page, gradeOwn(dir));
  await expect(page.locator(".fm-grade-side")).toBeVisible();
  await scan.look("the first card, with the sidebar open");
  await crit(page, "defs").locator("input").fill("0,5");
  await crit(page, "derive").locator("input").fill("1");
  await crit(page, "interp").locator("input").fill("1,3");
  await scan.look("a lost mark with no note, and a value off the steps");
  await crit(page, "interp").locator("input").fill("1");
  const sample = page.locator("article[data-qid=add] [data-action=sample]");
  if ((await sample.count()) > 0) {
    await sample.click();
    await scan.look("the sample answer");
  }
  await next(page);
  await crit(page, "TR").locator("[data-act=more]").click();
  await scan.look("a half-graded banded card");
  await next(page);
  await scan.look("a banded card rounded down");
  await next(page);
  await page.locator("article[data-qid=holistic] [data-ctl=score] input").fill("3");
  await crit(page, "names-the-nyquist-rate").locator("[data-verdict=met]").click();
  await scan.look("a holistic score with no reason");
  await next(page);
  await scan.look("a code card");
  await page.locator("[data-auto]").click();
  const frame = page.frameLocator("iframe[data-frame=marked]");
  await expect(frame.locator("[data-results]")).toBeVisible();
  await scan.look("the replay in the frame", frame);
  await page.locator(".fm-grade-side [data-row=add]").click();
  await page.locator("[data-action=appearance]").first().click();
  await scan.look("the Appearance menu");
  await page.keyboard.press("Escape");
  await page.locator("[data-action=finish]").first().click();
  await expect(page.locator("dialog[open] [data-problem]").first()).toBeVisible();
  await scan.look("the blocked dialog");
  await page.locator("dialog[open] [data-problem=add]").click();
  await crit(page, "derive").locator("textarea").fill("Thiếu một bước.");
  for (const id of ["ielts", "holistic"]) {
    await page.locator(`.fm-grade-side [data-row=${id}]`).click();
    await page.locator(`article[data-qid=${id}] [data-action=clear]`).click();
  }
  await page.keyboard.press("q");
  await scan.look("the sidebar closed");
  await page.locator("[data-action=finish]").first().click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.locator("[data-field=name]")).toBeVisible();
  await scan.look("the Finish dialog, asking the name");
  await dialog.locator("[data-field=name]").fill("Lan");
  await dialog.locator("[data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toBeVisible();
  await scan.look("the saved card");
  expect((await server.end()).code).toBe(0);
  expect(scan.leaks(), "English chrome in the vi grading form").toEqual([]);
});

test("no English chrome in the vi grading form with --grades: as given, adjusted, restored, the Finish dialog, the saved card, and on a phone", async ({
  page,
}) => {
  const dir = gradeFolder();
  const server = await serveForm(dir, [
    "grade",
    "results.json",
    "--quiz",
    "quiz.md",
    "--web",
    "--grades",
    "agent.json",
    "--name",
    "Lan",
  ]);
  await openForm(page, server);
  const scan = scanner(page, gradeOwn(dir));
  await expect(page.locator(".fm-status-pill")).toBeVisible();
  await scan.look("pre-filled, as given");
  await crit(page, "derive").locator("[data-act=more]").click();
  await crit(page, "derive").locator("textarea").fill("Đủ ý.");
  await scan.look("adjusted");
  await page.locator(".fm-grade-side [data-row=holistic]").click();
  await scan.look("a holistic card as given");
  await page.locator("article[data-qid=holistic] [data-action=clear]").click();
  await expect(page.locator("[data-action=restore]")).toBeVisible();
  await scan.look("a question cleared, with the way back");
  await page.locator("[data-action=restore]").click();
  await page.setViewportSize(PHONE);
  await scan.look("on a phone");
  await page.locator("[data-action=sidebar]").first().click();
  await scan.look("the sidebar on a phone");
  await page.locator(".fm-grade-side [data-row=add]").click();
  await page.setViewportSize(WIDE);
  await page.locator("[data-action=finish]").first().click();
  await expect(page.locator("dialog[open] [data-action=save]")).toBeVisible();
  await scan.look("the Finish dialog");
  await page.locator("dialog[open] [data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toBeVisible();
  await scan.look("the saved card");
  expect((await server.end()).code).toBe(0);
  expect(scan.leaks(), "English chrome in the vi grading form with --grades").toEqual([]);
});

/** The scan finds what it looks for: the same forms on an English quiz show the forms' English words. */
test("the forms' scan finds English chrome in an English form (a control)", async ({ page }) => {
  const reviewDir = quizFolder("test/fixtures/page/types.md");
  const review = await serveForm(reviewDir, ["review", "quiz.md"]);
  await openForm(page, review);
  const onReview = scanner(page, own(reviewDir));
  await onReview.look("the review form");
  const found = onReview.leaks().join("\n");
  for (const key of ["review.keepRest", "review.verdictLabel", "review.judged()"]) {
    expect(found, key).toContain(key);
  }
  const dir = gradeFolder();
  writeFileSync(join(dir, "quiz.md"), readFileSync(join(dir, "quiz.md"), "utf8").replace("ui_lang: vi\n", ""));
  const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
  results.quizHash = quizHash(readFileSync(join(dir, "quiz.md"), "utf8"), []);
  writeFileSync(join(dir, "results.json"), JSON.stringify(results));
  const grade = await serveForm(dir, ["grade", "results.json", "--quiz", "quiz.md", "--web"]);
  await openForm(page, grade);
  const onGrade = scanner(page, gradeOwn(dir));
  await onGrade.look("the grading form");
  const foundGrade = onGrade.leaks().join("\n");
  for (const key of ["grade.toGrade", "grade.autoHead", "grade.gradedOf()"]) expect(foundGrade, key).toContain(key);
});
