import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { TomlIndex } from "../core/config/toml-index";

/** `library.toml`: the index of a library's quizzes (COMMANDS.md, "The library folder"). */
export const FORMAT = "fullmark-library";
export const INDEX_VERSION = 2;

const HASH = /^[0-9a-f]{64}$/;
export const NAME = /^[a-z0-9-]{1,64}$/;

const VersionSchema = z
  .object({
    hash: z.string().regex(HASH, "must be a hash: 64 lowercase hexadecimal characters"),
    added: z.string().min(1),
    /** the source's name in the version's folder (step 4, G22) */
    file: z.string().min(1),
  })
  .strict();

/**
 * One shelf entry of a quiz: `{ shelf = "public", kind = "quiz" }` (COMMANDS.md, `quiz library publish`; `version` is
 * reserved). v1 commands touch only the shelf `public` and `kind = "quiz"`; every other entry is kept, field for field.
 */
const ShelfEntrySchema = z.looseObject({
  shelf: z.string().min(1),
  kind: z.string().min(1),
});
export type ShelfEntry = z.infer<typeof ShelfEntrySchema>;

/** The shelf the v1 commands know, and the one kind of entry they put on it. */
export const PUBLIC_SHELF = "public";
export const QUIZ_KIND = "quiz";

/** Whether the quiz is on the public shelf as a quiz (an entry of another kind is not published by v1). */
export const isPublished = (quiz: { shelves: readonly ShelfEntry[] }): boolean =>
  quiz.shelves.some((e) => e.shelf === PUBLIC_SHELF && e.kind === QUIZ_KIND);

/** The names of the shelves a quiz has entries on, each once, in the order of its entries. */
export const shelfNames = (quiz: { shelves: readonly ShelfEntry[] }): string[] => [
  ...new Set(quiz.shelves.map((e) => e.shelf)),
];

const QuizSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    source: z.string(),
    current: z.string().regex(HASH, "must be a hash: 64 lowercase hexadecimal characters"),
    versions: z.array(VersionSchema).min(1),
    shelves: z.array(ShelfEntrySchema).default([]),
  })
  .strict();

/** A quiz of the index, with its name. */
export type IndexQuiz = z.infer<typeof QuizSchema> & { name: string };
export type LibraryIndex = {
  format: typeof FORMAT;
  version: typeof INDEX_VERSION;
  created: string;
  quizzes: IndexQuiz[];
};

export type IndexProblem = { line: number; message: string; fix?: string };
export type IndexRead =
  | { ok: true; index: LibraryIndex }
  | {
      ok: false /** another format or version: a 0.x library, or a newer one */;
      foreign: boolean;
      problems: IndexProblem[];
    };

const byName = (a: IndexQuiz, b: IndexQuiz): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function emptyIndex(created: string): LibraryIndex {
  return { format: FORMAT, version: INDEX_VERSION, created, quizzes: [] };
}

const FOREIGN_FIX = "fullmark 1.0 keeps its own library: make one with `quiz library init PATH`";

/**
 * Reads the text of a `library.toml`: the index (quizzes sorted by name), or every problem with its line. A file with
 * another `format` or `version` is `foreign`, and nothing else is checked then.
 */
