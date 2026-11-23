import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { profileOptions } from "../core/config/resolve";
import { RULES } from "../core/rules/registry";
import { type IndexQuiz, readIndex } from "../library/index-file";
import { INDEX_FILE, libraryPaths } from "../library/layout";
import { loadConfig, loadUserConfig, type Machine } from "./config";
import { listTemplates } from "./templates";

/**
 * The values Tab completes that are read from the user's own files (COMMANDS.md, `quiz shell-init`, "What Tab
 * completes"). Each is a small function of the machine; none writes, locks, prompts or prints. A source that cannot
 * answer (no library, a broken index, a config with errors) throws `NoAnswer`: `quiz __complete` turns that into no
 * candidates and `:default`, so nothing is ever printed into the prompt.
 */

/** One candidate: the value, and the words shown beside it where the shell shows them. */
export type Candidate = { value: string; description?: string };

/** The source cannot say (as opposed to saying there is nothing). */
export class NoAnswer extends Error {}

/** The templates `quiz new` can start from, or only the user's own (`template rm`). */
export function templateNames(m: Machine, userOnly: boolean): Candidate[] {
  return listTemplates(m)
    .filter((t) => (userOnly ? t.source === "user" : t.invalid === null && !t.ignored))
    .map((t) => ({ value: t.name, description: t.source === "built-in" ? "built-in template" : "your template" }));
}

/**
 * The profiles `--profile` accepts: the built-in ones and those of `config.toml` and the nearest `fullmark.toml` (found
 * from `cwd`, or `config` when `--config` was already typed).
 */
export function profileNames(m: Machine, config: string | null): Candidate[] {
  const loaded = loadConfig(m, m.cwd, config);
  if (loaded.errors.length > 0) throw new NoAnswer("the config has errors");
  return profileOptions(loaded.layers).map((p) => ({
    value: p.name,
    description: p.file === null ? "built-in profile" : `profile from ${p.file}`,
  }));
}

/** The rule ids `quiz rules RULE` takes, with their one-line summaries. */
export function ruleIds(): Candidate[] {
  return RULES.map((r) => ({ value: r.id, description: r.summary }));
}

/** The folder of the library: `FULLMARK_LIBRARY`, else `library` in `config.toml`, as `library` commands find it. */
export function libraryRoot(m: Machine): string {
  const config = loadUserConfig(m);
  if (config.errors.length > 0) throw new NoAnswer("the config has errors");
  const fromEnv = m.env.FULLMARK_LIBRARY;
  if (fromEnv) return resolve(m.cwd, fromEnv);
  if (config.data?.library) return resolve(config.path, "..", config.data.library);
  throw new NoAnswer("no library");
}

/** The quizzes of the library's index, by name. */
export function libraryQuizzes(m: Machine): { root: string; quizzes: IndexQuiz[] } {
  const root = libraryRoot(m);
  let read: ReturnType<typeof readIndex>;
  try {
    read = readIndex(readFileSync(join(root, INDEX_FILE), "utf8"));
  } catch {
    throw new NoAnswer("no library index");
  }
  if (!read.ok) throw new NoAnswer("the library index has problems");
  return { root, quizzes: read.index.quizzes };
}

/** The names of the library's quizzes, with the title as the description. */
export function quizNames(m: Machine): Candidate[] {
  return libraryQuizzes(m).quizzes.map((q) => ({ value: q.name, description: q.title }));
}

/** A quiz of the library by its name, or its id as `library` commands also accept. */
function quizOf(m: Machine, name: string): { root: string; quiz: IndexQuiz } {
  const { root, quizzes } = libraryQuizzes(m);
  const quiz = quizzes.find((q) => q.name === name) ?? quizzes.find((q) => q.id === name);
  if (quiz === undefined) throw new NoAnswer(`no quiz named ${name}`);
  return { root, quiz };
}

/** A quiz's attempt stamps, newest first (the names of its `results/` files). */
export function attemptStamps(m: Machine, name: string): Candidate[] {
  const { root, quiz } = quizOf(m, name);
  let files: string[];
  try {
    files = readdirSync(libraryPaths(root).quiz(quiz.id).results);
  } catch {
    return [];
  }
  return files
    .filter((f) => /^\d{8}-\d{6}\.json$/.test(f))
    .map((f) => f.slice(0, -".json".length))
    .sort()
    .reverse()
    .map((stamp) => ({ value: stamp, description: stampText(stamp) }));
}

/** `20261105-190300` as `2026-11-05 19:03`, the words beside a stamp. */
const stampText = (s: string): string =>
  `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(9, 11)}:${s.slice(11, 13)}`;

/** The titled sections of a quiz file, by slug, with their titles: what `--section` takes. */
export async function sectionsOfFile(file: string): Promise<Candidate[]> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new NoAnswer("cannot read the quiz");
  }
  // the parser (and the YAML reader under it) loads here and nowhere else: a name or a stamp does not need it
  const { quiz } = (await import("../core/parse")).parse(text, file);
  if (quiz === null) throw new NoAnswer("the quiz has errors");
  return quiz.sections
    .filter((s) => s.title !== null && s.id !== "")
    .map((s) => ({ value: s.id, description: s.title as string }));
}

/** The sections of a library quiz's current version. */
export async function sectionsOfLibraryQuiz(m: Machine, name: string): Promise<Candidate[]> {
  const { root, quiz } = quizOf(m, name);
  const version = quiz.versions.find((v) => v.hash === quiz.current);
  if (version === undefined) throw new NoAnswer("the quiz has no current version");
  return await sectionsOfFile(join(libraryPaths(root).quiz(quiz.id).version(version.hash), version.file));
}
