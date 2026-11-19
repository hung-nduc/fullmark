import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";
import type { ShelfManifest } from "../../src/core/ir";
import { jsonSchema } from "../../src/core/json-schemas";
import {
  listQuizFolders,
  MANIFEST_FILE,
  manifestPaths,
  planSync,
  readManifest,
  renderManifest,
  safePath,
} from "../../src/library/shelf";
import { cleanTemps, tempDir } from "../helpers/library";

afterEach(cleanTemps);

const H1 = "1a2b".padEnd(64, "0");
const H2 = "2b9d".padEnd(64, "0");
const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

const FIRST: ShelfManifest["quizzes"][number] = {
  id: "signals",
  name: "signals-intro",
  title: "Signals",
  lang: "en",
  hash: H1,
  added: "2026-11-10T09:00:00+00:00",
  file: "signals.md",
  files: ["signals/signals.md", "signals/index.html"],
};

const manifest = (over: Partial<ShelfManifest> = {}): ShelfManifest => ({
  format: "fullmark-shelf",
  version: 2,
  ui_lang: "en",
  with_brief: false,
  fonts: "quiz",
  quizzes: [FIRST],
  files: ["index.html"],
  ...over,
});

describe("the shelf manifest", () => {
  it("renders sorted keys, quizzes by id and paths sorted, two-space indent, a final newline; the same bytes twice", () => {
    const m = manifest({
      quizzes: [
        { ...FIRST, id: "zeta", files: ["zeta/b", "zeta/a"] },
        { ...FIRST, id: "alpha", files: ["alpha/index.html"] },
      ],
    });
    const text = dec(renderManifest(m));
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.indexOf('"alpha"')).toBeLessThan(text.indexOf('"zeta"'));
    expect(text.indexOf('"files"')).toBeLessThan(text.indexOf('"fonts"'));
    expect(text.indexOf('"added"')).toBeLessThan(text.indexOf('"title"'));
    expect(text.indexOf('"zeta/a"')).toBeLessThan(text.indexOf('"zeta/b"'));
    expect(text).toContain('\n  "format": "fullmark-shelf",');
    expect(dec(renderManifest({ ...m, quizzes: [...m.quizzes].reverse() }))).toBe(text);
  });

  it("reads what it renders, to the same bytes", () => {
    const bytes = renderManifest(manifest());
    const read = readManifest(dec(bytes));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest).toEqual({
      ...manifest(),
      quizzes: [{ ...FIRST, files: ["signals/index.html", "signals/signals.md"] }],
    });
    expect(Buffer.from(renderManifest(read.manifest)).equals(Buffer.from(bytes))).toBe(true);
  });

  it("is refused as foreign when its format is another (or missing) or its version is below 2, and as newer above 2", () => {
    const refused = (text: string) => {
      const r = readManifest(text);
      return r.ok ? "ok" : `${r.kind}: ${r.message}`;
    };
    expect(refused('{"format":"fullmark-publish","version":2}')).toBe(
      'foreign: not a fullmark shelf: fullmark-shelf.json has format "fullmark-publish"',
    );
    expect(refused('{"version":2}')).toBe("foreign: not a fullmark shelf: fullmark-shelf.json has no `format`");
    expect(refused('{"format":"fullmark-shelf","version":1}')).toBe(
      "foreign: not a fullmark 1.0 shelf: fullmark-shelf.json has version 1",
    );
    expect(refused('{"format":"fullmark-shelf","version":3}')).toMatch(/^newer: fullmark-shelf\.json has version 3/);
  });

  it("is refused as malformed: not JSON, not an object, a missing or wrong field, a path that leaves the shelf", () => {
    const kind = (text: string) => {
      const r = readManifest(text);
      return r.ok ? "ok" : `${r.kind}: ${r.message}`;
    };
    expect(kind("{")).toMatch(/^malformed: not valid JSON/);
    expect(kind("[]")).toBe("malformed: it is not a JSON object");
    const good = manifest();
    expect(kind(JSON.stringify({ ...good, fonts: "bold" }))).toMatch(/^malformed: fullmark-shelf\.json: `fonts`:/);
    expect(kind(JSON.stringify({ ...good, quizzes: [{ ...FIRST, hash: "abc" }] }))).toMatch(
      /^malformed: fullmark-shelf\.json: `quizzes\.0\.hash`:/,
    );
    const { files: _f, ...noFiles } = good;
    expect(kind(JSON.stringify(noFiles))).toMatch(/^malformed: fullmark-shelf\.json: `files`:/);
    for (const bad of ["../x", "/etc/passwd", "a/../../b", "C:/x", "a\\b", "", "a//b"])
      expect(kind(JSON.stringify({ ...good, files: [bad] })), bad).toMatch(/^malformed/);
    expect(safePath("signals/index.html")).toBe(true);
    expect(manifestPaths(good)).toEqual(["index.html", "signals/signals.md", "signals/index.html"]);
  });

  it("has a JSON Schema that accepts what the writer writes and refuses what the reader refuses", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(jsonSchema("fullmark-shelf"));
    expect(validate(JSON.parse(dec(renderManifest(manifest()))))).toBe(true);
    expect(validate({ ...manifest(), version: 3 })).toBe(false);
    expect(validate({ ...manifest(), format: "other" })).toBe(false);
    expect(validate({ ...manifest(), fonts: "bold" })).toBe(false);
    expect(validate({ ...manifest(), ui_lang: "fr" })).toBe(false);
    const { with_brief: _w, ...partial } = manifest();
    expect(validate(partial)).toBe(false);
  });
});

