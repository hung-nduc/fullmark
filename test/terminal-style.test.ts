import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCheck } from "../src/cli/check";
import { runInspect } from "../src/cli/inspect";
import type { LibraryIo } from "../src/cli/library-common";
import { runLibraryInfo } from "../src/cli/library-info";
import { runLibraryList } from "../src/cli/library-list";
import { runLibraryStats } from "../src/cli/library-stats";
import { runLibraryStatus } from "../src/cli/library-status";
import { runStats } from "../src/cli/stats";
import { painter, renderFacts, renderTable } from "../src/cli/table";
import { capture } from "./helpers/cli";
import { cleanTemps, NOW } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

/**
 * The terminal styles (STEP4.md, slice 4f; COMMANDS.md, "Terminal style"): `simple` and `boxed` on a terminal, for every
 * command that draws a table or a block, with colour and without; `boxed` falls back to `simple` when the terminal is
 * narrower than the table; and what a program reads (`--plain`, `NO_COLOR`, no terminal, `--json`) never changes with
 * the setting. The plain output of every command is the goldens'.
 */
afterEach(cleanTemps);

const ESC = "\u001b[";
// biome-ignore lint/suspicious/noControlCharactersInRegex: strips the colour codes
const strip = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, "");
const BOX = /[┌┐└┘├┤┬┴┼│─]/;

describe("table.ts: the boxed style", () => {
  const rows = [
    ["signals", "Signals", "86%"],
    ["rust-basics", "Rust basics", "7%"],
  ];
  const header = ["NAME", "TITLE", "BEST"];
  const align = ["left", "left", "right"] as const;

  it("draws a table in box characters, the cells padded and the best column right-aligned", () => {
    const p = painter(true, { style: "boxed", width: 80 });
    expect(renderTable(p, header, rows, align).map(strip)).toEqual([
      "┌─────────────┬─────────────┬──────┐",
      "│ NAME        │ TITLE       │ BEST │",
      "├─────────────┼─────────────┼──────┤",
      "│ signals     │ Signals     │  86% │",
      "│ rust-basics │ Rust basics │   7% │",
      "└─────────────┴─────────────┴──────┘",
    ]);
  });

  it("shades each cell of the header row, and keeps the colours of the cells (the terminal's own 16)", () => {
    const p = painter(true, { style: "boxed", width: 80 });
    const lines = renderTable(
      p,
      ["NAME", "BEST"],
      [[p.tag("changed", "yellow"), p.band("92%", 92)]],
      ["left", "right"],
    );
    expect(lines[1]).toBe(`│${ESC}7m NAME    ${ESC}27m│${ESC}7m BEST ${ESC}27m│`);
    expect(lines[3]).toBe(`│ ${ESC}33mchanged${ESC}39m │  ${ESC}32m92%${ESC}39m │`);
    expect(lines.join("")).not.toMatch(/38;|48;/);
  });

  it("draws the facts block as a panel", () => {
    const p = painter(false, { style: "boxed", width: 80 });
    // without colour the style is always simple: a program reads it
    expect(renderFacts(p, [["Library", "/lib"]])).toEqual(["Library    /lib"]);
    const q = painter(true, { style: "boxed", width: 80 });
    expect(
      renderFacts(q, [
        ["Library", "/lib"],
        ["Commits as", "x"],
      ]).map(strip),
    ).toEqual(["┌─────────────────┐", "│ Library    /lib │", "│ Commits as x    │", "└─────────────────┘"]);
    // a label column of 10, as inspect has it
    expect(renderFacts(q, [["Types", "single 4"]], 10).map(strip)).toEqual([
      "┌────────────────────┐",
      "│ Types     single 4 │",
      "└────────────────────┘",
    ]);
  });

  it("falls back to simple when the terminal is narrower than the table or the panel", () => {
    // the table is 36 wide: it fits at 36 and not at 35
    const wide = painter(true, { style: "boxed", width: 36 });
    expect(renderTable(wide, header, rows, align).map(strip)[0]).toBe("┌─────────────┬─────────────┬──────┐");
    const narrow = painter(true, { style: "boxed", width: 35 });
    const lines = renderTable(narrow, header, rows, align).map(strip);
    expect(lines.join("\n")).not.toMatch(BOX);
    expect(lines[1]).toBe("signals      Signals       86%");
    expect(renderFacts(painter(true, { style: "boxed", width: 10 }), [["Library", "/lib"]]).map(strip)).toEqual([
      "Library    /lib",
    ]);
    // an unknown width never makes it fall back
    expect(renderTable(painter(true, { style: "boxed" }), header, rows, align).map(strip)[0]).toMatch(/^┌/);
  });

  it("simple stays the default, with or without colour", () => {
    expect(painter(true).style).toBe("simple");
    expect(painter(false, { style: "boxed" }).style).toBe("simple");
  });
});

