import { type IndexQuiz, isPublished } from "../library/index-file";
import { EXIT, type ExitCode } from "./exit-codes";
import { type LibraryIo, machineOf, nowOf, openLibrary, painterFor } from "./library-common";
import { readHistory } from "./library-history";
import { listRow, percentText, shortDay } from "./library-row";
import { shownPath } from "./paths";
import { plural, renderTable } from "./table";

export type LibraryListOptions = { json: boolean; plain: boolean };

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * `quiz library list [--plain] [--json]` (COMMANDS.md): every quiz with its versions, attempts, last score, and a note
 * when its source has changed. It reads only; the numbers come from `library-history.ts`.
 */
export function runLibraryList(opts: LibraryListOptions, io: LibraryIo): ExitCode {
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const now = nowOf(io);
  const quizzes = [...opened.index.quizzes].sort((a, b) => compare(a.name, b.name));
  const histories = quizzes.map((q) => readHistory(root, q));
  const rows = quizzes.map((q, i) => listRow(root, q, histories[i]));
  if (opts.json) {
    io.out(JSON.stringify({ quizzes: rows }));
    return EXIT.done;
  }
  const p = painterFor(io, opts);
  const where = shownPath(root, machineOf(io).cwd);
  const word = (n: number) => (n === 1 ? "1 quiz" : `${n} quizzes`);
  const attempts = rows.reduce((n, r) => n + r.attempts, 0);
  if (rows.length === 0) {
    io.out(`${word(0)} · ${where}`);
    io.out(p.dim("next: quiz library register FILE"));
    return EXIT.done;
  }
  io.out(`${word(rows.length)} · ${plural(attempts, "attempt")} · ${where}`);
  io.out("");
  const table = rows.map((r, i) => {
    const h = histories[i];
    const last = h?.last ?? null;
    const star = last !== null && last.pending.essay + last.pending.code > 0 ? "*" : "";
    const score = r.score === null ? "–" : p.band(`${percentText(r.score)}${star}`, r.score);
    const notes = [
      r.changed ? p.tag("source changed", "yellow") : null,
      isPublished(quizzes[i] as IndexQuiz) ? p.tag("public", "green") : null,
      r.ungraded ? p.tag(`${h?.ungraded.length ?? 0} ungraded`, "cyan") : null,
      r.flagged > 0 ? p.tag(`${r.flagged} flagged`, "yellow") : null,
    ].filter((x): x is string => x !== null);
    return [
      r.name,
      r.title,
      String(r.versions),
      String(r.attempts),
      score,
      r.best === null ? "–" : p.band(percentText(r.best), r.best),
      r.taken === null ? "never" : shortDay(r.taken, now),
      notes.join(" · "),
    ];
  });
  for (const line of renderTable(
    p,
    ["NAME", "TITLE", "VERSIONS", "ATTEMPTS", "LAST", "BEST", "TAKEN", "NOTES"],
    table,
    ["left", "left", "right", "right", "right", "right", "left", "left"],
  ))
    io.out(line);
  return EXIT.done;
}
