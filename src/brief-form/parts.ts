import type { Question, QuestionValue } from "../core/brief/questions";
import type { BriefMessages } from "../core/i18n/brief";
import type { BriefData } from "./data";
import { currentOf, type Kept, type Model } from "./logic";

/** The profile card lives under **More options**, not in a step. */
export const MORE_KEYS: readonly string[] = ["profile"];

/** The columns of a question's choices at 1280 px (the board's `cols`); a choice question of two or three is one row. */
export const COLS: Record<string, number> = {
  purpose: 2,
  "content.kinds": 3,
  mix: 3,
  difficulty: 3,
  mode: 3,
  language: 2,
  weak_topics: 2,
  profile: 2,
};

/** How far `-` and `+` move a number (the board's `step`); a cleared commitment starts at 70. */
export const STEP: Record<string, number> = { count: 1, minutes: 5, commitment: 5 };
export const COMMITMENT_START = 70;

/** One stroke path per question, drawn at 16 px in the card's head (the board's `ICONS`). */
export const ICONS: Record<string, string> = {
  purpose: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 11.5v1",
  scope: "M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z",
  "content.kinds": "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  "content.elsewhere":
    "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  count: "M5 9h14M5 15h14M10 4L8 20M16 4l-2 16",
  minutes: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2",
  mix: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  difficulty: "M5 20v-6M12 20V9M19 20V4",
  mode: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
  language:
    "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  weak_topics: "M3 7l6 6 4-4 8 8M15 17h6v-6",
  commitment: "M5 21V4M5 4h11l-2 4 2 4H5",
  request: "M4 5h16v11H9l-5 4z",
  profile: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
};

/** An element id for a question's card: the key's dot is not a character a selector wants. */
export const cardId = (key: string): string => `q-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;

export type ChoiceView = { value: string; label: string; hint: string };

/** A question's choices as the form shows them: the question file's, and for the profile every profile on offer (G115). */
export function choicesOf(data: BriefData, b: BriefMessages, q: Question): ChoiceView[] {
  const lang = data.lang;
  if (q.key === "profile") {
    return data.profiles.map((p) => {
      const known = (b.profiles as Record<string, { hint: string } | undefined>)[p.name];
      return { value: p.name, label: p.name, hint: p.file === null ? (known?.hint ?? "") : b.profileOwn(p.file) };
    });
  }
  return (q.choices ?? []).map((c) => ({ value: c.value, label: c.label[lang], hint: c.hint[lang] }));
}

/** The label of a choice's value. */
export const labelOf = (data: BriefData, b: BriefMessages, q: Question, value: string): string =>
  choicesOf(data, b, q).find((c) => c.value === value)?.label ?? value;

/** The shown form of an answer (the board's `display`): the sidebar's second line and the summary's Answer column. */
export function displayOf(
  data: BriefData,
  b: BriefMessages,
  m: Model,
  kept: Kept,
  q: Question,
  override?: QuestionValue,
  other?: string,
): string {
  const v = override !== undefined ? override : currentOf(m, kept, q);
  if (q.kind === "choice") return v === undefined || v === "" ? b.notAnswered : labelOf(data, b, q, String(v));
  if (q.kind === "multi") {
    const list = (v as string[] | undefined) ?? [];
    if (list.length === 0) return b.none;
    const followKey = q["follow-up"]?.key;
    const text = other ?? (followKey === undefined ? "" : String(kept[followKey] ?? ""));
    return list
      .map((x) => (x === q["follow-up"]?.when && text !== "" ? b.otherIs(text) : labelOf(data, b, q, x)))
      .join(", ");
  }
  if (q.key === "minutes") return v === 0 ? b.noLimit : b.minShort(Number(v));
  if (q.key === "commitment") return v === undefined || v === "" || v === 0 ? b.noGoalW : `${v}%`;
  if (q.key === "count") return b.nQuestions(Number(v));
  if (q.kind === "text") return v === undefined || v === "" ? (q["human-only"] ? b.notAnswered : b.none) : String(v);
  return String(v);
}
