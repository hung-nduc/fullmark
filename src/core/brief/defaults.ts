import type { PURPOSES } from "../ir";
import type { Question, QuestionFile, QuestionValue } from "./questions";

/**
 * The pure functions of the brief question file, apart from its schema: the form in the browser reads them, and must not
 * carry zod or the YAML parser with them (`questions.ts` does, and re-exports these for the CLI).
 */

export type Lang = "en" | "vi";

export function questionOf(file: QuestionFile, key: string): Question {
  const q = file.questions.find((x) => x.key === key);
  if (!q) throw new Error(`the brief question file has no question ${key}`);
  return q;
}

/**
 * The value of a question when nothing is given: for a multi, the choices marked for the purpose; for a text with
 * `default-by-purpose`, the purpose's value; else the question's `default`. `overrides` are the machine config's
 * `[brief.purpose.<purpose>]` table, which replace the defaults of a purpose.
 */
export function defaultOf(
  q: Question,
  purpose: (typeof PURPOSES)[number],
  overrides: Readonly<Record<string, QuestionValue>> = {},
): QuestionValue {
  const own = overrides[q.key];
  if (own !== undefined) return own;
  if (q.kind === "multi" && q.choices?.some((c) => c["default-for"] !== undefined))
    return q.choices.filter((c) => c["default-for"]?.includes(purpose)).map((c) => c.value);
  const byPurpose = q["default-by-purpose"]?.[purpose];
  if (byPurpose !== undefined) return byPurpose;
  if (q.default !== undefined) return q.default;
  return q.kind === "multi" ? [] : q.kind === "number" ? 0 : "";
}

/** The words of a text answer, as a detail rule counts them. */
export const wordCount = (text: string): number => text.split(/\s+/).filter((w) => w !== "").length;

/** A number answer checked against its question: the value, or what is wrong with it (`must be ..., not "x"`). */
export function parseNumber(q: Question, given: string, whole: boolean): { value: number } | { problem: string } {
  const min = q.min ?? 0;
  const range = q.max === undefined ? `${min} or more` : `from ${min} to ${q.max}`;
  const text = given.trim();
  const n = Number(text);
  if (
    !(whole ? /^\d+$/ : /^\d+(\.\d+)?$/).test(text) ||
    !Number.isFinite(n) ||
    n < min ||
    (q.max !== undefined && n > q.max)
  )
    return { problem: `must be ${whole ? "a whole number" : "a number"}, ${range}, not "${given}"` };
  return { value: n };
}
