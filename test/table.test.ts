import { describe, expect, it } from "vitest";
import { painter, plural, renderFacts, renderTable, visibleWidth } from "../src/cli/table";

const ESC = "\u001b[";

describe("the terminal style `simple` (table.ts)", () => {
  it("draws aligned columns with no colour and no trailing space, right-aligning where asked", () => {
    const p = painter(false);
    expect(
      renderTable(
        p,
        ["NAME", "TITLE", "BEST"],
        [
          ["signals", "Signals", "86%"],
          ["rust-basics", "Rust basics", "7%"],
        ],
        ["left", "left", "right"],
      ),
    ).toEqual(["NAME         TITLE        BEST", "signals      Signals       86%", "rust-basics  Rust basics    7%"]);
    expect(p.badge("problem")).toBe("problem");
    expect(p.band("92%", 92)).toBe("92%");
    expect(p.tag("changed")).toBe("changed");
  });

  it("draws the facts block with its labels in a column of 11", () => {
    expect(
      renderFacts(painter(false), [
        ["Library", "/lib"],
        ["Commits as", "x"],
      ]),
    ).toEqual(["Library    /lib", "Commits as x"]);
  });

  it("on a terminal: a shaded header, scores by band, coloured tags and badges, the terminal's own 16 colours", () => {
    const p = painter(true);
    expect(p.color).toBe(true);
    const table = renderTable(p, ["NAME", "BEST"], [[p.tag("changed", "yellow"), p.band("92%", 92)]]);
    expect(table[0]).toBe(`${ESC}7mNAME     BEST${ESC}27m`);
    expect(table[1]).toBe(`${ESC}33mchanged${ESC}39m  ${ESC}32m92%${ESC}39m`);
    expect(p.band("65%", 65)).toBe("65%");
    expect(p.band("80%", 80)).toBe(`${ESC}32m80%${ESC}39m`);
    expect(p.band("64%", 64)).toBe(`${ESC}33m64%${ESC}39m`);
    expect(p.badge("problem")).toBe(`${ESC}1m${ESC}31mproblem${ESC}39m${ESC}22m`);
    expect(p.badge("note")).toBe(`${ESC}1m${ESC}36mnote${ESC}39m${ESC}22m`);
    expect(p.bold("x")).toBe(`${ESC}1mx${ESC}22m`);
    expect(p.dim("x")).toBe(`${ESC}2mx${ESC}22m`);
    // never fixed RGB or the 256-colour palette
    expect([p.red("x"), p.green("x"), p.yellow("x"), p.cyan("x"), p.shade("x")].join("")).not.toMatch(/38;|48;/);
  });

  it("counts a cell by what the eye sees, not by its escape codes", () => {
    const p = painter(true);
    expect(visibleWidth(p.badge("problem"))).toBe(7);
    const rows = renderTable(
      p,
      ["A", "B"],
      [
        [p.red("long cell"), "x"],
        ["s", "y"],
      ],
    );
    expect(rows[2]?.startsWith("s          y")).toBe(true);
  });

  it("pluralises", () => {
    expect([plural(1, "note"), plural(2, "note"), plural(0, "note")]).toEqual(["1 note", "2 notes", "0 notes"]);
  });
});
