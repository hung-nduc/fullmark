import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { type ShelfMessages, shelfEn, shelfVi } from "../core/i18n/shelf";
import { toBase64 } from "../core/keyblob";
import { deviceThemeCss } from "../core/themes";

/**
 * The index page of a shelf (COMMANDS.md, `quiz library publish`, "The index page"): every quiz on it, sorted by title,
 * each a link to `ID/` with its language badge, its number of questions and its time limit when it has one. A static
 * page with no script, the page's theme tokens in light and dark from `prefers-color-scheme`, system fonts and a CSP that
 * allows only its own style sheet, by hash. Pure, and it holds no time: the same quizzes give the same bytes.
 */
export type ShelfEntry = {
  id: string;
  title: string;
  lang: "en" | "vi";
  questions: number;
  /** seconds; null when untimed */
  timeLimit: number | null;
};

const sha256Source = (text: string): string => `'sha256-${toBase64(sha256(utf8ToBytes(text)))}'`;

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const CSS =
  "body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.6}" +
  "main{max-width:42rem;margin:0 auto;padding:1.5rem 8px 2rem}@media (min-width:520px){main{padding:2rem 16px}}" +
  "h1{font-size:1.5rem;margin:0 0 1rem;overflow-wrap:anywhere}" +
  "ul{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}" +
  "li{background:var(--card);border:1px solid var(--card-line);border-radius:var(--card-radius);padding:.75rem 1rem}" +
  "a{color:var(--accent);font-weight:600;text-decoration:none;overflow-wrap:anywhere}a:hover{text-decoration:underline}" +
  "a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}" +
  ".meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .75rem;margin-top:.25rem;color:var(--muted);font-size:.875rem}" +
  ".badge{border:1px solid var(--line-strong);border-radius:4px;padding:0 .375rem;font-weight:600;font-size:.75rem;letter-spacing:.04em}" +
  ".empty{color:var(--muted)}";

/** `1 h 30 min`: a time limit in whole seconds, in the page's language. */
export function limitText(seconds: number, t: ShelfMessages): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts = [...(h > 0 ? [t.hours(h)] : []), ...(m > 0 ? [t.minutes(m)] : []), ...(s > 0 ? [t.seconds(s)] : [])];
  return parts.length === 0 ? t.seconds(0) : parts.join(" ");
}

const byTitle = (a: ShelfEntry, b: ShelfEntry): number => {
  const [x, y] = [a.title.toLowerCase(), b.title.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** The page: `heading` is the shelf folder's name, `ui` the interface language (`--ui-lang`). */
export function buildShelfIndex(heading: string, entries: readonly ShelfEntry[], ui: "en" | "vi"): string {
  const t: ShelfMessages = ui === "vi" ? shelfVi : shelfEn;
  const css = deviceThemeCss() + CSS;
  const csp = [
    "default-src 'none'",
    "script-src 'none'",
    `style-src ${sha256Source(css)}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const name = heading === "" ? t.heading : heading;
  const items = [...entries].sort(byTitle).map((e) => {
    const facts = [
      `<span class="badge" lang="${e.lang}" title="${escapeHtml(t.language[e.lang])}">${e.lang.toUpperCase()}</span>`,
      `<span>${t.questions(e.questions)}</span>`,
      ...(e.timeLimit === null ? [] : [`<span>${t.timeLimit(limitText(e.timeLimit, t))}</span>`]),
    ];
    return `<li><a href="${escapeHtml(encodeURIComponent(e.id))}/index.html" lang="${e.lang}">${escapeHtml(e.title)}</a><div class="meta">${facts.join("")}</div></li>`;
  });
  const body =
    items.length === 0
      ? `<p class="empty">${t.empty}</p>`
      : `<ul aria-label="${escapeHtml(t.listLabel)}">${items.join("")}</ul>`;
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
    `<main><h1>${escapeHtml(name)}</h1>${body}</main>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
