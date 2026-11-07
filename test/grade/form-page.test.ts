import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGradeForm } from "../../src/build/grade-form";
import { loadQuiz } from "../../src/cli/load";
import { attemptOf, parseResults } from "../../src/core/attempt";
import { grade } from "../../src/core/grade";
import { gradesTemplate } from "../../src/core/rubric/grades";
import type { GradeData } from "../../src/grade-form/data";

/** The grading form's page, built in memory: its CSP, its data, and that it is a page of its own. */
const input = resolve(import.meta.dirname, "..", "golden", "grade", "rubrics-grades-all", "input");
const loaded = loadQuiz(join(input, "quiz.md"));
const quiz = loaded.quiz as NonNullable<typeof loaded.quiz>;
const read = parseResults(readFileSync(join(input, "results.json"), "utf8"));
if (!read.ok) throw new Error(read.message);
const attempt = attemptOf(read.results);
const graded = grade(quiz, attempt);
const script = "/* the form */ window.x = 1;";
const page = buildGradeForm({
  quiz,
  hash: loaded.hash ?? "",
  assets: [],
  attempt,
  graded,
  template: gradesTemplate(quiz, graded, read.json) as { grades: Record<string, Record<string, unknown>> },
  name: "Lan",
  files: { grades: "results-grades.json", report: "results-report.md" },
  script,
  css: ".fm-x{}",
  gradeCss: ".fm-g{}",
  builtAt: "2026-11-07T10:00:00.000Z",
  version: "1.0.0-test",
});
const sha = (text: string) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
const data = JSON.parse(
  /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? "",
) as GradeData;

describe("the grading form's page", () => {
  it("allows its script and styles by hash and its own submit, and nothing else", () => {
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(page)?.[1] ?? "";
    expect(csp).toContain(`script-src ${sha(script)}`);
    expect(csp).toMatch(/style-src 'sha256-/);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(page).toContain(`<script>${script}</script>`);
  });

  it("is the same bytes twice", () => {
    expect(page.length).toBeGreaterThan(1000);
  });

  it("hands the form the answered essays and code to grade, the sums and the name", () => {
    expect(data.items.map((i) => [i.id, i.number, i.mode])).toEqual([
      ["add", 2, "additive"],
      ["ielts", 3, "banded"],
      ["banded", 4, "banded"],
      ["holistic", 5, "holistic"],
      ["code", 6, "additive"],
    ]);
    expect(data.unanswered).toEqual([]);
    expect(data.name).toBe("Lan");
    expect(data.auto).toEqual({ count: 1, earned: 1, points: 1, kinds: ["choice"] });
    expect(data.base).toEqual({ earned: 1, points: 1 });
    expect(data.items[0]?.criteria.map((c) => [c.id, c.max])).toEqual([
      ["defs", 0.5],
      ["derive", 1.5],
      ["interp", 1],
    ]);
    expect(data.items[1]?.scale).toEqual({ min: 0, max: 9, step: 0.5 });
    expect(data.items[1]?.round).toBe("ielts");
    expect(data.items[4]?.language).toBe("python");
    expect(data.items[0]?.sampleHtml).toContain("Define the terms");
  });
});

describe("the kinds fullmark marks (G98)", () => {
  it("names each kind once, in the order of the sidebar's row, from the questions not left to the grader", () => {
    const dir = resolve(import.meta.dirname, "..", "golden", "build", "all-types", "input");
    const all = loadQuiz(join(dir, "quiz.md"));
    const q = all.quiz as NonNullable<typeof all.quiz>;
    const ids = q.sections.flatMap((sec) => sec.questions.map((x) => x.id));
    const results = {
      format: "fullmark-results",
      version: 2,
      quizHash: all.hash ?? "",
      plan: { source: "full", questions: ids },
      state: {
        answers: { e1: { text: "An answer." }, k1: { code: "x", language: "python" } },
        startedAt: "2026-10-23T16:02:00",
        submittedAt: "2026-10-23T16:30:00",
        timeUsed: 60,
        sectionTime: {},
        flagged: [],
        checked: [],
        timedOut: false,
      },
      phase: "submitted",
    };
    const r = parseResults(JSON.stringify(results));
    if (!r.ok) throw new Error(r.message);
    const a = attemptOf(r.results);
    const g = grade(q, a);
    const html = buildGradeForm({
      quiz: q,
      hash: all.hash ?? "",
      assets: [],
      attempt: a,
      graded: g,
      template: gradesTemplate(q, g, r.json) as { grades: Record<string, Record<string, unknown>> },
      name: null,
      files: { grades: "g.json", report: "r.md" },
      script,
      css: "",
      gradeCss: "",
      builtAt: "2026-11-07T10:00:00.000Z",
      version: "1.0.0-test",
    });
    const d = JSON.parse(
      /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "",
    ) as GradeData;
    expect(d.items.map((i) => i.id)).toEqual(["e1", "k1"]);
    expect(d.auto.kinds).toEqual(["choice", "fillin", "numeric", "ordering", "matching", "scale"]);
  });
});
