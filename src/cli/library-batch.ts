import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Quiz } from "../core/ir";
import { ID_FORMAT, slug } from "../core/slug";
import { CHECK_FILE, renderCheck } from "../library/check-file";
import type { Git } from "../library/git";
import { type IndexQuiz, type LibraryIndex, writeIndex } from "../library/index-file";
import { libraryPaths } from "../library/layout";
import { type VersionFile, writeVersion } from "../library/versions";
import { writeFileAtomic } from "./atomic";
import { type FileOutcome, humanIssue } from "./check";

/**
 * What `library register` and `library import` share (STEP5.md, slice 5b): judging one checked file, a quiz's default
 * name and a free one beside it, the files of a version, and writing a batch (the versions, `library.toml`, one commit)
 * all or nothing. What differs between the commands (which id and name each quiz takes, `added`, the shelf entry,
 * `source`) is passed in.
 */

/** A finding in `check`'s issue format: `FILE:LINE: level rule: message`, then `fix:` lines. */
export type Finding = { file: string; line: number | null; rule: string; message: string; fix: string[] };

export type Checked = Exclude<FileOutcome, { status: "error" }>;

/** The quiz of a file whose check passed. */
export const quizOf = (checked: Checked): Quiz => {
  if (checked.loaded.quiz === null) throw new Error("a quiz that passed its check has no parsed quiz");
  return checked.loaded.quiz;
};

export const NAME_FIX = "a name is a slug: a to z, 0 to 9 and -, starting with a letter, 1 to 64 characters";

/** The name a quiz gets by default: its slugged title, else its id. */
export function defaultName(title: string, id: string): string {
  const slugged = slug(title).slice(0, 64).replace(/-+$/, "");
  return ID_FORMAT.test(slugged) ? slugged : id;
}

/** A free name beside `name`: `name-2`, `name-3`, … */
export function freeName(name: string, taken: ReadonlySet<string>): string {
  const base = name.slice(0, 60).replace(/-+$/, "");
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The files of a version: the source under its own name, every asset and sheet at its path, the brief, `check.json`. */
export function versionFiles(abs: string, checked: Checked): VersionFile[] {
  const enc = new TextEncoder();
  const files: VersionFile[] = [{ path: basename(abs), bytes: enc.encode(checked.loaded.text) }];
  for (const a of checked.loaded.assets) files.push({ path: a.path, bytes: a.bytes });
  for (const s of checked.loaded.sheets) files.push({ path: s.path, bytes: enc.encode(s.source) });
  const brief = join(dirname(abs), "brief.yaml");
  if (existsSync(brief)) files.push({ path: "brief.yaml", bytes: new Uint8Array(readFileSync(brief)) });
  files.push({ path: CHECK_FILE, bytes: enc.encode(renderCheck(checked.resolved)) });
  return files;
}

/** What a checked file is, before it is compared with the library. */
export type Judged =
  | { kind: "error"; lines: string[] }
  | { kind: "refused"; findings: Finding[] }
  | {
      kind: "ok";
      checked: Checked;
      hash: string;
      frontMatter: Checked["loaded"]["frontMatter"];
      /** the file's own warnings and notes, as `check` prints them */
      shownIssues: string[];
      /** the finding to refuse it with, so the caller can name the file's line for an id */
      issueFindings: () => Finding[];
    };

/**
 * Judges the outcome of checking one file: a file or config that could not be read (`error`), a failed check, a
 * survey (`library.survey`) or a file whose parts could not be read (`refused`), or a quiz that may go on (`ok`).
 */
export function judge(file: string, result: FileOutcome, strict: boolean, color: boolean): Judged {
  if (result.status === "error") {
    const lines = [`${result.file}: ${result.message}`];
    for (const p of result.problems ?? []) lines.push(`    ${p}`);
    for (const e of result.configErrors ?? []) {
      lines.push(`${e.file}:${e.line}: ${e.message}`);
      if (e.fix) lines.push(`    fix: ${e.fix}`);
    }
    return { kind: "error", lines };
  }
  const issueFindings = (): Finding[] =>
    result.issues
      .filter((i) => i.level === "error" || (strict && i.level === "warning"))
      .map((i) => ({
        file: i.file,
        line: i.line,
        rule: i.rule,
        message: i.message,
        fix: i.fix ? [i.fix] : [],
      }));
  if (result.status === "failed") {
    const found = issueFindings();
    return {
      kind: "refused",
      findings:
        found.length > 0
          ? found
          : [{ file, line: null, rule: "check.failed", message: "the quiz failed its check", fix: [] }],
    };
  }
  const fm = result.loaded.frontMatter;
  const hash = result.loaded.hash;
  if (fm.kind === "survey")
    return {
      kind: "refused",
      findings: [
        {
          file,
          line: fm.keyLines.kind ?? 1,
          rule: "library.survey",
          message: "a survey is not kept in the library: the library is one learner's history of their own attempts",
          fix: ["`quiz serve` and `quiz stats` handle a survey with no library"],
        },
      ],
    };
  if (hash === null)
    return {
      kind: "refused",
      findings: [
        { file, line: null, rule: "check.failed", message: "a file the quiz uses could not be read", fix: [] },
      ],
    };
  return {
    kind: "ok",
    checked: result,
    hash,
    frontMatter: fm,
    shownIssues: result.issues.map((i) => humanIssue(i, color).join("\n")),
    issueFindings,
  };
}

/** One version to write: its folder under the quiz's `versions/`, by hash. */
export type VersionToWrite = { id: string; hash: string; files: VersionFile[] };

export type BatchWritten =
  | { ok: true; committed: { hash: string; message: string } | null; commitWarning: string | null; written: string[] }
  | { ok: false; error: Error };

/**
 * Writes a batch: each version into its folder, then `library.toml` with the quizzes as they are to be (the caller
 * built them), then one commit of `library.toml` and the folders written (when `message` is not null). A write that
 * fails removes the folders this run made, and the library is as it was.
 */
export async function writeBatch(input: {
  root: string;
  git: Git;
  index: LibraryIndex;
  versions: readonly VersionToWrite[];
  quizzes: readonly IndexQuiz[];
  message: string | null;
  atomic?: (file: string, data: Uint8Array) => Promise<void>;
}): Promise<BatchWritten> {
  const { root, git, index } = input;
  const paths = libraryPaths(root);
  const written: string[] = [];
  try {
    for (const v of input.versions) {
      await writeVersion(paths.quiz(v.id).versions, v.hash, v.files);
      written.push(`quizzes/${v.id}/versions/${v.hash}`);
    }
    await writeIndex(paths.index, { ...index, quizzes: [...input.quizzes] }, input.atomic ?? writeFileAtomic);
  } catch (error) {
    for (const w of written)
      await rm(join(root, ...w.split("/")), { recursive: true, force: true }).catch(() => undefined);
    return { ok: false, error: error as Error };
  }
  let committed: { hash: string; message: string } | null = null;
  let commitWarning: string | null = null;
  if (input.message !== null) {
    const result = await git.commit(["library.toml", ...written], input.message);
    if (result.status === "committed") committed = { hash: result.hash, message: input.message };
    else if (result.status === "failed") commitWarning = result.message;
  }
  return { ok: true, committed, commitWarning, written };
}
