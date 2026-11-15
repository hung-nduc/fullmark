// biome-ignore-all lint/suspicious/noExplicitAny: a test edits the grades file freely
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { quizHash } from "../src/core/hash";
import { resultsHash } from "../src/core/rubric/grades";
import { expectGolden, noViolations, root, run, type Served, serveProcess } from "./helpers";

/**
 * `quiz grade --web --grades` at 1280 px (STEP3.md, slice 3p2; the GradeAI board): the form opens with the file's grades
 * pre-filled, each question naming its own grader; a lit box does nothing, a change makes it plain and a press puts the
 * row back; Save writes `reviewed` on each pre-filled question. The input is the golden `rubrics-grades-all`: one essay
 * of each mode and a code question, and a grades file by Claude Opus 5.5 for all five.
 */
const INPUT = join(root, "test", "golden", "grade", "rubrics-grades-all", "input");

type Json = Record<string, any>;

const OPUS = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-10-24T09:00:00" };
const SONNET = { kind: "ai", name: "Claude Sonnet 5.5", model: "claude-sonnet-5-5", at: "2026-10-23T15:40:00" };
const LAN = { kind: "human", name: "Lan", at: "2026-10-25T10:00:00" };

/** The golden's folder with `agent.json` (the grades, as `edit` leaves them) and the results re-keyed to the new hash. */
function folder(edit: (doc: Json) => void = () => undefined, extra: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "fm-prefilled-"));
  mkdirSync(join(dir, ".git"));
  const source = readFileSync(join(INPUT, "quiz.md"), "utf8").replace(
    /^---\n/,
    `---\n${extra.join("\n")}${extra.length ? "\n" : ""}`,
  );
  writeFileSync(join(dir, "quiz.md"), source);
  const results = JSON.parse(readFileSync(join(INPUT, "results.json"), "utf8"));
  results.quizHash = quizHash(source, []);
  writeFileSync(join(dir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const grades = JSON.parse(readFileSync(join(INPUT, "grades.json"), "utf8")) as Json;
  grades.results_hash = resultsHash(results);
  edit(grades);
  writeFileSync(join(dir, "agent.json"), `${JSON.stringify(grades, null, 2)}\n`);
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

const crit = (page: Page, id: string) => page.locator(`[data-crit="${id}"]`);
const chip = (page: Page, id: string) => crit(page, id).locator(".fm-given");
const field = (page: Page, id: string) => crit(page, id).locator("input.fm-ctl-value");
const note = (page: Page, id: string) => crit(page, id).locator("textarea");
const pill = (page: Page) => page.locator(".fm-status-pill");
const row = (page: Page, id: string) => page.locator(`.fm-grade-side [data-row=${id}]`);
const head = (page: Page) => page.locator("article .fm-box-who");
const finish = (page: Page) => page.locator("[data-action=finish]");

const dropGrader = (doc: Json, ids: string[], grader: Json): void => {
  for (const id of ids) doc.grades[id].grader = grader;
};

test("opens pre-filled: every question graded, the pill, the box head and the marks", async ({ page }) => {
  const dir = folder((doc) => dropGrader(doc, ["ielts", "holistic"], SONNET));
  const server = await web(dir, "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  await expect(page.locator(".fm-status-seg[data-seg=graded]")).toHaveText("Graded 5 of 5");
  await expect(pill(page)).toHaveText("Pre-filled · 5 as given, 0 adjusted");
  await expect(pill(page)).toHaveAttribute("title", "Pre-filled from Claude Opus 5.5 (3) and Claude Sonnet 5.5 (2)");
  // the first question: its grader named over the date, the result badge, no restore button
  await expect(page.locator("article[data-qid=add] .fm-grade-badge")).toContainText("Partly right");
  await expect(head(page)).toHaveText("Graded by Claude Opus 5.5 (AI)24 Oct 2026 · unchanged");
  await expect(page.locator("[data-action=restore]")).toHaveCount(0);
  await expect(page.locator("[data-action=clear]")).toBeVisible();
  for (const id of ["defs", "derive", "interp"]) {
    await expect(chip(page, id)).toHaveAttribute("aria-pressed", "true");
  }
  await expect(chip(page, "derive")).toHaveText("1.25");
  await expect(field(page, "derive")).toHaveValue("1.25");
  await expect(note(page, "derive")).toHaveValue("Skips the zero initial-conditions assumption.");
  // the computed total shows the given total, display only
  const total = page.locator("[data-ctl=total] .fm-given");
  await expect(total).toHaveText("2.25");
  await expect(total).toHaveAttribute("data-on", "");
  // each question names its own grader: the second one is Sonnet's
  await row(page, "ielts").click();
  await expect(head(page)).toHaveText("Graded by Claude Sonnet 5.5 (AI)23 Oct 2026 · unchanged");
  // the sidebar: the sparkle, and "NAME's grade" under the name (the full name, G110)
  await expect(row(page, "add")).toHaveAttribute("data-mark", "ai");
  await expect(row(page, "add").locator(".fm-grade-row-sub")).toHaveText("Claude Opus 5.5's grade");
  await expect(row(page, "ielts").locator(".fm-grade-row-sub")).toHaveText("Claude Sonnet 5.5's grade");
  await expect(row(page, "add")).toHaveAccessibleName(/Claude Opus 5\.5's grade/);
  await expect(page.locator(".fm-grade-legend")).toHaveText(
    /AI's.*AI's, adjusted.*A person's.*A person's, adjusted.*Needs a note.*current/s,
  );
});

test("a press of a lit box does nothing; a change makes it plain, and a press restores the row's score and note", async ({
  page,
}) => {
  const server = await web(folder(), "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  const derive = chip(page, "derive");
  await derive.click();
  await expect(derive).toHaveAttribute("aria-pressed", "true");
  await expect(field(page, "derive")).toHaveValue("1.25");
  // the score changes: the box is plain, still showing the given value; the pill and the head follow
  await crit(page, "derive").locator("[data-act=more]").click();
  await expect(field(page, "derive")).toHaveValue("1.5");
  await expect(derive).toHaveAttribute("aria-pressed", "false");
  await expect(derive).toHaveText("1.25");
  await expect(derive).toHaveAccessibleName("Back to the AI's score and note for Derive the result: 1.25");
  await expect(pill(page)).toHaveText("Pre-filled · 4 as given, 1 adjusted");
  await expect(head(page)).toHaveText("Claude Opus 5.5 (AI), adjusted by yousaved at Finish");
  await expect(row(page, "add")).toHaveAttribute("data-mark", "ai-adjusted");
  await expect(row(page, "add").locator(".fm-grade-row-sub")).toHaveText("adjusted by you");
  // the total's display is dashed once it differs
  await expect(page.locator("[data-ctl=total] .fm-given")).not.toHaveAttribute("data-on", "");
  // the note changes too; one press puts the score and the note back together
  await note(page, "derive").fill("Something else.");
  await derive.click();
  await expect(field(page, "derive")).toHaveValue("1.25");
  await expect(note(page, "derive")).toHaveValue("Skips the zero initial-conditions assumption.");
  await expect(derive).toHaveAttribute("aria-pressed", "true");
  await expect(pill(page)).toHaveText("Pre-filled · 5 as given, 0 adjusted");
  await expect(row(page, "add")).toHaveAttribute("data-mark", "ai");
});

test('"✦ AI\'s" restores a text; "✦ Back to the AI\'s grade" restores the question; Clear this question counts as changed', async ({
  page,
}) => {
  const server = await web(folder(), "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  const why = page.locator("textarea[aria-label='Why this score']");
  const given = await why.inputValue();
  expect(given).toContain("Solid derivation");
  const whyChip = page.locator(".fm-box-label-row .fm-given").first();
  await expect(whyChip).toHaveText("AI's");
  await expect(whyChip).toHaveAttribute("aria-pressed", "true");
  await why.fill("Mine.");
  await expect(whyChip).toHaveAttribute("aria-pressed", "false");
  await expect(pill(page)).toHaveText("Pre-filled · 4 as given, 1 adjusted");
  await whyChip.click();
  await expect(why).toHaveValue(given);
  await expect(pill(page)).toHaveText("Pre-filled · 5 as given, 0 adjusted");
  // change a row and a text, then restore the whole question
  await crit(page, "defs").locator("[data-act=less]").click();
  await note(page, "defs").fill("Lost a mark.");
  await why.fill("Mine.");
  const restore = page.locator("[data-action=restore]");
  await expect(restore).toHaveText("Back to the AI's grade");
  await restore.click();
  await expect(field(page, "defs")).toHaveValue("0.5");
  await expect(note(page, "defs")).toHaveValue("");
  await expect(why).toHaveValue(given);
  await expect(restore).toHaveCount(0);
  // Clear this question empties it: it is changed, so the restore button is back, and a press brings every value back
  await page.locator("[data-action=clear]").click();
  await expect(field(page, "defs")).toHaveValue("");
  await expect(row(page, "add").locator(".fm-grade-row-sub")).toHaveText("not graded");
  await expect(restore).toBeVisible();
  await restore.click();
  await expect(field(page, "derive")).toHaveValue("1.25");
  await expect(row(page, "add")).toHaveAttribute("data-mark", "ai");
});

test("a verdict, one score, a banded row: the same box, with its own size", async ({ page }) => {
  const server = await web(folder(), "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  await row(page, "holistic").click();
  const verdict = chip(page, "names-the-nyquist-rate");
  await expect(verdict).toHaveText("Met");
  await expect(verdict).toHaveAttribute("aria-pressed", "true");
  expect((await verdict.boundingBox())?.width).toBe(88);
  await crit(page, "names-the-nyquist-rate").locator("[data-verdict=missed]").click();
  await expect(verdict).toHaveAttribute("aria-pressed", "false");
  await expect(verdict).toHaveText("Met");
  await verdict.click();
  await expect(crit(page, "names-the-nyquist-rate").locator("[data-verdict=met]")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // the one score's control opens with the same box
  const score = page.locator("[data-ctl=score]").first();
  await expect(score.locator(".fm-given")).toHaveText("3");
  expect((await score.locator(".fm-given").boundingBox())?.width).toBe(76);
  await score.locator("[data-act=less]").click();
  await expect(score.locator(".fm-given")).toHaveAttribute("aria-pressed", "false");
  await score.locator(".fm-given").click();
  await expect(score.locator("input")).toHaveValue("3");
  // the slot columns: 346 px, 388 px for verdicts
  const rowWidth = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => (e.lastElementChild as HTMLElement).getBoundingClientRect().width);
  expect(await rowWidth("[data-crit=names-the-nyquist-rate] .fm-box-row")).toBe(388);
  await row(page, "ielts").click();
  expect(await rowWidth("[data-crit=TR] .fm-box-row")).toBe(346);
  // a banded total shows the given band
  await expect(page.locator("[data-ctl=total] .fm-given")).toHaveText("6.5");
});

test("a pre-filled question cleared and saved carries no reviewed; the rest do (Save writes reviewed)", async ({
  page,
}) => {
  const dir = folder();
  const server = await web(dir, "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  await row(page, "ielts").click();
  await page.locator("[data-action=clear]").click();
  await finish(page).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("4 of 5 questions graded");
  await dialog.locator("[data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText("Grades saved");
  await expect(page.locator("[data-grade-saved]")).toContainText("Reviewing the grades of Claude Opus 5.5");
  const end = await server.end();
  expect(end.code).toBe(0);
  const file = JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8"));
  expect(file.grades.ielts).not.toHaveProperty("reviewed");
  expect(file.grades.add.reviewed).toEqual(OPUS);
});

/** Saves the form, reads the file back and checks the golden (`at` masked). */
async function save(page: Page, server: Served, dir: string, golden: string): Promise<Json> {
  await finish(page).click();
  await page.locator("dialog[open] [data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText("Grades saved");
  const end = await server.end();
  expect(end.code).toBe(0);
  const file = JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8")) as Json;
  expect(file.grader).toMatchObject({ kind: "human", name: "Lan" });
  file.grader.at = "<at>";
  expectGolden(golden, `${JSON.stringify(file, null, 2)}\n`);
  // read back by `quiz grade --grades`, which names the questions' grader (the human) and takes `reviewed` as is
  const again = join(dir, "again.md");
  run(dir, "grade", "results.json", "--quiz", "quiz.md", "--grades", "results-grades.json", "-o", again);
  expect(readFileSync(again, "utf8")).toBe(readFileSync(join(dir, "results-report.md"), "utf8"));
  return file;
}

test("saved unchanged: kind human, reviewed on each question, no grader of their own", async ({ page }) => {
  const dir = folder();
  const server = await web(dir, "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  const file = await save(page, server, dir, "grade-web-prefilled-unchanged");
  for (const id of ["add", "ielts", "banded", "holistic", "code"]) {
    expect(file.grades[id].reviewed).toEqual(OPUS);
    expect(file.grades[id]).not.toHaveProperty("grader");
  }
});

test("saved adjusted: the new values, with reviewed naming the grader it was pre-filled from", async ({ page }) => {
  const dir = folder();
  const server = await web(dir, "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  await crit(page, "derive").locator("[data-act=more]").click();
  await note(page, "derive").fill("Fine after all.");
  await expect(pill(page)).toHaveText("Pre-filled · 4 as given, 1 adjusted");
  const file = await save(page, server, dir, "grade-web-prefilled-adjusted");
  expect(file.grades.add.criteria.derive).toMatchObject({ score: 1.5, note: "Fine after all." });
  expect(file.grades.add.reviewed).toEqual(OPUS);
});

test("from two AI graders (G102): each question's own grader is the reviewed one", async ({ page }) => {
  const dir = folder((doc) => dropGrader(doc, ["ielts", "code"], SONNET));
  const server = await web(dir, "--grades", "agent.json", "--name", "Lan");
  await open(page, server);
  const file = await save(page, server, dir, "grade-web-prefilled-two-graders");
  expect(["add", "ielts", "banded", "holistic", "code"].map((id) => file.grades[id].reviewed.name)).toEqual([
    "Claude Opus 5.5",
    "Claude Sonnet 5.5",
    "Claude Opus 5.5",
    "Claude Opus 5.5",
    "Claude Sonnet 5.5",
  ]);
});

test("from a person: the words say Given, no (AI), a tick and a pencil alone", async ({ page }) => {
  const dir = folder((doc) => {
    doc.grader = LAN;
  });
  const server = await web(dir, "--grades", "agent.json", "--name", "Minh");
  await open(page, server);
  await expect(head(page)).toHaveText("Graded by Lan24 Oct 2026 · unchanged".replace("24 Oct 2026", "25 Oct 2026"));
  await expect(page.locator(".fm-box-label-row .fm-given").first()).toHaveText("Given");
  await expect(row(page, "add")).toHaveAttribute("data-mark", "person");
  await expect(chip(page, "derive")).toHaveAccessibleName(
    "score and note for Derive the result 1.25: as given, in use",
  );
  await crit(page, "derive").locator("[data-act=more]").click();
  await expect(chip(page, "derive")).toHaveAccessibleName(
    "Back to the given score and note for Derive the result: 1.25",
  );
  await expect(head(page)).toHaveText("Lan, adjusted by yousaved at Finish");
  await expect(row(page, "add")).toHaveAttribute("data-mark", "person-adjusted");
  await expect(page.locator("[data-action=restore]")).toHaveText("Back to the given grade");
  await expect(pill(page)).toHaveAttribute("title", "Pre-filled from Lan (5)");
  await finish(page).click();
  await page.locator("dialog[open] [data-action=save]").click();
  await expect(page.locator("[data-grade-saved]")).toContainText("Reviewing the grades of Lan");
  const end = await server.end();
  expect(end.code).toBe(0);
  const file = JSON.parse(readFileSync(join(dir, "results-grades.json"), "utf8")) as Json;
  expect(file.grader).toMatchObject({ kind: "human", name: "Minh" });
  expect(file.grades.add.reviewed).toEqual(LAN);
  file.grader.at = "<at>";
  expectGolden("grade-web-prefilled-person", `${JSON.stringify(file, null, 2)}\n`);
});

test("a question the file leaves null is graded as without --grades, and the file may name itself (G108)", async ({
  page,
}) => {
  const dir = folder((doc) => {
    const code = doc.grades.code;
    for (const c of Object.values(code.criteria) as Json[]) {
      c.score = null;
      c.note = null;
    }
    code.justification = null;
    code.improvement = null;
  });
  // the usual way: the agent's file is the template's own name
  writeFileSync(join(dir, "results-grades.json"), readFileSync(join(dir, "agent.json")));
  const server = await web(dir, "--grades", "results-grades.json", "--name", "Lan");
  await open(page, server);
  await expect(page.locator(".fm-status-seg[data-seg=graded]")).toHaveText("Graded 4 of 5");
  await expect(pill(page)).toHaveText("Pre-filled · 4 as given, 0 adjusted");
  await row(page, "code").click();
  await expect(page.locator("article[data-qid=code] .fm-grade-badge")).toHaveText("Waiting for a grade");
  await expect(chip(page, "works")).toHaveCount(0);
  await expect(row(page, "code").locator(".fm-grade-row-sub")).toHaveText("Code · points per criterion");
  const file = await save(page, server, dir, "grade-web-prefilled-same-path");
  expect(file.grades.code).not.toHaveProperty("reviewed");
  expect(file.grades.add.reviewed).toEqual(OPUS);
});

test("the words in vi", async ({ page }) => {
  const server = await web(
    folder(() => undefined, ["ui_lang: vi"]),
    "--grades",
    "agent.json",
    "--name",
    "Lan",
  );
  await open(page, server);
  await expect(pill(page)).toHaveText("Điền sẵn · 5 giữ nguyên, 0 đã sửa");
  await expect(pill(page)).toHaveAttribute("title", "Điền sẵn từ Claude Opus 5.5 (5)");
  await expect(head(page)).toContainText("Chấm bởi Claude Opus 5.5 (AI)");
  await expect(head(page)).toContainText("chưa đổi");
  await expect(row(page, "add").locator(".fm-grade-row-sub")).toHaveText("Điểm của Claude Opus 5.5");
  await crit(page, "derive").locator("[data-act=more]").click();
  await expect(head(page)).toContainText("Claude Opus 5.5 (AI), bạn đã sửa");
  await expect(page.locator("[data-action=restore]")).toHaveText("Về điểm của AI");
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe passes in ${scheme}, as given and adjusted, with the frame shown too`, async ({ page }) => {
    const server = await web(folder(), "--grades", "agent.json", "--name", "Lan");
    await open(page, server);
    await page.emulateMedia({ colorScheme: scheme });
    await noViolations(page);
    await crit(page, "derive").locator("[data-act=more]").click();
    await note(page, "derive").fill("Fine after all.");
    await noViolations(page);
    await row(page, "holistic").click();
    await noViolations(page);
    await page.locator("[data-auto]").click();
    await expect(page.frameLocator("iframe[data-frame=marked]").locator("[data-results]")).toBeVisible();
    await noViolations(page);
  });
}
