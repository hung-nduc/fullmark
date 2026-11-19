import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "../src/cli/atomic";
import { type BuildOptions, runBuild } from "../src/cli/build";
import { checkFile } from "../src/cli/check";
import { readIndex } from "../src/library/index-file";
import { realLockEnv } from "../src/library/lock";
import { manifestPaths, readManifest } from "../src/library/shelf";
import { cleanTemps, git, NOW } from "./helpers/library";
import { folderBytes, shelfLibrary } from "./helpers/library-publish";
import { quizText } from "./helpers/library-register";

/**
 * The sync of `library publish [DIR]` (STEP5.md, slice 5a), in-process with real git in temp folders. The goldens of the
 * Output blocks are in test/golden/library/publish-*; the privacy and determinism tests are in test/shelf-*.test.ts.
 */
afterEach(cleanTemps);

const read = (dir: string, path: string) => readFileSync(join(dir, path), "utf8");
const manifestOf = (dir: string) => {
  const r = readManifest(read(dir, "fullmark-shelf.json"));
  if (!r.ok) throw new Error(r.message);
  return r.manifest;
};
const listing = (dir: string) => [...folderBytes(dir).keys()];
const addedOf = (lib: string, name: string) => {
  const r = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!r.ok) throw new Error("bad index");
  return r.index.quizzes.find((q) => q.name === name)?.versions[0]?.added as string;
};

