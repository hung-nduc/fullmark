import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { jsonSchemaText, SCHEMA_NAMES, type SchemaName, schemaFile } from "../src/core/json-schemas";

/**
 * The JSON Schemas of `results`, `report`, `grades` and `review` (TECHNICAL_DESIGN.md, the 0.x-to-1.0 table, "JSON
 * Schemas"): made from the zod schemas by `npm run schemas`, committed in schemas/. A stale one fails here as a golden
 * does, and every file of the five formats in the tests and the examples is valid against its schema.
 */
const root = resolve(import.meta.dirname, "..");
const FOLDERS = ["test/golden", "e2e/golden", "examples"];

/**
 * The served commands' goldens mask what changes between runs (e2e/helpers.ts, `maskLines`, and the specs that write
 * them): a time is `<time>` or `<at>`. Each is put back as a time of the shape it hides before the file is checked.
 */
const UNMASK: Record<string, string> = { "<time>": "2026-11-16T09:30:00+07:00", "<at>": "2026-11-16T09:30:00+07:00" };

/**
 * The inputs that exist to be refused, each by the command its golden runs (a 0.x file, a missing key, a broken rule):
 * their schema refuses them too. Every other file of the five formats is valid.
 *
 * The grades schema holds each entry's shape (3z2), so four more grades inputs of the `rubrics-grades-invalid-*` goldens
 * are refused by it, each for a shape no rubric can take: a grader of kind "robot" and a nameless one (`everything`), an
 * entry with no `rubric_hash` (`no-rubric-hash`), an entry with no `rubric_hash` or `criteria` (`unknown-question`,
 * which `quiz grade` refuses for its id, a quiz-dependent reason, but whose entry is a shape no rubric can take too),
 * and an additive entry with `bullets` and no `criteria` (`wrong-mode`). `quiz grade` refuses all four. `other-key` (G121) is a holistic entry with `criteria` and no `bullets`:
 * the schema refuses it too, as the two now take the same files.
 */
const REFUSED = [
  "test/golden/check/review-invalid-json/input/review.json",
  "test/golden/check/review-invalid/input/review.json",
  "test/golden/grade/results-malformed/input/results.json",
  "test/golden/grade/results-v1/input/results.json",
  "test/golden/grade/rubrics-grades-v1/input/grades.json",
  "test/golden/grade/rubrics-grades-invalid-everything/input/grades.json",
  "test/golden/grade/rubrics-grades-invalid-no-rubric-hash/input/grades.json",
  "test/golden/grade/rubrics-grades-invalid-other-key/input/grades.json",
  "test/golden/grade/rubrics-grades-invalid-unknown-question/input/grades.json",
  "test/golden/grade/rubrics-grades-invalid-wrong-mode/input/grades.json",
  "test/golden/grade/several-with-grades/input/grades.json",
  "test/golden/grade/web-grades-v1/input/grades.json",
  "test/golden/library/grade-invalid-grades/input/grades.json",
  "test/golden/review/out-invalid-json/input/review.json",
  "test/golden/review/out-invalid/input/review.json",
  "test/golden/review/since-invalid/input/review.json",
];

const FORMATS: Record<string, SchemaName> = {
  "fullmark-results": "results",
  "fullmark-report": "report",
  "fullmark-grades": "grades",
  "fullmark-review": "review",
  "fullmark-shelf": "fullmark-shelf",
};

/** A schema's name without the `fullmark-` the manifest's name already has: the others get it in their `$id` and title. */
const short = (name: string): string => name.replace(/^fullmark-/, "");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return walk(path);
    return /\.jsonl?$/.test(e.name) ? [path] : [];
  });
}

/** The documents of one of the five formats in a file: a `.json` file is one document, a served golden may be one too. */
function documents(path: string): { name: SchemaName; json: unknown }[] {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  let json: unknown;
  try {
    json = JSON.parse(text, (_key, value) => (typeof value === "string" && value in UNMASK ? UNMASK[value] : value));
  } catch {
    return [];
  }
  const format = json !== null && typeof json === "object" ? (json as { format?: unknown }).format : undefined;
  const name = typeof format === "string" ? FORMATS[format] : undefined;
  return name ? [{ name, json }] : [];
}

