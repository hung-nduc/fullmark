import type { Quiz } from "../core/ir";
import { renderStats, type StatsInput, type StatsNames, summarise, titleOf } from "../core/stats";
import { EXIT, type ExitCode } from "./exit-codes";
import { findQuiz, type LibraryIo, libraryFail, loadStored, noSuchQuiz, openLibrary } from "./library-common";
import { readHistory } from "./library-history";
import { plural } from "./table";

export type LibraryStatsOptions = { json: boolean };

/** The names of the current version's questions and tags, as `quiz stats --quiz` takes them. */
function namesOf(quiz: Quiz): StatsNames {
  const questions = new Map<string, { title: string; tags: readonly string[] }>();
  for (const s of quiz.sections)
    for (const q of s.questions) questions.set(q.id, { title: titleOf(q.prompt), tags: q.tags });
  return { title: quiz.frontMatter.title, questions };
}

/**
 * `quiz library stats NAME [--json]` (COMMANDS.md): progress over every attempt at a quiz, across versions, each as
 * `readHistory` grades it (the newest report, else graded on the spot). Writes nothing and takes no lock.
 */
export function runLibraryStats(name: string, opts: LibraryStatsOptions, io: LibraryIo): ExitCode {
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const history = readHistory(root, quiz);
  if (history.attempts.length === 0)
    return libraryFail(io, opts.json, `no attempts at ${quiz.name} yet`, { fix: `quiz library take ${quiz.name}` });

  const inputs: StatsInput[] = history.attempts.flatMap((a) =>
    a.report === null ? [] : [{ file: `results/${a.stamp}.json`, report: a.report }],
  );
  const current = loadStored(root, quiz, quiz.current)?.quiz ?? null;
  const summary = summarise(inputs, current === null ? null : namesOf(current));
  if (opts.json) {
    io.out(JSON.stringify(summary));
    return EXIT.done;
  }
  const versions = new Set(summary.attempts.map((a) => a.version)).size;
  io.out(
    `${quiz.name} · ${quiz.title} · ${plural(summary.attempts.length, "attempt")}, ${plural(versions, "version")}`,
  );
  for (const line of renderStats(summary).slice(1)) io.out(line);
  return EXIT.done;
}
