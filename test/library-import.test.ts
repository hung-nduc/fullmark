import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryImport } from "../src/cli/library-import";
import { runLibraryRename } from "../src/cli/library-rename";
import { slashed } from "../src/library/layout";
import { capture } from "./helpers/cli";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, libraryEnv, NOW, tempDir } from "./helpers/library";
import { importOptions, importWorld, indexOf, LATER } from "./helpers/library-import";
import { quizText } from "./helpers/library-register";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

/**
 * `library import DIR [--into PATH]` (STEP5.md, slice 5b; COMMANDS.md, `quiz library import`; STEP5-GAPS.md, G7, G8,
 * G11), in-process with real git in temp folders. The goldens of the Output blocks are in test/golden/library/import-*;
 * the lock and the single commit are in test/library-lock.test.ts; the round trip is in test/shelf-round-trip.test.ts.
 */
afterEach(cleanTemps);

const read = (dir: string, path: string) => readFileSync(join(dir, path), "utf8");
const Q: [string, string][] = [["one", "First?"]];
/** The instant of a time as the library writes it (in the machine's zone): equal instants are equal times. */
const at = (time: string | undefined): number => Date.parse(time ?? "");

describe("library import: a shelf into a library (G7)", () => {
  it("registers every quiz of the manifest with its id, name and time, on the public shelf, in one commit", async () => {
    const w = await importWorld();
    const before = await w.commits(w.b.lib, w.b.env);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    const quizzes = indexOf(w.b.lib).quizzes;
    expect(quizzes.map((q) => [q.name, q.id])).toEqual([
      ["limits", "calculus-limits"],
      ["rust-basics", "rust"],
    ]);
    for (const q of quizzes) {
      expect(q.shelves).toEqual([{ shelf: "public", kind: "quiz" }]);
      expect(at(q.versions[0]?.added)).toBe(at(NOW)); // the manifest's time, not the importing clock's
      // relative to the importing library (G8)
      expect(q.source).toBe(slashed(relative(w.b.lib, join(w.shelf, q.id, q.versions[0]?.file as string))));
    }
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before + 1);
    expect(r.out.slice(0, 1)).toEqual(["imported 2 quizzes: limits, rust-basics (on the public shelf)"]);
    expect(r.out[1]).toMatch(/^committed [0-9a-f]{7} fullmark: import limits rust-basics$/);
    expect(r.out[2]).toBe(
      "note a shelf holds no results, reports or older versions: import restores quizzes, not a backup",
    );
    // the version folder holds the source, the sheet and the stored rules, and the shelf's own files are not there
    const folder = join(w.b.lib, "quizzes", "rust", "versions", quizzes[1]?.current as string);
    expect(existsSync(join(folder, "rust.md"))).toBe(true);
    expect(existsSync(join(folder, "sheet.md"))).toBe(true);
    expect(existsSync(join(folder, "check.json"))).toBe(true);
    expect(existsSync(join(folder, "index.html"))).toBe(false);
    expect(existsSync(join(folder, "fullmark.toml"))).toBe(false);
  });

  it("is unchanged a second time: nothing written, nothing committed", async () => {
    const w = await importWorld();
    await w.importing(w.shelf);
    const before = await w.commits(w.b.lib, w.b.env);
    const index = read(w.b.lib, "library.toml");
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toBe("unchanged 2 quizzes: limits, rust-basics");
    expect(read(w.b.lib, "library.toml")).toBe(index);
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
    const json = await w.importing(w.shelf, { json: true });
    expect(JSON.parse(json.out[0] as string)).toEqual({
      status: "unchanged",
      library: w.b.lib,
      imported: [],
      unchanged: ["limits", "rust-basics"],
      refused: [],
      warnings: [],
      committed: null,
    });
  });

  it("an older version on the shelf is unchanged, with a note: nothing goes backwards", async () => {
    const w = await importWorld();
    await w.importing(w.shelf);
    // the library moves on: a new version of rust, registered from a file of its own
    w.b.write({ "more/rust.md": quizText("rust", "Rust basics", [...Q, ["two", "Second?"]]) });
    expect((await w.b.register(["more/rust.md"], { update: "rust-basics" })).exit).toBe(0);
    const current = indexOf(w.b.lib).quizzes.find((q) => q.name === "rust-basics")?.current;
    const before = await w.commits(w.b.lib, w.b.env);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out.join("\n")).toMatch(/^note rust-basics: the shelf has an older version \([0-9a-f]{4,}\)$/m);
    expect(indexOf(w.b.lib).quizzes.find((q) => q.name === "rust-basics")?.current).toBe(current);
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
  });

  it("a new hash adds a version and makes it current, with the manifest's time", async () => {
    const w = await importWorld();
    await w.importing(w.shelf);
    // the first library edits the quiz, registers it and publishes again, a day later
    w.a.write({
      "notes/limits.md": quizText("calculus-limits", "Limits", [
        ["limit", "What is a limit?"],
        ["more", "More?"],
      ]),
    });
    const clock = { now: () => new Date("2026-11-19T10:00:00+00:00") };
    expect((await w.a.register(["notes/limits.md"], { update: "limits" }, clock)).exit).toBe(0);
    expect((await w.a.sync("shelf")).exit).toBe(0);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toBe("imported 1 quiz: limits (on the public shelf)");
    const limits = indexOf(w.b.lib).quizzes.find((q) => q.name === "limits");
    expect(limits?.versions).toHaveLength(2);
    expect(limits?.current).toBe(limits?.versions[1]?.hash);
    expect(at(limits?.versions[1]?.added)).toBe(at("2026-11-19T10:00:00+00:00"));
  });

  it("a file edited after publishing is registered with the time of now, and a warning names it", async () => {
    const w = await importWorld();
    const file = join(w.shelf, "calculus-limits", "limits.md");
    writeFileSync(
      file,
      `${readFileSync(file, "utf8")}\n## Added by hand {type=single id=hand}\n\n- [x] Yes\n- [ ] No\n\n::: explanation\nBecause.\n:::\n`,
    );
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out.join("\n")).toContain(
      `warning ${slashed(file)} was edited after it was published, so it is added with the time of now`,
    );
    const limits = indexOf(w.b.lib).quizzes.find((q) => q.name === "limits");
    expect(at(limits?.versions[0]?.added)).toBe(at(LATER));
    const rust = indexOf(w.b.lib).quizzes.find((q) => q.name === "rust-basics");
    expect(at(rust?.versions[0]?.added)).toBe(at(NOW));
  });

  it("an id the library has keeps the library's name, with a note when the shelf calls it otherwise", async () => {
    const w = await importWorld();
    await w.importing(w.shelf);
    const c = w.b.at();
    expect(await runLibraryRename("rust-basics", "rust-lang", { json: false, plain: true }, c.io)).toBe(0);
    const before = await w.commits(w.b.lib, w.b.env);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toBe("note the shelf calls rust rust-basics; the library keeps rust-lang");
    expect(indexOf(w.b.lib).quizzes.map((q) => q.name)).toEqual(["limits", "rust-lang"]);
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
  });

  it("a name taken by another quiz refuses the import, with a free name suggested, and writes nothing", async () => {
    const w = await importWorld();
    w.b.write({ "own/limits.md": quizText("something-else", "Another", Q) });
    expect((await w.b.register(["own/limits.md"], { name: "limits" })).exit).toBe(0);
    const before = await w.commits(w.b.lib, w.b.env);
    const index = read(w.b.lib, "library.toml");
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(1);
    expect(r.out.join("\n")).toMatch(
      /error library\.name-taken: the name limits is taken by another quiz\n {4}fix: limits-2 is free/,
    );
    expect(r.out.at(-1)).toBe("nothing imported 1 of 2 files ready, 1 refused");
    expect(read(w.b.lib, "library.toml")).toBe(index);
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
    expect(existsSync(join(w.b.lib, "quizzes", "rust"))).toBe(false);
    const json = JSON.parse((await w.importing(w.shelf, { json: true })).out[0] as string);
    expect(json).toMatchObject({ status: "problems", imported: [], refused: [{ name: "limits" }] });
    expect(json.refused[0].suggest).toContain("limits-2");
  });

  it("a manifest that is foreign or newer exits 2, as publish does; a folder that is no folder exits 2", async () => {
    const w = await importWorld();
    const file = join(w.shelf, "fullmark-shelf.json");
    const good = readFileSync(file, "utf8");
    writeFileSync(file, good.replace('"fullmark-shelf"', '"something"'));
    expect((await w.importing(w.shelf)).exit).toBe(2);
    writeFileSync(file, good.replace('"version": 2', '"version": 3'));
    const newer = await w.importing(w.shelf);
    expect(newer.exit).toBe(2);
    expect(newer.err[0]).toContain("version 3");
    expect((await w.importing(join(w.a.dir, "nowhere"))).exit).toBe(2);
    expect(indexOf(w.b.lib).quizzes).toEqual([]);
  });
});

