import { existsSync, readFileSync } from "node:fs";
import { summarise } from "../core/inspect";
import type { Quiz } from "../core/ir";
import { readReview } from "../core/review/read";
import { reviewFindings } from "../core/rules/review";
import { CHECK_FILE, readCheck } from "../library/check-file";
import { type IndexQuiz, shelfNames } from "../library/index-file";
import { libraryPaths } from "../library/layout";
import { loadStored } from "./library-common";
import { type QuizHistory, readHistory } from "./library-history";
import { loadQuiz } from "./load";
import { resolveSource } from "./source-path";

/** One row of `quiz library list --json`: every field always present (COMMANDS.md). */
export type ListRow = {
  name: string;
  id: string;
  title: string;
  kind: string;
  lang: string;
  profile: string;
  tags: string[];
  types: string[];
  shelves: string[];
  questions: number;
  points: number;
  versions: number;
  attempts: number;
  score: number | null;
  best: number | null;
  weak: string[];
  added: string;
  updated: string;
  taken: string | null;
  changed: boolean;
  ungraded: boolean;
  flagged: number;
};

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The date part of an ISO time, as it was written: `2026-11-17`. */
export const isoDate = (iso: string): string => iso.slice(0, 10);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `17 Nov`, with the year when it is not this year (COMMANDS.md, `library list`). */
export function shortDay(iso: string, now: Date): string {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) return iso;
  return `${Number(m[3])} ${month}${Number(m[1]) === now.getFullYear() ? "" : ` ${m[1]}`}`;
}

/** What `library list` and `info` know of the current (or a chosen) version's content. */
export type VersionContent = {
  loaded: NonNullable<ReturnType<typeof loadStored>> | null;
  quiz: Quiz | null;
  profile: string;
};

export function contentOf(root: string, quiz: IndexQuiz, hash: string): VersionContent {
  const loaded = loadStored(root, quiz, hash);
  let profile = loaded?.frontMatter.profile ?? "";
  const file = `${libraryPaths(root).quiz(quiz.id).version(hash)}/${CHECK_FILE}`;
  try {
    const read = readCheck(readFileSync(file, "utf8"));
    if (read.ok) profile = read.profile.name;
  } catch {
    // no check.json: the profile the quiz names
  }
  return { loaded, quiz: loaded?.quiz ?? null, profile };
}

/** The open `review.fix` and `review.drop` findings of the quiz's `review.json` against a version; 0 without one. */
export function flaggedOf(root: string, quiz: IndexQuiz, version: Quiz | null): number {
  const file = libraryPaths(root).quiz(quiz.id).review;
  if (version === null || !existsSync(file)) return 0;
  try {
    const read = readReview(readFileSync(file, "utf8"));
    if (!read.ok) return 0;
    const found = reviewFindings(version, read.review);
    return found.fix.length + found.drop.length;
  } catch {
    return 0;
  }
}

/** Whether the file the quiz was registered from still exists, and whether it differs from the current version. */
export function sourceOf(root: string, quiz: IndexQuiz): { exists: boolean; changed: boolean } {
  const file = resolveSource(quiz.source, root);
  if (file === null || !existsSync(file)) return { exists: false, changed: false };
  try {
    return { exists: true, changed: loadQuiz(file).hash !== quiz.current };
  } catch {
    return { exists: false, changed: false };
  }
}

/** The row of a quiz. `at` is the version the content fields describe (the current one by default). */
export function listRow(
  root: string,
  quiz: IndexQuiz,
  history: QuizHistory = readHistory(root, quiz),
  at: string = quiz.current,
): ListRow {
  const current = quiz.versions.find((v) => v.hash === quiz.current);
  const content = contentOf(root, quiz, at);
  const summary = content.quiz === null ? null : summarise(content.quiz, at);
  const currentQuiz = at === quiz.current ? content.quiz : (loadStored(root, quiz, quiz.current)?.quiz ?? null);
  return {
    name: quiz.name,
    id: quiz.id,
    title: quiz.title,
    kind: content.loaded?.frontMatter.kind ?? "",
    lang: content.loaded?.frontMatter.lang ?? "",
    profile: content.profile,
    tags: [...new Set((summary?.tags ?? []).flatMap((t) => (t.tag === null ? [] : [t.tag])))].sort(compare),
    types: (summary?.types ?? []).map((t) => t.type).sort(compare),
    shelves: shelfNames(quiz),
    questions: summary?.questions ?? 0,
    points: summary?.points ?? 0,
    versions: quiz.versions.length,
    attempts: history.attempts.length,
    score: history.score,
    best: history.best,
    weak: history.weak,
    added: isoDate(quiz.versions[0]?.added ?? ""),
    updated: isoDate(current?.added ?? ""),
    taken: history.taken === null ? null : isoDate(history.taken),
    changed: sourceOf(root, quiz).changed,
    ungraded: history.ungraded.length > 0,
    flagged: flaggedOf(root, quiz, currentQuiz),
  };
}

/** `80%`: a percent as the list shows it; `–` when there is none. */
export const percentText = (percent: number | null): string => (percent === null ? "–" : `${Math.round(percent)}%`);
