import pc from "picocolors";

/**
 * The terminal style `simple` (COMMANDS.md, "Terminal style"): no borders, columns separated by spaces, a shaded
 * header row, scores by band, coloured tags, `problem` and `note` as badges. Colour is the terminal's own 16 ANSI colours,
 * never fixed RGB, and only when `color` is true (a terminal, no `--plain`, no `NO_COLOR`); without it the same text is
 * drawn with no escape codes. `[terminal] style = "boxed"` is read and validated, and drawn as `simple` until 4f.
 */
export type Painter = {
  color: boolean;
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  green(s: string): string;
  yellow(s: string): string;
  cyan(s: string): string;
  /** the shaded header row */
  shade(s: string): string;
  /** `problem` or `note`, as a badge */
  badge(kind: "problem" | "note"): string;
  /** a score as text, by band: 80% and up green, under 65% yellow, else plain */
  band(text: string, percent: number): string;
  /** a mark such as `changed` or `ungraded`, as a coloured tag */
  tag(text: string, colour?: "yellow" | "cyan" | "green" | "red"): string;
};

export function painter(color: boolean): Painter {
  const c = pc.createColors(color);
  return {
    color,
    bold: c.bold,
    dim: c.dim,
    red: c.red,
    green: c.green,
    yellow: c.yellow,
    cyan: c.cyan,
    shade: (s) => c.inverse(s),
    badge: (kind) => (kind === "problem" ? c.bold(c.red(kind)) : c.bold(c.cyan(kind))),
    band: (text, percent) => (percent >= 80 ? c.green(text) : percent < 65 ? c.yellow(text) : text),
    tag: (text, colour = "cyan") => c[colour](text),
  };
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: matches the escape codes of colour
const ANSI = /\u001b\[[0-9;]*m/g;
/** The width of a cell as the eye counts it: without the escape codes. */
export const visibleWidth = (s: string): number => s.replace(ANSI, "").length;

const pad = (cell: string, width: number, align: "left" | "right"): string => {
  const gap = " ".repeat(Math.max(0, width - visibleWidth(cell)));
  return align === "right" ? gap + cell : cell + gap;
};

/**
 * Aligned columns, two spaces apart. `header` is shaded across the whole row; a row's trailing spaces are dropped
 * (a shaded header keeps its width, so the shade is one band).
 */
export function renderTable(
  p: Painter,
  header: readonly string[],
  rows: readonly (readonly string[])[],
  align: readonly ("left" | "right")[] = [],
): string[] {
  const widths = header.map((h, i) => Math.max(visibleWidth(h), ...rows.map((r) => visibleWidth(r[i] ?? ""))));
  const line = (cells: readonly string[]): string =>
    cells.map((cell, i) => pad(cell, widths[i] ?? 0, align[i] ?? "left")).join("  ");
  const head = line(header);
  return [p.color ? p.shade(head) : head.trimEnd(), ...rows.map((r) => line(r).trimEnd())];
}

/** The width of the label column of a facts block (`Commits as` is the longest, and one space). */
const LABEL_WIDTH = 11;

/** `Label      value` lines, the labels bold. */
export function renderFacts(p: Painter, rows: readonly (readonly [label: string, value: string])[]): string[] {
  return rows.map(([label, value]) => `${p.bold(label)}${" ".repeat(Math.max(1, LABEL_WIDTH - label.length))}${value}`);
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
