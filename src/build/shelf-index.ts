import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { en } from "../core/i18n/en";
import { paperEn, paperVi } from "../core/i18n/paper";
import { type ShelfMessages, shelfEn, shelfVi } from "../core/i18n/shelf";
import { vi } from "../core/i18n/vi";
import { DEFAULT_TYPE_ORDER, QUESTION_TYPES, type QuestionType } from "../core/ir";
import { toBase64 } from "../core/keyblob";
import { lightDarkCss } from "../core/themes";

/**
 * The index page of a shelf (COMMANDS.md, `quiz library publish`, "The index page"): every quiz on it in one table sorted by
 * title: the quiz (a link to `ID/index.html`, its language badge and its question types), its type (Exam or Practice),
 * questions, points, time limit and pass mark. On a phone the same table is restyled into one card per row. A static page
 * with no script and no `style` attribute, the page's light and dark theme tokens (dark from `prefers-color-scheme`),
 * system fonts and a CSP that allows only its own style sheet, by hash. Its look is the ShelfTable boards
 * (docs/mockup/boards). Pure, and it holds no time: the same quizzes give the same bytes.
 */
export type ShelfEntry = {
  id: string;
  title: string;
  lang: "en" | "vi";
  /** as the start screen counts them: a bank counts the questions drawn */
  questions: number;
  /** null when a bank draws from questions with different points, so the total is not known */
  points: number | null;
  /** seconds; null when untimed */
  timeLimit: number | null;
  /** percent; null when there is no pass mark */
  passMark: number | null;
  /** the version's stored profile is `exam` or extends it */
  exam: boolean;
  /** `feedback: instant` */
  instant: boolean;
  /** the question types the quiz holds */
  types: readonly QuestionType[];
};

const sha256Source = (text: string): string => `'sha256-${toBase64(sha256(utf8ToBytes(text)))}'`;

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const EXAM_ICON = "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9 2h6";
const PRACTICE_ICON = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";

const CSS =
  "body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6}" +
  "main{box-sizing:border-box;max-width:1096px;margin:0 auto;padding:48px 28px}" +
  ".wrap{display:flex;flex-direction:column;gap:24px}" +
  "h1{margin:0;font-size:2em;line-height:1.2;font-weight:700;overflow-wrap:anywhere}" +
  ".summary{margin:6px 0 0;font-size:.9em;color:var(--muted)}" +
  ".empty{color:var(--muted)}" +
  ".box{position:relative;overflow:clip;background:var(--card);border:1px solid var(--line);border-radius:var(--card-radius);box-shadow:var(--shadow)}" +
  "table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}" +
  "caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
  "thead th{position:sticky;top:0;z-index:1;background:var(--sunken);box-shadow:inset 0 -1px 0 var(--line);padding:10px 16px;font-size:.72em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);white-space:nowrap;text-align:right}" +
  "thead th:first-child,thead th:nth-child(2){text-align:left}" +
  "tbody tr{border-top:1px solid var(--line)}" +
  "tbody th,tbody td{padding:14px 16px;vertical-align:middle;text-align:right;white-space:nowrap}" +
  "tbody th{text-align:left;font-weight:400;width:46%;white-space:normal}" +
  "tbody td.type{text-align:left}" +
  ".q{display:flex;flex-direction:column;gap:4px}" +
  ".top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}" +
  "a{color:var(--accent);font-weight:700;text-decoration:none;overflow-wrap:anywhere}a:hover{text-decoration:underline}" +
  "a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}" +
  ".badge{flex-shrink:0;border:1px solid var(--line-strong);border-radius:4px;padding:0 6px;font-size:.72em;font-weight:700;letter-spacing:.06em;line-height:1.5}" +
  ".kinds{font-size:.85em;color:var(--muted)}" +
  ".t{display:flex;flex-direction:column;gap:2px;align-items:flex-start}" +
  ".pill{display:inline-flex;align-items:center;gap:6px;font-size:.85em;font-weight:700;line-height:1.5;padding:1px 10px;border-radius:999px;white-space:nowrap;background:var(--card);color:var(--text);border:1px solid var(--line-strong)}" +
  ".pill.exam{background:var(--info-wash);color:var(--info);border-color:var(--info)}" +
  ".instant{font-size:.8em;color:var(--muted)}" +
  "@media (max-width:519px){" +
  "body{font-size:16px}main{padding:24px 8px}.wrap{gap:16px}h1{font-size:1.6em}" +
  ".box{overflow:visible;background:none;border:0;border-radius:0;box-shadow:none}" +
  "table,tbody{display:block}" +
  "thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
  "tbody tr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));row-gap:6px;margin-bottom:10px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--card-radius);box-shadow:var(--shadow)}" +
  "tbody th,tbody td{padding:0;width:auto;text-align:left}" +
  "tbody th,tbody td.type{grid-column:1/-1}" +
  ".top{justify-content:space-between;flex-wrap:nowrap}" +
  "a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}" +
  "tbody td.n{margin-top:4px;border-top:1px solid var(--line);padding-top:8px;font-weight:700}" +
  "tbody td.n::before{content:attr(data-label);display:block;font-size:.7em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}" +
  "}";

