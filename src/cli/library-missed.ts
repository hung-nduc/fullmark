import type { Quiz } from "../core/ir";
import type { IndexQuiz } from "../library/index-file";
import { type QuizHistory, readHistory } from "./library-history";

/**
 * Which questions `library take --missed` serves (TECHNICAL_DESIGN.md, section 10; step 4, G5), worked out without a
 * server so that the tests and the history goldens read the plan as it would be served.
 */
export type Missed = {
  /** the questions still in the current version that are missed, in its source order */
  questions: string[];
  /** of those, the ones whose text differs from the version they were missed on */
  changed: string[];
  /** the missed questions no longer in the current version (of the section, with `section`) */
  gone: number;
  /** the attempts looked at */
  attempts: number;
};

/** The last time a question was missed: its hash then, and the section it was in. */
type Seen = { hash: string; section: string };

/**
 * Over every attempt of the quiz, on every version, oldest first (each as `list` grades it: the newest report, else
 * graded on the spot against its version): a question (by id) is missed when its latest result is wrong or partly
 * right; a fully right answer later clears it; an unanswered question is seen, not missed, and changes nothing; an
 * essay or code answer with no grade yet is skipped, and one graded below full marks is missed.
 *
 * `current` is the current version's quiz; `section` (a section's id) keeps only the missed questions of that section.
 */
export function missedOf(current: Quiz, history: QuizHistory, section: string | null = null): Missed {
  const missed = new Map<string, Seen>();
  for (const attempt of history.attempts) {
    if (attempt.report === null) continue;
    for (const q of attempt.report.questions) {
      if (q.status === "correct") missed.delete(q.id);
      else if (q.status === "partial" || q.status === "incorrect")
        missed.set(q.id, { hash: q.hash, section: q.section });
      // unanswered, pending and ungraded: seen or skipped, never missed, and an earlier miss stands
    }
  }
  const questions: string[] = [];
  const changed: string[] = [];
  const present = new Set<string>();
  for (const s of current.sections) {
    for (const q of s.questions) {
      present.add(q.id);
      if (section !== null && s.id !== section) continue;
      const seen = missed.get(q.id);
      if (seen === undefined) continue;
      questions.push(q.id);
      if (seen.hash !== q.hash) changed.push(q.id);
    }
  }
  let gone = 0;
  for (const [id, seen] of missed) {
    if (present.has(id)) continue;
    if (section === null || seen.section === section) gone++;
  }
  return { questions, changed, gone, attempts: history.attempts.length };
}

/** The same for a library quiz, reading its attempts. */
export function missedFor(root: string, quiz: IndexQuiz, current: Quiz, section: string | null = null): Missed {
  return missedOf(current, readHistory(root, quiz), section);
}