export function readIndex(text: string): IndexRead {
  let doc: Record<string, unknown>;
  try {
    doc = parseToml(text.replace(/^﻿/, "")) as Record<string, unknown>;
  } catch (e) {
    const err = e as { line?: number; message?: string };
    return {
      ok: false,
      foreign: false,
      problems: [
        {
          line: err.line ?? 1,
          message: `not valid TOML: ${(err.message ?? "").split("\n")[0]?.replace(/^Invalid TOML document: /, "") ?? ""}`,
        },
      ],
    };
  }
  const where = new TomlIndex(text.replace(/^﻿/, ""));
  if (doc.format !== FORMAT || doc.version !== INDEX_VERSION) {
    const what =
      doc.format === undefined
        ? "has no `format`"
        : doc.format !== FORMAT
          ? `has format ${JSON.stringify(doc.format)}`
          : `has version ${JSON.stringify(doc.version)}`;
    return {
      ok: false,
      foreign: true,
      problems: [
        {
          line: where.lineOf([doc.format !== FORMAT ? "format" : "version"]),
          message: `not a fullmark 1.0 library: library.toml ${what}`,
          fix: FOREIGN_FIX,
        },
      ],
    };
  }
  const problems: IndexProblem[] = [];
  const problem = (path: readonly string[], message: string, fix?: string) =>
    problems.push({ line: where.lineOf(path), message, ...(fix ? { fix } : {}) });
  for (const key of Object.keys(doc)) {
    if (!["format", "version", "created", "quizzes"].includes(key)) problem([key], `unknown key \`${key}\``);
  }
  if (typeof doc.created !== "string" || doc.created === "")
    problem(["created"], "`created` must be a time, in quotes");
  const quizzes: IndexQuiz[] = [];
  const table = doc.quizzes;
  if (table !== undefined && (typeof table !== "object" || table === null || Array.isArray(table))) {
    problem(["quizzes"], "`quizzes` must be a table of quizzes", "write [quizzes.NAME]");
  } else {
    const ids = new Map<string, string>();
    for (const [name, value] of Object.entries((table ?? {}) as Record<string, unknown>)) {
      const path = ["quizzes", name];
      if (!NAME.test(name)) {
        problem(path, `"${name}" is not a valid name`, "a name is a slug: a to z, 0 to 9 and -, 1 to 64 characters");
        continue;
      }
      const parsed = QuizSchema.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          if (issue.code === "unrecognized_keys") {
            for (const k of issue.keys) problem([...path, k], `quiz \`${name}\`: unknown key \`${k}\``);
            continue;
          }
          const key = issue.path.map(String).join(".");
          const missing = /received undefined/.test(issue.message);
          problem(
            [...path, ...issue.path.map(String)],
            `quiz \`${name}\`: ${missing ? `\`${key}\` is missing` : `\`${key}\`: ${issue.message}`}`,
          );
        }
        continue;
      }
      const quiz = parsed.data;
      if (!quiz.versions.some((v) => v.hash === quiz.current))
        problem([...path, "current"], `quiz \`${name}\`: \`current\` is not one of its versions`);
      const other = ids.get(quiz.id);
      if (other !== undefined) problem([...path, "id"], `quiz \`${name}\` has the id of quiz \`${other}\``);
      ids.set(quiz.id, name);
      quizzes.push({ ...quiz, name });
    }
  }
  if (problems.length > 0) return { ok: false, foreign: false, problems };
  return {
    ok: true,
    index: { format: FORMAT, version: INDEX_VERSION, created: doc.created as string, quizzes: quizzes.sort(byName) },
  };
}

/** A TOML basic string. `JSON.stringify` writes one, except that TOML wants DEL escaped too. */
const str = (s: string): string => JSON.stringify(s).replaceAll("\u007f", "\\u007f");

const bareKey = /^[A-Za-z0-9_-]+$/;

/** A TOML value as an inline one: strings, numbers, booleans, times, arrays and tables. */
function inline(v: unknown): string {
  if (typeof v === "string") return str(v);
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v !== null && typeof v === "object") {
    if (typeof (v as { toISOString?: unknown }).toISOString === "function") return (v as Date).toISOString();
    const parts = Object.entries(v).map(([k, x]) => `${bareKey.test(k) ? k : str(k)} = ${inline(x)}`);
    return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
  }
  return str(String(v));
}

/** One shelf entry: `shelf` and `kind` first, then every other field in the order it was read. */
const renderEntry = (e: ShelfEntry): string => {
  const { shelf, kind, ...rest } = e;
  return inline({ shelf, kind, ...rest });
};

/** The text of an index: the same bytes for the same index (keys in a fixed order, quizzes sorted, a final newline). */
export function renderIndex(index: LibraryIndex): string {
  const lines = [`format = ${str(index.format)}`, `version = ${index.version}`, `created = ${str(index.created)}`];
  for (const q of [...index.quizzes].sort(byName)) {
    lines.push(
      "",
      `[quizzes.${q.name}]`,
      `id = ${str(q.id)}`,
      `title = ${str(q.title)}`,
      `source = ${str(q.source)}`,
      `current = ${str(q.current)}`,
      `versions = [${q.versions.map((v) => `{ hash = ${str(v.hash)}, added = ${str(v.added)}, file = ${str(v.file)} }`).join(", ")}]`,
      `shelves = [${q.shelves.map(renderEntry).join(", ")}]`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Writes `library.toml`, through `write`: an atomic writer, so a crash leaves the old file or the new one. */
export async function writeIndex(
  file: string,
  index: LibraryIndex,
  write: (file: string, data: Uint8Array) => Promise<void>,
): Promise<void> {
  await write(file, new TextEncoder().encode(renderIndex(index)));
}
