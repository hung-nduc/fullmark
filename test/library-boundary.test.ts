import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The library's boundary (TECHNICAL_DESIGN.md, section 7; STEP4.md, "Rules for every slice"): `src/library/` uses
 * `node:*` and `src/core/` only, and nothing in `src/core/`, `src/build/`, `src/serve/` or `src/page/` imports it.
 */
const src = resolve(import.meta.dirname, "..", "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const specifier = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)["']([^"']+)["']/g;
const specifiers = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(specifier)].map((m) => m[1] ?? "");
const shown = (file: string): string => file.slice(src.length + 1).replaceAll("\\", "/");

/** The folder under `src/` a relative import of `file` lands in, or null for a package or a `node:` module. */
function target(file: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  return shown(resolve(file, "..", spec)).split("/")[0] ?? null;
}

describe("src/library boundary", () => {
  const files = sources(join(src, "library"));

  it("finds the library files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`imports node:*, packages and src/core only: ${shown(file)}`, () => {
      const bad = specifiers(file).filter((s) => {
        if (!s.startsWith(".")) return false;
        const into = target(file, s);
        return into !== "core" && into !== "library";
      });
      expect(bad).toEqual([]);
    });
  }

  for (const folder of ["core", "build", "serve", "page"]) {
    it(`nothing in src/${folder}/ imports the library`, () => {
      const bad = sources(join(src, folder)).flatMap((file) =>
        specifiers(file)
          .filter((s) => s.startsWith(".") && target(file, s) === "library")
          .map((s) => `${shown(file)}: ${s}`),
      );
      expect(bad).toEqual([]);
    });
  }
});