describe("planSync", () => {
  const files = (o: Record<string, string>) => new Map(Object.entries(o).map(([k, v]) => [k, enc(v)]));
  const disk = (o: Record<string, string>) => (path: string) => (path in o ? enc(o[path] as string) : null);
  const q = (id: string, hash: string, paths: string[]) => ({ ...FIRST, id, hash, files: paths });

  it("adds what is not on disk, updates what the old manifest lists and differs, leaves what is the same", () => {
    const old = manifest({
      quizzes: [q("calculus", H1, ["calculus/index.html", "calculus/c.md"])],
      files: ["index.html"],
    });
    const next = manifest({
      quizzes: [q("calculus", H2, ["calculus/index.html", "calculus/c.md"]), q("signals", H1, ["signals/index.html"])],
    });
    const wanted = files({
      "index.html": "index2",
      "calculus/index.html": "page2",
      "calculus/c.md": "same",
      "signals/index.html": "new",
    });
    const plan = planSync({
      old,
      next,
      wanted,
      manifestBytes: renderManifest(next),
      current: disk({
        "index.html": "index1",
        "calculus/index.html": "page1",
        "calculus/c.md": "same",
        [MANIFEST_FILE]: "old",
      }),
    });
    expect(plan.writes).toEqual([
      { path: "calculus/index.html", kind: "update" },
      { path: "index.html", kind: "update" },
      { path: "signals/index.html", kind: "add" },
    ]);
    expect(plan.removes).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.quizzes).toEqual([
      { action: "add", id: "signals", why: "new on the shelf" },
      { action: "update", id: "calculus", why: "version 1a2b → 2b9d" },
    ]);
    expect(plan.index).toBe("update");
    expect(plan.manifest).toBe("update");
    expect(plan.unchanged).toBe(false);
  });

  it("removes only the paths the old manifest lists, and not a path it does not list", () => {
    const old = manifest({ quizzes: [q("gone", H1, ["gone/index.html", "gone/g.md"])], files: ["index.html"] });
    const next = manifest({ quizzes: [], files: ["index.html"] });
    const plan = planSync({
      old,
      next,
      wanted: files({ "index.html": "i" }),
      manifestBytes: renderManifest(next),
      current: disk({
        "index.html": "i",
        "gone/index.html": "x",
        "gone/g.md": "x",
        "gone/mine.txt": "owner's",
        "README.md": "owner's",
        [MANIFEST_FILE]: "old",
      }),
    });
    expect(plan.removes).toEqual(["gone/g.md", "gone/index.html"]);
    expect(plan.quizzes).toEqual([{ action: "remove", id: "gone", why: "off the shelf" }]);
    // the interim manifest lists everything it may touch: the old paths and the new ones
    expect(plan.union).toEqual(["gone/g.md", "gone/index.html", "index.html"]);
  });

  it("a listed path already missing is not a removal; a wanted path of the owner's that differs is a conflict, never written", () => {
    const old = manifest({ quizzes: [q("gone", H1, ["gone/index.html"])] });
    const next = manifest({ quizzes: [q("new", H1, ["new/index.html"])] });
    const plan = planSync({
      old,
      next,
      wanted: files({ "index.html": "i", "new/index.html": "page" }),
      manifestBytes: renderManifest(next),
      current: disk({ "new/index.html": "owner's own page", [MANIFEST_FILE]: "old" }),
    });
    expect(plan.removes).toEqual([]);
    expect(plan.conflicts).toEqual(["new/index.html"]);
    expect(plan.writes).toEqual([{ path: "index.html", kind: "add" }]);
  });

  it("is unchanged when every file and the manifest are what would be written", () => {
    const next = manifest();
    const wanted = files({ "index.html": "i", "signals/index.html": "p", "signals/signals.md": "m" });
    const manifestBytes = renderManifest(next);
    const plan = planSync({
      old: next,
      next,
      wanted,
      manifestBytes,
      current: (path) => (path === MANIFEST_FILE ? manifestBytes : (wanted.get(path) ?? null)),
    });
    expect(plan.unchanged).toBe(true);
    expect(plan.quizzes).toEqual([]);
    expect(plan.writes).toEqual([]);
  });
});

describe("listQuizFolders (G6)", () => {
  it("is a top-level folder with an .md file and an index.html at its top level, and nothing else", () => {
    const dir = tempDir();
    const put = (path: string) => {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), "x");
    };
    put("quiz-a/a.md");
    put("quiz-a/index.html");
    put("only-page/index.html");
    put("only-md/notes.md");
    put("nested/deep/x.md");
    put("nested/deep/index.html");
    put("loose.md");
    put("index.html");
    put("upper/Q.MD");
    put("upper/index.html");
    expect(listQuizFolders(dir)).toEqual(["quiz-a", "upper"]);
    expect(listQuizFolders(join(dir, "missing"))).toEqual([]);
  });
});
