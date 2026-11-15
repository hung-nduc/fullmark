import { describe, expect, it } from "vitest";
import type { BriefData } from "../../src/brief-form/data";
import {
  blocking,
  changedKeys,
  countsOf,
  currentOf,
  defaultNow,
  givenOf,
  inChoiceOrder,
  isVague,
  markOf,
  modelOf,
  prefillOf,
  question,
  record,
  revert,
} from "../../src/brief-form/logic";
import { displayOf } from "../../src/brief-form/parts";
import { minutesIn } from "../../src/brief-form/state";
import { loadQuestions } from "../../src/cli/brief-questions";
import { briefEn } from "../../src/core/i18n/brief";

/**
 * The form's answers as `--tui` keeps them (src/cli/brief-tui.ts): one rule each for what is kept, what is a default
 * that follows the purpose, and what the form returns. No DOM: the form's state is these functions and signals.
 */
const questions = loadQuestions();
const model = (prefill: BriefData["prefill"] = {}, overrides: BriefData["overrides"] = {}) =>
  modelOf({ version: 1, lang: "en", questions, prefill, overrides } as BriefData);
const q = (key: string) => question(model(), key);
const SCOPE = "lectures 3 to 5, the Fourier transform";

describe("the form's answers", () => {
  it("starts with purpose and scope missing, and every other question at its default", () => {
    const m = model();
    expect(countsOf(m, {})).toEqual({ you: 0, prefilled: 0, default: 12, missing: 2, vague: false });
    expect(blocking(m, {}).map((b) => [b.key, b.why])).toEqual([
      ["purpose", "purpose"],
      ["scope", "scope"],
    ]);
    expect(markOf(m, {}, q("commitment"))).toBe("default");
    expect(currentOf(m, {}, q("commitment"))).toBe(0);
  });

  it("takes the defaults of Self-study until a purpose is picked, then those of the purpose, and follows it", () => {
    const m = model();
    expect(currentOf(m, {}, q("mix"))).toEqual(["recall", "understanding", "calculation"]);
    const exam = record(m, {}, q("purpose"), "exam-prep");
    expect(currentOf(m, exam, q("mix"))).toEqual(["understanding", "calculation", "essay"]);
    expect(currentOf(m, exam, q("profile"))).toBe("exam");
    expect(currentOf(m, record(m, {}, q("purpose"), "survey"), q("mix"))).toEqual([]);
  });

  it("takes the machine config's table for a purpose in place of its defaults", () => {
    const m = model({}, { "exam-prep": { count: 30, minutes: 90 } });
    const exam = record(m, {}, q("purpose"), "exam-prep");
    expect(currentOf(m, exam, q("count"))).toBe(30);
    expect(currentOf(m, exam, q("minutes"))).toBe(90);
    expect(currentOf(m, {}, q("count"))).toBe(20);
    expect(defaultNow(m, exam, q("count"))).toBe(30);
  });

  it("keeps a changed answer and drops one set back to its default, so that it follows the purpose again", () => {
    const m = model();
    let k = record(m, {}, q("purpose"), "exam-prep");
    k = record(m, k, q("count"), 25);
    expect(markOf(m, k, q("count"))).toBe("you");
    k = record(m, k, q("count"), 20);
    expect(k.count).toBeUndefined();
    expect(markOf(m, k, q("count"))).toBe("default");
    k = record(m, k, q("mix"), ["code"]);
    expect(markOf(m, k, q("mix"))).toBe("you");
    k = record(m, k, q("purpose"), "survey");
    expect(currentOf(m, k, q("mix"))).toEqual(["code"]);
    // the purpose and the scope are always the user's, even at their only value
    expect(record(m, {}, q("purpose"), "self-study").purpose).toBe("self-study");
  });

  it("a pre-filled answer is the user's when kept, even at its default, and is marked as pre-filled until changed", () => {
    const m = model({ purpose: "exam-prep", scope: SCOPE, count: 20 });
    const k = { ...m.pre };
    expect(markOf(m, k, q("count"))).toBe("prefilled");
    expect(givenOf(k)).toEqual({ purpose: "exam-prep", scope: SCOPE, count: 20 });
    const changed = record(m, k, q("count"), 20);
    expect(changed.count).toBe(20);
    const other = record(m, k, q("count"), 25);
    expect(markOf(m, other, q("count"))).toBe("you");
    expect(changedKeys(m, other)).toEqual(["count"]);
    // changed back by typing, it is the pre-filled answer again
    expect(markOf(m, record(m, other, q("count"), 20), q("count"))).toBe("prefilled");
  });

  it("goes back to the pre-filled answers one at a time or all at once, leaving the others as they are", () => {
    const m = model({ purpose: "exam-prep", scope: SCOPE, count: 25 });
    let k = { ...m.pre };
    k = record(m, k, q("count"), 30);
    k = record(m, k, q("scope"), "one two three four five");
    k = record(m, k, q("mode"), "timed-exam");
    expect(changedKeys(m, k).sort()).toEqual(["count", "scope"]);
    const one = revert(m, k, ["count"]);
    expect(one.count).toBe(25);
    expect(one.scope).toBe("one two three four five");
    const all = revert(m, k, Object.keys(m.pre));
    expect(changedKeys(m, all)).toEqual([]);
    expect(all.mode).toBe("timed-exam");
  });

  it("holds Finish for a scope under its minimum, and counts it as one question to answer", () => {
    const m = model();
    let k = record(m, {}, q("purpose"), "self-study");
    k = record(m, k, q("scope"), "signals");
    expect(isVague(m, k, q("scope"))).toBe(true);
    expect(blocking(m, k)).toEqual([{ key: "scope", why: "vague" }]);
    expect(countsOf(m, k).vague).toBe(true);
    k = record(m, k, q("scope"), SCOPE);
    expect(blocking(m, k)).toEqual([]);
  });

  it("returns what --tui returns: only the answers kept, a scope trimmed, weak topics as a boolean", () => {
    const m = model();
    let k = record(m, {}, q("purpose"), "classmates");
    k = record(m, k, q("scope"), `  ${SCOPE}  `);
    k = record(m, k, q("weak_topics"), "yes");
    k = record(m, k, q("content.kinds"), ["notes"]);
    expect(givenOf(k)).toEqual({
      purpose: "classmates",
      scope: SCOPE,
      weakTopics: true,
      kinds: ["notes"],
    });
    expect(prefillOf({ weakTopics: false, kinds: ["other"], kindsOther: "x" })).toEqual({
      weak_topics: "no",
      "content.kinds": ["other"],
      kinds_other: "x",
    });
  });

  it("orders a multi's values as its choices are, so one set is one answer", () => {
    expect(inChoiceOrder(q("mix"), ["essay", "recall", "code"])).toEqual(["recall", "code", "essay"]);
  });

  it("shows an answer as the sidebar and the summary do", () => {
    const m = model();
    const b = briefEn;
    const show = (key: string, k = {}) => displayOf({ lang: "en", profiles: [] } as never, b, m, k, q(key));
    expect(show("purpose")).toBe("Not answered");
    expect(show("count")).toBe("20 questions");
    expect(show("minutes")).toBe("No limit");
    expect(show("commitment")).toBe("No goal");
    expect(show("commitment", { commitment: 70 })).toBe("70%");
    expect(show("mix")).toBe("Recall, Understanding, Calculation");
    expect(show("content.kinds")).toBe("None");
    expect(show("content.kinds", { "content.kinds": ["notes", "other"], kinds_other: "a journal" })).toBe(
      "Notes, Other: a journal",
    );
  });

  it("counts the minutes left, rounded up, and a minute or less as none (G113)", () => {
    expect(minutesIn(1_800_000)).toBe(30);
    expect(minutesIn(1_740_001)).toBe(30);
    expect(minutesIn(1_740_000)).toBe(29);
    expect(minutesIn(90_000)).toBe(2);
    expect(minutesIn(60_000)).toBe(0);
    expect(minutesIn(0)).toBe(0);
  });
});
