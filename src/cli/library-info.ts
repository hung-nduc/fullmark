import { existsSync, readFileSync } from "node:fs";
import { formatDuration, summarise, summaryLines } from "../core/inspect";
import { reviewCounts, reviewRow } from "../core/review/counts";
import { readReview } from "../core/review/read";
import { type IndexQuiz, shelfNames } from "../library/index-file";
import { libraryPaths, shortHash, slashed } from "../library/layout";
import { diffVersions, questionHashes } from "../library/versions";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  machineOf,
  noSuchQuiz,
  nowOf,
  openLibrary,
  painterFor,
  pickVersion,
} from "./library-common";
import { readHistory } from "./library-history";
import { contentOf, flaggedOf, isoDate, listRow, percentText, shortDay, sourceOf } from "./library-row";
import { shownPath, storedPath } from "./paths";
import { plural, renderFacts } from "./table";

export type LibraryInfoOptions = { version: string | null; json: boolean; plain: boolean };

/** The labels of `inspect`'s rows are 10 wide; the boards of `info` give them 11. */
const LABEL = 11;
const row = (label: string, value: string): [string, string] => [label, value];

/** What a version changed against the one before it, in words: `2 added, 1 removed, 3 changed`. */
function diffWords(d: { added: string[]; removed: string[]; changed: string[] }): string {
  const parts = [
    d.added.length > 0 ? `${d.added.length} added` : null,
    d.removed.length > 0 ? `${d.removed.length} removed` : null,
    d.changed.length > 0 ? `${d.changed.length} changed` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(", ") : "no question changed";
}

/** `1 essay`, `2 code`: the answers waiting for a grader. */
const waiting = (essay: number, code: number): string =>
  [essay > 0 ? plural(essay, "essay") : null, code > 0 ? `${code} code` : null].filter(Boolean).join(", ");

/**
 * `quiz library info NAME [--version HASH] [--plain] [--json]` (COMMANDS.md): everything about one quiz in one place,
 * from what `list`, `inspect` and `stats` already compute. It writes nothing.
 */
export function runLibraryInfo(name: string, opts: LibraryInfoOptions, io: LibraryIo): ExitCode {
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const quiz: IndexQuiz | undefined = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);

  const all = quiz.versions.map((v) => v.hash);
  const picked = pickVersion(io, opts.json, quiz, opts.version);
  if ("exit" in picked) return picked.exit;
  const at = picked.hash;

  const now = nowOf(io);
  const history = readHistory(root, quiz);
  const content = contentOf(root, quiz, at);
  const base = listRow(root, quiz, history, at);
  const summary = content.quiz === null ? null : summarise(content.quiz, at);
  const cwd = machineOf(io).cwd;
  const source = sourceOf(quiz);
  const paths = libraryPaths(root).quiz(quiz.id);

  // each version against the one before it, newest first
  const hashesOf = (hash: string) => {
    const loaded = contentOf(root, quiz, hash).quiz;
    return loaded === null ? null : questionHashes(loaded);
  };
  const history2 = [...quiz.versions].reverse().map((v, i, list) => {
    const before = list[i + 1];
    const mine = hashesOf(v.hash);
    const prior = before === undefined ? null : hashesOf(before.hash);
    const diff = mine !== null && prior !== null ? diffVersions(prior, mine) : null;
    return { hash: v.hash, added: v.added, first: before === undefined, diff };
  });

  const sections = (summary?.sections ?? []).map((s) => ({
    slug: s.id,
    title: s.title,
    questions: s.questions,
    points: s.points,
  }));
  const banks = (summary?.sections ?? []).flatMap((s) =>
    s.pick === null ? [] : [{ section: s.id, pick: s.pick, of: s.questions }],
  );

  if (opts.json) {
    io.out(
      JSON.stringify({
        ...base,
        generated_by: content.loaded?.frontMatter.generatedBy ?? null,
        source: { path: slashed(quiz.source), exists: source.exists },
        sections,
        banks,
        history: history2.map((h) => ({
          hash: h.hash,
          added: isoDate(h.added),
          added_questions: h.diff?.added ?? [],
          removed_questions: h.diff?.removed ?? [],
          changed_questions: h.diff?.changed ?? [],
        })),
        first_taken: history.firstTaken === null ? null : isoDate(history.firstTaken),
        path: paths.dir,
      }),
    );
    return EXIT.done;
  }

  const p = painterFor(io, opts);
  const short = (hash: string) => shortHash(hash, all);
  const lines: string[] = [];
  const facts: [string, string][] = [];
  lines.push(
    `${p.bold(quiz.name)} · ${quiz.title} · version ${short(at)}${at === quiz.current ? "" : ` (not current: ${short(quiz.current)} is)`}`,
  );
  const fm = content.loaded?.frontMatter;
  facts.push(
    row(
      "Identity",
      [
        `id ${quiz.id}`,
        base.kind,
        base.lang,
        `profile ${base.profile}`,
        ...(fm?.generatedBy ? [`generated by ${fm.generatedBy}`] : []),
      ]
        .filter((x) => x !== "")
        .join(" · "),
    ),
  );
  facts.push(
    row(
      "Source",
      `${storedPath(quiz.source, cwd)} · ${
        !source.exists ? "the file is gone" : source.changed ? `changed since ${short(quiz.current)}` : "unchanged"
      }`,
    ),
  );
  if (summary !== null) {
    const titled = summary.sections.filter((s) => s.title !== null);
    facts.push(
      row(
        "Content",
        [
          plural(summary.questions, "question"),
          plural(summary.points, "point"),
          titled.length > 0 ? plural(titled.length, "section") : "no sections",
          summary.timeLimit === null ? "untimed" : `time limit ${formatDuration(summary.timeLimit)}`,
        ].join(" · "),
      ),
    );
    const rows = new Map<string, string>();
    for (const l of summaryLines(summary).slice(2)) rows.set(l.slice(0, 10).trim(), l.slice(10));
    for (const label of ["Sections", "Types", "Tags"]) {
      const text = rows.get(label);
      if (text !== undefined) facts.push(row(label, text));
    }
    if (banks.length > 0)
      facts.push(row("Banks", banks.map((b) => `${b.section}: pick ${b.pick} of ${b.of}`).join(" · ")));
  } else facts.push(row("Content", "the version's files are missing"));

  const versionLines = history2.map((h) => {
    const marks = [
      h.hash === quiz.current ? "current" : null,
      h.first ? "first version" : h.diff === null ? "not readable" : diffWords(h.diff),
    ].filter((x): x is string => x !== null);
    const joined = h.first && h.hash === quiz.current ? "current · first version" : marks.join(" · ");
    return `${short(h.hash)}  ${shortDay(h.added, now).padStart(6)}  ${joined}`;
  });
  versionLines.forEach((l, i) => facts.push(i === 0 ? row("Versions", l) : row("", l)));
  facts.push(row("Shelves", shelfNames(quiz).length > 0 ? shelfNames(quiz).join(", ") : "none"));

  if (history.attempts.length === 0) facts.push(row("Attempts", "none"));
  else {
    const first = history.firstTaken === null ? null : shortDay(history.firstTaken, now);
    const lastDay = history.taken === null ? null : shortDay(history.taken, now);
    const star = history.last !== null && history.last.pending.essay + history.last.pending.code > 0 ? "*" : "";
    const parts = [
      String(history.attempts.length),
      first === null ? null : first === lastDay ? first : `${first} to ${lastDay}`,
      `last ${percentText(history.score)}${star}`,
      `best ${percentText(history.best)}`,
      history.weak.length > 0 ? `weakest ${history.weak.join(", ")}` : null,
    ].filter((x): x is string => x !== null);
    facts.push(row("Attempts", parts.join(" · ")));
    for (const a of history.ungraded)
      facts.push(row("", `ungraded: ${a.stamp} (${waiting(a.pending.essay, a.pending.code)})`));
  }

  const reviewFile = paths.review;
  if (existsSync(reviewFile)) {
    const read = readReview(readFileSync(reviewFile, "utf8"));
    const current = at === quiz.current ? content.quiz : null;
    if (read.ok && current !== null) {
      const flagged = flaggedOf(root, quiz, current);
      facts.push(
        row(
          "Review",
          `${reviewRow(reviewCounts(current, read.review)).slice(10)}${flagged > 0 ? ` · ${flagged} flagged` : ""}`,
        ),
      );
    }
  }
  facts.push(row("Path", shownPath(paths.dir, cwd)));
  for (const line of lines) io.out(line);
  for (const line of renderFacts(p, facts, LABEL)) io.out(line);
  return EXIT.done;
}
