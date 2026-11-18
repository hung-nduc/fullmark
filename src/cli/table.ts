import pc from "picocolors";

/**
 * The terminal styles (COMMANDS.md, "Terminal style"). `simple`: no borders, columns separated by spaces, a shaded
 * header row, scores by band, coloured tags, `problem` and `note` as badges. `boxed`: the same, with tables drawn in box
 * characters and blocks such as `library status`'s facts in a panel. Colour is the terminal's own 16 ANSI colours, never
 * fixed RGB, and only when `color` is true (a terminal, no `--plain`, no `NO_COLOR`); without it the same text is drawn
 * with no escape codes, and always in the `simple` layout: output read by programs never changes with the setting.
 * `boxed` falls back to `simple` when the terminal is narrower than the table or the panel.
 */
export type Style = "simple" | "boxed";

export type Painter = {
  color: boolean;
  /** the layout of tables and blocks: `boxed` only on a coloured terminal, by the machine config */
  style: Style;
  /** the terminal's width in columns, when it is known; `boxed` falls back to `simple` below the table's width */
  width: number | null;
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

export function painter(color: boolean, look: { style?: Style; width?: number | null } = {}): Painter {
  const c = pc.createColors(color);
  return {
    color,
    // the box characters are for a terminal that shows colour: anything read by a program is always `simple`
    style: color ? (look.style ?? "simple") : "simple",
    width: look.width ?? null,
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

const fits = (p: Painter, width: number): boolean => p.width === null || width <= p.width;

/** A box-drawn line: `left`, the segments joined by `mid`, `right`. */
const rule = (widths: readonly number[], left: string, mid: string, right: string): string =>
  `${left}${widths.map((w) => "─".repeat(w + 2)).join(mid)}${right}`;

/**
 * Aligned columns, two spaces apart. `header` is shaded across the whole row; a row's trailing spaces are dropped
 * (a shaded header keeps its width, so the shade is one band). In the `boxed` style the table is drawn in box
 * characters, each cell shaded in the header row, when the terminal is wide enough; else as `simple`.
 */
export function renderTable(
  p: Painter,
  header: readonly string[],
  rows: readonly (readonly string[])[],
  align: readonly ("left" | "right")[] = [],
): string[] {
  const widths = header.map((h, i) => Math.max(visibleWidth(h), ...rows.map((r) => visibleWidth(r[i] ?? ""))));
  if (
    p.style === "boxed" &&
    fits(
      p,
      widths.reduce((n, w) => n + w + 3, 1),
    )
  ) {
    const cells = (row: readonly string[], shade: boolean): string =>
      `│${row
        .map((cell, i) => {
          const text = pad(cell, widths[i] ?? 0, align[i] ?? "left");
          return shade ? p.shade(` ${text} `) : ` ${text} `;
        })
        .join("│")}│`;
    return [
      rule(widths, "┌", "┬", "┐"),
      cells(header, true),
      rule(widths, "├", "┼", "┤"),
      ...rows.map((r) => cells(r, false)),
      rule(widths, "└", "┴", "┘"),
    ];
  }
  const line = (cells: readonly string[]): string =>
    cells.map((cell, i) => pad(cell, widths[i] ?? 0, align[i] ?? "left")).join("  ");
  const head = line(header);
  return [p.color ? p.shade(head) : head.trimEnd(), ...rows.map((r) => line(r).trimEnd())];
}

/** The width of the label column of a facts block (`Commits as` is the longest, and one space). */
const LABEL_WIDTH = 11;

/**
 * `Label      value` lines, the labels bold; `labelWidth` is the column the values start at (`quiz inspect` has 10, the
 * others 11). In the `boxed` style the block is a panel, when the terminal is wide enough; else the same lines as
 * `simple`.
 */
export function renderFacts(
  p: Painter,
  rows: readonly (readonly [label: string, value: string])[],
  labelWidth: number = LABEL_WIDTH,
): string[] {
  const lines = rows.map(
    ([label, value]) => `${p.bold(label)}${" ".repeat(Math.max(1, labelWidth - label.length))}${value}`,
  );
  const inner = Math.max(0, ...lines.map(visibleWidth));
  if (p.style !== "boxed" || lines.length === 0 || !fits(p, inner + 4)) return lines;
  return [
    rule([inner], "┌", "─", "┐"),
    ...lines.map((l) => `│ ${pad(l, inner, "left")} │`),
    rule([inner], "└", "─", "┘"),
  ];
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