describe("library publish DIR: the first sync", () => {
  it("writes one folder per quiz named by its id, the index page and the manifest, and nothing private", async () => {
    const t = await shelfLibrary();
    const r = await t.sync("shelf");
    expect(r.exit).toBe(0);
    const dir = join(t.dir, "shelf");
    expect(listing(dir)).toEqual([
      "calculus-limits/index.html",
      "calculus-limits/limits.md",
      "fullmark-shelf.json",
      "index.html",
      "rust/index.html",
      "rust/rust.md",
      "rust/sheet.md",
    ]);
    expect(r.out).toEqual([
      `published 2 quizzes to ${dir}: 2 added`,
      `remembered ${dir} as the public shelf`,
      `note ${dir} is not in a git repository, so nothing was committed`,
    ]);
    const m = manifestOf(dir);
    expect(m).toMatchObject({ format: "fullmark-shelf", version: 2, ui_lang: "en", with_brief: false, fonts: "quiz" });
    expect(m.files).toEqual(["index.html"]);
    expect(m.quizzes.map((q) => [q.id, q.name, q.title, q.lang, q.file])).toEqual([
      ["calculus-limits", "limits", "Limits", "en", "limits.md"],
      ["rust", "rust-basics", "Rust basics", "en", "rust.md"],
    ]);
    expect(m.quizzes[1]?.files).toEqual(["rust/index.html", "rust/rust.md", "rust/sheet.md"]);
    expect(m.quizzes[1]?.added).toBe(addedOf(t.lib, "rust-basics"));
    expect(readFileSync(join(dir, "rust", "rust.md"), "utf8")).toBe(read(t.dir, "notes/rust.md"));
    expect(existsSync(join(dir, ".fullmark.lock"))).toBe(false);
    expect(read(t.dir, "config.toml")).toContain(`[shelves]\npublic = ${JSON.stringify(dir)}`);
  });

  it("a shelf page is byte-identical to quiz build of the version's source with the same --built-at and --fonts", async () => {
    const t = await shelfLibrary();
    expect((await t.sync("shelf", { fonts: "none" })).exit).toBe(0);
    const build = (file: string, output: string): BuildOptions => ({
      profile: null,
      config: null,
      strict: false,
      output,
      builtAt: addedOf(t.lib, file === "notes/rust.md" ? "rust-basics" : "limits"),
      uiLang: null,
      fonts: "none",
      plain: true,
      json: false,
      buildFile: null,
      open: false,
      print: false,
      seed: null,
      answerSheet: false,
      answers: null,
      materials: null,
      watch: false,
      serve: false,
      port: null,
      version: "1.0.0-test",
    });
    for (const [file, id] of [
      ["notes/rust.md", "rust"],
      ["notes/limits.md", "calculus-limits"],
    ] as const) {
      expect(await runBuild([file], build(file, `built/${id}.html`), t.at().io)).toBe(0);
      const shelf = readFileSync(join(t.dir, "shelf", id, "index.html"));
      expect(shelf.length).toBeGreaterThan(10_000);
      expect(shelf.equals(readFileSync(join(t.dir, "built", `${id}.html`)))).toBe(true);
    }
    // the default font choice gives a different page, and the manifest remembers `none`
    expect(manifestOf(join(t.dir, "shelf")).fonts).toBe("none");
  });

  it("the index page lists every quiz by title with its link, badge and counts, and holds no script", async () => {
    const t = await shelfLibrary();
    await t.sync("shelf");
    const html = read(join(t.dir, "shelf"), "index.html");
    expect(html).not.toContain("<script");
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("<title>shelf</title>");
    expect(html.indexOf("Limits")).toBeLessThan(html.indexOf("Rust basics"));
    expect(html).toContain('href="rust/"');
    expect(html).toContain('href="calculus-limits/"');
    expect(html).toContain(">EN</span>");
    expect(html).toContain("2 questions");
  });

  it("--with-brief copies brief.yaml, never check.json; --no-brief takes it away again; the manifest remembers the choice", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    expect((await t.sync("shelf", { withBrief: true })).exit).toBe(0);
    expect(listing(dir)).toContain("rust/brief.yaml");
    expect(listing(dir).some((f) => f.endsWith("check.json"))).toBe(false);
    expect(manifestOf(dir).with_brief).toBe(true);
    // remembered: no flag, nothing to do
    const same = await t.sync("shelf");
    expect(same.out).toEqual([`unchanged: ${dir} already matches the library (2 quizzes)`]);
    const off = await t.sync("shelf", { noBrief: true });
    expect(off.out[0]).toBe(`published 2 quizzes to ${dir}: 2 updated`);
    expect(listing(dir)).not.toContain("rust/brief.yaml");
    expect(manifestOf(dir).with_brief).toBe(false);
  });

  it("--ui-lang vi sets the index page's own language and is remembered", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    await t.sync("shelf", { uiLang: "vi" });
    expect(read(dir, "index.html")).toContain('<html lang="vi">');
    expect(read(dir, "index.html")).toContain("2 câu hỏi");
    expect(manifestOf(dir).ui_lang).toBe("vi");
    expect((await t.sync("shelf")).out[0]).toMatch(/^unchanged:/);
    await t.sync("shelf", { uiLang: "en" });
    expect(read(dir, "index.html")).toContain('<html lang="en">');
  });

  it("a quiz registered under another built-in profile than its own gets its fullmark.toml, and quiz check on its shelf folder reports what the library found (step 5, G38)", async () => {
    const t = await shelfLibrary({ mark: [] });
    t.write({
      "notes/short.md": quizText("short", "Short", [["a", "A?"]]).replaceAll(
        "The first choice is the right one here.",
        "Short.",
      ),
    });
    expect((await t.register(["notes/short.md"], { name: "short", profile: "draft" })).exit).toBe(0);
    await t.publish("short", { on: true });
    const dir = join(t.dir, "shelf");
    expect((await t.sync("shelf")).exit).toBe(0);
    expect(read(dir, "short/fullmark.toml")).toBe('[check]\nprofile = "draft"\n');
    expect(manifestOf(dir).quizzes[0]?.files).toEqual(["short/fullmark.toml", "short/index.html", "short/short.md"]);
    const options = { profile: null, config: null, strict: false, review: null, json: false, plain: true } as const;
    const checked = checkFile(join(dir, "short", "short.md"), options, t.at(join(dir, "short")).io);
    if (checked.status === "error") throw new Error(checked.message);
    expect(checked.profile).toBe("draft");
    expect(checked.issues.filter((i) => i.rule === "explanation.short").map((i) => i.level)).toEqual(["info"]);
  });
});

