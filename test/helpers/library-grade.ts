import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LibraryGradeIo, type LibraryGradeOptions, runLibraryGrade } from "../../src/cli/library-grade";
import { readIndex } from "../../src/library/index-file";
import { realLockEnv } from "../../src/library/lock";
import { git } from "./library";
import { newLibrary } from "./library-register";

/** A quiz with one single-choice question and one essay with an additive rubric (two criteria of 2 points). */
export const WRITING = `---
title: Writing
id: writing
---

## Which is right? {type=single id=q1}

- [x] This one
- [ ] That one

## Describe it. {type=essay id=desc points=4}

\`\`\`answer
rubric:
  mode: additive
  step: 0.5
  criteria:
    - id: a
      text: Part A
      points: 2
    - id: b
      text: Part B
      points: 2
\`\`\`
`;

/** The clock of every grade: local time, so that the stamp does not depend on the machine's zone */
export const GRADE_CLOCK = new Date(2026, 10, 18, 15, 2, 12);
export const GRADE_STAMP = "20261118-150212";

export const gradeOptions = (extra: Partial<LibraryGradeOptions> = {}): LibraryGradeOptions => ({
  attempt: null,
  grades: null,
  web: false,
  name: null,
  timeout: null,
  port: null,
  open: false,
  json: false,
  plain: true,
  version: "1.0.0-test",
  ...extra,
});

export type T = Awaited<ReturnType<typeof newLibrary>>;

export const quizOf = (t: T, name: string) => {
  const read = readIndex(readFileSync(join(t.lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  const found = read.index.quizzes.find((q) => q.name === name);
  if (!found) throw new Error(`no quiz ${name}`);
  return found;
};

/** A library holding `writing` (version 1), and no attempt yet. */
export async function writingLibrary(text = WRITING): Promise<T> {
  const t = await newLibrary();
  t.write({ "notes/writing.md": text });
  await t.register(["notes/writing.md"]);
  return t;
}

/** Files an attempt as `take` would: `results/<stamp>.json` for a version, with an essay answer or none. */
export async function fileAttempt(
  t: T,
  stamp: string,
  hash: string,
  essay: string | null,
  ids = ["q1", "desc"],
): Promise<void> {
  const dir = join(t.lib, "quizzes", "writing", "results");
  mkdirSync(dir, { recursive: true });
  const answers: Record<string, unknown> = { q1: { choice: 0 } };
  if (essay !== null) answers.desc = { text: essay };
  else answers.desc = null;
  const results = {
    format: "fullmark-results",
    version: 2,
    quizHash: hash,
    plan: { source: "full", questions: ids },
    state: {
      answers,
      startedAt: "2026-11-15T09:00:00",
      submittedAt: "2026-11-15T09:30:12",
      timeUsed: 1800,
      sectionTime: {},
      flagged: [],
      checked: [],
      timedOut: false,
    },
    phase: "submitted",
  };
  writeFileSync(join(dir, `${stamp}.json`), `${JSON.stringify(results, null, 2)}\n`);
  await git(t.lib, t.env, "add", "-A");
  await git(t.lib, t.env, "commit", "-q", "-m", `fullmark: take writing (${stamp})`);
}

export type Grader = { kind: "ai" | "human"; name: string; model?: string; at?: string };

/** The empty grades template of an attempt, filled: `a` and `b` are the two criteria's scores. */
export function filledGrades(
  // biome-ignore lint/suspicious/noExplicitAny: a template walked loosely
  template: Record<string, any>,
  grader: Grader,
  scores: { a: number; b: number },
  words = "Fine.",
): string {
  const copy = JSON.parse(JSON.stringify(template));
  copy.grader = grader;
  const entry = copy.grades.desc;
  entry.criteria.a.score = scores.a;
  entry.criteria.a.note = "Noted.";
  entry.criteria.b.score = scores.b;
  entry.criteria.b.note = "Noted.";
  entry.justification = words;
  entry.improvement = "More.";
  return `${JSON.stringify(copy, null, 2)}\n`;
}

/** `library grade` in-process, with the fixed clock and a lock that never waits. */
export async function grade(
  t: T,
  name: string,
  extra: Partial<LibraryGradeOptions> = {},
  io: Partial<LibraryGradeIo> = {},
) {
  const c = t.at();
  const full: LibraryGradeIo = {
    ...c.io,
    now: () => GRADE_CLOCK,
    lock: { ...realLockEnv(), waitMs: 0 },
    ...io,
  };
  const exit = await runLibraryGrade(name, gradeOptions(extra), full);
  return { exit, out: c.out, err: c.err };
}

export const names = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
