import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Command, Option } from "commander";
import type { Candidate } from "./complete-sources";
import type { Machine } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import type { Io } from "./ids";

/**
 * `quiz __complete WORDS...` (COMMANDS.md, `quiz shell-init`): the hidden command the shells' Tab scripts call. `WORDS`
 * are the command line so far, the last one the word being completed (empty after a space). It walks the command tree
 * to find the position, then asks the value source that position names; the candidates it prints are those that
 * begin with the word. Read-only and quiet: it never writes, locks or prompts, and any problem is no candidates, the
 * directive `:default` and exit 0, so nothing ever lands in the prompt.
 */

/** What the shell does after the candidates (COMMANDS.md): nothing more, files of a kind, or its own completion. */
export type Directive = ":nofile" | ":files:md" | ":files:json" | ":default";

export type Completion = { candidates: Candidate[]; directive: Directive };

export type CompleteIo = Pick<Io, "out" | "cwd"> & { machine?: Machine };

const NONE: Completion = { candidates: [], directive: ":default" };
const names = (list: Candidate[], directive: Directive = ":nofile"): Completion => ({ candidates: list, directive });
const files = (kind: "md" | "json"): Completion => ({ candidates: [], directive: `:files:${kind}` });
const nothing: Completion = { candidates: [], directive: ":nofile" };

/** The commands whose positional files are quizzes (`.md`) and results, grades or reviews (`.json`). */
const QUIZ_FILES = new Set(["check", "build", "inspect", "serve", "review", "ids", "library register", "template add"]);
const JSON_FILES = new Set(["grade", "replay", "stats"]);

/** The library commands whose first argument is a quiz's name. */
const QUIZ_NAME = new Set([
  "library take",
  "library info",
  "library stats",
  "library grade",
  "library review",
  "library share",
  "library replay",
  "library rename",
  "library rm",
  "library path",
  "library publish",
  "library template add",
]);

/** Options whose value is a file, by kind; the other options that take a path are left to the shell. */
const FILE_OPTIONS: Record<string, "md" | "json"> = {
  "--quiz": "md",
  "--for": "md",
  "--from": "md",
  "--grades": "json",
  "--review": "json",
  "--since": "json",
};
const PATH_OPTIONS = new Set(["--config", "--build-file", "--output", "-o", "--out", "--into", "--autosave"]);

/** Where the walk of the typed words ended. */
type Position = {
  cmd: Command;
  /** the commands entered, `["library", "take"]` */
  path: string[];
  /** the arguments typed so far, options and their values left out */
  args: string[];
  /** every option typed, by long name, with its values */
  given: Map<string, string[]>;
  /** the option whose value is the word being completed */
  pending: Option | null;
  /** after `--`: everything is an argument */
  literal: boolean;
};

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

const visible = (c: Command): boolean => !(c as unknown as { _hidden?: boolean })._hidden && c.name() !== "__complete";

/** The option a typed word names (`--fonts`, `-o`), or null. */
function optionOf(cmd: Command, word: string): Option | null {
  return cmd.options.find((o) => o.long === word || o.short === word) ?? null;
}

/** Whether an option takes a value the next word holds (`--opt <v>`; an optional `[v]` is taken as none). */
const takesValue = (o: Option): boolean => o.required === true;

function walk(program: Command, typed: string[]): Position {
  const at: Position = {
    cmd: program,
    path: [],
    args: [],
    given: new Map(),
    pending: null,
    literal: false,
  };
  for (const word of typed) {
    if (at.pending) {
      const long = at.pending.long ?? at.pending.short ?? "";
      at.given.set(long, [...(at.given.get(long) ?? []), word]);
      at.pending = null;
    } else if (at.literal || !word.startsWith("-") || word === "-") {
      const sub =
        at.args.length === 0 && !at.literal
          ? at.cmd.commands.find((c) => c.name() === word || c.aliases().includes(word))
          : undefined;
      if (sub) {
        at.cmd = sub;
        at.path.push(sub.name());
      } else if (!(at.cmd === program && at.args.length === 0 && word === "help")) {
        // `quiz help COMMAND` completes the commands as the line's first word does, so `help` itself counts for nothing
        at.args.push(word);
      }
    } else if (word === "--") at.literal = true;
    else {
      const eq = word.indexOf("=");
      const flag = word.startsWith("--") && eq > 0 ? word.slice(0, eq) : word;
      const option = optionOf(at.cmd, flag);
      if (option === null) continue;
      const long = option.long ?? option.short ?? flag;
      if (flag !== word) at.given.set(long, [...(at.given.get(long) ?? []), word.slice(eq + 1)]);
      else if (takesValue(option)) at.pending = option;
      else at.given.set(long, at.given.get(long) ?? []);
    }
  }
  return at;
}

/** The index of the argument being typed: a variadic argument takes every later position. */
function argumentAt(cmd: Command, index: number): { name: string; choices: readonly string[] | undefined } | null {
  const declared = cmd.registeredArguments;
  const argument = declared[index] ?? (declared.at(-1)?.variadic ? declared.at(-1) : undefined);
  return argument ? { name: argument.name(), choices: argument.argChoices } : null;
}

/** The value sources read the user's files, and load their parsers only when asked: `lib` and `--fo` need none of them. */
const sources = () => import("./complete-sources");

