import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import {
  defaultOf,
  type Lang,
  parseNumber,
  type Question,
  type QuestionFile,
  type QuestionValue,
  questionOf,
  wordCount,
} from "../core/brief/questions";
import {
  type Answer,
  type BriefAnswers,
  briefOf,
  type ContentKind,
  type Decider,
  emitBrief,
  type MixKind,
  type Purpose,
} from "../core/brief/write";
import { profileOptions, resolveProfile, unknownProfileMessage } from "../core/config/resolve";
import { WriteError, writeFileAtomic } from "./atomic";
import { loadQuestions } from "./brief-questions";
import { loadConfig, type Machine } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import { fail } from "./fail";
import type { Io } from "./ids";
import { readFailure, shownPath } from "./paths";
import { machineOf } from "./templates";

/** The options of `quiz brief` as the command line gave them: text, or null when not given. */
export type BriefOptions = {
  purpose: string | null;
  scope: string | null;
  kinds: string | null;
  kindsOther: string | null;
  elsewhere: string | null;
  count: string | null;
  minutes: string | null;
  mix: string | null;
  difficulty: string | null;
  mode: string | null;
  weakTopics: string | null;
  commitment: string | null;
  language: string | null;
  request: string | null;
  profile: string | null;
  config: string | null;
  acceptDefaults: boolean;
  web: boolean;
  tui: boolean;
  json: boolean;
  /** `--web`: false with `--no-open` (the browser opens by default); absent: true */
  open?: boolean;
  /** `--web`: seconds as given; null or absent: 1800 */
  timeout?: string | null;
  /** `--web`: as given; null or absent: a free port */
  port?: string | null;
  version?: string;
};

/** What `runBrief` needs beyond the plain `Io`: the question file and the machine config (tests), and the seams of the forms. */
export type BriefIo = Io & {
  questions?: QuestionFile;
  machine?: Machine;
  tui?: TuiStreams;
  /** `--web`: where `dist/brief.js` is, the clock, the opener, Ctrl+C and the timer, which tests control */
  runtimeDir?: string;
  now?: () => Date;
  open?: (url: string) => void | Promise<void>;
  onInterrupt?: (handler: () => void) => () => void;
  setTimer?: (fire: () => void, ms: number) => () => void;
};

/** A warning in `--json`'s `warnings` (and, in words, on stderr). */
export type BriefWarning = {
  rule: "brief.vague" | "brief.no-history";
  message: string;
  key?: string;
  words?: number;
  example?: string;
};

/** The answers someone gave (through flags, or by changing a default in a form): what `decided_by: user` records. */
export type Given = {
  purpose?: Purpose;
  scope?: string;
  kinds?: ContentKind[];
  kindsOther?: string;
  elsewhere?: string;
  count?: number;
  minutes?: number;
  mix?: MixKind[];
  difficulty?: string;
  mode?: string;
  weakTopics?: boolean;
  commitment?: number;
  language?: Lang;
  request?: string;
  profile?: string;
};

/** Where `--tui` asks: stdin and stderr, unless a test hands it streams of its own. */
export type TuiStreams = { input: Readable; output: Writable };

class Usage extends Error {}

const list = (values: readonly string[]): string => values.join(", ");

/** The values a choice or multi question accepts, from the question file. */
const valuesOf = (q: Question): string[] => (q.choices ?? []).map((c) => c.value);

function oneOf(q: Question, flag: string, given: string): string {
  const allowed = valuesOf(q);
  const value = given.trim();
  if (!allowed.includes(value)) throw new Usage(`--${flag} must be one of: ${list(allowed)}, not "${given}"`);
  return value;
}

function manyOf(q: Question, flag: string, given: string): string[] {
  const allowed = valuesOf(q);
  const picked = given
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "");
  const bad = picked.find((x) => !allowed.includes(x));
  if (bad !== undefined)
    throw new Usage(`--${flag} takes a comma list of: ${list(allowed)}; "${bad}" is not one of them`);
  return picked;
}

function numberOf(q: Question, flag: string, given: string, whole: boolean): number {
  const parsed = parseNumber(q, given, whole);
  if ("problem" in parsed) throw new Usage(`--${flag} ${parsed.problem}`);
  return parsed.value;
}

