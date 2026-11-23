import { CONTROLS, type ControlWords, type Lang } from "../i18n/controls";
import type { Question, Quiz } from "../ir";
import type { Finding } from "./types";

/** `content.names-control` (TECHNICAL_DESIGN.md, section 5; QUIZ_SYNTAX.md, section 8): the matching, with no rule plumbing. */

export const NAMES_CONTROL_RULE = "content.names-control";
export const NAMES_CONTROL_MESSAGE = "names a control of the page; the paper has none";
const fixFor = (word: string) =>
  `reword "${word}": say what it is, not which control shows it (QUIZ_SYNTAX.md, section 8)`;

const blank = (s: string): string => s.replace(/[^\n]/g, " ");
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LETTER = "[\\p{L}\\p{M}\\p{N}_]";
const whole = (body: string): RegExp => new RegExp(`(?<!${LETTER})(?:${body})(?!${LETTER})`, "giu");
const spaced = (s: string): string => s.split(/\s+/).map(escapeRe).join("\\s+");

/** Fenced code, inline code and maths, blanked (newlines kept, so a line count still holds). */
export function withoutCode(text: string): string {
  const lines = text.split("\n");
  let fence: { ch: string; len: number } | null = null;
  const kept = lines.map((l) => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(l);
      if (close?.[1]?.startsWith(fence.ch) && close[1].length >= fence.len) fence = null;
      return blank(l);
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(l);
    if (open?.[1]) {
      fence = { ch: open[1][0] ?? "`", len: open[1].length };
      return blank(l);
    }
    return l;
  });
  return kept
    .join("\n")
    .replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, blank)
    .replace(/\$\$[\s\S]*?\$\$/g, blank)
    .replace(/(?<![\\$])\$(?=\S)(?:\\.|[^$\\\n])*?(?<=\S)\$(?![\d$])/g, blank);
}

/** The first place `text` names a control, as an index and the word found; null when it names none. */
export function findControl(
  source: string,
  lang: Lang,
  lists: Record<Lang, ControlWords> = CONTROLS,
): { index: number; word: string } | null {
  const words = lists[lang];
  const text = withoutCode(source.normalize("NFC"));
  let best: { index: number; word: string } | null = null;
  const take = (index: number, word: string) => {
    if (best === null || index < best.index) best = { index, word };
  };

  // the phrases that are ordinary words are set aside before the screen words are looked for
  let rest = text;
  for (const phrase of words.leave) rest = rest.replace(whole(spaced(phrase)), blank);
  const enForms = (w: string) => `${escapeRe(w)}(?:e?s|ed|ing|${escapeRe(w.slice(-1))}(?:ed|ing))?`;
  for (const w of words.screen) {
    const m = whole(lang === "en" ? enForms(w) : spaced(w)).exec(rest);
    if (m) take(m.index, m[0]);
  }
  // a word that names a control only as an instruction: "tap the button", never "the tap" or "a press"
  for (const w of words.instruction) {
    const forms = lang === "en" ? enForms(w) : spaced(w);
    const m = whole(`(${forms})\\s+(?:the|on|an?|here|this)`).exec(rest);
    if (m) take(m.index, m[1] ?? m[0]);
  }

  const labels = words.labels.map((l) => l.normalize("NFC").toLowerCase());
  for (const m of text.matchAll(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g)) {
    const run = (m[1] ?? m[2] ?? "").trim().replace(/:$/, "").trim();
    if (labels.includes(run.toLowerCase())) take(m.index, run);
  }
  for (const label of words.labels) {
    const l = spaced(label.normalize("NFC"));
    const next = lang === "en" ? `${l}\\s+buttons?` : `nút\\s+${l}`;
    const m = whole(next).exec(text);
    if (m) take(m.index, label);
  }
  return best;
}

/** The findings in one text: at most one, on the line of the first match. `line` is where the text starts. */
export function textFinding(text: string, line: number, lang: Lang, lists?: Record<Lang, ControlWords>): Finding[] {
  const found = findControl(text, lang, lists);
  if (!found) return [];
  const at = line + (text.normalize("NFC").slice(0, found.index).match(/\n/g)?.length ?? 0);
  return [{ line: at, message: NAMES_CONTROL_MESSAGE, fix: fixFor(found.word) }];
}

type Piece = { text: string; line: number };

/** Every text of a question a learner reads: not the sample answer, the keys or the starter code. */
function questionTexts(q: Question): Piece[] {
  const out: Piece[] = [{ text: q.prompt, line: q.line }];
  if (q.hint) out.push(q.hint);
  if (q.explanation) out.push(q.explanation);
  switch (q.type) {
    case "single":
    case "multi":
      for (const c of q.choices) {
        out.push({ text: c.text, line: c.line });
        if (c.input?.prompt) out.push({ text: c.input.prompt, line: c.line });
      }
      break;
    case "ordering":
      out.push(...q.items);
      break;
    case "matching":
      for (const p of q.pairs) out.push({ text: p.left, line: p.line }, { text: p.right, line: p.line });
      out.push(...q.distractors);
      break;
    case "fields":
      for (const f of q.fields) out.push({ text: f.label, line: f.line });
      break;
    case "scale":
      for (const l of q.labels) out.push({ text: l.text, line: l.line });
      break;
    case "essay":
    case "code":
      for (const c of q.rubric?.criteria ?? []) out.push({ text: c.text, line: c.line });
      break;
    default:
      break;
  }
  return out;
}

/** The findings of a quiz: one per text. */
export function namesControl(quiz: Quiz, lists?: Record<Lang, ControlWords>): Finding[] {
  const fm = quiz.frontMatter;
  const out: Finding[] = [];
  const check = (p: Piece) => out.push(...textFinding(p.text, p.line, fm.lang, lists));
  if (fm.description) check({ text: fm.description, line: fm.keyLines.description ?? 1 });
  for (const s of quiz.sections) {
    if (s.intro.trim() !== "") check({ text: s.intro, line: s.line + 1 });
    for (const p of s.passages) check(p);
    for (const q of s.questions) for (const p of questionTexts(q)) check(p);
  }
  return out;
}
