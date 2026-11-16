// Writes the JSON Schemas of the four 1.0 file formats into schemas/ (`npm run schemas`; TECHNICAL_DESIGN.md, the
// 0.x-to-1.0 table, "JSON Schemas"). They are made from the zod schemas by src/core/json-schemas.ts, which is bundled
// here with esbuild, as the CLI is, and run in memory. test/json-schemas.test.ts fails when a committed file differs
// from a fresh one; scripts/build-schemas.mjs copies them into dist/schemas/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const out = await build({
  entryPoints: [join(root, "src", "core", "json-schemas.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "warning",
});
const code = out.outputFiles[0].text;
const { SCHEMA_NAMES, jsonSchemaText, schemaFile } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
mkdirSync(join(root, "schemas"), { recursive: true });
for (const name of SCHEMA_NAMES) writeFileSync(join(root, "schemas", schemaFile(name)), jsonSchemaText(name));