/** The first typed argument as a path from the working directory: the quiz file a `--section` asks about. */
const fileArg = (at: Position, cwd: string): string => {
  const file = at.args[0];
  if (file === undefined) throw new Error("no quiz file typed");
  return resolve(cwd, file);
};

async function optionValue(at: Position, option: Option, m: Machine): Promise<Completion> {
  if (option.argChoices) return names(option.argChoices.map((value) => ({ value })));
  const flag = option.long ?? option.short ?? "";
  const path = at.path.join(" ");
  const kind = FILE_OPTIONS[flag] ?? (flag === "--out" && (path === "serve" || path === "review") ? "json" : null);
  if (kind) return files(kind);
  if (PATH_OPTIONS.has(flag)) return NONE;
  switch (flag) {
    case "--profile":
      return names((await sources()).profileNames(m, at.given.get("--config")?.[0] ?? null));
    case "--section":
      if (path === "serve") return names(await (await sources()).sectionsOfFile(fileArg(at, m.cwd)));
      if (path === "library take" && at.args[0] !== undefined)
        return names(await (await sources()).sectionsOfLibraryQuiz(m, at.args[0]));
      return nothing;
    case "--attempt":
      return at.args[0] === undefined ? nothing : names((await sources()).attemptStamps(m, at.args[0]));
    case "--update":
      return names((await sources()).quizNames(m));
    default:
      return nothing;
  }
}

/** The brief flags' values live in the question file, which only `quiz brief` and this read. */
async function briefValue(option: Option): Promise<Completion | null> {
  const flag = option.long?.replace(/^--/, "");
  if (flag === undefined) return null;
  const choices = (await import("./brief-help")).briefChoices(flag);
  if (choices === null) return null;
  return names(choices.map((c) => ({ value: c.value, description: c.hint })));
}

async function argumentValue(at: Position, m: Machine): Promise<Completion> {
  const path = at.path.join(" ");
  const argument = argumentAt(at.cmd, at.args.length);
  // a word after a command that is not one (`quiz bogus x`): nothing to offer, the shell's own completion follows
  if (at.cmd.commands.length > 0) return NONE;
  if (argument === null) return nothing;
  if (argument.choices) return names(argument.choices.map((value) => ({ value })));
  if (QUIZ_FILES.has(path)) return files("md");
  if (JSON_FILES.has(path)) return files("json");
  if (path === "rules") return names((await sources()).ruleIds());
  if (path === "new")
    return at.given.has("--from") || at.args.length > 0 ? NONE : names((await sources()).templateNames(m, false));
  if (path === "template rm") return names((await sources()).templateNames(m, true));
  if (QUIZ_NAME.has(path)) {
    if (at.args.length > 0) return nothing;
    // `publish` takes a folder when neither --on nor --off is given: the shell's own completion fills in when no name matches
    return names((await sources()).quizNames(m), path === "library publish" ? ":default" : ":nofile");
  }
  return NONE;
}

/** The flags of a command, each with its help line. */
function flagsOf(cmd: Command): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const o of cmd.options) {
    if (o.hidden || o.long === undefined || seen.has(o.long)) continue;
    seen.add(o.long);
    out.push({ value: o.long, description: o.description });
  }
  if (!seen.has("--help")) out.push({ value: "--help", description: "help for the command" });
  return out;
}

async function complete(program: Command, words: string[], m: Machine): Promise<Completion> {
  const typed = words.length === 0 ? [""] : words;
  const current = typed.at(-1) as string;
  const at = walk(program, typed.slice(0, -1));

  if (at.pending) {
    if (at.cmd.name() === "brief") {
      const brief = await briefValue(at.pending);
      if (brief) return brief;
    }
    return optionValue(at, at.pending, m);
  }
  if (!at.literal && current.startsWith("-") && current !== "-") {
    // `--fonts=q`: the shells split a word at `=` in their own ways, so the value is left to them
    if (current.includes("=")) return NONE;
    return names(flagsOf(at.cmd));
  }
  const subs = at.cmd.commands.filter(visible);
  if (subs.length > 0 && at.args.length === 0 && !at.literal) {
    const list = subs.map((c) => ({ value: c.name(), description: c.description() }));
    return names(at.cmd === program ? [...list, { value: "help", description: "help for a command" }] : list);
  }
  return argumentValue(at, m);
}

/** The candidates that begin with the word being completed, whatever their case. */
function matching(found: Completion, current: string): Completion {
  const prefix = current.toLowerCase();
  return {
    directive: found.directive,
    candidates: found.candidates.filter((c) => c.value.toLowerCase().startsWith(prefix)),
  };
}

/** Runs `quiz __complete WORDS...`: the candidates, one per line, then the directive; always exit 0. */
export async function runComplete(program: Command, words: string[], io: CompleteIo): Promise<ExitCode> {
  const m: Machine = io.machine ?? { cwd: io.cwd, env: process.env, platform: process.platform, home: homedir() };
  let found: Completion;
  try {
    found = matching(await complete(program, words, m), words.at(-1) ?? "");
  } catch {
    found = NONE;
  }
  const lines = found.candidates.map((c) =>
    c.description === undefined || clean(c.description) === ""
      ? clean(c.value)
      : `${clean(c.value)}\t${clean(c.description)}`,
  );
  io.out([...lines, found.directive].join("\n"));
  return EXIT.done;
}