describe("library publish DIR: the second sync", () => {
  it("is unchanged when nothing changed: it writes nothing (mtimes kept), commits nothing and says so", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    await t.sync("shelf");
    const stamps = new Map(listing(dir).map((f) => [f, statSync(join(dir, f)).mtimeMs]));
    const config = read(t.dir, "config.toml");
    await new Promise((r) => setTimeout(r, 20));
    const again = await t.sync("shelf");
    expect(again.exit).toBe(0);
    expect(again.out).toEqual([`unchanged: ${dir} already matches the library (2 quizzes)`]);
    for (const [f, ms] of stamps) expect(statSync(join(dir, f)).mtimeMs, f).toBe(ms);
    expect(read(t.dir, "config.toml")).toBe(config);
    expect(readdirSync(dir).sort()).toEqual(["calculus-limits", "fullmark-shelf.json", "index.html", "rust"]);
  });

  it("adds, updates and removes: a new version, a quiz taken off, one put on; the owner's own files are left alone", async () => {
    const t = await shelfLibrary({ mark: ["rust-basics"] });
    const dir = join(t.dir, "shelf");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "README.md"), "mine\n");
    mkdirSync(join(dir, "calculus-limits"), { recursive: true });
    writeFileSync(join(dir, "calculus-limits", "notes.txt"), "mine too\n");
    expect((await t.sync("shelf")).exit).toBe(0);
    // a new version of rust, limits put on the shelf
    t.write({ "notes/rust.md": quizText("rust", "Rust basics", [["own", "Who owns the value?"]]) });
    expect((await t.register(["notes/rust.md"], { update: "rust-basics" })).exit).toBe(0);
    await t.publish("limits", { on: true });
    const r = await t.sync("shelf");
    expect(r.exit).toBe(0);
    expect(r.out[0]).toBe(`published 2 quizzes to ${dir}: 1 added, 1 updated`);
    // taken off: its folder goes, the owner's file in it stays, nothing else is touched
    await t.publish("rust-basics", { off: true });
    const off = await t.sync("shelf");
    expect(off.out[0]).toBe(`published 1 quiz to ${dir}: 1 removed`);
    expect(listing(dir)).toEqual([
      "README.md",
      "calculus-limits/index.html",
      "calculus-limits/limits.md",
      "calculus-limits/notes.txt",
      "fullmark-shelf.json",
      "index.html",
    ]);
    expect(read(dir, "README.md")).toBe("mine\n");
    expect(existsSync(join(dir, "rust"))).toBe(false);
  });

  it("--dry-run prints the plan and writes nothing: no folder, no config, no lock", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    const config = read(t.dir, "config.toml");
    const dry = await t.sync("shelf", { dryRun: true });
    expect(dry.exit).toBe(0);
    expect(dry.out).toEqual([
      `would publish 2 quizzes to ${dir}`,
      "  add     calculus-limits/   new on the shelf",
      "  add     rust/              new on the shelf",
      "  add     index.html",
      "nothing written (--dry-run)",
    ]);
    expect(existsSync(dir)).toBe(false);
    expect(read(t.dir, "config.toml")).toBe(config);
    await t.sync("shelf");
    const same = await t.sync("shelf", { dryRun: true });
    expect(same.out).toEqual([`unchanged: ${dir} already matches the library (2 quizzes)`]);
    // a plan with an update and a removal
    await t.publish("limits", { off: true });
    t.write({ "notes/rust.md": quizText("rust", "Rust basics", [["own", "Who owns the value?"]]) });
    await t.register(["notes/rust.md"], { update: "rust-basics" });
    const plan = await t.sync("shelf", { dryRun: true });
    expect(plan.out[0]).toBe(`would publish 1 quiz to ${dir}`);
    expect(plan.out.slice(1, 3)).toEqual([
      expect.stringMatching(/^ {2}update {2}rust\/ {14}version [0-9a-f]{4} → [0-9a-f]{4}$/),
      "  remove  calculus-limits/   off the shelf",
    ]);
    expect(plan.out.slice(3)).toEqual(["  update  index.html", "nothing written (--dry-run)"]);
    expect(manifestOf(dir).quizzes).toHaveLength(2);
  });

  it("--json is {status, dir, added, updated, removed, committed, warnings}; the words go to stderr", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    const r = await t.sync("shelf", { json: true });
    expect(r.out).toHaveLength(1);
    expect(JSON.parse(r.out[0] ?? "")).toEqual({
      status: "published",
      dir,
      added: ["calculus-limits", "rust"],
      updated: [],
      removed: [],
      committed: null,
      warnings: [],
    });
    expect(r.err[0]).toBe(`published 2 quizzes to ${dir}: 2 added`);
    const again = await t.sync("shelf", { json: true });
    expect(JSON.parse(again.out[0] ?? "")).toMatchObject({ status: "unchanged", dir, added: [], committed: null });
  });
});