describe("schemas/", () => {
  it.each(SCHEMA_NAMES)("%s: the committed schema equals a fresh one (run npm run schemas)", (name) => {
    expect(readFileSync(join(root, "schemas", schemaFile(name)), "utf8")).toBe(jsonSchemaText(name));
  });

  it("holds the five schemas and nothing else", () => {
    expect(readdirSync(join(root, "schemas")).sort()).toEqual(SCHEMA_NAMES.map(schemaFile).sort());
  });

  it("are copied into dist/schemas/ by the build, so they ship (run npm run build)", () => {
    const dist = join(root, "dist", "schemas");
    expect(readdirSync(dist).sort()).toEqual(SCHEMA_NAMES.map(schemaFile).sort());
    for (const name of SCHEMA_NAMES) {
      expect(readFileSync(join(dist, schemaFile(name)), "utf8"), name).toBe(
        readFileSync(join(root, "schemas", schemaFile(name)), "utf8"),
      );
    }
  });

  it("are made by no command: no chunk of dist/ holds the report's zod schema or the schema maker", () => {
    const dist = join(root, "dist");
    for (const f of readdirSync(dist).filter((n) => n.endsWith(".js"))) {
      const text = readFileSync(join(dist, f), "utf8");
      expect(text.includes("// src/core/report/schema.ts"), f).toBe(false);
      expect(text.includes("// src/core/json-schemas.ts"), f).toBe(false);
    }
  });

  it.each(SCHEMA_NAMES)("%s: draft 2020-12, with its $id, title and description", (name) => {
    const schema = JSON.parse(readFileSync(join(root, "schemas", schemaFile(name)), "utf8"));
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe(`fullmark-${short(name)}-v2`);
    expect(schema.title).toBe(`fullmark ${short(name)}, version 2`);
    expect(schema.description).toMatch(new RegExp(`^fullmark-${short(name)}, version 2: `));
  });
});

describe("every results, report, grades and review file in the tests and examples", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validators = Object.fromEntries(
    SCHEMA_NAMES.map((name) => [
      name,
      ajv.compile(JSON.parse(readFileSync(join(root, "schemas", schemaFile(name)), "utf8"))),
    ]),
  ) as Record<SchemaName, ReturnType<typeof ajv.compile>>;
  const files = FOLDERS.flatMap((f) => walk(join(root, f))).flatMap((path) =>
    documents(path).map((d) => ({ ...d, file: relative(root, path).split(sep).join("/") })),
  );

  it("finds files of each of the formats (the shelf's manifests are in the sync's goldens)", () => {
    for (const name of SCHEMA_NAMES) expect(files.filter((f) => f.name === name).length, name).toBeGreaterThan(0);
  });

  const valid = files.filter((f) => !REFUSED.includes(f.file));

  it.each(valid.map((f) => [f.file, f] as const))("%s is valid against its schema", (_file, f) => {
    const validate = validators[f.name];
    expect(validate(f.json) ? [] : validate.errors).toEqual([]);
  });

  it.each(REFUSED)("%s, refused by its command, is refused by its schema", (file) => {
    const f = files.find((x) => x.file === file);
    expect(f, `${file} is not found as a file of the five formats`).toBeDefined();
    if (f) expect(validators[f.name](f.json)).toBe(false);
  });
});

describe("the grades schema refuses a shape no rubric can take", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(join(root, "schemas", schemaFile("grades")), "utf8")));
  const entry = {
    mode: "additive",
    rubric_hash: "abc",
    points: 1,
    step: 0.5,
    criteria: { a: { text: "A", max: 1, score: null, note: null } },
    justification: null,
    improvement: null,
  };
  const file = (grader: unknown, grades: unknown) => ({
    format: "fullmark-grades",
    version: 2,
    results_hash: "x",
    grader,
    grades,
  });
  const ai = { kind: "ai", name: "Claude", model: "claude-opus-5-5" };

  it("accepts a template (a null grader and null cells) and a filled file with a grader on a question", () => {
    expect(validate(file(null, { q: entry })), "template").toBe(true);
    expect(validate(file(ai, { q: { ...entry, grader: { kind: "human", name: "Ana" } } })), "own grader").toBe(true);
  });

  it("refuses an unknown mode", () => {
    expect(validate(file(ai, { q: { ...entry, mode: "banana" } }))).toBe(false);
  });

  it("refuses criteria that is not an object", () => {
    expect(validate(file(ai, { q: { ...entry, criteria: 42 } }))).toBe(false);
  });

  it("refuses a grader with no name", () => {
    expect(validate(file({ kind: "ai", model: "m" }, { q: entry }))).toBe(false);
  });

  it("refuses a grader of an unknown kind", () => {
    expect(validate(file({ kind: "robot", name: "R" }, { q: entry }))).toBe(false);
  });
});
