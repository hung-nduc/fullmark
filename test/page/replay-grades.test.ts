import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterAll, describe, expect, it } from "vitest";
import { pageQuizOf } from "../../src/build/page";
import { loadQuiz } from "../../src/cli/load";
import { readReplay } from "../../src/cli/replay";
import { App } from "../../src/page/App";
import type { PageQuiz } from "../../src/page/data";
import { createStore, type QuizState } from "../../src/page/store";
import { capture } from "../helpers/cli";

/**
 * The grades on a replay page (STEP2.md, slice 2j2): each graded essay or code answer shows its table and the grader's
 * line exactly as the grades file says, and the score counts them as `quiz grade` does (19.25 of 25 for this file).
 */
const fixtures = resolve(import.meta.dirname, "..", "fixtures", "replay");
const work = mkdtempSync(join(tmpdir(), "fullmark-replay-grades-"));
afterAll(() => rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

type Grades = { grader: { at?: string }; grades: Record<string, unknown> };
type Edit = (grades: Grades) => void;

/** The fixture's replay page in a store, with the grades file edited by `edit` (null: no grades file at all). */
function pageOf(edit: Edit | null, uiLang: "en" | "vi" = "en", name = "case") {
  const dir = join(work, name);
  cpSync(fixtures, dir, { recursive: true });
  if (edit === null) rmSync(join(dir, "essay-results-grades.json"));
  else {
    const path = join(dir, "essay-results-grades.json");
    const grades = JSON.parse(readFileSync(path, "utf8"));
    edit(grades);
    writeFileSync(path, JSON.stringify(grades));
  }
  const loaded = loadQuiz(join(dir, "essay.md"));
  const io = capture(dir).io;
  const read = readReplay("essay-results.json", { quiz: "essay.md", loaded, grades: null, open: "default" }, io);
  if (!read.ok) throw new Error(read.problems.join("\n"));
  const page: PageQuiz = pageQuizOf({
    quiz: loaded.quiz as never,
    hash: loaded.hash as string,
    assets: [],
    uiLang,
    replay: read.replay,
  });
  const store = createStore({ version: 1, quizzes: [page] });
  const state = store.quizzes.get(page.id) as QuizState;
  return { store, state, html: renderToString(h(App, { store })), page };
}

const card = (html: string, id: string): string => {
  const at = html.indexOf(`data-qid="${id}"`);
  const start = html.lastIndexOf("<article", at);
  return html.slice(start, html.indexOf("</article>", at));
};
const text = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("grades on a replay page", () => {
  it("scores what `quiz grade` scores and shows no pending note", () => {
    const { state, html } = pageOf((g) => g);
    const total = state.graded.value;
    expect(total?.questions.map((q) => q.status)).not.toContain("pending");
    const earned = total?.questions.reduce((sum, q) => sum + (q.earned ?? 0), 0);
    expect(earned).toBe(19.25);
    expect(html).not.toContain("data-pending-note");
    expect(html).toContain('data-pending="0"');
  });

  it("shows an additive box: the head, each criterion's slot and note, the total, the grader and the date", () => {
    const { html } = pageOf((g) => g);
    const add = text(card(html, "add"));
    expect(add).toContain("Points per criterion step 0.25 Graded by Claude Opus 5.5 (agent) 24 Oct 2026");
    expect(add).toContain("Define the terms 0.5 of 0.5 points");
    expect(add).toContain(
      "Derive the result 1.25 of 1.5 points 1.25 / 1.5 Skips the zero initial-conditions assumption.",
    );
    expect(add).toContain("Interpret it 0.5 of 1 point 0.5 / 1 Does not link the result to stability.");
    expect(add).toContain("Total the sum of the criteria 2.25 of 3 points 2.25 / 3");
    expect(add).toContain("Why this score · optional Solid derivation; the interpretation is the weak part.");
    expect(add).toContain("To improve · optional Say why the result matters.");
    const code = card(html, "code");
    expect(text(code)).toContain("Is short and clear 0.5 of 1 point 0.5 / 1 x + x works, but 2 * x is the usual form.");
    expect(text(code)).toContain("Total the sum of the criteria 1.5 of 2 points");
    expect(code).not.toContain("<table");
  });

  it("colours a slot by result: full, part, none; a band is neutral", () => {
    const { html } = pageOf((g) => {
      const c = (g.grades.add as { criteria: Record<string, { score: number }> }).criteria;
      (c.interp as { score: number }).score = 0;
    });
    const add = card(html, "add");
    expect(add.match(/data-res="(\w+)"/g)).toEqual([
      'data-res="full"',
      'data-res="part"',
      'data-res="none"',
      'data-res="part"',
    ]);
    expect(card(html, "ielts").match(/data-res="band"/g)).toHaveLength(5);
  });

  it("shows a banded box: the band per criterion over the scale, the overall band, the scale in the head", () => {
    const { html } = pageOf((g) => g);
    const ielts = text(card(html, "ielts"));
    expect(ielts).toContain("A band per criterion bands 0 to 9, step 0.5 Graded by Claude Opus 5.5 (agent)");
    expect(ielts).toContain("Task Response band 6 of 9 6 / 9 Room to improve here.");
    expect(ielts).toContain("Overall band mean 6.25, IELTS rounding to 6.5 band 6.5 of 9 6.5 / 9");
    const banded = text(card(html, "banded"));
    expect(banded).toContain("bands 0 to 6, step 1");
    expect(banded).toContain("Style band 6 of 6 6 / 6 Overall band mean 5.33, rounded down to 5");
  });

  it("shows a holistic box: a verdict slot per bullet, no verdict where none is given, the score", () => {
    const { html } = pageOf((g) => {
      const b = (g.grades.holistic as { bullets: Record<string, { verdict?: string }> }).bullets;
      delete (b["explains-how-to-avoid-it"] as { verdict?: string }).verdict;
    });
    const raw = card(html, "holistic");
    const holistic = text(raw);
    expect(holistic).toContain("One score Graded by Claude Opus 5.5 (agent) 24 Oct 2026");
    expect(holistic).toContain("Names the Nyquist rate verdict, not scored verdict: Met Met");
    expect(holistic).toContain("Gives an example verdict, not scored verdict: Partly Partly");
    expect(holistic).toContain("Explains how to avoid it verdict, not scored no verdict No verdict");
    expect(holistic).toContain("Score the score given 3 of 4 points 3 / 4");
    expect(holistic).toContain("Why this score · required for one score");
    expect(raw.match(/data-res="no"/g)).toHaveLength(1);
    expect(raw).toMatch(/data-wide[ >]/);
  });

  it("a grades file without a date shows the head's grader without one", () => {
    const { html } = pageOf(
      (g) => {
        delete g.grader.at;
      },
      "en",
      "nodate",
    );
    const add = text(card(html, "add"));
    expect(add).toContain("Graded by Claude Opus 5.5 (agent) Define the terms");
    expect(add).not.toContain("2026");
  });

  it("a human grader has no (agent) after the name", () => {
    const { html } = pageOf(
      (g) => {
        (g.grader as { kind: string }).kind = "human";
      },
      "en",
      "human",
    );
    const add = text(card(html, "add"));
    expect(add).toContain("Graded by Claude Opus 5.5 24 Oct 2026");
    expect(add).not.toContain("(agent)");
  });

  it("leaves out an empty or missing note, and each of the grader's two texts when it is not given", () => {
    const add = card(
      pageOf(
        (g) => {
          const one = g.grades.add as Record<string, unknown>;
          one.improvement = null;
        },
        "en",
        "notes",
      ).html,
      "add",
    );
    // three criteria, one with no note: two notes, plus "Why this score"
    expect(add.match(/fm-box-note/g)).toHaveLength(3);
    expect(add).toContain("Why this score");
    expect(add).not.toContain("To improve");
    const none = card(
      pageOf(
        (g) => {
          const one = g.grades.add as Record<string, unknown>;
          one.justification = null;
          one.improvement = null;
        },
        "en",
        "no-texts",
      ).html,
      "add",
    );
    expect(none).not.toContain("Why this score");
    expect(none).toContain("fm-box-total");
  });

  it("is a list of sections, with the head and the total outside it, and names every slot in words", () => {
    const add = card(pageOf((g) => g).html, "add");
    expect(add.match(/<ul class="fm-box-list">/g)).toHaveLength(1);
    expect(add.match(/<li class="fm-box-sec">/g)).toHaveLength(3);
    expect(add.indexOf("fm-box-head")).toBeLessThan(add.indexOf("fm-box-list"));
    expect(add.indexOf("fm-box-list")).toBeLessThan(add.indexOf("fm-box-total"));
    expect(add).toContain('<span class="fm-sr">1.25 of 1.5 points</span><span class="fm-slot-in" aria-hidden="true">');
    expect(add).toContain('role="group" aria-labelledby=');
  });

  it("without grades the essays and code stay pending, with no table", () => {
    const { html, state } = pageOf(null, "en", "none");
    expect(state.graded.value?.questions.filter((q) => q.status === "pending").map((q) => q.id)).toEqual([
      "add",
      "ielts",
      "banded",
      "holistic",
      "code",
    ]);
    expect(html).not.toContain("fm-box");
    expect(html).toContain("data-pending-note");
  });

  it("a question the grades file leaves out stays pending beside the graded ones", () => {
    const { state } = pageOf(
      (g) => {
        delete g.grades.code;
      },
      "en",
      "partial",
    );
    const by = new Map(state.graded.value?.questions.map((q) => [q.id, q.status]));
    expect(by.get("code")).toBe("pending");
    expect(by.get("add")).not.toBe("pending");
  });

  it("the same results, quiz and grades give the same page, byte for byte", () => {
    const a = pageOf((g) => g, "en", "same-a");
    const b = pageOf((g) => g, "en", "same-b");
    expect(a.html).toBe(b.html);
    expect(JSON.stringify(a.page)).toBe(JSON.stringify(b.page));
  });

  it("in Vietnamese the box uses the catalog, with a decimal comma", () => {
    const { html } = pageOf((g) => g, "vi", "vi");
    const add = text(card(html, "add"));
    expect(add).toContain("Điểm cho từng tiêu chí bước 0,25 Chấm bởi Claude Opus 5.5 (agent) 24 thg 10 2026");
    expect(add).toContain("1,25 trên 1,5 điểm");
    expect(add).toContain("Tổng tổng các tiêu chí 2,25 trên 3 điểm 2,25 / 3");
    expect(add).toContain("Lý do cho điểm này · không bắt buộc");
    expect(add).not.toContain("Graded by");
    expect(text(card(html, "holistic"))).toContain("Đạt một phần");
  });
});
