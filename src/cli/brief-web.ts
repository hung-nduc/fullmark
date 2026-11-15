import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BriefData } from "../brief-form/data";
import { buildBriefForm } from "../build/brief-form";
import { FORM_ID } from "../core/brief/form";
import { type Lang, type QuestionFile, type QuestionValue, questionOf, wordCount } from "../core/brief/questions";
import type { Purpose } from "../core/brief/write";
import { PURPOSES } from "../core/ir";
import { type ServerOutcome, type SubmitRead, startServer } from "../serve/server";
import type { BriefIo, FlagText, Given } from "./brief";
import { runtimeFolder, systemOpen } from "./runtime";

/**
 * The `--web` half of `quiz brief` (COMMANDS.md, "The forms"): serves the form on the one-shot server and waits for one
 * submit, which is the answers (`Given`) or a cancel (G112). It decides nothing about the file: the command checks the
 * answers as it checks flags and writes the bytes it writes for flags (`commit`). Loaded by `--web` only: `brief` through
 * flags and `--tui` never reach it, and neither does `check`.
 */

/** What a submit holds once read. */
export type BriefSubmitValue = { cancel: true } | { given: Given };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const NO_FLAGS: FlagText = {
  purpose: null,
  scope: null,
  kinds: null,
  kindsOther: null,
  elsewhere: null,
  count: null,
  minutes: null,
  mix: null,
  difficulty: null,
  mode: null,
  weakTopics: null,
  commitment: null,
  language: null,
  request: null,
  profile: null,
};

/** The answers of a submit as the flags that would give them: one parser checks the flags, `--tui` and the form. */
function flagsOf(given: Record<string, unknown>): FlagText | string {
  const out: FlagText = { ...NO_FLAGS };
  const bad = (key: string): string => `the answers hold a "${key}" of the wrong kind`;
  for (const [key, value] of Object.entries(given)) {
    const text = typeof value === "string";
    const count = typeof value === "number" && Number.isFinite(value);
    const list = Array.isArray(value) && value.every((x) => typeof x === "string");
    switch (key) {
      case "purpose":
      case "scope":
      case "kindsOther":
      case "elsewhere":
      case "difficulty":
      case "mode":
      case "language":
      case "request":
      case "profile":
        if (!text) return bad(key);
        out[key] = value;
        break;
      case "kinds":
      case "mix":
        if (!list) return bad(key);
        out[key] = (value as string[]).join(",");
        break;
      case "count":
      case "minutes":
      case "commitment":
        if (!count) return bad(key);
        out[key] = String(value);
        break;
      case "weakTopics":
        if (typeof value !== "boolean") return bad(key);
        out.weakTopics = value ? "yes" : "no";
        break;
      default:
        return `the answers hold an unknown key "${key}"`;
    }
  }
  return out;
}

/**
 * What the form's submit body must hold: `{quizId: "brief", cancel: true}`, or `{quizId: "brief", given}` with the
 * answers, each checked as its flag is checked, a purpose and a scope, and a scope of at least `min-words` words. The
 * problem is in plain words (HTTP 400, and the server keeps waiting).
 */
export function briefSubmitReader(
  questions: QuestionFile,
  parse: (flags: FlagText) => Given,
): (body: unknown) => SubmitRead<BriefSubmitValue> {
  return (body) => {
    if (!isRecord(body)) return "the body is not an answer set";
    if (body.quizId !== FORM_ID) return `this server takes the brief form, not "${String(body.quizId)}"`;
    if (body.cancel === true) return { quizId: FORM_ID, value: { cancel: true } };
    if (!isRecord(body.given)) return "the body has no answers";
    const flags = flagsOf(body.given);
    if (typeof flags === "string") return flags;
    let given: Given;
    try {
      given = parse(flags);
    } catch (error) {
      return (error as Error).message;
    }
    const missing = [
      ...(given.purpose === undefined ? ["purpose"] : []),
      ...(given.scope === undefined ? ["scope"] : []),
    ];
    if (missing.length > 0)
      return `the answers have no ${missing.join(" and no ")}: ${missing.join(" and ")} must be answered`;
    const scope = questionOf(questions, "scope");
    const min = scope["min-words"];
    if (min !== undefined && wordCount(given.scope as string) < min) {
      return `the scope has ${wordCount(given.scope as string)} words; ${min} or more say what the quiz covers, for example "${scope.example?.en ?? ""}"`;
    }
    return { quizId: FORM_ID, value: { given } };
  };
}

