import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanTemps } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

afterEach(cleanTemps);

const FIXTURE = resolve(import.meta.dirname, "fixtures", "library-history");
const UPDATE = process.env.FULLMARK_GOLDEN_UPDATE === "1";

function walk(dir: string, base = dir, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === ".fullmark.lock") continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) walk(path, base, out);
    else out.push(path.slice(base.length + 1).replaceAll("\\", "/"));
  }
  return out.sort();
}

describe("the history helper", () => {
  it("builds the library the list and info goldens run over (test/fixtures/library-history/lib)", async () => {
    const h = await buildHistory();
    const here = (rel: string): string =>
      readFileSync(join(h.lib, rel), "utf8").replaceAll(join(h.dir, "notes"), "/home/minh/notes");
    const files = walk(h.lib);
    if (UPDATE) {
      rmSync(join(FIXTURE, "lib"), { recursive: true, force: true });
      for (const rel of files) {
        mkdirSync(dirname(join(FIXTURE, "lib", rel)), { recursive: true });
        writeFileSync(join(FIXTURE, "lib", rel), here(rel));
      }
      return;
    }
    expect(existsSync(join(FIXTURE, "lib"))).toBe(true);
    expect(walk(join(FIXTURE, "lib"))).toEqual(files);
    for (const rel of files) expect(readFileSync(join(FIXTURE, "lib", rel), "utf8"), rel).toBe(here(rel));
  });

  it("has the study quiz in three versions, five attempts from the stats fixtures, a practice on the second version and one more on the third", async () => {
    const h = await buildHistory();
    expect(h.hashes).toHaveLength(3);
    expect(new Set(h.hashes).size).toBe(3);
    expect(readdirSync(join(h.lib, "quizzes", "study", "results"))).toHaveLength(7);
    expect(readdirSync(join(h.lib, "quizzes", "study", "reports"))).toHaveLength(2);
  });
});
