import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "../../src/cli/atomic";
import { emptyIndex, type LibraryIndex, readIndex, renderIndex, writeIndex } from "../../src/library/index-file";
import { cleanTemps, tempDir } from "../helpers/library";

afterEach(cleanTemps);

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

const index: LibraryIndex = {
  ...emptyIndex("2026-11-18T14:22:10+07:00"),
  quizzes: [
    {
      name: "signals",
      id: "signals",
      title: 'Signals "and" systems',
      source: "/home/minh/quizzes/signals.md",
      current: H2,
      versions: [
        { hash: H1, added: "2026-11-17T09:05:00+07:00" },
        { hash: H2, added: "2026-11-18T08:00:00+07:00" },
      ],
      shelves: [],
    },
    {
      name: "rust-basics",
      id: "rust",
      title: "Rust basics",
      source: "C:\\quizzes\\rust.md",
      current: H1,
      versions: [{ hash: H1, added: "2026-11-17T09:00:00+07:00" }],
      shelves: ["public"],
    },
  ],
};

describe("library.toml", () => {
  it("writes the same bytes for the same index: sorted by name, keys in a fixed order, a final newline", () => {
    const text = renderIndex(index);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.indexOf("[quizzes.rust-basics]")).toBeLessThan(text.indexOf("[quizzes.signals]"));
    expect(renderIndex({ ...index, quizzes: [...index.quizzes].reverse() })).toBe(text);
    expect(text).toContain(`versions = [{ hash = "${H1}", added = "2026-11-17T09:05:00+07:00" }, { hash = "${H2}"`);
  });

  it("round-trips: what is read renders to the same bytes", () => {
    const text = renderIndex(index);
    const read = readIndex(text);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.index.quizzes.map((q) => q.name)).toEqual(["rust-basics", "signals"]);
    expect(read.index.quizzes[1]?.title).toBe('Signals "and" systems');
    expect(read.index.quizzes[0]?.source).toBe("C:\\quizzes\\rust.md");
    expect(read.index.quizzes[0]?.shelves).toEqual(["public"]);
    expect(renderIndex(read.index)).toBe(text);
  });

  it("an empty library is three lines", () => {
    expect(renderIndex(emptyIndex("2026-11-18T14:22:10+07:00"))).toBe(
      'format = "fullmark-library"\nversion = 2\ncreated = "2026-11-18T14:22:10+07:00"\n',
    );
    expect(readIndex(renderIndex(emptyIndex("x"))).ok).toBe(true);
  });

  const problemsOf = (text: string) => {
    const r = readIndex(text);
    return r.ok ? [] : r.problems.map((p) => `${p.line}: ${p.message}`);
  };
  const head = 'format = "fullmark-library"\nversion = 2\ncreated = "t"\n';
  const quiz = (extra = "") =>
    `\n[quizzes.a]\nid = "a"\ntitle = "A"\nsource = "/a.md"\ncurrent = "${H1}"\nversions = [{ hash = "${H1}", added = "t" }]\n${extra}`;

  it("reads a quiz with `shelves` left out, as empty", () => {
    const r = readIndex(head + quiz());
    expect(r.ok && r.index.quizzes[0]?.shelves).toEqual([]);
  });

  it("names a foreign library: another version, another format, none (0.x)", () => {
    for (const [text, line, what] of [
      ['format = "fullmark-library"\nversion = 3\n', 2, "has version 3"],
      ['format = "other"\nversion = 2\n', 1, 'has format "other"'],
      ["version = 1\n", 1, "has no `format`"],
      ["[quizzes.a]\nid = 'a'\n", 1, "has no `format`"],
    ] as const) {
      const r = readIndex(text);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.foreign).toBe(true);
      expect(r.problems[0]).toMatchObject({ line });
      expect(r.problems[0]?.message).toBe(`not a fullmark 1.0 library: library.toml ${what}`);
    }
  });

  it("reports TOML that does not parse, with its line", () => {
    const r = readIndex(`${head}\nbroken = \n`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.foreign).toBe(false);
      expect(r.problems[0]?.line).toBe(5);
      expect(r.problems[0]?.message).toMatch(/^not valid TOML/);
    }
  });

  it("reports each problem of the content with the line of its key", () => {
    expect(problemsOf('format = "fullmark-library"\nversion = 2\n')).toEqual([
      "1: `created` must be a time, in quotes",
    ]);
    expect(problemsOf(`${head}extra = 1\n`)).toEqual(["4: unknown key `extra`"]);
    expect(problemsOf(`${head}quizzes = 5\n`)).toEqual(["4: `quizzes` must be a table of quizzes"]);
    expect(problemsOf(`${head}\n[quizzes.Bad_Name]\nid = "a"\n`)).toEqual(['5: "Bad_Name" is not a valid name']);
    expect(problemsOf(head + quiz("colour = 1\n"))).toEqual(["11: quiz `a`: unknown key `colour`"]);
    expect(problemsOf(`${head}\n[quizzes.a]\nid = "a"\ntitle = "A"\n`)).toEqual([
      "5: quiz `a`: `source` is missing",
      "5: quiz `a`: `current` is missing",
      "5: quiz `a`: `versions` is missing",
    ]);
    expect(problemsOf(head + quiz().replace(`current = "${H1}"`, `current = "${H2}"`))).toEqual([
      "9: quiz `a`: `current` is not one of its versions",
    ]);
    expect(problemsOf(head + quiz().replace(`hash = "${H1}"`, 'hash = "abc"'))).toEqual([
      "10: quiz `a`: `versions.0.hash`: must be a hash: 64 lowercase hexadecimal characters",
    ]);
    expect(problemsOf(head + quiz() + quiz().replace("[quizzes.a]", "[quizzes.b]"))).toEqual([
      "13: quiz `b` has the id of quiz `a`",
    ]);
  });

  it("is written atomically: a writer killed mid-way leaves the old file, readable", async () => {
    const dir = tempDir();
    const file = join(dir, "library.toml");
    const old = renderIndex(emptyIndex("old"));
    writeFileSync(file, old);
    // a writer that dies after writing half of the temporary file and before the rename
    const killed = async (path: string, data: Uint8Array): Promise<void> => {
      writeFileSync(join(path, "..", `.library.toml.0123abcd.tmp`), data.slice(0, 10));
      throw new Error("killed");
    };
    await expect(writeIndex(file, index, killed)).rejects.toThrow("killed");
    expect(readFileSync(file, "utf8")).toBe(old);
    expect(readIndex(readFileSync(file, "utf8")).ok).toBe(true);
    // and the real writer leaves the new file whole, with no temporary file
    await writeIndex(file, index, writeFileAtomic);
    expect(readFileSync(file, "utf8")).toBe(renderIndex(index));
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp") && f !== ".library.toml.0123abcd.tmp")).toEqual([]);
  });

  it("makes the folder of the file when it is missing (a new library)", async () => {
    const dir = tempDir();
    mkdirSync(join(dir, "x"));
    await writeIndex(join(dir, "x", "y", "library.toml"), emptyIndex("t"), writeFileAtomic);
    expect(readdirSync(join(dir, "x", "y"))).toEqual(["library.toml"]);
  });
});