async function setup(style: "simple" | "boxed" | null) {
  const h = await buildHistory();
  if (style !== null) appendFileSync(h.env.FULLMARK_CONFIG as string, `\n[terminal]\nstyle = "${style}"\n`);
  /** a command on a terminal (colour on, unless asked otherwise), its width injected */
  const run = async <T>(
    fn: (io: LibraryIo) => T | Promise<T>,
    options: { tty?: boolean; columns?: number; noColor?: boolean } = {},
  ) => {
    const { NO_COLOR: _off, ...withColour } = h.env;
    const c = capture(h.dir, options.noColor ? h.env : withColour);
    const io: LibraryIo = {
      ...c.io,
      tty: options.tty ?? true,
      columns: options.columns ?? 200,
      now: () => new Date(NOW),
    };
    const exit = await fn(io);
    return { exit, out: c.out, err: c.err };
  };
  return { ...h, run };
}

describe("library commands in the boxed style", () => {
  it("list: the table in box characters on a terminal; simple, narrow, plain, NO_COLOR, no terminal and --json are not", async () => {
    const t = await setup("boxed");
    const list = (options = {}, o = { json: false, plain: false }) => t.run((io) => runLibraryList(o, io), options);
    const boxed = await list();
    const text = boxed.out.map(strip);
    expect(text[2]).toMatch(/^┌[─┬]+┐$/);
    expect(text[3]).toMatch(/^│ NAME +│ TITLE +│ VERSIONS │ ATTEMPTS │ LAST │ BEST │ TAKEN +│ NOTES +│$/);
    expect(text.at(-1)).toMatch(/^└[─┴]+┘$/);
    expect(text.some((l) => l.includes("study-fixture") && l.includes("3 ungraded"))).toBe(true);
    // the header is shaded and the scores are by band: colour is on
    expect(boxed.out.join("\n")).toContain(`${ESC}7m`);
    // each way of being read by a program, or too narrow, is the simple layout
    for (const other of [
      await list({ columns: 60 }),
      await list({}, { json: false, plain: true }),
      await list({ noColor: true }),
      await list({ tty: false }),
    ]) {
      expect(other.out.map(strip).join("\n")).not.toMatch(BOX);
      expect(other.out.map(strip)[2]).toMatch(/^NAME +TITLE +VERSIONS/);
    }
    const json = await list({}, { json: true, plain: false });
    expect(JSON.parse(json.out[0] ?? "").quizzes).toHaveLength(3);
  });

  it("list in the simple style is the shaded table without borders, as before", async () => {
    for (const style of ["simple", null] as const) {
      const t = await setup(style);
      const r = await t.run((io) => runLibraryList({ json: false, plain: false }, io));
      expect(r.out.map(strip).join("\n")).not.toMatch(BOX);
      expect(r.out.join("\n")).toContain(`${ESC}7mNAME`);
    }
  });

  it("status: the facts block is a panel", async () => {
    const t = await setup("boxed");
    const r = await t.run((io) => runLibraryStatus({ json: false, plain: false }, io));
    const text = r.out.map(strip);
    expect(text[0]).toMatch(/^┌─+┐$/);
    expect(text[1]).toMatch(/^│ Library +.+│$/);
    expect(text.findIndex((l) => /^└─+┘$/.test(l))).toBeGreaterThan(3);
    const narrow = await t.run((io) => runLibraryStatus({ json: false, plain: false }, io), { columns: 20 });
    expect(narrow.out.map(strip).join("\n")).not.toMatch(BOX);
    expect(narrow.out.map(strip)[0]).toMatch(/^Library +/);
  });

  it("info and library stats: the blocks are panels", async () => {
    const t = await setup("boxed");
    const info = await t.run((io) => runLibraryInfo("study-fixture", { version: null, json: false, plain: false }, io));
    const text = info.out.map(strip);
    expect(text[0]).toMatch(/^study-fixture · Study fixture · version /);
    expect(text[1]).toMatch(/^┌─+┐$/);
    expect(text.at(-1)).toMatch(/^└─+┘$/);
    // wide enough for every row only on a very wide terminal; else the simple lines
    const stats = await t.run((io) => runLibraryStats("study-fixture", { json: false }, io), { columns: 1000 });
    expect(stats.out.map(strip)[1]).toMatch(/^┌─+┐$/);
    const narrowStats = await t.run((io) => runLibraryStats("study-fixture", { json: false }, io), { columns: 100 });
    expect(narrowStats.out.map(strip).join("\n")).not.toMatch(BOX);
  });
});

