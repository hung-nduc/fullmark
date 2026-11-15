import type { Given } from "../cli/brief";
import type { Lang, QuestionFile, QuestionValue } from "../core/brief/questions";
import type { Purpose } from "../core/brief/write";

/** A profile the form offers: its name, and the file it comes from (null for a built-in one). */
export type ProfileOption = { name: string; file: string | null };

/**
 * What `quiz brief --web` hands to the form (`src/build/brief-form.ts` writes it into the page as JSON): the question
 * file, the answers the flags pre-filled, the defaults of each purpose, the profiles, and the names the cards show.
 */
export type BriefData = {
  version: 1;
  /** `--language`: the form's language, fixed for the run (the quiz's language is a question of its own) */
  lang: Lang;
  questions: QuestionFile;
  /** the answers the flags gave (`Given`): kept as the user's even when they equal the default */
  prefill: Given;
  /** the machine config's `[brief.purpose.<purpose>]` tables, which replace that purpose's defaults */
  overrides: Partial<Record<Purpose, Record<string, QuestionValue>>>;
  /** the built-in profiles, then every profile `--profile` would accept for this DIR */
  profiles: ProfileOption[];
  /** seconds the server waits; 0: forever (G113) */
  timeout: number;
  /** DIR's name: the form's title */
  dir: string;
  /** `DIR/brief.yaml` as the command shows it */
  target: string;
  /** the command that starts again, flags included (G112) */
  command: string;
};

/** What the form posts to `submit`: the answers, or a cancel (G112). */
export type BriefSubmit = { quizId: "brief"; given: Given } | { quizId: "brief"; cancel: true };
