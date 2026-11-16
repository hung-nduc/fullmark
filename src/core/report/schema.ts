import { z } from "zod";
import { PHASES, PLAN_SOURCES } from "../attempt/schema";
import type { QuestionStatus } from "../grade";
import { QUESTION_TYPES } from "../ir";
import { GraderSchema } from "../rubric/grades";
import { REPORT_FORMAT, REPORT_VERSION } from "./format";

/**
 * `fullmark-report` version 2 (TECHNICAL_DESIGN.md, section 6) as a zod schema: the source of the `Report` type and of
 * `schemas/report-v2.schema.json` (`npm run schemas`). Nothing reads a report through it: `quiz grade` writes the
 * object `buildReport` makes, and `stats` checks what it needs by hand. The rest of the code imports only its types, so
 * no command loads it.
 */

const STATUSES = [
  "correct",
  "partial",
  "incorrect",
  "unanswered",
  "pending",
  "ungraded",
] as const satisfies readonly QuestionStatus[];

const percent = z.number().nullable();

export const ReportScoreSchema = z.object({
  earned: z.number(),
  points: z.number(),
  /** earned over points, to two decimals; null when there are no points */
  percent,
  /** the points of the questions still waiting for a grade */
  pending: z.number(),
  pass: z.object({ mark: z.number().nullable(), passed: z.boolean().nullable() }),
});

/** A section or a tag, tallied. */
export const ReportGroupSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  earned: z.number(),
  points: z.number(),
  percent,
  pending: z.number(),
  questions: z.number().int().min(0),
});

export const ReportQuestionSchema = z.object({
  id: z.string(),
  /** the question hash: the version of this question, which `stats` compares across versions (foundation 1) */
  hash: z.string(),
  section: z.string(),
  type: z.enum(QUESTION_TYPES),
  tags: z.array(z.string()),
  points: z.number(),
  earned: z.number().nullable(),
  status: z.enum(STATUSES),
  prompt: z.string(),
  /** the learner's answer as text; null when there is none */
  answer: z.string().nullable(),
  /** the right answer as text; null for essays, code, scales and ungraded questions */
  key: z.string().nullable(),
  explanation: z.string().nullable(),
  words: z.number().int().min(0).nullable(),
});

const criterion = { id: z.string(), text: z.string() };

/** A rubric as grading sees it: the mode settled, a preset expanded, defaults applied. */
export const ResolvedRubricSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("holistic"),
    /** declared `step`, or null: then any score from 0 to the points will do */
    step: z.number().nullable(),
    criteria: z.array(z.object(criterion)),
  }),
  z.object({
    mode: z.literal("additive"),
    step: z.number(),
    criteria: z.array(z.object({ ...criterion, max: z.number() })),
  }),
  z.object({
    mode: z.literal("banded"),
    scale: z.object({ min: z.number(), max: z.number(), step: z.number() }),
    round: z.enum(["nearest-step", "down", "ielts"]),
    preset: z.string().nullable(),
    criteria: z.array(z.object({ ...criterion, weight: z.number() })),
  }),
]);

export const CriterionResultSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** additive: the score; banded and holistic: null */
  earned: z.number().nullable(),
  max: z.number().nullable(),
  weight: z.number().nullable(),
  band: z.number().nullable(),
  note: z.string().nullable(),
  verdict: z.enum(["met", "partly", "missed"]).nullable(),
});

/** The grade applied to an open question. */
export const ReportGradeSchema = z.object({
  id: z.string(),
  mode: z.enum(["holistic", "additive", "banded"]),
  points: z.number(),
  earned: z.number(),
  /** the overall band of a banded rubric */
  band: z.number().nullable(),
  graded_by: GraderSchema,
  /** `grade --web --grades`: the grader the question was pre-filled from (G107) */
  reviewed: GraderSchema.optional(),
  /** false when the entry was written against a rubric that has changed since */
  rubric_current: z.boolean(),
  criteria: z.array(CriterionResultSchema),
  justification: z.string().nullable(),
  improvement: z.string().nullable(),
  status: z.enum(STATUSES),
});

/** An answered essay or code question, laid out for a grader. */
export const ReportOpenSchema = z.object({
  id: z.string(),
  type: z.enum(["essay", "code"]),
  points: z.number(),
  prompt: z.string(),
  answer: z.string(),
  words: z.number().int().min(0).nullable(),
  language: z.string().nullable(),
  rubric: ResolvedRubricSchema,
  sample_answer: z.string().nullable(),
  /** true while no grade has been applied */
  pending: z.boolean(),
  grade: ReportGradeSchema.nullable(),
});

export const ReportSchema = z.object({
  format: z.literal(REPORT_FORMAT),
  version: z.literal(REPORT_VERSION),
  quiz: z.object({
    title: z.string(),
    id: z.string(),
    hash: z.string(),
    kind: z.enum(["quiz", "survey"]),
    lang: z.enum(["en", "vi"]),
  }),
  attempt: z.object({
    phase: z.enum(PHASES),
    source: z.enum(PLAN_SOURCES),
    questions: z.number().int().min(0),
    started: z.string().nullable(),
    submitted: z.string().nullable(),
    time_used: z.number().min(0),
    timed_out: z.boolean(),
  }),
  /** null for a survey: it has no score */
  score: ReportScoreSchema.nullable(),
  sections: z.array(ReportGroupSchema),
  tags: z.array(ReportGroupSchema),
  questions: z.array(ReportQuestionSchema),
  /** the ids of scored questions that are wrong or only partly right */
  wrong: z.array(z.string()),
  /** the answered essays and code, laid out for a grader */
  open: z.array(ReportOpenSchema),
  grades: z.object({ grader: GraderSchema.nullable(), warnings: z.array(z.string()) }).nullable(),
  unknown: z.array(z.string()),
});

export type ReportGroup = z.infer<typeof ReportGroupSchema>;
export type ReportQuestion = z.infer<typeof ReportQuestionSchema>;
export type ReportOpen = z.infer<typeof ReportOpenSchema>;
export type Report = z.infer<typeof ReportSchema>;