describe("check, inspect and stats", () => {
  const quiz = join(import.meta.dirname, "..", "examples", "calculus", "quiz.md");
  const reports = ["a1-v1", "a2-v1", "a3-v2"].map((n) =>
    join(import.meta.dirname, "fixtures", "stats", "reports", `${n}-report.json`),
  );

  it("inspect draws its block through the style: a panel when boxed, the plain lines (the goldens') otherwise", async () => {
    const t = await setup("boxed");
    const boxed = await t.run((io) =>
      runInspect(quiz, { profile: null, config: null, review: null, json: false, plain: false }, { ...io, cwd: t.dir }),
    );
    const text = boxed.out.map(strip);
    expect(text[0]).toMatch(/^calculus-1 · Calculus I: derivatives · version /);
    expect(text[1]).toBe("12 questions · 22 points · 3 sections · time limit 30m");
    expect(text[2]).toMatch(/^┌─+┐$/);
    expect(text[3]).toMatch(/^│ Types +single 4 \(4 points\)/);
    expect(text.some((l) => /^└─+┘$/.test(l))).toBe(true);
    expect(boxed.out[0]).toContain(`${ESC}1m`);
    const plain = await t.run(
      (io) =>
        runInspect(
          quiz,
          { profile: null, config: null, review: null, json: false, plain: true },
          { ...io, cwd: t.dir },
        ),
      {},
    );
    expect(plain.out[2]).toMatch(/^Types {5}single 4 \(4 points\)/);
    expect(plain.out.join("\n")).not.toMatch(BOX);
    // simple, on a terminal: the same rows with bold labels, no panel
    const simple = await setup("simple");
    const s = await simple.run((io) =>
      runInspect(
        quiz,
        { profile: null, config: null, review: null, json: false, plain: false },
        { ...io, cwd: simple.dir },
      ),
    );
    expect(s.out.map(strip).join("\n")).not.toMatch(BOX);
    expect(s.out[2]).toBe(`${ESC}1mTypes${ESC}22m     ${plain.out[2]?.slice(10)}`);
  });

  it("stats draws its block through the style, too", async () => {
    const t = await setup("boxed");
    const r = await t.run((io) => runStats(reports, { quiz: null, json: false }, { ...io, cwd: t.dir }), {
      columns: 1000,
    });
    const text = r.out.map(strip);
    expect(text[0]).toMatch(/^study · Study fixture · 3 attempts, 2 versions/);
    expect(text[1]).toMatch(/^┌─+┐$/);
    expect(text[2]).toMatch(/^│ Attempts +3 Oct 50%/);
    const plain = await t.run((io) => runStats(reports, { quiz: null, json: false }, { ...io, cwd: t.dir }), {
      tty: false,
    });
    expect(plain.out[1]).toMatch(/^Attempts {3}3 Oct 50%/);
    expect(plain.out.join("\n")).not.toMatch(BOX);
  });

  it("check paints its findings with the shared painter: coloured on a terminal, plain otherwise", async () => {
    const t = await setup("boxed");
    const file = join(t.dir, "q.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, readFileSync(join(import.meta.dirname, "fixtures", "invalid", "answer-missing.md"), "utf8"));
    const on = await t.run((io) =>
      runCheck([file], { profile: null, config: null, strict: false, review: null, json: false, plain: false }, io),
    );
    const off = await t.run((io) =>
      runCheck([file], { profile: null, config: null, strict: false, review: null, json: false, plain: true }, io),
    );
    expect(on.exit).toBe(1);
    expect(on.out.join("\n")).toContain(`${ESC}31m`);
    expect(off.out.join("\n")).not.toContain(ESC);
    expect(on.out.map(strip)).toEqual(off.out.map(strip));
  });
});