/** The name of a question type in the paper's catalog, lower case but for the first letter of the whole list. */
function kindsText(types: readonly QuestionType[], ui: "en" | "vi"): string {
  const names = (ui === "vi" ? paperVi : paperEn).typeNames;
  const order: QuestionType[] = [...DEFAULT_TYPE_ORDER.flat(), ...QUESTION_TYPES];
  const seen = [...new Set(order)].filter((t) => types.includes(t));
  const text = seen
    .map((t) => names[t] ?? t)
    .map((n) => n.charAt(0).toLowerCase() + n.slice(1))
    .join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const num = (n: number, ui: "en" | "vi"): string => {
  const text = String(Math.round(n * 100) / 100);
  return ui === "vi" ? text.replace(".", ",") : text;
};

const byTitle = (a: ShelfEntry, b: ShelfEntry): number => {
  const [x, y] = [a.title.toLowerCase(), b.title.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

const DASH = "\u2013";

/** The page: `heading` is the shelf folder's name, `ui` the interface language (`--ui-lang`). */
export function buildShelfIndex(heading: string, entries: readonly ShelfEntry[], ui: "en" | "vi"): string {
  const t: ShelfMessages = ui === "vi" ? shelfVi : shelfEn;
  const duration = (ui === "vi" ? vi : en).page.duration;
  const css = lightDarkCss() + CSS;
  const csp = [
    "default-src 'none'",
    "script-src 'none'",
    `style-src ${sha256Source(css)}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const name = heading === "" ? t.heading : heading;
  const sorted = [...entries].sort(byTitle);
  const rows = sorted.map((e) => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${e.exam ? EXAM_ICON : PRACTICE_ICON}"></path></svg>`;
    const kinds = kindsText(e.types, ui);
    const cell = (label: string, value: string): string =>
      `<td class="n" data-label="${escapeHtml(label)}">${value}</td>`;
    return [
      "<tr>",
      `<th scope="row"><span class="q"><span class="top"><a href="${escapeHtml(encodeURIComponent(e.id))}/index.html" lang="${e.lang}">${escapeHtml(e.title)}</a>`,
      `<span class="badge" title="${escapeHtml(t.language[e.lang])}">${e.lang.toUpperCase()}</span></span>`,
      kinds === "" ? "" : `<span class="kinds">${escapeHtml(kinds)}</span>`,
      "</span></th>",
      `<td class="type"><span class="t"><span class="pill${e.exam ? " exam" : ""}">${icon}${e.exam ? t.exam : t.practice}</span>`,
      e.instant ? `<span class="instant">${t.instant}</span>` : "",
      "</span></td>",
      cell(t.headShort.questions, String(e.questions)),
      cell(t.headShort.points, e.points === null ? DASH : num(e.points, ui)),
      cell(t.headShort.time, e.timeLimit === null ? DASH : escapeHtml(duration(e.timeLimit))),
      cell(t.headShort.pass, e.passMark === null ? DASH : `${num(e.passMark, ui)}%`),
      "</tr>",
    ].join("");
  });
  const languages = new Set(sorted.map((e) => e.lang)).size;
  const th = (text: string): string => `<th scope="col">${escapeHtml(text)}</th>`;
  const body =
    rows.length === 0
      ? `<p class="empty">${t.empty}</p>`
      : `<div class="box"><table><caption>${escapeHtml(t.listLabel)}</caption><thead><tr>${[t.head.quiz, t.head.type, t.head.questions, t.head.points, t.head.time, t.head.pass].map(th).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  return [
    "<!doctype html>",
    `<html lang="${ui}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
    `<title>${escapeHtml(name)}</title>`,
    `<style>${css}</style>`,
    "</head>",
    "<body>",
    `<main><div class="wrap"><div><h1>${escapeHtml(name)}</h1>${rows.length === 0 ? "" : `<p class="summary">${t.summary(sorted.length, languages)}</p>`}</div>${body}</div></main>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
