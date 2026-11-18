import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { TomlIndex } from "../core/config/toml-index";
import { writeFileAtomic } from "./atomic";

/**
 * The text of `config.toml` with `library = "PATH"` set: the file is kept as it is, comments and order included. An
 * existing top-level `library` has its value replaced; otherwise the line is put above the first table (at the end
 * when there is none). The text must be valid TOML (the caller has parsed it).
 */
export function withLibraryKey(text: string, path: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const value = JSON.stringify(path);
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
