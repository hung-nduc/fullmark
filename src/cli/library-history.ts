import { readdirSync, readFileSync } from "node:fs";
import { answerProblem, attemptOf, parseResults } from "../core/attempt";
import { en } from "../core/i18n";
import type { Quiz } from "../core/ir";
import { buildReport, REPORT_FORMAT, REPORT_VERSION, type Report } from "../core/report";
import { type StatsInput, summarise as summariseStats } from "../core/stats";
import type { IndexQuiz } from "../library/index-file";
import { libraryPaths } from "../library/layout";
import { loadStored } from "./library-common";

/**
 * What a quiz's attempts say (G6; COMMANDS.md, `library list` and `info`): the one place that reads `results/` and
 * `reports/` of a library quiz and works out the numbers, so that `list`, `info` and (in 4e) `stats` agree.
 *
 * An attempt's score is its newest report's when there is one, else the attempt graded on the spot against the version
 * it names, as `quiz stats` grades a results file; essays and code with no grade leave it pending.
 */
export type AttemptRecord = {
  /** the results file's name without `.json`: `20261118-142212` */
  stamp: string;
  /** the hash of the version the attempt was taken on */
  version: string;
  started: string | null;
  submitted: string | null;
  /** when it was taken: submitted, else started */
  when: string | null;
  /** percent of the graded points; null when it has none or could not be graded */
  percent: number | null;
  /** answered essays and code with no grade yet, by type */
  pending: { essay: number; code: number };
  /** the report the score comes from: filed, or made on the spot; null when it could not be graded */
  report: Report | null;
};

export type QuizHistory = {
  /** oldest first (the stamps sort by time) */
  attempts: AttemptRecord[];
  last: AttemptRecord | null;
  /** the last attempt's percent, and the best one's */
  score: number | null;
  best: number | null;
  /** the date of the last and of the first attempt, ISO (`2026-11-17T20:14:12`) */
  taken: string | null;
  firstTaken: string | null;
  /** the three weakest tags over all attempts (`stats`'s Weakest), weakest first */
  weak: string[];
  /** the attempts with essays or code not yet graded */
  ungraded: AttemptRecord[];
};

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

const jsonFiles = (dir: string): string[] => {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
};

/** A filed report, when it has the parts the numbers need. */
function readReport(path: string): Report | null {
  try {
    const json: unknown = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
    if (!isObject(json) || json.format !== REPORT_FORMAT || json.version !== REPORT_VERSION) return null;
    if (!isObject(json.quiz) || !isObject(json.attempt) || !Array.isArray(json.questions) || !Array.isArray(json.open))
      return null;
    if (json.score !== null && !isObject(json.score)) return null;
    return json as unknown as Report;
  } catch {
    return null;
  }
}

/** An attempt graded on the spot against the version it names, as `quiz stats` grades a results file. */
function gradeOnTheSpot(text: string, quiz: Quiz, hash: string): Report | null {
  const read = parseResults(text);
  if (!read.ok) return null;
  const attempt = attemptOf(read.results);
  if (attempt.quizHash !== hash) return null;
  const byId = new Map<string, Quiz["sections"][number]["questions"][number]>();
  for (const s of quiz.sections) for (const q of s.questions) byId.set(q.id, q);
  for (const id of attempt.plan.questions) {
    const q = byId.get(id);
    if (q && answerProblem(q.type, attempt.state.answers[id])) return null;
  }
  return buildReport({ quiz, quizHash: hash, attempt }, en.report);
}

/** Reads every attempt of one library quiz, with its score and what is still waiting for a grader. */
export function readHistory(root: string, quiz: IndexQuiz): QuizHistory {
  const q = libraryPaths(root).quiz(quiz.id);
  const stored = new Map<string, Quiz | null>();
  const quizAt = (hash: string): Quiz | null => {
    if (!stored.has(hash)) stored.set(hash, loadStored(root, quiz, hash)?.quiz ?? null);
    return stored.get(hash) ?? null;
  };
  const attempts: AttemptRecord[] = [];
  for (const name of jsonFiles(q.results)) {
    const stamp = name.slice(0, -".json".length);
    let text: string;
    try {
      text = readFileSync(`${q.results}/${name}`, "utf8");
    } catch {
      continue;
    }
    const read = parseResults(text);
    if (!read.ok) continue;
    const { quizHash, state } = read.results;
    let report = readReport(q.reportJson(stamp));
    if (report === null) {
      const version = quizAt(quizHash);
      report = version === null ? null : gradeOnTheSpot(text, version, quizHash);
    }
    const open = report?.open.filter((o) => o.pending) ?? [];
    attempts.push({
      stamp,
      version: quizHash,
      started: state.startedAt,
      submitted: state.submittedAt,
      when: state.submittedAt ?? state.startedAt,
      percent: report?.score?.percent ?? null,
      pending: {
        essay: open.filter((o) => o.type === "essay").length,
        code: open.filter((o) => o.type === "code").length,
      },
      report,
    });
  }
  const last = attempts.at(-1) ?? null;
  const percents = attempts.flatMap((a) => (a.percent === null ? [] : [a.percent]));
  const inputs: StatsInput[] = attempts.flatMap((a) =>
    a.report === null ? [] : [{ file: a.stamp, report: a.report }],
  );
  return {
    attempts,
    last,
    score: last?.percent ?? null,
    best: percents.length > 0 ? Math.max(...percents) : null,
    taken: last?.when ?? null,
    firstTaken: attempts[0]?.when ?? null,
    weak: inputs.length > 0 ? summariseStats(inputs).weakest : [],
    ungraded: attempts.filter((a) => a.pending.essay + a.pending.code > 0),
  };
}
