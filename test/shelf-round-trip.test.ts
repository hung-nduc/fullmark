import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryImport } from "../src/cli/library-import";
import { runLibraryPublish } from "../src/cli/library-publish";
import { capture } from "./helpers/cli";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, libraryEnv, NOW, tempDir } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";
import { importOptions, indexOf, LATER } from "./helpers/library-import";
import { folderBytes, publishOptions } from "./helpers/library-publish";
import { quizText } from "./helpers/library-register";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/**
 * The round trip (STEP5.md, Goal and slice 5b; TECHNICAL_DESIGN.md, section 11, "Round trip"): publish a library to an
 * empty folder, import that folder into a second library, publish the second library to the first folder: `unchanged`,
 * and no byte of the folder differs; and the second library published to a third empty folder gives the first folder's
 * bytes. The library is the history library (older versions, results, a review, grades) with a quiz registered under a
 * profile other than its own (G38), a quiz under a custom profile, and a brief published with `--with-brief`.
 */
afterEach(cleanTemps);

/** The first library, every quiz on the shelf, and a second machine with no library, the shelf a repository. */
async function world() {
  const a = await buildHistory();
  a.write({
    "notes/short.md": quizText("short", "Short", [["a", "A?"]]).replaceAll(
      "The first choice is the right one here.",
      "Short.",
    ),
    "notes/custom.md": quizText("custom", "Custom", [["a", "A?"]], "profile: mine\n"),
    "notes/mine.toml": '[profiles.mine]\nextends = "default"\nrules."explanation.short" = "warning"\n',
  });
  expect((await a.register(["notes/short.md"], { name: "short", profile: "draft" })).exit).toBe(0);
  expect((await a.register(["notes/custom.md"], { name: "custom", config: "notes/mine.toml" })).exit).toBe(0);
  const index = indexOf(a.lib);
  for (const q of index.quizzes) {
    const c = a.at();
    expect(await runLibraryPublish(q.name, publishOptions({ on: true }), c.io)).toBe(0);
  }
  // a brief beside the current version of `short`: it goes out only with --with-brief
  const short = index.quizzes.find((q) => q.name === "short");
  writeFileSync(
    join(a.lib, "quizzes", "short", "versions", short?.current as string, "brief.yaml"),
    "purpose: self-study\n",
  );

  const first = join(a.dir, "shelf");
  mkdirSync(first);
  await git(first, a.env, "init", "-q");

  // the second machine: its own config, its own clock (a later time than every time of the first library)
  const dirB = tempDir();
  const envB = libraryEnv(dirB);
  const atB = () => {
    const c = capture(dirB, envB);
    return { io: { ...c.io, now: () => new Date(LATER) }, out: c.out, err: c.err };
  };
  const publishA = async (dir: string) => {
    const c = a.at();
    const exit = await runLibraryPublish(dir, publishOptions({ withBrief: true }), c.io);
    return { exit, out: c.out, err: c.err };
  };
  const publishB = async (dir: string) => {
    const c = atB();
    const exit = await runLibraryPublish(dir, publishOptions({ withBrief: true }), c.io);
    return { exit, out: c.out, err: c.err };
  };
  const importB = async (dir: string, into: string) => {
    const c = atB();
    const exit = await runLibraryImport(dir, importOptions({ into }), c.io);
    return { exit, out: c.out, err: c.err };
  };
  return { a, first, dirB, envB, publishA, publishB, importB };
}

/** The paths where two folders differ, for a readable failure. */
const differing = (a: Map<string, string>, b: Map<string, string>): string[] =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();

const commits = async (dir: string, env: Record<string, string>): Promise<number> =>
  Number((await git(dir, env, "rev-list", "--count", "HEAD")).trim());

describe("the round trip", () => {
  it("publish, import into a second library, publish it back: unchanged, and no byte of the folder differs", async () => {
    const w = await world();
    const published = await w.publishA(w.first);
    expect(published.exit, published.err.join(" | ")).toBe(0);
    const files = folderBytes(w.first);
    // the shelf really holds the cases this test is about
    expect(files.has("short/fullmark.toml")).toBe(true); // a built-in profile that is not the quiz's own
    expect(files.has("custom/fullmark.toml")).toBe(true); // a custom one
    expect(files.has("short/brief.yaml")).toBe(true);
    expect(files.has("study/index.html")).toBe(true);
    const before = await commits(w.first, w.a.env);

    const imported = await w.importB(w.first, "lib2");
    expect(imported.exit, imported.out.join(" | ")).toBe(0);
    expect(imported.out.join("\n")).toContain(
      "imported 5 quizzes: custom, limits-and-continuity, short, study-fixture, tidy",
    );
    const lib2 = join(w.dirB, "lib2");
    expect(
      indexOf(lib2)
        .quizzes.map((q) => q.id)
        .sort(),
    ).toEqual(
      indexOf(w.a.lib)
        .quizzes.map((q) => q.id)
        .sort(),
    );

    const back = await w.publishB(w.first);
    expect(back.exit, back.err.join(" | ")).toBe(0);
    expect(back.out[0]).toMatch(/^unchanged: .* already matches the library \(5 quizzes\)$/);
    expect(await commits(w.first, w.a.env)).toBe(before);
    expect(folderBytes(w.first)).toEqual(files);
  });

  it("the second library published to a third empty folder gives the first folder's bytes", async () => {
    const w = await world();
    expect((await w.publishA(w.first)).exit).toBe(0);
    expect((await w.importB(w.first, "lib2")).exit).toBe(0);
    // the index page is headed by the shelf folder's name, so the third folder is named as the first
    const third = join(w.dirB, "elsewhere", "shelf");
    const out = await w.publishB(third);
    expect(out.exit, out.err.join(" | ")).toBe(0);
    expect(differing(folderBytes(third), folderBytes(w.first))).toEqual([]);
    expect(folderBytes(third)).toEqual(folderBytes(w.first));
    // and the times came through the manifest, not the second library's clock
    const lib2 = indexOf(join(w.dirB, "lib2"));
    for (const q of lib2.quizzes)
      expect(Date.parse(q.versions.at(-1)?.added as string)).toBeLessThan(Date.parse(LATER));
    expect(Date.parse(NOW)).toBeLessThan(Date.parse(LATER));
    expect(readFileSync(join(third, "fullmark-shelf.json"), "utf8")).toBe(
      readFileSync(join(w.first, "fullmark-shelf.json"), "utf8"),
    );
  });
});