const wholeNumber = (text: string, min: number): number | null =>
  /^\d+$/.test(text) && Number(text) >= min ? Number(text) : null;

const asDecider = (given: boolean, accepted = false): Decider => (given ? "user" : accepted ? "agent" : "default");

/** The text, the example and the minimum of a detail rule, as they are shown in `lang`. */
const exampleIn = (q: Question, lang: Lang): string => q.example?.[lang] ?? "";

/** The answer flags as text: what a form's answers are turned into so that one parser checks them all. */
export type FlagText = Pick<
  BriefOptions,
  | "purpose"
  | "scope"
  | "kinds"
  | "kindsOther"
  | "elsewhere"
  | "count"
  | "minutes"
  | "mix"
  | "difficulty"
  | "mode"
  | "weakTopics"
  | "commitment"
  | "language"
  | "request"
  | "profile"
>;

/**
 * `quiz brief DIR` (COMMANDS.md): every option checked against the question file, the defaults filled and recorded,
 * then `DIR/brief.yaml` and an empty `DIR/content/` written. A human-only value without a flag makes the run exit 3
 * and write nothing. With `--tui` or `--web` the flags only pre-fill a form, which returns the answers as `Given`, and
 * the bytes are made from that exactly as from flags.
 */
export async function runBrief(dir: string, opts: BriefOptions, io: BriefIo): Promise<ExitCode> {
  const json = opts.json;
  const say = (line: string): void => (json ? io.err(line) : io.out(line));
  if (opts.web && opts.tui) {
    fail(io, json, "--web and --tui cannot be used together: choose one form");
    return EXIT.usage;
  }
  // the form answers a person: `--accept-defaults` is for an agent that has been handed the choices
  if (opts.tui && opts.acceptDefaults) {
    fail(io, json, "--accept-defaults cannot be used with --tui: the person at the terminal answers");
    return EXIT.usage;
  }
  if (opts.web && opts.acceptDefaults) {
    fail(io, json, "--accept-defaults cannot be used with --web: the person at the form answers");
    return EXIT.usage;
  }

  // `--timeout`, `--port` and `--no-open` belong to the web form (G116)
  if (!opts.web) {
    const needsWeb =
      opts.timeout != null ? "--timeout" : opts.port != null ? "--port" : opts.open === false ? "--no-open" : null;
    if (needsWeb !== null) {
      fail(io, json, `${needsWeb} needs --web`);
      return EXIT.usage;
    }
  }

  let questions: QuestionFile;
  try {
    questions = io.questions ?? loadQuestions();
  } catch (error) {
    fail(io, json, (error as Error).message);
    return EXIT.usage;
  }
  const q = (key: string): Question => questionOf(questions, key);

  // -- the machine config: the defaults of each purpose, and the profiles `--profile` may name
  const folder = resolve(io.cwd, dir);
  const config = loadConfig(machineOf(io), folder, opts.config);
  if (config.errors.length > 0) {
    fail(io, json, "the config has errors", { errors: config.errors });
    for (const e of config.errors) {
      io.err(`${e.file}:${e.line}: ${e.message}`);
      if (e.fix) io.err(`    fix: ${e.fix}`);
    }
    return EXIT.usage;
  }

  /** The answers of `flags` checked against the question file: `Given`, or a `Usage` naming the first that is wrong. */
  const parseFlags = (flags: FlagText): Given => {
    const out: Given = {};
    if (flags.purpose !== null) out.purpose = oneOf(q("purpose"), "purpose", flags.purpose) as Purpose;
    if (flags.scope !== null && flags.scope.trim() !== "") out.scope = flags.scope.trim();
    if (flags.kinds !== null) out.kinds = manyOf(q("content.kinds"), "kinds", flags.kinds) as ContentKind[];
    if (flags.kindsOther !== null) {
      if (!out.kinds?.includes("other")) throw new Usage("--kinds-other needs `other` in --kinds");
      out.kindsOther = flags.kindsOther;
    }
    if (flags.elsewhere !== null) out.elsewhere = flags.elsewhere;
    if (flags.count !== null) out.count = numberOf(q("count"), "count", flags.count, true);
    if (flags.minutes !== null) out.minutes = numberOf(q("minutes"), "minutes", flags.minutes, false);
    if (flags.mix !== null) out.mix = manyOf(q("mix"), "mix", flags.mix) as MixKind[];
    if (flags.difficulty !== null) out.difficulty = oneOf(q("difficulty"), "difficulty", flags.difficulty);
    if (flags.mode !== null) out.mode = oneOf(q("mode"), "mode", flags.mode);
    if (flags.weakTopics !== null) out.weakTopics = oneOf(q("weak_topics"), "weak-topics", flags.weakTopics) === "yes";
    if (flags.commitment !== null) out.commitment = numberOf(q("commitment"), "commitment", flags.commitment, true);
    if (flags.language !== null) out.language = oneOf(q("language"), "language", flags.language) as Lang;
    if (flags.request !== null) out.request = flags.request;
    if (flags.profile !== null) {
      const name = flags.profile.trim();
      if (resolveProfile(name, config.layers).profile === null)
        throw new Usage(unknownProfileMessage(name, config.layers));
      out.profile = name;
    }
    return out;
  };

  // -- every flag checked before anything else happens
  let given: Given;
  let timeout = 1800;
  let port = 0;
  try {
    given = parseFlags(opts);
    if (opts.web) {
      if (opts.timeout != null) {
        const t = wholeNumber(opts.timeout, 0);
        if (t === null) throw new Usage(`--timeout ${opts.timeout} is not a number of seconds (0 waits forever)`);
        timeout = t;
      }
      if (opts.port != null) {
        const n = wholeNumber(opts.port, 1);
        if (n === null || n > 65535) throw new Usage(`--port ${opts.port} is not a port number (1 to 65535)`);
        port = n;
      }
    }
  } catch (error) {
    if (!(error instanceof Usage)) throw error;
    fail(io, json, error.message);
    return EXIT.usage;
  }

  // -- an existing brief is never overwritten, and that is found before anything is asked (G18)
  const target = join(folder, "brief.yaml");
  if (existsSync(target)) {
    const shown = shownPath(target, io.cwd);
    fail(io, json, `${shown} already exists: edit it, or delete it to start again`);
    return EXIT.usage;
  }

  // -- the terminal is checked last (G26): an agent that prepares a form learns of its own mistakes first
  const streams: TuiStreams = io.tui ?? { input: process.stdin, output: process.stderr };
  if (opts.tui && !((streams.input as { isTTY?: boolean }).isTTY && (streams.output as { isTTY?: boolean }).isTTY)) {
    fail(io, json, "--tui needs an interactive terminal: use --web, or give the answers as flags");
    return EXIT.usage;
  }

  // -- human-only values: purpose has a default `--accept-defaults` may take, scope has none. With a form the flags
  // only pre-fill it, which asks every question
  const purposeQuestion = q("purpose");
  const overridesOf = (p: Purpose): Readonly<Record<string, QuestionValue>> =>
    config.layers.user?.briefDefaults[p] ?? {};

  /** The answers, the file's text and the warnings made from what was given: the same for flags, `--tui` and `--web`. */
  const compose = (answered: Given): { brief: ReturnType<typeof briefOf>; text: string; warnings: BriefWarning[] } => {
    // -- every other value: the flag, else the default of the purpose (the machine config's table may change it)
    const purpose: Purpose = answered.purpose ?? (purposeQuestion.default as Purpose);
    const overrides = overridesOf(purpose);
    const fill = <T>(key: string, value: T | undefined, by: Decider = "default"): Answer<T> =>
      value !== undefined ? { value, by: "user" } : { value: defaultOf(q(key), purpose, overrides) as T, by };

    const answers: BriefAnswers = {
      purpose:
        answered.purpose !== undefined
          ? { value: purpose, by: "user" }
          : { value: purpose, by: asDecider(false, true) },
      scope: { value: answered.scope as string, by: "user" },
      kinds: fill("content.kinds", answered.kinds),
      kindsOther: { value: answered.kindsOther ?? "", by: asDecider(answered.kindsOther !== undefined) },
      elsewhere: fill("content.elsewhere", answered.elsewhere),
      count: fill("count", answered.count),
      minutes: fill("minutes", answered.minutes),
      mix: fill("mix", answered.mix),
      difficulty: fill("difficulty", answered.difficulty) as BriefAnswers["difficulty"],
      mode: fill("mode", answered.mode) as BriefAnswers["mode"],
      language: fill("language", answered.language) as BriefAnswers["language"],
      request: fill("request", answered.request),
      weakTopics:
        answered.weakTopics !== undefined
          ? { value: answered.weakTopics, by: "user" }
          : { value: defaultOf(q("weak_topics"), purpose, overrides) === "yes", by: "default" },
      commitment: fill("commitment", answered.commitment),
      ...(answered.profile !== undefined ? { profile: { value: answered.profile, by: "user" as const } } : {}),
    };

    const brief = briefOf(answers);
    const text = emitBrief(brief);
    const lang: Lang = answered.language ?? "en";

    // -- warnings: a short answer is accepted (detail rules), weak topics have no history to read here (G17)
    const warnings: BriefWarning[] = [];
    // only the answers the user (or the agent) gave are held to a detail rule; a default is never vague
    for (const rule of questions.questions) {
      const min = rule["min-words"];
      const value = rule.key === "scope" ? answered.scope : undefined;
      if (value === undefined || min === undefined) continue;
      const words = wordCount(value);
      if (words >= min) continue;
      const example = exampleIn(rule, lang);
      warnings.push({
        rule: "brief.vague",
        key: rule.key,
        words,
        example,
        message: `--${rule.flag} has ${words} word${words === 1 ? "" : "s"}; ${min} or more say what the quiz covers, for example "${example}"`,
      });
    }
    if (brief.weak_topics && answered.weakTopics === true) {
      warnings.push({
        rule: "brief.no-history",
        message:
          "focus_tags is empty: quiz brief reads no history; pick the weak topics from the learner's reports, or use the library's brief (step 4), which fills them from stats",
      });
    }
    return { brief, text, warnings };
  };

  /** brief.yaml first (atomic, creates DIR), then the empty content folder; an existing one is kept. Throws what it could not do. */
  const writeOut = async (text: string): Promise<void> => {
    if (existsSync(folder) && !statSync(folder).isDirectory()) throw new WriteError(folder, { code: "ENOTDIR" });
    await writeFileAtomic(target, Buffer.from(text, "utf8"));
    await mkdir(join(folder, "content"), { recursive: true });
  };
  const writeProblem = (error: unknown): string => {
    const file = (error as { file?: string }).file ?? folder;
    return `cannot write ${shownPath(file, io.cwd)}: ${error instanceof WriteError ? error.message : readFailure(error)}`;
  };

  const report = (brief: ReturnType<typeof briefOf>, warnings: BriefWarning[]): void => {
    const shown = shownPath(target, io.cwd);
    const applied = Object.entries(brief.decided_by)
      .filter(([key, by]) => by !== "user" && key !== "focus_tags")
      .map(([key]) => key);
    for (const w of warnings) io.err(`warning ${w.rule}: ${w.message}`);
    if (json) {
      io.out(JSON.stringify({ status: "written", brief: shown, defaults_applied: applied, warnings }));
    }
    say(`wrote ${shown} and ${shownPath(join(folder, "content"), io.cwd)}/`);
    if (applied.length > 0) say(`defaults used: ${applied.join(", ")}`);
  };

  if (opts.web) {
    const { serveBriefForm } = await import("./brief-web");
    let taken: ReturnType<typeof compose> | null = null;
    let writeFailure: string | null = null;
    const outcome = await serveBriefForm({
      io,
      json,
      questions,
      lang: given.language ?? "en",
      prefill: given,
      overridesOf,
      profiles: profileOptions(config.layers),
      timeout,
      port,
      open: opts.open !== false,
      dir: basename(folder),
      target: shownPath(target, io.cwd),
      command: restartCommand(dir, opts),
      version: opts.version ?? "1.0.0",
      parse: (flags) => {
        try {
          return parseFlags(flags);
        } catch (error) {
          if (error instanceof Usage) throw new Error(error.message);
          throw error;
        }
      },
      async commit(answered) {
        // the brief may have appeared while the form was open: it is never overwritten
        if (existsSync(target))
          return `${shownPath(target, io.cwd)} already exists: edit it, or delete it to start again`;
        const made = compose(answered);
        try {
          await writeOut(made.text);
        } catch (error) {
          writeFailure = writeProblem(error);
          throw error;
        }
        taken = made;
        return null;
      },
    });
    switch (outcome.kind) {
      case "written": {
        const made = taken as unknown as ReturnType<typeof compose>;
        report(made.brief, made.warnings);
        return EXIT.done;
      }
      case "cancelled":
        if (json) io.out(JSON.stringify({ status: "cancelled" }));
        io.err("cancelled: nothing was written");
        return EXIT.usage;
      case "timeout":
        if (json) io.out(JSON.stringify({ status: "timeout" }));
        io.err(`timed out after ${timeout} seconds without a Finish; nothing was written`);
        return EXIT.usage;
      case "interrupted":
        if (json) io.out(JSON.stringify({ status: "interrupted" }));
        io.err("stopped; nothing was written");
        return EXIT.usage;
      case "failed":
        fail(io, json, writeFailure ?? outcome.message);
        return EXIT.usage;
    }
  }

  if (opts.tui) {
    const { askForm } = await import("./brief-tui");
    const controller = new AbortController();
    const onInterrupt = (): void => controller.abort();
    process.once("SIGINT", onInterrupt);
    let result: Awaited<ReturnType<typeof askForm>>;
    try {
      result = await askForm({
        questions,
        lang: given.language ?? "en",
        prefill: given,
        overridesOf,
        profileProblem: (name) =>
          resolveProfile(name, config.layers).profile === null ? unknownProfileMessage(name, config.layers) : null,
        input: streams.input,
        output: streams.output,
        signal: controller.signal,
      });
    } finally {
      process.off("SIGINT", onInterrupt);
    }
    if (result === "cancelled") {
      if (json) io.out(JSON.stringify({ status: "cancelled" }));
      io.err("cancelled: nothing was written");
      return EXIT.usage;
    }
    given = result;
  }
  const missing: string[] = [];
  if (!opts.tui && given.purpose === undefined && !opts.acceptDefaults) missing.push("purpose");
  if (given.scope === undefined) missing.push("scope");
  if (missing.length > 0) {
    const flags = missing.map((k) =>
      k === "purpose" ? `--purpose (${list(valuesOf(purposeQuestion))})` : "--scope TEXT",
    );
    const how = `give ${flags.join(" and ")}${missing.includes("purpose") ? ", or --accept-defaults to take the default purpose" : ""}; or ask the user in a form with --web`;
    if (json) io.out(JSON.stringify({ status: "needs_input", missing, how }));
    io.err(`needs input: ${missing.join(", ")}`);
    io.err(`    how: ${how}`);
    return EXIT.needsInput;
  }

  const made = compose(given);
  try {
    await writeOut(made.text);
  } catch (error) {
    fail(io, json, writeProblem(error));
    return EXIT.usage;
  }
  report(made.brief, made.warnings);
  return EXIT.done;
}

/** The flags as `--web` was given them, for the command that starts again (G112): the answers, `--language` and `--profile`. */
function restartCommand(dir: string, opts: BriefOptions): string {
  const quote = (text: string): string =>
    /^[\w@%+=:,./-]+$/.test(text) ? text : `"${text.replace(/(["\\$`])/g, "\\$1")}"`;
  const parts = ["quiz", "brief", quote(dir), "--web"];
  const add = (flag: string, value: string | null): void => {
    if (value !== null) parts.push(`--${flag}`, quote(value));
  };
  add("purpose", opts.purpose);
  add("scope", opts.scope);
  add("kinds", opts.kinds);
  add("kinds-other", opts.kindsOther);
  add("elsewhere", opts.elsewhere);
  add("count", opts.count);
  add("minutes", opts.minutes);
  add("mix", opts.mix);
  add("difficulty", opts.difficulty);
  add("mode", opts.mode);
  add("weak-topics", opts.weakTopics);
  add("commitment", opts.commitment);
  add("language", opts.language);
  add("request", opts.request);
  add("profile", opts.profile);
  if (opts.config !== null) add("config", opts.config);
  return parts.join(" ");
}