describe("library import: a folder with no manifest (G8)", () => {
  async function bare() {
    const w = await importWorld();
    rmSync(join(w.shelf, "fullmark-shelf.json"));
    rmSync(join(w.shelf, "index.html"));
    return w;
  }

  it("registers every DIR/*/*.md with front matter under its id and its slugged title, with no shelf entry and the time of now", async () => {
    const w = await bare();
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toBe("imported 2 quizzes: limits, rust-basics");
    const quizzes = indexOf(w.b.lib).quizzes;
    expect(quizzes.map((q) => [q.name, q.id, q.shelves.length, at(q.versions[0]?.added)])).toEqual([
      ["limits", "calculus-limits", 0, at(LATER)],
      ["rust-basics", "rust", 0, at(LATER)],
    ]);
    // the sheet (no front matter) is a file of the quiz, not a quiz
    expect(existsSync(join(w.b.lib, "quizzes", "rust", "versions", quizzes[1]?.current as string, "sheet.md"))).toBe(
      true,
    );
  });

  it("a taken id is refused with its suggestion, and nothing is written", async () => {
    const w = await bare();
    await w.importing(w.shelf);
    const before = await w.commits(w.b.lib, w.b.env);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(1);
    expect(r.out.join("\n")).toContain("error library.id-taken: the id rust is already in the library, as rust-basics");
    expect(r.out.join("\n")).toContain("quiz library register");
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
  });

  it("two .md files in one folder are two quizzes, each with the folder's assets", async () => {
    const w = await bare();
    writeFileSync(join(w.shelf, "rust", "second.md"), quizText("second", "Second quiz", Q));
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(0);
    expect(indexOf(w.b.lib).quizzes.map((q) => q.id)).toEqual(["calculus-limits", "rust", "second"]);
  });

  it("a survey is refused (library.survey), and so is a check error; nothing is written", async () => {
    const w = await bare();
    mkdirSync(join(w.shelf, "poll"));
    writeFileSync(
      join(w.shelf, "poll", "poll.md"),
      quizText("poll", "Poll", Q, "kind: survey\n").replace("- [x]", "- [ ]"),
    );
    mkdirSync(join(w.shelf, "broken"));
    writeFileSync(
      join(w.shelf, "broken", "broken.md"),
      quizText("broken", "Broken", Q).replace("{type=single id=one}", "{type=single}"),
    );
    const before = await w.commits(w.b.lib, w.b.env);
    const r = await w.importing(w.shelf);
    expect(r.exit).toBe(1);
    const text = r.out.join("\n");
    expect(text).toContain("error library.survey");
    expect(text).toMatch(/error question\.id-missing/);
    expect(r.out.at(-1)).toBe("nothing imported 2 of 4 files ready, 2 refused");
    expect(indexOf(w.b.lib).quizzes).toEqual([]);
    expect(await w.commits(w.b.lib, w.b.env)).toBe(before);
  });
});

