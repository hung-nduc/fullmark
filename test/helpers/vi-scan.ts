import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { en, vi } from "../../src/core/i18n";
import { gradeEn, gradeVi } from "../../src/core/i18n/grade";
import { reviewEn, reviewVi } from "../../src/core/i18n/review";

/**
 * The comparison behind the `vi` scan (STEP2.md, slices 2i and 2i2), shared by `test/build/vi-scan.test.ts` (the page as
 * built) and `e2e/vi-scan.spec.ts` (the page as rendered, after Submit): no string of the `en` page catalog that
 * differs from its `vi` entry appears in the text, unless the author's own files hold it (they may be English).
 */
type Tree = { [key: string]: unknown };

/** The catalog's strings by key path, where the English and the Vietnamese differ (functions are not scanned). */
export function differing(a: Tree, b: Tree, path = ""): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(a)) {
    const other = b[key];
    const here = path === "" ? key : `${path}.${key}`;
    if (typeof value === "string" && typeof other === "string") {
      if (value !== other && value.trim().length >= 2) out.push([here, value]);
    } else if (value !== null && typeof value === "object" && other !== null && typeof other === "object") {
      out.push(...differing(value as Tree, other as Tree, here));
    }
  }
  return out;
}

/** The `en` page strings that differ from `vi`. */
export const catalogStrings: [string, string][] = differing(en.page as unknown as Tree, vi.page as unknown as Tree);

/** A stand-in for a function's argument: it splits the result where the argument went. */
const HOLE = "\u0001";
const CUT = new RegExp(`[${HOLE}\\d]+`);

/**
 * The fixed words of a catalog's functions: each is called with a stand-in, then with 1 and 0 (the singular, and the
 * false side of a flag), and the results are cut where an argument or a number went. Pieces of fewer than three letters
 * in a row ("of", "·") say nothing and are left out.
 */
function pieces(tree: Tree, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const here = path === "" ? key : `${path}.${key}`;
    if (typeof value === "function") {
      for (const arg of [HOLE, 1, 0]) {
        let text: unknown;
        try {
          text = (value as (...a: unknown[]) => unknown)(...Array(Math.max(value.length, 1)).fill(arg));
        } catch {
          continue;
        }
        if (typeof text !== "string") continue;
        for (const piece of text.split(CUT)) {
          const t = piece.trim();
          if (/\p{L}{3}/u.test(t)) out.set(t, here);
        }
      }
    } else if (value !== null && typeof value === "object") {
      for (const [t, k] of pieces(value as Tree, here)) out.set(t, k);
    }
  }
  return out;
}

/** The plain strings of a catalog, at any depth. */
function strings(tree: Tree): Set<string> {
  const out = new Set<string>();
  for (const value of Object.values(tree)) {
    if (typeof value === "string") out.add(value);
    else if (value !== null && typeof value === "object") for (const s of strings(value as Tree)) out.add(s);
  }
  return out;
}

/** A form catalog's English that differs from its `vi` twin: its strings, and the fixed words of its functions. */
function formStrings(name: string, a: Tree, b: Tree): [string, string][] {
  const theirs = new Set([...strings(b), ...pieces(b).keys()]);
  const fixed = [...pieces(a)]
    .filter(([t]) => !theirs.has(t))
    .map(([t, key]) => [`${name}.${key}()`, t] as [string, string]);
  return [...differing(a, b, name), ...fixed];
}

/**
 * What a served form (`quiz review`, `quiz grade --web`) may show in English: its own catalog (STEP3.md, slice 3z), and
 * the page's, whose parts it reuses (the question cards, Appearance, the replay in the grading form's frame).
 */
export const formCatalogStrings: [string, string][] = [
  ...catalogStrings,
  ...formStrings("review", reviewEn as unknown as Tree, reviewVi as unknown as Tree),
  ...formStrings("grade", gradeEn as unknown as Tree, gradeVi as unknown as Tree),
];

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** What a reader sees of the page's HTML: no scripts, styles, tags or attributes. */
export const visibleText = (html: string): string =>
  decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  );

/** The text of the author's own files (the quiz and its sheets), lower-cased. */
export const own = (dir: string): string => {
  let text = "";
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith(".md") || e.name.endsWith(".yaml")) text += `\n${readFileSync(join(d, e.name), "utf8")}`;
    }
  };
  walk(dir);
  return text.toLowerCase();
};

/** The catalog keys whose English string stands in `text` as a whole phrase and is not in the author's own files. */
export const leaksIn = (text: string, mine: string, scanned: [string, string][] = catalogStrings): string[] =>
  scanned
    .filter(([, value]) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(
        text,
      ),
    )
    .filter(([, value]) => !mine.includes(value.toLowerCase()))
    .map(([key, value]) => `${key}: "${value}"`);