describe("library publish DIR: where the shelf is (G4)", () => {
  it("remembers the first DIR, says so when a later one replaces it, and uses it when none is given", async () => {
    const t = await shelfLibrary();
    const a = join(t.dir, "a");
    const b = join(t.dir, "b");
    expect((await t.sync("a")).out).toContain(`remembered ${a} as the public shelf`);
    const bare = await t.sync(null);
    expect(bare.out).toEqual([`unchanged: ${a} already matches the library (2 quizzes)`]);
    const other = await t.sync("b");
    expect(other.out).toContain(`remembered ${b} as the public shelf`);
    expect(read(t.dir, "config.toml")).toContain(`public = ${JSON.stringify(b)}`);
    expect(read(t.dir, "config.toml")).not.toContain(JSON.stringify(a));
    // the same DIR again says nothing about remembering
    await t.publish("limits", { off: true });
    expect((await t.sync("b")).out.some((l) => l.startsWith("remembered"))).toBe(false);
    // a relative DIR is relative to the working directory, a missing one is made with its parents
    expect((await t.sync("deep/er/shelf")).exit).toBe(0);
    expect(existsSync(join(t.dir, "deep", "er", "shelf", "fullmark-shelf.json"))).toBe(true);
  });

  it("with no DIR and none remembered exits 3", async () => {
    const t = await shelfLibrary();
    const r = await t.sync(null);
    expect(r.exit).toBe(3);
    expect(r.err).toEqual(["error: no DIR given and none remembered", "    fix: quiz library publish DIR"]);
    const j = await t.sync(null, { json: true });
    expect(j.exit).toBe(3);
    expect(JSON.parse(j.out[0] ?? "")).toEqual({
      status: "error",
      message: "no DIR given and none remembered",
      fix: "quiz library publish DIR",
    });
  });

  it("keeps the rest of config.toml when it records the shelf", async () => {
    const t = await shelfLibrary();
    const config = join(t.dir, "config.toml");
    writeFileSync(config, `${readFileSync(config, "utf8")}\n# mine\n[terminal]\nstyle = "boxed"\n`);
    await t.sync("shelf");
    const text = readFileSync(config, "utf8");
    expect(text).toContain('# mine\n[terminal]\nstyle = "boxed"\n');
    expect(text).toContain("[shelves]\npublic = ");
  });
});

