import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile } from "../src/cli/check";
import { capture } from "./helpers/cli";
import { type Fenced, fencedBlocks } from "./helpers/fenced";

/**
 * Every `quiz-example` block of the authoring guide passes `check` (QUIZ_SYNTAX.md; TECHNICAL_DESIGN.md, section 7, "A
 * visual guide"), so the guide cannot document syntax the parser rejects. How a block is checked, the same for all:
 *
 * - A block that starts with `---` is a whole quiz and is checked as it is.
 * - Any other block is a fragment: it gets the front matter `---`, `title: Example`, `---` and a blank line before it.
 * - It is written as `quiz.md` in a folder that holds the files the guide's examples name: `assets/chart.png`,
 *   `assets/z-table.png`, `track1.mp3` and the sheet `materials/formulas.md`.
 * - It is checked under the `default` profile with `strict` on, so a warning fails it as an error does, and the
 *   failure names the block's line in `guide/GUIDE.md`.
 */
const root = resolve(import.meta.dirname, "..");
const guidePath = join(root, "guide", "GUIDE.md");
const blocks = fencedBlocks(readFileSync(guidePath, "utf8")).filter((b) => b.info === "quiz-example");

// a 1 x 1 PNG: the checker needs a file of a supported type, not a picture
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const FRONT = "---\ntitle: Example\n---\n\n";

/** The text that is checked for a block, and how many lines the wrapping added before it. */
function wrap(text: string): { source: string; added: number } {
  if (text.startsWith("---\n")) return { source: `${text}\n`, added: 0 };
  return { source: `${FRONT}${text}\n`, added: FRONT.split("\n").length - 1 };
}

function sandbox(source: string): { dir: string; done(): void } {
  const dir = mkdtempSync(join(tmpdir(), "fullmark-guide-"));
  const files: Record<string, string | Buffer> = {
    "quiz.md": source,
    "assets/chart.png": PNG,
    "assets/z-table.png": PNG,
    "track1.mp3": Buffer.from("ID3"),
    "materials/formulas.md": "# Formulas\n\n$$sin^2 x + cos^2 x = 1$$\n",
  };
  for (const [path, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), data);
  }
  return { dir, done: () => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }) };
}

function checked(block: Fenced): string[] {
  const { source, added } = wrap(block.text);
  const box = sandbox(source);
  try {
    const { io } = capture(box.dir);
    const result = checkFile(
      join(box.dir, "quiz.md"),
      { profile: "default", config: null, strict: true, review: null, json: false, plain: true },
      io,
    );
    if (result.status === "error") return [`cannot check: ${result.message}`];
    return result.issues
      .filter((i) => i.level === "error" || i.level === "warning")
      .map((i) => `${i.rule} at line ${block.line + i.line - added}: ${i.message}`);
  } finally {
    box.done();
  }
}

describe("the examples of guide/GUIDE.md", () => {
  it("has examples", () => {
    expect(blocks.length).toBeGreaterThan(20);
  });

  for (const block of blocks) {
    it(`the quiz-example block at line ${block.line} passes check`, () => {
      expect(checked(block), `guide/GUIDE.md line ${block.line}`).toEqual([]);
    });
  }

  it("holds a fragment of every question type", () => {
    const text = blocks.map((b) => b.text).join("\n");
    for (const type of [
      "single",
      "multi",
      "truefalse",
      "numeric",
      "short",
      "blanks",
      "fields",
      "ordering",
      "matching",
      "essay",
      "code",
      "scale",
    ]) {
      expect(text, type).toContain(`type=${type}`);
    }
  });
});
