import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Attempt, answerProblem, attemptOf, parseResults } from "../core/attempt";
import type { Quiz } from "../core/ir";
import type { Io } from "./ids";
import { readFailure } from "./paths";

/** Why a results file cannot be graded: its problems, or the failure to read it. */
export type AttemptProblem =
  | { status: "problems"; file: string; message: string; problems: string[] }
  | { status: "error"; file: string; message: string };

/** The results file read, checked against the quiz and its version, and its answers against their questions. */
export function readAttempt(
  results: string,
  quiz: Quiz,
  quizHash: string,
  quizFile: string,
  io: Io,
): { status: "ok"; read: Extract<ReturnType<typeof parseResults>, { ok: true }>; attempt: Attempt } | AttemptProblem {
  let text: string;
  try {
    text = readFileSync(resolve(io.cwd, results)).toString("utf8");
  } catch (error) {
    return { status: "error", file: results, message: `cannot read the file: ${readFailure(error)}` };
  }
  const read = parseResults(text);
  if (!read.ok) return { status: "problems", file: results, message: read.message, problems: [read.message] };
  const attempt = attemptOf(read.results);
  if (attempt.quizHash !== quizHash) {
    const message = `hash mismatch: the attempt was taken on quiz ${attempt.quizHash}, but ${quizFile} is ${quizHash}`;
    return { status: "problems", file: results, message, problems: [message] };
  }
  const shape: string[] = [];
  const byId = new Map<string, Quiz["sections"][number]["questions"][number]>();
  for (const s of quiz.sections) for (const q of s.questions) byId.set(q.id, q);
  for (const id of attempt.plan.questions) {
    const q = byId.get(id);
    const problem = q ? answerProblem(q.type, attempt.state.answers[id]) : null;
    if (problem) shape.push(`${id}: ${problem}`);
  }
  if (shape.length > 0) {
    return { status: "problems", file: results, message: "answers that do not fit their questions", problems: shape };
  }
  return { status: "ok", read, attempt };
}