export type WebRun = {
  io: BriefIo;
  json: boolean;
  questions: QuestionFile;
  /** the form's language: `--language` */
  lang: Lang;
  /** the answers the flags gave */
  prefill: Given;
  overridesOf(purpose: Purpose): Readonly<Record<string, QuestionValue>>;
  profiles: BriefData["profiles"];
  /** seconds; 0 waits forever */
  timeout: number;
  /** 0: a free port */
  port: number;
  open: boolean;
  dir: string;
  target: string;
  command: string;
  version: string;
  /** checks answers as the flags are checked: `Given`, or throws a problem in plain words */
  parse(flags: FlagText): Given;
  /** writes the brief for answers that passed; a plain-words problem, or null; throws when the file cannot be written */
  commit(given: Given): Promise<string | null>;
};

export type WebOutcome =
  | { kind: "written" }
  | { kind: "cancelled" }
  | { kind: "timeout" }
  | { kind: "interrupted" }
  | { kind: "failed"; message: string };

const defaultInterrupt = (handler: () => void): (() => void) => {
  process.once("SIGINT", handler);
  return () => {
    process.off("SIGINT", handler);
  };
};

/** Serves the form, prints the `listening` line under `--json`, and waits for the one submit, the timeout or Ctrl+C. */
export async function serveBriefForm(run: WebRun): Promise<WebOutcome> {
  const { io } = run;
  const folder = io.runtimeDir ?? runtimeFolder();
  const read = (name: string): string | null => {
    try {
      return readFileSync(join(folder, name), "utf8");
    } catch {
      return null;
    }
  };
  const script = read("brief.js");
  const pageCss = read("page.css");
  const briefCss = read("brief.css");
  if (script === null || pageCss === null || briefCss === null) {
    return { kind: "failed", message: "the page runtime is missing next to the program: run `npm run build`" };
  }
  const overrides: BriefData["overrides"] = {};
  for (const p of PURPOSES) {
    const own = run.overridesOf(p);
    if (Object.keys(own).length > 0) overrides[p] = { ...own };
  }
  const data: BriefData = {
    version: 1,
    lang: run.lang,
    questions: run.questions,
    prefill: run.prefill,
    overrides,
    profiles: run.profiles,
    timeout: run.timeout,
    dir: run.dir,
    target: run.target,
    command: run.command,
  };
  const page = buildBriefForm({
    data,
    script,
    css: pageCss,
    briefCss,
    builtAt: (io.now ?? (() => new Date()))().toISOString(),
    version: run.version,
  });

  let cancelled = false;
  let server: Awaited<ReturnType<typeof startServer<BriefSubmitValue>>>;
  try {
    server = await startServer<BriefSubmitValue>({
      pages: { "": page },
      quizIds: { [FORM_ID]: "form" },
      predicate: (accepted) => accepted.has(FORM_ID),
      timeoutMs: run.timeout * 1000,
      port: run.port,
      readSubmit: briefSubmitReader(run.questions, run.parse),
      ...(io.setTimer ? { setTimer: io.setTimer } : {}),
      async onSubmit(_id, value) {
        if ("cancel" in value) {
          cancelled = true;
          return null;
        }
        return run.commit(value.given);
      },
    });
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    const why = e.code === "EADDRINUSE" ? "the port is in use" : (e.message ?? "unknown error");
    return { kind: "failed", message: `cannot start the server${run.port ? ` on port ${run.port}` : ""}: ${why}` };
  }

  const removeInterrupt = (io.onInterrupt ?? defaultInterrupt)(() => server.stop());
  if (run.json) io.out(JSON.stringify({ status: "listening", url: server.url, port: server.port, pid: process.pid }));
  io.err(`asking about ${run.dir} at ${server.url}`);
  io.err("waiting for Finish (Ctrl+C to stop)");
  if (run.open) {
    try {
      await (io.open ?? systemOpen)(server.url);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      io.err(
        `warning: cannot open the page: ${e.code === "ENOENT" ? "the system's opener was not found" : (e.message ?? "unknown error")}`,
      );
    }
  }

  const outcome: ServerOutcome = await server.done;
  removeInterrupt();
  switch (outcome.status) {
    case "submitted":
      return cancelled ? { kind: "cancelled" } : { kind: "written" };
    case "timeout":
      return { kind: "timeout" };
    case "interrupted":
      return { kind: "interrupted" };
    case "error":
      return { kind: "failed", message: outcome.message };
  }
}
