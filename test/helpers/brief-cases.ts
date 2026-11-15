import type { BriefOptions } from "../../src/cli/brief";
import { KEY, pick, typed } from "./tui";

/**
 * The answer sets of the byte-identity criterion (STEP3.md, step 3's "Done when"): each is answered through flags
 * (`flags`), through `--tui` (`script`, the keys of its prompts) and through `--web` (e2e/brief-identity.spec.ts drives
 * the form to `flags`, after the pre-fills `form` gave it), and every way writes the same bytes. 3i built the first
 * ones; 3h adds those with pre-fills changed and restored.
 */

export const SCOPE = "lectures 3 to 5, the Fourier transform";
export const VI_SCOPE = "bài giảng 3 đến 5, phép biến đổi Fourier";

/** The prompts of the form in the question file's order, one key string each; `over` changes some. */
type Step =
  | "purpose"
  | "scope"
  | "kinds"
  | "other"
  | "elsewhere"
  | "count"
  | "minutes"
  | "mix"
  | "difficulty"
  | "mode"
  | "language"
  | "request"
  | "weak"
  | "commitment"
  | "profile";
const ORDER: Step[] = [
  "purpose",
  "scope",
  "kinds",
  "elsewhere",
  "count",
  "minutes",
  "mix",
  "difficulty",
  "mode",
  "language",
  "request",
  "weak",
  "commitment",
  "profile",
];
export function walk(over: Partial<Record<Step, string>>, tail: string[] = [KEY.enter]): string[] {
  const steps: string[] = [];
  for (const step of ORDER) {
    steps.push(over[step] ?? (step === "scope" ? typed(SCOPE) : KEY.enter));
    if (step === "kinds" && over.other !== undefined) steps.push(over.other);
  }
  return [...steps, ...tail];
}

export type Case = {
  name: string;
  script: string[];
  form?: Partial<BriefOptions>;
  flags: Partial<BriefOptions>;
  files?: Record<string, string>;
  /** `--web` only: change the pre-filled answers first, then put them back (each question's button, then all at once) */
  detour?: "change-restore";
};
export const cases: Case[] = [
  ...(["self-study", "exam-prep", "classmates", "survey"] as const).map((purpose, i) => ({
    name: `purpose ${purpose}, defaults for the rest`,
    script: walk({ purpose: pick(i) }),
    flags: { purpose, scope: SCOPE },
  })),
  {
    name: "Vietnamese: the language answered in the form",
    script: walk({
      purpose: pick(2),
      scope: typed(VI_SCOPE),
      language: pick(1),
      request: typed("ôn kỹ phần chuỗi: Fourier # 2"),
    }),
    flags: { purpose: "classmates", scope: VI_SCOPE, language: "vi", request: "ôn kỹ phần chuỗi: Fourier # 2" },
  },
  {
    name: "Vietnamese: language given as a flag and kept",
    script: walk({ scope: typed(VI_SCOPE) }),
    form: { language: "vi", purpose: "self-study" },
    flags: { purpose: "self-study", scope: VI_SCOPE, language: "vi" },
  },
  {
    name: "other with its text, and notes",
    script: walk({
      kinds: `${KEY.down.repeat(2)}${KEY.space}${KEY.down.repeat(3)}${KEY.space}${KEY.enter}`,
      other: typed("a field journal: week 4"),
    }),
    flags: { purpose: "self-study", scope: SCOPE, kinds: "notes,other", kindsOther: "a field journal: week 4" },
  },
  {
    name: "the purpose changed on the way back",
    script: walk({ count: typed("12"), mode: pick(1) }, [pick(1), pick(1), KEY.enter]),
    flags: { purpose: "exam-prep", scope: SCOPE, count: "12", mode: "timed-exam" },
  },
  {
    name: "weak topics yes (and its warning)",
    script: walk({ weak: pick(-1) }),
    flags: { purpose: "self-study", scope: SCOPE, weakTopics: "yes" },
  },
  {
    name: "several answers changed, mix and minutes among them",
    script: walk({
      minutes: typed("37.5"),
      mix: `${KEY.space}${KEY.down.repeat(3)}${KEY.space}${KEY.enter}`,
      difficulty: pick(1),
      commitment: typed("75"),
      elsewhere: typed("the library's reserve copy"),
    }),
    flags: {
      purpose: "self-study",
      scope: SCOPE,
      minutes: "37.5",
      mix: "understanding,calculation,code".replace("understanding,calculation,code", "calculation,understanding,code"),
      difficulty: "harder",
      commitment: "75",
      elsewhere: "the library's reserve copy",
    },
  },
  {
    name: "a flag pre-fill kept, equal to its default",
    script: walk({ scope: KEY.enter }),
    form: { scope: SCOPE, count: "20", profile: "default" },
    flags: { purpose: "self-study", scope: SCOPE, count: "20", profile: "default" },
  },
  {
    name: "pre-fills changed and restored in the web form, then kept",
    script: walk({ purpose: KEY.enter, scope: KEY.enter, count: KEY.enter, mode: KEY.enter, request: KEY.enter }),
    form: { purpose: "exam-prep", scope: SCOPE, count: "25", mode: "timed-exam", request: "Match the 2024 midterm" },
    flags: { purpose: "exam-prep", scope: SCOPE, count: "25", mode: "timed-exam", request: "Match the 2024 midterm" },
    detour: "change-restore",
  },
  {
    name: "a pre-fill changed and kept changed, the others kept",
    script: walk({ purpose: KEY.enter, scope: KEY.enter, count: typed("30"), mode: KEY.enter }),
    form: { purpose: "exam-prep", scope: SCOPE, count: "25", mode: "timed-exam" },
    flags: { purpose: "exam-prep", scope: SCOPE, count: "30", mode: "timed-exam" },
  },
  {
    name: "a pre-fill changed to its default stays the user's",
    script: walk({ purpose: KEY.enter, scope: KEY.enter, count: typed("20") }),
    form: { purpose: "exam-prep", scope: SCOPE, count: "25" },
    flags: { purpose: "exam-prep", scope: SCOPE, count: "20" },
  },
];
