import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryPublish } from "../src/cli/library-publish";
import { readIndex } from "../src/library/index-file";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";
import { folderBytes, publishOptions } from "./helpers/library-publish";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/**
 * What goes out is checked by bytes, not by eye (STEP5.md, "Rules for every slice"): the history library has results,
 * grades, reports, a review, progress, older versions and briefs, and after `library publish` no file of the shelf is or
 * holds any of them (STEP5.md, Goal: "Privacy"; TECHNICAL_DESIGN.md, section 11).
 */
afterEach(cleanTemps);

const MARK = "PRIVATE-MARKER-7f3a";

/** The history library with every quiz on the shelf, a brief beside each current version, and progress files. */
async function history() {
  const t = await buildHistory();
  const idx = readIndex(readFileSync(join(t.lib, "library.toml"), "utf8"));
  if (!idx.ok) throw new Error("bad index");
  for (const q of idx.index.quizzes) {
    const c = t.at();
    const exit = await runLibraryPublish(q.name, publishOptions({ on: true }), c.io);
    if (exit !== 0) throw new Error(c.err.join(" | "));
    const folder = join(t.lib, "quizzes", q.id);
    writeFileSync(join(folder, "versions", q.current, "brief.yaml"), `purpose: self-study\nrequest: ${MARK}-brief\n`);
    mkdirSync(join(folder, "progress"), { recursive: true });
    for (const name of [`${q.current}.json`, `${q.current}.serving.json`, `${q.current}.submitted.json`])
      writeFileSync(join(folder, "progress", name), `{"answers":{"x":"${MARK}-progress"},"pid":1}\n`);
  }
  const publish = async (dir: string, o: Parameters<typeof publishOptions>[0] = {}) => {
    const c = t.at();
    const exit = await runLibraryPublish(dir, publishOptions(o), c.io);
    if (exit !== 0) throw new Error(`publish failed: ${c.err.join(" | ")}`);
  };
  return { ...t, publish, idx: idx.index };
}

/** What the library holds that must not leave it: strings found in a private file and in no public one. */
const PRIVATE = [
  MARK,
  "the wording is unclear", // the review's note
  "Fixture grader", // a grade's grader
  "Claude Opus 5.5",
  "20261116-201412", // an attempt's stamp
  "20261003-100000",
  "fullmark-progress",
];
const PRIVATE_FORMATS = ["fullmark-results", "fullmark-report", "fullmark-grades", "fullmark-review"];
const PRIVATE_NAMES = /(^|[/\\._-])(results?|grades?|reports?|review|progress|serving|submitted|check)([/\\._-]|$)/i;

describe("the shelf holds nothing private (privacy)", () => {
  it("after publishing the history library, no file is or holds a results, grades, report, review or progress file", async () => {
    const t = await history();
    const dir = join(t.dir, "shelf");
    await t.publish(dir);
    const files = folderBytes(dir);
    expect([...files.keys()]).toEqual([
      "calculus-limits/index.html",
      "calculus-limits/limits.md",
      "fullmark-shelf.json",
      "index.html",
      "study/index.html",
      "study/study.md",
      "tidy/index.html",
      "tidy/tidy.md",
    ]);
    for (const [path, base64] of files) {
      const bytes = Buffer.from(base64, "base64");
      expect(PRIVATE_NAMES.test(path.replace(/^fullmark-shelf\.json$/, "")), `${path}: its name`).toBe(false);
      expect(path.endsWith("brief.yaml") || path.endsWith("check.json") || path.includes("versions/"), path).toBe(
        false,
      );
      const text = bytes.toString("utf8");
      for (const marker of PRIVATE) expect(text.includes(marker), `${path} holds ${marker}`).toBe(false);
      // no file is a JSON document of a private format (the page's own code names the formats it writes; it is not one)
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        // not JSON: a page or a source
      }
      if (json !== null && typeof json === "object")
        expect(PRIVATE_FORMATS, `${path} is a ${(json as { format?: string }).format}`).not.toContain(
          (json as { format?: string }).format,
        );
    }
    // the only JSON file is the manifest, and the only version is the current one
    expect([...files.keys()].filter((p) => p.endsWith(".json"))).toEqual(["fullmark-shelf.json"]);
    const study = t.idx.quizzes.find((q) => q.id === "study");
    for (const v of study?.versions ?? []) {
      const held = [...files].some(([, b]) => Buffer.from(b, "base64").toString("utf8").includes(v.hash));
      expect(held, `version ${v.hash.slice(0, 4)}`).toBe(v.hash === study?.current);
    }
    expect(readFileSync(join(dir, "study", "study.md"), "utf8")).toBe(t.texts[2]);
  });

  it("no brief.yaml without --with-brief; with it the briefs and nothing more", async () => {
    const t = await history();
    const without = join(t.dir, "without", "shelf");
    const withBriefs = join(t.dir, "with", "shelf");
    await t.publish(without);
    await t.publish(withBriefs, { withBrief: true });
    const a = [...folderBytes(without).keys()];
    const b = [...folderBytes(withBriefs).keys()];
    expect(a.filter((p) => p.endsWith("brief.yaml"))).toEqual([]);
    expect(b.filter((p) => p.endsWith("brief.yaml"))).toEqual([
      "calculus-limits/brief.yaml",
      "study/brief.yaml",
      "tidy/brief.yaml",
    ]);
    // every other path is the same
    expect(b.filter((p) => !p.endsWith("brief.yaml"))).toEqual(a);
    const briefs = b.filter((p) => p.endsWith("brief.yaml"));
    expect(briefs.length).toBeGreaterThan(0);
    for (const p of briefs) expect(readFileSync(join(withBriefs, p), "utf8")).toContain(MARK);
    // the briefs are the only difference: nothing else of the library came with them
    for (const [path, base64] of folderBytes(withBriefs)) {
      if (path.endsWith("brief.yaml")) continue;
      const text = Buffer.from(base64, "base64").toString("utf8");
      for (const marker of PRIVATE.filter((m) => m !== MARK))
        expect(text.includes(marker), `${path} holds ${marker}`).toBe(false);
    }
    expect(readdirSync(withBriefs).sort()).toEqual([
      "calculus-limits",
      "fullmark-shelf.json",
      "index.html",
      "study",
      "tidy",
    ]);
  });
});
