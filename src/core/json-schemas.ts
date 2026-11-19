import { z } from "zod";
import { ResultsSchema } from "./attempt/results";
import { ShelfManifestSchema } from "./ir";
import { ReportSchema } from "./report/schema";
import { ReviewSchema } from "./review/schema";
import { GradesFileShapeSchema } from "./rubric/grades";

/**
 * The JSON Schemas of the five 1.0 file formats (TECHNICAL_DESIGN.md, the 0.x-to-1.0 table, "JSON Schemas"), made from
 * their zod schemas with zod's own `toJSONSchema`. `npm run schemas` (scripts/schemas.mjs) writes them to `schemas/`
 * at the repository's root, the build copies them into `dist/schemas/`, and test/json-schemas.test.ts fails when a
 * committed one differs from a fresh one. No command loads this module.
 *
 * Each is made as zod reads a file (`io: "input"`): a reader ignores keys it does not know, so a schema does not
 * forbid them either.
 */
const FORMATS = {
  results: {
    schema: ResultsSchema,
    description:
      "fullmark-results, version 2: one attempt at a quiz, as the page saves it (TECHNICAL_DESIGN.md, section 4, results-v2).",
  },
  report: {
    schema: ReportSchema,
    description:
      "fullmark-report, version 2: an attempt graded, as `quiz grade --json` writes it (TECHNICAL_DESIGN.md, section 6).",
  },
  grades: {
    schema: GradesFileShapeSchema,
    description:
      "fullmark-grades, version 2: the grades of an attempt's open questions, by a person or an AI (TECHNICAL_DESIGN.md, section 6, grades-v2). The schema holds each entry's shape and the grader's; `quiz grade` checks them against the quiz's rubric.",
  },
  review: {
    schema: ReviewSchema,
    description:
      "fullmark-review, version 2: the learner's verdict on each question, written by `quiz review` (TECHNICAL_DESIGN.md, section 4, review-v2).",
  },
  "fullmark-shelf": {
    schema: ShelfManifestSchema,
    description:
      'fullmark-shelf, version 2: the manifest `quiz library publish` writes into a shelf folder, `fullmark-shelf.json` (COMMANDS.md, `quiz library publish`, "The manifest").',
  },
} as const;

export type SchemaName = keyof typeof FORMATS;
export const SCHEMA_NAMES = Object.keys(FORMATS) as SchemaName[];

/** The file a schema is written to, in `schemas/` and `dist/schemas/`: `results-v2.schema.json`, `fullmark-shelf-v2.schema.json`. */
export const schemaFile = (name: SchemaName): string => `${name}-v2.schema.json`;

/** One format's JSON Schema, draft 2020-12, with its `$id`, `title` and `description` first. */
export function jsonSchema(name: SchemaName): Record<string, unknown> {
  const { schema, description } = FORMATS[name];
  const { $schema, ...rest } = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
  // the manifest's format is `fullmark-shelf` already: its name carries the prefix the others get here
  const short = name.replace(/^fullmark-/, "");
  return { $schema, $id: `fullmark-${short}-v2`, title: `fullmark ${short}, version 2`, description, ...rest };
}

/** The text of a schema's file, as `npm run schemas` writes it. */
export const jsonSchemaText = (name: SchemaName): string => `${JSON.stringify(jsonSchema(name), null, 2)}\n`;