describe("library publish DIR: git (G5)", () => {
  const run = (t: { env: Record<string, string> }, cwd: string, ...args: string[]) => git(cwd, t.env, ...args);

  it("DIR at a repository's root: one commit of the paths it wrote, `fullmark: publish`", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "site");
    mkdirSync(dir);
    await run(t, dir, "init", "-q");
    const r = await t.sync("site");
    expect(r.exit).toBe(0);
    const head = (await run(t, dir, "rev-parse", "--short", "HEAD")).trim();
    expect(r.out).toEqual([
      `published 2 quizzes to ${dir}: 2 added`,
      `remembered ${dir} as the public shelf`,
      `committed ${head} fullmark: publish (in ${dir})`,
      `next: git -C ${dir} push   (fullmark never pushes)`,
    ]);
    expect((await run(t, dir, "log", "--format=%s")).trim()).toBe("fullmark: publish");
    expect((await run(t, dir, "show", "--name-only", "--format=", "HEAD")).trim().split("\n")).toEqual(listing(dir));
    expect(await run(t, dir, "status", "--porcelain")).toBe("");
    // unchanged: no second commit
    await t.sync("site");
    expect((await run(t, dir, "rev-list", "--count", "HEAD")).trim()).toBe("1");
    // a removal is committed too
    await t.publish("limits", { off: true });
    await t.sync("site");
    expect((await run(t, dir, "rev-list", "--count", "HEAD")).trim()).toBe("2");
    expect(await run(t, dir, "status", "--porcelain")).toBe("");
  });

  it("DIR in a repository's docs/ folder: committed from there, and the owner's own staged changes stay out", async () => {
    const t = await shelfLibrary();
    const repo = join(t.dir, "site");
    mkdirSync(join(repo, "docs"), { recursive: true });
    writeFileSync(join(repo, "README.md"), "one\n");
    await run(t, repo, "init", "-q");
    await run(t, repo, "add", "README.md");
    await run(t, repo, "commit", "-q", "-m", "start");
    writeFileSync(join(repo, "README.md"), "two\n");
    await run(t, repo, "add", "README.md");
    writeFileSync(join(repo, "notes.txt"), "untracked\n");
    const r = await t.sync("site/docs");
    expect(r.exit).toBe(0);
    expect(r.out.some((l) => l.startsWith("committed "))).toBe(true);
    const files = (await run(t, repo, "show", "--name-only", "--format=", "HEAD")).trim().split("\n");
    expect(files).toEqual(listing(join(repo, "docs")).map((f) => `docs/${f}`));
    expect((await run(t, repo, "status", "--porcelain")).trim().split("\n").sort()).toEqual([
      "?? notes.txt",
      "M  README.md",
    ]);
  });

  it("DIR outside any repository: nothing committed, a note, and fullmark never runs git init", async () => {
    const t = await shelfLibrary();
    const r = await t.sync("plain");
    expect(r.exit).toBe(0);
    expect(existsSync(join(t.dir, "plain", ".git"))).toBe(false);
    expect(r.out.some((l) => l.startsWith("committed"))).toBe(false);
    expect(r.out.at(-1)).toBe(`note ${join(t.dir, "plain")} is not in a git repository, so nothing was committed`);
  });

  it("a failed commit is a warning: the files are written, the exit is 0", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "site");
    mkdirSync(dir);
    await run(t, dir, "init", "-q");
    writeFileSync(join(dir, ".gitignore"), "*\n");
    const r = await t.sync("site", { json: true });
    expect(r.exit).toBe(0);
    expect(existsSync(join(dir, "fullmark-shelf.json"))).toBe(true);
    const json = JSON.parse(r.out[0] ?? "") as { committed: string | null; warnings: string[] };
    expect(json.committed).toBeNull();
    expect(json.warnings[0]).toMatch(/^the commit failed: /);
    expect(r.err.some((l) => l.startsWith("warning the commit failed: "))).toBe(true);
  });
});