describe("library import: each quiz under its nearest fullmark.toml, never above DIR", () => {
  it("a quiz folder's own fullmark.toml applies to it, and one at DIR's top applies to the quizzes without one", async () => {
    const w = await importWorld({ mark: [] });
    const dir = join(w.a.dir, "hand");
    mkdirSync(join(dir, "a"), { recursive: true });
    mkdirSync(join(dir, "b"), { recursive: true });
    const short = (id: string, title: string) =>
      quizText(id, title, Q).replace("The first choice is the right one here.", "Short.");
    writeFileSync(join(dir, "a", "a.md"), short("alpha", "Alpha"));
    writeFileSync(join(dir, "b", "b.md"), short("beta", "Beta"));
    const profile = '[check]\nprofile = "strictish"\n\n[profiles.strictish.rules]\n"explanation.short" = "error"\n';
    // none anywhere: both pass
    expect((await w.importing(dir)).exit).toBe(0);
    for (const q of ["alpha", "beta"]) rmSync(join(w.b.lib, "quizzes", q), { recursive: true });
    writeFileSync(join(w.b.lib, "library.toml"), read(w.b.lib, "library.toml").split("\n[quizzes.")[0] as string);
    // one at DIR's top applies to both
    writeFileSync(join(dir, "fullmark.toml"), profile);
    const top = await w.importing(dir);
    expect(top.exit).toBe(1);
    expect(top.out.filter((l) => l.includes("error explanation.short"))).toHaveLength(2);
    // a folder's own wins over the top one
    writeFileSync(join(dir, "a", "fullmark.toml"), '[check]\nprofile = "default"\n');
    const own = await w.importing(dir);
    expect(own.exit).toBe(1);
    expect(own.out.filter((l) => l.includes("error explanation.short"))).toHaveLength(1);
    expect(own.out.join("\n")).toContain(join(dir, "b", "b.md"));
    // never above DIR: a fullmark.toml beside DIR is not read
    rmSync(join(dir, "fullmark.toml"));
    writeFileSync(join(w.a.dir, "fullmark.toml"), profile);
    expect((await w.importing(dir)).exit).toBe(0);
    // the rules the quiz was checked under travel with its version, as check.json
    const check = JSON.parse(
      read(w.b.lib, `quizzes/alpha/versions/${indexOf(w.b.lib).quizzes[0]?.current}/check.json`),
    );
    expect(check.profile).toBe("default");
  });
});

