import { summarise, summaryHead, summaryRows } from "../core/inspect";
import { reviewCounts, reviewFact } from "../core/review/counts";
import { type CheckIo, type CheckOptions, checkFile, describeOutcome, humanIssue, issueJson } from "./check";
import { EXIT, type ExitCode } from "./exit-codes";
import { fail } from "./fail";
import { expandInputs } from "./files";
import { terminalPainter } from "./look";
import { renderFacts } from "./table";

export type InspectOptions = {
  profile: string | null;
  config: string | null;
  review: string | null;
  json: boolean;
  plain: boolean;
};

/**
 * `quiz inspect FILE` (COMMANDS.md): checks the quiz, prints the summary whenever it parses, then the issues as
 * `check` prints them. Exit 0 done, 1 check errors, 2 an I/O error or a config that does not load.
 */
export function runInspect(pattern: string, opts: InspectOptions, io: CheckIo): ExitCode {
  const inputs = expandInputs([pattern], io.cwd);
  const bad = inputs.errors[0];
  if (bad) {
    fail(io, opts.json, bad.message, { file: bad.input });
    return EXIT.usage;
  }
  const file = inputs.files[0] as string;
  const check: CheckOptions = {
    profile: opts.profile,
    config: opts.config,
    strict: false,
    review: opts.review,
    json: opts.json,
    plain: opts.plain,
  };
  const result = checkFile(file, check, io);
  if (result.status === "error") {
    fail(io, opts.json, result.message, {
      file: result.file,
      ...(result.configErrors ? { errors: result.configErrors } : {}),
      ...(result.problems ? { problems: result.problems } : {}),
    });
    for (const line of describeOutcome(result, false, false).slice(1)) io.err(line);
    return EXIT.usage;
  }

  const { quiz, hash } = result.loaded;
  const summary = quiz && hash ? summarise(quiz, hash) : null;
  const errors = result.issues.filter((i) => i.level === "error");
  const warnings = result.issues.filter((i) => i.level === "warning");
  const counts = result.loaded.quiz && result.review ? reviewCounts(result.loaded.quiz, result.review) : null;
  const failed = result.status === "failed";
  if (opts.json) {
    io.out(
      JSON.stringify({
        status: failed ? "failed" : "done",
        quiz: summary?.quiz ?? null,
        questions: summary?.questions ?? null,
        points: summary?.points ?? null,
        timeLimit: summary ? summary.timeLimit : null,
        types: summary?.types ?? [],
        sections: summary?.sections ?? [],
        tags: summary?.tags ?? [],
        positions: summary?.positions ?? {},
        review: counts,
        errors: errors.map(issueJson),
        warnings: warnings.map(issueJson),
      }),
    );
    return failed ? EXIT.problems : EXIT.done;
  }
  const p = terminalPainter(io, opts);
  if (summary) {
    const [first, second] = summaryHead(summary);
    io.out(p.bold(first));
    io.out(second);
    // the rows of the facts block, and the review's after Positions: a panel in the `boxed` style
    const rows = [...summaryRows(summary), ...(counts ? [reviewFact(counts)] : [])];
    for (const line of renderFacts(p, rows, 10)) io.out(line);
  }
  for (const i of result.issues) for (const line of humanIssue(i, p.color)) io.out(line);
  const count = `${file}: ${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;
  io.out(failed ? p.red(count) : p.green(count));
  return failed ? EXIT.problems : EXIT.done;
}
