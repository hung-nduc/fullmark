import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { TomlIndex } from "../core/config/toml-index";
import { slashed } from "../library/layout";
import { writeFileAtomic } from "./atomic";

/**
 * The text of `config.toml` with `library = "PATH"` set: the file is kept as it is, comments and order included. An
 * existing top-level `library` has its value replaced; otherwise the line is put above the first table (at the end
 * when there is none). The text must be valid TOML (the caller has parsed it).
 */
export function withLibraryKey(text: string, path: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const value = JSON.stringify(slashed(path));
  const doc = text.trim() === "" ? {} : (parseToml(text) as Record<string, unknown>);
  const index = new TomlIndex(text);
  const lines = text.split(/\r?\n/);
  if (doc.library !== undefined) {
    const at = index.lineOf(["library"]) - 1;
    const line = lines[at] ?? "";
    lines[at] = /^\s*library\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/.test(line)
      ? line.replace(/^(\s*library\s*=\s*)("(?:[^"\\]|\\.)*"|'[^']*')/, (_m, head: string) => `${head}${value}`)
      : `library = ${value}`;
    return lines.join(eol);
  }
  const firstTable = Object.entries(doc).find(([, v]) => typeof v === "object" && v !== null && !(v instanceof Date));
  if (firstTable === undefined) {
    const body = text === "" || text.endsWith("\n") ? text : `${text}${eol}`;
    return `${body}library = ${value}${eol}`;
  }
  const at = index.lineOf([firstTable[0]]) - 1;
  lines.splice(at, 0, `library = ${value}`, "");
  return lines.join(eol);
}

/** Records the library in `config.toml`, atomically; the file and its folder are made when missing. */
export async function recordLibrary(configPath: string, library: string): Promise<void> {
  let text = "";
  try {
    text = readFileSync(configPath, "utf8").replace(/^﻿/, "");
  } catch {
    // a new file
  }
  await writeFileAtomic(configPath, new TextEncoder().encode(withLibraryKey(text, library)));
}

/**
 * The text of `config.toml` with `[shelves]` holding `SHELF = "PATH"` (COMMANDS.md, `quiz library publish`, "Remembered"):
 * the file is kept as it is, comments and order included. An existing `SHELF` key has its value replaced; a `[shelves]`
 * table without it gets the line right under its header; without a table, `[shelves]` is added at the end. The text must
 * be valid TOML (the caller has parsed it).
 */
export function withShelfKey(text: string, shelf: string, path: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const value = JSON.stringify(slashed(path));
  const doc = text.trim() === "" ? {} : (parseToml(text) as Record<string, unknown>);
  const table = doc.shelves;
  if (typeof table !== "object" || table === null || Array.isArray(table)) {
    const body = text === "" || text.endsWith("\n") ? text : `${text}${eol}`;
    const gap = body === "" ? "" : eol;
    return `${body}${gap}[shelves]${eol}${shelf} = ${value}${eol}`;
  }
  const index = new TomlIndex(text);
  const lines = text.split(/\r?\n/);
  const header = index.lineOf(["shelves"]) - 1;
  if (/^\s*shelves\s*=/.test(lines[header] ?? "")) {
    // an inline table: the line is written again from what it holds
    const entries = Object.entries({ ...(table as Record<string, unknown>), [shelf]: slashed(path) })
      .map(([k, v]) => `${/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k)} = ${JSON.stringify(v)}`)
      .join(", ");
    lines[header] = `shelves = { ${entries} }`;
    return lines.join(eol);
  }
  if (Object.hasOwn(table, shelf)) {
    const at = index.lineOf(["shelves", shelf]) - 1;
    const line = lines[at] ?? "";
    const quoted = /^(\s*(?:[A-Za-z0-9_-]+|"[^"]*")\s*=\s*)("(?:[^"\\]|\\.)*"|'[^']*')/;
    lines[at] = quoted.test(line)
      ? line.replace(quoted, (_m, head: string) => `${head}${value}`)
      : `${shelf} = ${value}`;
    return lines.join(eol);
  }
  lines.splice(header + 1, 0, `${shelf} = ${value}`);
  return lines.join(eol);
}

/** Records a shelf's folder in `config.toml`, atomically; the file and its folder are made when missing. */
export async function recordShelf(configPath: string, shelf: string, dir: string): Promise<void> {
  let text = "";
  try {
    text = readFileSync(configPath, "utf8").replace(/^﻿/, "");
  } catch {
    // a new file
  }
  await writeFileAtomic(configPath, new TextEncoder().encode(withShelfKey(text, shelf, dir)));
}
