// Copies the committed JSON Schemas (schemas/, written by `npm run schemas`) into dist/schemas/, so they ship with the
// package. No command reads them; the agent guide points to the folder.
import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
mkdirSync(join(root, "dist", "schemas"), { recursive: true });
cpSync(join(root, "schemas"), join(root, "dist", "schemas"), { recursive: true });
