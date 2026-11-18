import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStored } from "../src/cli/library-common";
import { type QuizHistory, readHistory } from "../src/cli/library-history";
import { missedFor, missedOf } from "../src/cli/library-missed";
import type { Quiz } from "../src/core/ir";
import { readIndex } from "../src/library/index-file";
import { cleanTemps } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

afterEach(cleanTemps);

/** Expected texts of functions, as test/golden-fn keeps them; `FULLMARK_GOLDEN_UPDATE=1` rewrites them. */
const golden = (name: string, value: unknown): void => {
  const file = resolve(import.meta.dirname, "golden-fn", name);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (process.env.FULLMARK_GOLDEN_UPDATE === "1") writeFileSync(file, text);
  else expect(existsSync(file), name).toBe(true);
  expect(text).toBe(readFileSync(file, "utf8"));
};

async function study() {
  const h = await buildHistory();
  const read = readIndex(readFileSync(join(h.lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  const quiz = read.index.quizzes.find((q) => q.name === "study-fixture");
  if (!quiz) throw new Error("no study quiz");
  const current = loadStored(h.lib, quiz, quiz.current)?.quiz;
  if (!current) throw new Error("no current version");
  return { ...h, quiz, current };
}

describe("take --missed: the plan over the history library (test/golden-fn)", () => {
  it("serves what is wrong or partly right and not answered right since, in the current version's order", async () => {
    const t = await study();
    const missed = missedFor(t.lib, t.quiz, t.current);
    // prime: wrong, right once, wrong again on the third version; even: wrong on the second version, reworded since and
    // left unanswered; add: an essay graded partly right; ielts: the same, then left unanswered
    expect(missed.questions).toEqual(["prime", "even", "add", "ielts"]);
    expect(missed.changed).toEqual(["even"]);
    // odd was missed on the second version and the third has removed it
    expect(missed.gone).toBe(1);
    expect(missed.attempts).toBe(7);
    golden("library-missed-study.txt", missed);
  });

  it("clears what a later attempt answered right: syll and late were wrong once and are right now", async () => {
    const t = await study();
    expect(missedFor(t.lib, t.quiz, t.current).questions).not.toContain("syll");
    expect(missedFor(t.lib, t.quiz, t.current).questions).not.toContain("late");
  });

  it("with a section keeps its questions, and counts as gone only the ones that were in it", async () => {
    const t = await study();
    const one = missedFor(t.lib, t.quiz, t.current, "part-one");
    expect(one).toEqual({ questions: ["prime", "even"], changed: ["even"], gone: 1, attempts: 7 });
    golden("library-missed-study-part-one.txt", one);
    const two = missedFor(t.lib, t.quiz, t.current, "part-two");
    expect(two).toEqual({ questions: ["add", "ielts"], changed: [], gone: 0, attempts: 7 });
    golden("library-missed-study-part-two.txt", two);
  });

  it("is what the page is given: the plan's questions and the changed ones", async () => {
    const t = await study();
    const missed = missedFor(t.lib, t.quiz, t.current);
    golden("library-missed-study-plan.txt", {
      plan: { source: "missed", questions: missed.questions },
      changed: missed.changed,
      gone: missed.gone,
    });
  });
});

describe("what is missed", () => {
  const quiz = {
    sections: [
      {
        id: "a",
        questions: [
          { id: "q1", hash: "h1" },
          { id: "q2", hash: "h2" },
        ],
      },
      { id: "b", questions: [{ id: "q3", hash: "h3" }] },
    ],
  } as unknown as Quiz;
  const attempt = (...rows: [string, string, string?, string?][]) => ({
    report: {
      questions: rows.map(([id, status, hash = `h${id.slice(1)}`, section = "a"]) => ({ id, status, hash, section })),
    },
  });
  const history = (...attempts: ReturnType<typeof attempt>[]): QuizHistory => ({ attempts }) as unknown as QuizHistory;

  it("misses a wrong or partly right answer, and a fully right one later clears it", () => {
    const h = history(
      attempt(["q1", "incorrect"], ["q2", "partial"], ["q3", "incorrect", "h3", "b"]),
      attempt(["q1", "correct"]),
    );
    expect(missedOf(quiz, h).questions).toEqual(["q2", "q3"]);
  });

  it("an unanswered question is seen, not missed: it neither marks nor clears", () => {
    expect(missedOf(quiz, history(attempt(["q1", "unanswered"]))).questions).toEqual([]);
    expect(missedOf(quiz, history(attempt(["q1", "incorrect"]), attempt(["q1", "unanswered"]))).questions).toEqual([
      "q1",
    ]);
  });

  it("skips an essay or code answer with no grade, and misses one graded below full marks", () => {
    // `pending`: no grade yet; `ungraded`: not scored at all
    expect(
      missedOf(quiz, history(attempt(["q1", "pending"], ["q2", "ungraded"], ["q3", "partial", "h3", "b"]))).questions,
    ).toEqual(["q3"]);
  });

  it("an attempt that could not be graded counts for nothing", () => {
    const h = { attempts: [{ report: null }, attempt(["q1", "incorrect"])] } as unknown as QuizHistory;
    expect(missedOf(quiz, h).questions).toEqual(["q1"]);
  });

  it("marks a question changed when its hash now is not the one it was missed on, and counts the removed as gone", () => {
    const h = history(attempt(["q1", "incorrect", "old"], ["q2", "incorrect"], ["gone", "incorrect", "hx", "b"]));
    expect(missedOf(quiz, h)).toEqual({ questions: ["q1", "q2"], changed: ["q1"], gone: 1, attempts: 1 });
    expect(missedOf(quiz, h, "b")).toEqual({ questions: [], changed: [], gone: 1, attempts: 1 });
    expect(missedOf(quiz, h, "a").gone).toBe(0);
  });

  it("the hash that counts is the one at the latest miss", () => {
    const h = history(attempt(["q1", "incorrect", "v1"]), attempt(["q1", "incorrect", "h1"]));
    expect(missedOf(quiz, h).changed).toEqual([]);
  });

  it("reads the attempts of a quiz with no attempt as nothing missed", async () => {
    const t = await study();
    const other = readHistory(t.lib, { ...t.quiz, id: "calculus-limits", name: "limits-and-continuity" });
    expect(missedOf(t.current, other).questions).toEqual([]);
  });
});
