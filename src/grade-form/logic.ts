import { bandPoints, isMultiple, meanBand, overallBand, sumMarks } from "../core/rubric/arith";
import type { GradeGiven, GradeItem } from "./data";

/** What the grader typed for one question: the raw text of each value (so a half-typed number is kept), and the texts. */
export type Fill = {
  /** additive and banded: by criterion id */
  cells: Record<string, { raw: string; note: string }>;
  /** holistic: the score */
  score: string;
  /** holistic: the optional verdict per bullet */
  verdicts: Record<string, "met" | "partly" | "missed" | null>;
  why: string;
  improve: string;
};

export const emptyFill = (item: GradeItem): Fill => ({
  cells: Object.fromEntries(item.criteria.map((c) => [c.id, { raw: "", note: "" }])),
  score: "",
  verdicts: Object.fromEntries(item.criteria.map((c) => [c.id, null])),
  why: "",
  improve: "",
});

/** A number as typed (a decimal comma too); null when it is not one. */
export function parseValue(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The values a control accepts: from `min` to `max` on `step` (null: any value in the range). */
export type Spec = { min: number; max: number; step: number | null };

/** The spec of a criterion's control, or (no id) of the holistic score. */
export function specOf(item: GradeItem, id?: string): Spec {
  if (item.mode === "banded" && item.scale) return { min: item.scale.min, max: item.scale.max, step: item.scale.step };
  if (item.mode === "additive") {
    const c = item.criteria.find((x) => x.id === id);
    return { min: 0, max: c?.max ?? 0, step: item.step };
  }
  return { min: 0, max: item.points, step: item.step ?? null };
}

/** Whether `n` is a value `spec` accepts. */
export const accepts = (spec: Spec, n: number): boolean =>
  n >= spec.min && n <= spec.max && (spec.step === null || isMultiple(n, spec.step, spec.min));

/** The number a raw text stands for, when the control accepts it. */
export function acceptedValue(spec: Spec, raw: string): number | null {
  const n = parseValue(raw);
  return n !== null && accepts(spec, n) ? n : null;
}

/** `+` or `−` pressed: from empty, + gives the maximum and − the first step below it; a band starts at the middle. */
export function pressed(spec: Spec, current: number | null, dir: 1 | -1, banded: boolean): number | null {
  const step = spec.step ?? 0.5;
  if (current === null) {
    if (banded) return Math.round((spec.min + spec.max) / 2 / step) * step;
    return dir === 1 ? spec.max : Math.max(spec.min, spec.max - step);
  }
  const next = Math.round((current + dir * step) * 1e6) / 1e6;
  return next < spec.min || next > spec.max ? null : next;
}

export type Condition = "none" | "half" | "note" | "done";

export type Evaluated = {
  condition: Condition;
  /** how many of the components are given, of how many */
  given: number;
  of: number;
  /** the problems that hold Finish: `half`, `note` (a lost mark without a note) and `why` (a score without a reason) */
  problems: ("half" | "note" | "why")[];
  /** the total once every component is given */
  total: { earned: number; band: number | null; mean: number | null } | null;
};

const blank = (s: string): boolean => s.trim() === "";

/** Where a question stands, by the rules the validator applies (TECHNICAL_DESIGN.md, section 6). */
export function evaluate(item: GradeItem, fill: Fill): Evaluated {
  if (item.mode === "holistic") {
    const spec = specOf(item);
    const score = acceptedValue(spec, fill.score);
    const anyVerdict = Object.values(fill.verdicts).some((v) => v !== null);
    if (blank(fill.score) && !anyVerdict) {
      return { condition: "none", given: 0, of: 1, problems: [], total: null };
    }
    if (score === null) return { condition: "half", given: 0, of: 1, problems: ["half"], total: null };
    const why = blank(fill.why);
    return {
      condition: why ? "note" : "done",
      given: 1,
      of: 1,
      problems: why ? ["why"] : [],
      total: { earned: score, band: null, mean: null },
    };
  }
  const values = item.criteria.map((c) => {
    const cell = fill.cells[c.id] ?? { raw: "", note: "" };
    return { c, cell, n: acceptedValue(specOf(item, c.id), cell.raw) };
  });
  const given = values.filter((v) => v.n !== null).length;
  const anyTyped = values.some((v) => !blank(v.cell.raw));
  const of = values.length;
  if (!anyTyped) return { condition: "none", given: 0, of, problems: [], total: null };
  if (given < of) return { condition: "half", given, of, problems: ["half"], total: null };
  const lost = values.some(
    (v) =>
      v.n !== null && v.n < (item.mode === "banded" ? (item.scale?.max ?? 0) : (v.c.max ?? 0)) && blank(v.cell.note),
  );
  const nums = values.map((v) => v.n as number);
  let total: Evaluated["total"];
  if (item.mode === "banded" && item.scale && item.round) {
    const weights = item.criteria.map((c) => c.weight ?? 1);
    const band = overallBand(nums, weights, item.scale, item.round);
    total = {
      earned: bandPoints(item.points, band, item.scale.max),
      band,
      mean: meanBand(nums, weights),
    };
  } else total = { earned: sumMarks(nums), band: null, mean: null };
  return { condition: lost ? "note" : "done", given, of, problems: lost ? ["note"] : [], total };
}

const text = (s: string): string | null => (blank(s) ? null : s.trim());

/** The question's entry of the grades document: the template's, with the grader's cells filled in. */
export function entryOf(item: GradeItem, fill: Fill): Record<string, unknown> {
  const entry = JSON.parse(JSON.stringify(item.entry)) as Record<string, unknown>;
  if (item.mode === "holistic") {
    entry.score = acceptedValue(specOf(item), fill.score);
    const bullets = entry.bullets as Record<string, Record<string, unknown>>;
    for (const c of item.criteria) (bullets[c.id] as Record<string, unknown>).verdict = fill.verdicts[c.id] ?? null;
  } else {
    const cells = entry.criteria as Record<string, Record<string, unknown>>;
    for (const c of item.criteria) {
      const cell = fill.cells[c.id] ?? { raw: "", note: "" };
      const target = cells[c.id] as Record<string, unknown>;
      target[item.mode === "banded" ? "band" : "score"] = acceptedValue(specOf(item, c.id), cell.raw);
      target.note = text(cell.note);
    }
  }
  entry.justification = text(fill.why);
  entry.improvement = text(fill.improve);
  return entry;
}

// -- `--grades`: what the file gave, and how far the grader has moved from it (G75) ---------------------------------

/** The fill that is exactly what the file gave (`fmt` writes a number as the form's language does). */
export function givenFill(item: GradeItem, given: GradeGiven, fmt: (n: number) => string): Fill {
  const shown = (v: number | null): string => (v === null ? "" : fmt(v));
  return {
    cells: Object.fromEntries(
      item.criteria.map((c) => [
        c.id,
        { raw: shown(given.cells[c.id]?.value ?? null), note: given.cells[c.id]?.note ?? "" },
      ]),
    ),
    score: shown(given.score),
    verdicts: Object.fromEntries(item.criteria.map((c) => [c.id, given.verdicts[c.id] ?? null])),
    why: given.why ?? "",
    improve: given.improve ?? "",
  };
}

/** The number a raw text stands for, or null when it is empty; `undefined` when it is not a value the control takes. */
const givenValue = (spec: Spec, raw: string): number | null | undefined =>
  raw.trim() === "" ? null : (acceptedValue(spec, raw) ?? undefined);

const sameText = (a: string, b: string): boolean => a.trim() === b.trim();

/** Whether a criterion's score (or band) and note are as given. */
export function sameCell(item: GradeItem, crit: string, fill: Fill, base: Fill): boolean {
  const spec = specOf(item, crit);
  const a = fill.cells[crit] ?? { raw: "", note: "" };
  const b = base.cells[crit] ?? { raw: "", note: "" };
  return givenValue(spec, a.raw) === givenValue(spec, b.raw) && sameText(a.note, b.note);
}

/** Whether the holistic score is as given. */
export const sameScore = (item: GradeItem, fill: Fill, base: Fill): boolean =>
  givenValue(specOf(item), fill.score) === givenValue(specOf(item), base.score);

export const sameVerdict = (crit: string, fill: Fill, base: Fill): boolean =>
  (fill.verdicts[crit] ?? null) === (base.verdicts[crit] ?? null);

export const sameWhy = (fill: Fill, base: Fill): boolean => sameText(fill.why, base.why);
export const sameImprove = (fill: Fill, base: Fill): boolean => sameText(fill.improve, base.improve);

/** Whether every value, verdict, note and text of the question is as given. */
export function sameFill(item: GradeItem, fill: Fill, base: Fill): boolean {
  if (item.mode === "holistic") {
    if (!sameScore(item, fill, base)) return false;
    if (!item.criteria.every((c) => sameVerdict(c.id, fill, base))) return false;
  } else if (!item.criteria.every((c) => sameCell(item, c.id, fill, base))) return false;
  return sameWhy(fill, base) && sameImprove(fill, base);
}