describe("library import --into (G11)", () => {
  function machine() {
    const dir = tempDir();
    const env = libraryEnv(dir);
    const run = async (shelf: string, into: string | null, o: { json?: boolean } = {}) => {
      const c = capture(dir, env);
      const exit = await runLibraryImport(shelf, importOptions({ into, ...o }), { ...c.io, now: () => new Date(NOW) });
      return { exit, out: c.out, err: c.err };
    };
    return { dir, env, run };
  }

  it("makes the library, records it when the config names none, and imports into it", async () => {
    const w = await importWorld();
    const m = machine();
    const r = await m.run(w.shelf, "lib2");
    expect(r.exit).toBe(0);
    expect(r.out[0]).toMatch(/^library ready .*lib2 \(new folder, git repository\)$/);
    expect(r.out[1]).toBe("imported 2 quizzes: limits, rust-basics (on the public shelf)");
    expect(read(m.dir, "config.toml")).toContain(`library = ${JSON.stringify(slashed(join(m.dir, "lib2")))}`);
    expect(indexOf(join(m.dir, "lib2")).quizzes).toHaveLength(2);
    const log = (await git(join(m.dir, "lib2"), m.env, "log", "--format=%s")).trim().split("\n");
    expect(log).toEqual(["fullmark: import limits rust-basics", "fullmark: init"]);
  });

  it("leaves the config alone when it names a library, and says how to use the new one", async () => {
    const w = await importWorld();
    const m = machine();
    expect((await m.run(w.shelf, "lib2")).exit).toBe(0);
    const config = read(m.dir, "config.toml");
    const r = await m.run(w.shelf, "lib3");
    expect(r.exit).toBe(0);
    expect(read(m.dir, "config.toml")).toBe(config);
    const lib3 = join(m.dir, "lib3");
    expect(r.out[1]).toBe(
      `note your library is still ${join(m.dir, "lib2")}; use this one with FULLMARK_LIBRARY=${lib3} or quiz library init ${lib3} --force`,
    );
    expect(indexOf(lib3).quizzes).toHaveLength(2);
  });

  it("takes init's rules for the folder: an empty or existing library's folder is used, a non-empty one exits 2", async () => {
    const w = await importWorld();
    const m = machine();
    mkdirSync(join(m.dir, "empty"));
    expect((await m.run(w.shelf, "empty")).exit).toBe(0);
    // the library just made: importing into it again is a no-change import
    const again = await m.run(w.shelf, "empty");
    expect(again.exit).toBe(0);
    expect(again.out.join("\n")).toContain("unchanged 2 quizzes");
    mkdirSync(join(m.dir, "full"));
    writeFileSync(join(m.dir, "full", "notes.txt"), "mine");
    const full = await m.run(w.shelf, "full");
    expect(full.exit).toBe(2);
    expect(full.err[0]).toContain("is not empty and is not a library");
    expect(readFileSync(join(m.dir, "full", "notes.txt"), "utf8")).toBe("mine");
    expect(existsSync(join(m.dir, "full", "library.toml"))).toBe(false);
  });

  it("with no library and no --into exits 2", async () => {
    const w = await importWorld();
    const m = machine();
    const r = await m.run(w.shelf, null);
    expect(r.exit).toBe(2);
    expect(r.err[0]).toBe("error: no library: run `quiz library init PATH`");
  });

  it("--into with a refused folder does not read the shelf, and a quiz refused after it leaves a library with no quizzes", async () => {
    const w = await importWorld();
    rmSync(join(w.shelf, "fullmark-shelf.json"));
    mkdirSync(join(w.shelf, "poll"));
    writeFileSync(
      join(w.shelf, "poll", "poll.md"),
      quizText("poll", "Poll", Q, "kind: survey\n").replace("- [x]", "- [ ]"),
    );
    const m = machine();
    const r = await m.run(w.shelf, "lib2");
    expect(r.exit).toBe(1);
    expect(indexOf(join(m.dir, "lib2")).quizzes).toEqual([]);
  });
});