describe("library publish DIR: what it refuses", () => {
  const folder = (dir: string) => JSON.stringify([...folderBytes(dir)]);

  it("exit 2: DIR inside the library, DIR holding a library.toml, a file, an unknown --fonts or --ui-lang", async () => {
    const t = await shelfLibrary();
    const inside = await t.sync(join(t.lib, "shelf"));
    expect(inside.exit).toBe(2);
    expect(inside.err[0]).toMatch(/^error: .* is the library or inside it, or holds a library\.toml$/);
    expect(inside.err[1]).toBe("    fix: a shelf is a folder of its own: choose another DIR");
    expect((await t.sync(t.lib)).exit).toBe(2);
    mkdirSync(join(t.dir, "other"));
    writeFileSync(join(t.dir, "other", "library.toml"), "x");
    expect((await t.sync("other")).exit).toBe(2);
    writeFileSync(join(t.dir, "afile"), "x");
    expect((await t.sync("afile")).err[0]).toMatch(/is a file, and a folder is needed$/);
    expect((await t.sync("shelf", { fonts: "huge" })).err).toEqual([
      "error: --fonts huge is not one of quiz, all, none",
    ]);
    expect((await t.sync("shelf", { uiLang: "fr" })).err).toEqual(["error: --ui-lang fr is not one of en, vi"]);
    expect((await t.sync("shelf", { withBrief: true, noBrief: true })).exit).toBe(2);
    expect(existsSync(join(t.dir, "shelf"))).toBe(false);
  });

  it("exit 2: a manifest that is foreign, newer or malformed; nothing is written", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    mkdirSync(dir);
    for (const [text, message] of [
      [
        '{"format":"fullmark-publish","version":2}',
        'not a fullmark shelf: fullmark-shelf.json has format "fullmark-publish"',
      ],
      ['{"format":"fullmark-shelf","version":3}', "has version 3"],
      ["{", "not valid JSON"],
    ] as const) {
      writeFileSync(join(dir, "fullmark-shelf.json"), text);
      const r = await t.sync("shelf");
      expect(r.exit).toBe(2);
      expect(r.err[0]).toContain(message);
      expect(r.err[1]).toMatch(/^ {4}fix: /);
      expect(listing(dir)).toEqual(["fullmark-shelf.json"]);
    }
    const json = await t.sync("shelf", { json: true });
    expect(JSON.parse(json.out[0] ?? "")).toMatchObject({ status: "error" });
  });

  it("exit 1: a quiz folder the manifest does not list, with a manifest or without; nothing is written", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    expect((await t.sync("shelf")).exit).toBe(0);
    mkdirSync(join(dir, "copied"));
    writeFileSync(join(dir, "copied", "q.md"), "x");
    writeFileSync(join(dir, "copied", "index.html"), "x");
    const before = folder(dir);
    await t.publish("limits", { off: true });
    const r = await t.sync("shelf");
    expect(r.exit).toBe(1);
    expect(r.err).toEqual([
      `error: copied/ in ${dir} is a quiz folder that fullmark-shelf.json does not list`,
      `    fix: move it out of ${dir}, or import it into the library first`,
    ]);
    expect(folder(dir)).toBe(before);
    const json = await t.sync("shelf", { json: true });
    expect(JSON.parse(json.out[0] ?? "")).toMatchObject({ status: "refused" });
    // with no manifest at all it is the same refusal
    const bare = join(t.dir, "bare");
    mkdirSync(join(bare, "mine"), { recursive: true });
    writeFileSync(join(bare, "mine", "a.md"), "x");
    writeFileSync(join(bare, "mine", "index.html"), "x");
    const first = await t.sync("bare");
    expect(first.exit).toBe(1);
    expect(first.err[0]).toBe(`error: mine/ in ${bare} is a quiz folder, and the folder has no fullmark-shelf.json`);
    expect(listing(bare)).toEqual(["mine/a.md", "mine/index.html"]);
  });

  it("exit 1: an index.html at the top of a folder with no manifest (the owner's page); other files are fine", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "site");
    mkdirSync(dir);
    writeFileSync(join(dir, "index.html"), "<p>mine</p>");
    writeFileSync(join(dir, "README.md"), "mine");
    const r = await t.sync("site");
    expect(r.exit).toBe(1);
    expect(r.err).toEqual([
      `error: index.html in ${dir} is not fullmark's: the folder has no fullmark-shelf.json, and the sync would overwrite it`,
      "    fix: move it, or publish into an empty folder",
    ]);
    expect(read(dir, "index.html")).toBe("<p>mine</p>");
    rmSync(join(dir, "index.html"));
    expect((await t.sync("site")).exit).toBe(0);
    expect(read(dir, "README.md")).toBe("mine");
  });

  it("exit 1: a path the sync would write that the manifest does not list and the owner's file differs; it is never changed", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "site");
    mkdirSync(join(dir, "rust"), { recursive: true });
    writeFileSync(join(dir, "rust", "index.html"), "mine");
    const r = await t.sync("site");
    expect(r.exit).toBe(1);
    expect(r.err[0]).toBe(
      `error: rust/index.html in ${dir} is not listed in fullmark-shelf.json and differs from what would be written`,
    );
    expect(read(dir, "rust/index.html")).toBe("mine");
    expect(existsSync(join(dir, "fullmark-shelf.json"))).toBe(false);
  });

  it("exit 1: a build that fails writes nothing at all, and names the quiz", async () => {
    const t = await shelfLibrary();
    await t.sync("shelf");
    const dir = join(t.dir, "shelf");
    const before = folder(dir);
    const versions = join(t.lib, "quizzes", "rust", "versions");
    const hash = readdirSync(versions)[0] as string;
    rmSync(join(versions, hash, "rust.md"));
    await t.publish("limits", { off: true });
    const r = await t.sync("shelf");
    expect(r.exit).toBe(1);
    expect(r.err[0]).toBe("rust-basics: the current version cannot be read from the library");
    expect(r.err.at(-2)).toBe("error: a build failed, so nothing was written");
    expect(folder(dir)).toBe(before);
    expect(existsSync(join(dir, ".fullmark.lock"))).toBe(false);
  });

  it("the shelf's lock: held by a live process it waits, fails busy and changes nothing; once free it syncs", async () => {
    const t = await shelfLibrary();
    const dir = join(t.dir, "shelf");
    mkdirSync(dir);
    writeFileSync(
      join(dir, ".fullmark.lock"),
      `${JSON.stringify({ pid: process.pid, command: "quiz library publish elsewhere", started: NOW })}\n`,
    );
    const busy = await t.sync("shelf", {}, { lock: { ...realLockEnv(), waitMs: 0 } });
    expect(busy.exit).toBe(2);
    expect(busy.err[0]).toMatch(/^error: the shelf is busy: quiz library publish elsewhere \(pid \d+\)/);
    expect(listing(dir)).toEqual([]);
    rmSync(join(dir, ".fullmark.lock"));
    expect((await t.sync("shelf")).exit).toBe(0);
  });
});

