import type { Given } from "../cli/brief";
import { defaultOf, questionOf, wordCount } from "../core/brief/defaults";
import type { Question, QuestionFile, QuestionValue } from "../core/brief/questions";
import type { ContentKind, MixKind, Purpose } from "../core/brief/write";
import type { BriefData } from "./data";

/**
 * The form's answers, as `--tui`'s form keeps them (src/cli/brief-tui.ts): a key is in `kept` when the person chose it
 * (typed, changed, or a flag gave it); every other question holds the default of the purpose. What the form returns is
 * `Given`, which `runBrief` turns into the bytes exactly as it does for flags, so nothing here decides the file.
 */
export type Kept = Readonly<Record<string, QuestionValue>>;

/** Where an answer came from, as the cards mark it. */
export type Mark = "you" | "prefilled" | "default" | "missing";

export type Model = {
  file: QuestionFile;
  overrides: BriefData["overrides"];
  /** the flags' answers, by question key (the follow-up's too) */
  pre: Kept;
  /** the keys a flag gave: kept as the user's even when changed back to the default */
  flagged: ReadonlySet<string>;
};

const same = (a: QuestionValue | undefined, b: QuestionValue | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The flags' answers by question key, as `--tui`'s `seed` has them. */
export function prefillOf(given: Given): Record<string, QuestionValue> {
  const out: Record<string, QuestionValue> = {};
  const set = (key: string, value: QuestionValue | undefined): void => {
    if (value !== undefined) out[key] = value;
  };
  set("purpose", given.purpose);
  set("scope", given.scope);
  set("content.kinds", given.kinds);
  set("kinds_other", given.kindsOther);
  set("content.elsewhere", given.elsewhere);
  set("count", given.count);
  set("minutes", given.minutes);
  set("mix", given.mix);
  set("difficulty", given.difficulty);
  set("mode", given.mode);
  set("weak_topics", given.weakTopics === undefined ? undefined : given.weakTopics ? "yes" : "no");
  set("commitment", given.commitment);
  set("language", given.language);
  set("request", given.request);
  set("profile", given.profile);
  return out;
}

export function modelOf(data: BriefData): Model {
  const pre = prefillOf(data.prefill);
  return { file: data.questions, overrides: data.overrides, pre, flagged: new Set(Object.keys(pre)) };
}

export const question = (m: Model, key: string): Question => questionOf(m.file, key);

export const purposeOf = (kept: Kept): Purpose | undefined => kept.purpose as Purpose | undefined;

/** The default of a question now: the purpose's, which is Self-study's until one is picked. */
export function defaultNow(m: Model, kept: Kept, q: Question): QuestionValue {
  const p = purposeOf(kept) ?? (question(m, "purpose").default as Purpose);
  return defaultOf(q, p, m.overrides[p] ?? {});
}

const isHuman = (q: Question): boolean => q["human-only"] === true && q.optional !== true;

/** What a question holds now: the person's answer, else its default (nothing for purpose and scope). */
export function currentOf(m: Model, kept: Kept, q: Question): QuestionValue | undefined {
  const own = kept[q.key];
  if (own !== undefined) return own;
  if (isHuman(q)) return undefined;
  return defaultNow(m, kept, q);
}

/** Records an answer: left at its default it is a default again (and follows the purpose), else it is the user's. */
export function record(m: Model, kept: Kept, q: Question, value: QuestionValue): Kept {
  const next = { ...kept };
  if (isHuman(q) || m.flagged.has(q.key) || !same(value, defaultNow(m, kept, q))) next[q.key] = value;
  else delete next[q.key];
  return next;
}

/** A scope under its `min-words` (the detail rule). */
export function isVague(m: Model, kept: Kept, q: Question): boolean {
  const min = q["min-words"];
  const value = currentOf(m, kept, q);
  return min !== undefined && typeof value === "string" && value.trim() !== "" && wordCount(value) < min;
}

export function markOf(m: Model, kept: Kept, q: Question): Mark {
  const value = currentOf(m, kept, q);
  if (isHuman(q) && (value === undefined || value === "")) return "missing";
  if (kept[q.key] === undefined) return "default";
  return q.key in m.pre && same(kept[q.key], m.pre[q.key]) ? "prefilled" : "you";
}

/** The questions as the form has them: the file's, in its order. */
export const questionsOf = (m: Model): readonly Question[] => m.file.questions;

export type Counts = { you: number; prefilled: number; default: number; missing: number; vague: boolean };

export function countsOf(m: Model, kept: Kept): Counts {
  const c: Counts = { you: 0, prefilled: 0, default: 0, missing: 0, vague: false };
  for (const q of questionsOf(m)) {
    const mark = markOf(m, kept, q);
    if (mark === "you") c.you++;
    else if (mark === "prefilled") c.prefilled++;
    else if (mark === "default") c.default++;
    else c.missing++;
    if (isVague(m, kept, q)) c.vague = true;
  }
  return c;
}

/** The questions that block Finish, in order: missing, or too short. */
export type Blocker = { key: string; why: "purpose" | "scope" | "vague" };
export const blocking = (m: Model, kept: Kept): Blocker[] =>
  questionsOf(m).flatMap((q): Blocker[] => {
    if (isVague(m, kept, q)) return [{ key: q.key, why: "vague" }];
    if (markOf(m, kept, q) === "missing") return [{ key: q.key, why: q.key === "purpose" ? "purpose" : "scope" }];
    return [];
  });

/** Pre-filled answers the person has changed (the follow-up is not a question of its own: its card's). */
export function changedKeys(m: Model, kept: Kept): string[] {
  return Object.keys(m.pre).filter((k) => !same(kept[k], m.pre[k]));
}

/** The keys that go back together with a question's pre-filled answer (a choice's follow-up goes with it). */
export function revertKeys(q: Question): string[] {
  const follow = q["follow-up"]?.key;
  return follow === undefined ? [q.key] : [q.key, follow];
}

/** Puts the pre-filled answers of `keys` back, leaving every other answer as it is. */
export function revert(m: Model, kept: Kept, keys: readonly string[]): Kept {
  const next = { ...kept };
  for (const k of keys) {
    if (k in m.pre) next[k] = m.pre[k] as QuestionValue;
  }
  return next;
}

/** What the form returns, as `--tui`'s ends: the answers kept, as flags would give them. */
export function givenOf(kept: Kept): Given {
  const given: Given = {};
  const get = <T extends QuestionValue>(key: string): T | undefined => kept[key] as T | undefined;
  const set = <K extends keyof Given>(k: K, v: Given[K] | undefined): void => {
    if (v !== undefined) given[k] = v;
  };
  set("purpose", get<string>("purpose") as Purpose | undefined);
  set("scope", get<string>("scope")?.trim());
  set("kinds", get<string[]>("content.kinds") as ContentKind[] | undefined);
  set("kindsOther", get<string>("kinds_other"));
  set("elsewhere", get<string>("content.elsewhere"));
  set("count", get<number>("count"));
  set("minutes", get<number>("minutes"));
  set("mix", get<string[]>("mix") as MixKind[] | undefined);
  set("difficulty", get<string>("difficulty"));
  set("mode", get<string>("mode"));
  const weak = get<string>("weak_topics");
  set("weakTopics", weak === undefined ? undefined : weak === "yes");
  set("commitment", get<number>("commitment"));
  set("language", get<string>("language") as Given["language"]);
  set("request", get<string>("request"));
  set("profile", get<string>("profile"));
  return given;
}

/** A multi's values in the order of its choices, so the same set is the same answer however it was ticked. */
export const inChoiceOrder = (q: Question, values: readonly string[]): string[] =>
  (q.choices ?? []).map((c) => c.value).filter((v) => values.includes(v));
