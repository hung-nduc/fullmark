import type { RoundRule } from "../core/rubric/arith";
import type { PageData } from "../page/data";

/** The kinds of question fullmark marks, as the sidebar's "Scored by fullmark" row names them (G98). */
export type AutoKind = "choice" | "fillin" | "numeric" | "ordering" | "matching" | "scale";

/** One criterion (or, for a holistic rubric, one bullet) as the form draws it. */
export type GradeCriterion = {
  id: string;
  /** the text as HTML (maths included) */
  html: string;
  /** additive: the maximum; else null */
  max: number | null;
  /** banded: the weight; else null */
  weight: number | null;
};

/** A grader as the grades file names one (`kind`, `name`, `model` for an AI, `at` as the file had it). */
export type GradeGrader = { kind: "ai" | "human"; name: string; model?: string; at?: string };

/**
 * What `--grades` gave one question (G75): every value, note and text of its entry, and the grader it is from (its own
 * `grader`, else the file's: G102). Only a question the file grades has one; a question it leaves `null` has none.
 */
export type GradeGiven = {
  grader: GradeGrader;
  /** a holistic rubric's score; else null */
  score: number | null;
  /** additive: the score; banded: the band; by criterion id */
  cells: Record<string, { value: number | null; note: string | null }>;
  /** holistic: the verdict of each bullet */
  verdicts: Record<string, "met" | "partly" | "missed" | null>;
  why: string | null;
  improve: string | null;
};

/** An essay or code question of the attempt, with its rubric. */
export type GradeItem = {
  id: string;
  /** the question's place in the attempt's plan, from 1: "Question 21" */
  number: number;
  type: "essay" | "code";
  points: number;
  promptHtml: string;
  /** the learner's answer as typed; null when there is none (an unanswered question) */
  answer: string | null;
  /** an essay's words, a code answer's lines; null with no answer */
  count: number | null;
  language: string | null;
  sampleHtml: string | null;
  mode: "additive" | "banded" | "holistic";
  /** additive and holistic: the rubric's step, null when it has none */
  step: number | null;
  /** banded: the scale and the rule that rounds the mean; else null */
  scale: { min: number; max: number; step: number } | null;
  round: RoundRule | null;
  criteria: GradeCriterion[];
  /** the question's entry in the grades template, as `quiz grade --json` writes it: the form fills its cells */
  entry: Record<string, unknown>;
  /** `--grades`: what the file gave this question, pre-filled in the form; null without `--grades` or when it left it `null` */
  given: GradeGiven | null;
};

/**
 * What `quiz grade --web` hands to the form (`src/build/grade-form.ts` writes it into the page as JSON): the quiz's
 * look, the questions to grade (answered essays and code, in the template's order), the ones left blank (read-only),
 * and the sums the running total needs. The page does no grading arithmetic of its own beyond the sums the core would
 * make: the server checks every submit with the grades validator.
 */
export type GradeData = {
  version: 1;
  page: Pick<PageData, "theme" | "look" | "font" | "fonts">;
  quizId: string;
  quizHash: string;
  title: string;
  uiLang: "en" | "vi";
  /** the attempt's date (submitted, else started), as the results file writes it; null when it has none */
  attemptAt: string | null;
  /** `--name`; null: the Finish dialog asks */
  name: string | null;
  /** the questions to grade, in the template's order */
  items: GradeItem[];
  /** essays and code left blank: nothing to grade, 0 of their points */
  unanswered: GradeItem[];
  /** the questions fullmark marks (all the rest): how many, what they scored, and the kinds they are (in the order `gradeDataOf` lists them) */
  auto: { count: number; earned: number; points: number; kinds: AutoKind[] };
  /** the points the score counts before any grade: fullmark's marks and the unanswered, scored */
  base: { earned: number; points: number };
  /** the two files written, as the saved card names them */
  files: { grades: string; report: string };
};