describe("library publish DIR: a sync killed half way (foundation: library and shelf writes take a lock)", () => {
  /** The state a kill is tried on: a shelf with rust and limits, then a new rust, limits off and brief on. */
  async function scenario() {
    const t = await shelfLibrary();
    expect((await t.sync("shelf")).exit).toBe(0);
    t.write({
      "notes/rust.md": quizText("rust", "Rust basics", [["own", "Who owns the value?"]], "materials:\n  - sheet.md\n"),
    });
    await t.register(["notes/rust.md"], { update: "rust-basics" });
    await t.publish("limits", { off: true });
    return t;
  }

  it("a clean sync after a kill repairs the folder, whichever write was the last: the same bytes as a fresh shelf", async () => {
    const calls = await (async () => {
      const t = await scenario();
      let n = 0;
      await t.sync(
        "shelf",
        { withBrief: true },
        {
          atomic: async (file, data) => {
            n++;
            await writeFileAtomic(file, data);
          },
        },
      );
      return n;
    })();
    expect(calls).toBeGreaterThan(3);
    for (let limit = 0; limit < calls; limit++) {
      const t = await scenario();
      const dir = join(t.dir, "shelf");
      let n = 0;
      await expect(
        t.sync(
          "shelf",
          { withBrief: true },
          {
            atomic: async (file, data) => {
              if (++n > limit) throw new Error("killed");
              await writeFileAtomic(file, data);
            },
          },
        ),
      ).rejects.toThrow("killed");
      expect(existsSync(join(dir, ".fullmark.lock")), `lock after kill at ${limit}`).toBe(false);
      // the manifest on disk lists everything the sync may have written (the old paths and the new)
      const manifest = manifestOf(dir);
      const listed = new Set(manifestPaths(manifest));
      for (const f of listing(dir))
        if (f !== "fullmark-shelf.json") expect(listed.has(f), `${f} after kill at ${limit}`).toBe(true);
      // the next sync refuses nothing and ends where a fresh shelf would
      const repaired = await t.sync("shelf", { withBrief: true });
      expect(repaired.exit, `repair after kill at ${limit}: ${repaired.err.join(" | ")}`).toBe(0);
      const fresh = await t.sync("fresh/shelf", { withBrief: true });
      expect(fresh.exit).toBe(0);
      expect(folderBytes(dir), `after kill at ${limit}`).toEqual(folderBytes(join(t.dir, "fresh", "shelf")));
      expect((await t.sync("shelf", { withBrief: true })).out[0]).toMatch(/^unchanged:/);
    }
  });
});
