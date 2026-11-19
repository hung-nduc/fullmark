import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type BuildOptions, runBuild } from "../src/cli/build";
import { checkFile } from "../src/cli/check";
import { type LibraryShareOptions, runLibraryShare, type ShareIo } from "../src/cli/library-share";
import { readCheck } from "../src/library/check-file";
import { cleanTemps, git, NOW } from "./helpers/library";
import { newLibrary, quizText } from "./helpers/library-register";

/**
 * `library share`, in-process with real git in a temp folder (STEP4.md, slice 4f; G35, G36). The page is `quiz build`'s
 * own, byte for byte (foundation 9); `--source` is the version's folder, and a `fullmark.toml` when its profile is a
 * custom one. The goldens of the Output blocks are in test/golden/library/share-*.
 */
afterEach(cleanTemps);

const QUESTIONS: [string, string][] = [
  ["own", "Who owns the value?"],
  ["borrow", "What does a borrow do?"],
  ["trait", "What is a trait?"],
];
const SOURCE = quizText("rust", "Rust basics", QUESTIONS, "materials:\n  - sheet.md\n");
const clock = () => new Date(NOW);

const shareOptions = (o: Partial<LibraryShareOptions> = {}): LibraryShareOptions => ({
  output: null,
  version: null,
  source: false,
  fonts: null,
  json: false,
  plain: true,
  program: "1.0.0-test",
  ...o,
});

async function rustLibrary() {
  const t = await newLibrary();
  t.write({
    "notes/rust.md": SOURCE,
    "notes/sheet.md": "# Formulas\n\nNothing here.\n",
    "notes/brief.yaml": "purpose: self-study\n",
  });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  const share = async (name: string, o: Partial<LibraryShareOptions> = {}, cwd = t.dir) => {
    const c = t.at(cwd);
    const io: ShareIo = { ...c.io, now: clock };
    const exit = await runLibraryShare(name, shareOptions(o), io);
    return { exit, out: c.out, err: c.err };
  };
  return { ...t, share };
}

const build = (): BuildOptions => ({
  profile: null,
  config: null,
  strict: false,
  output: null,
  builtAt: new Date(NOW).toISOString(),
  uiLang: null,
  fonts: null,
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

const names = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      join(e.parentPath, e.name)
        .slice(dir.length + 1)
        .replaceAll("\\", "/"),
    )
    .sort();

describe("library share: the page", () => {
  it("is byte-identical to quiz build of the same source (foundation 9)", async () => {
    const t = await rustLibrary();
    const c = t.at();
    const built = await runBuild(["notes/rust.md"], { ...build(), output: "built/rust-basics.html" }, c.io);
    expect(built).toBe(0);
    const r = await t.share("rust-basics", { output: "shared" });
    expect(r.exit).toBe(0);
    const a = readFileSync(join(t.dir, "built", "rust-basics.html"));
    const b = readFileSync(join(t.dir, "shared", "rust-basics.html"));
    expect(b.length).toBeGreaterThan(10_000);
    expect(b.equals(a)).toBe(true);
    // with an embedded font choice too
    const full = await runBuild(["notes/rust.md"], { ...build(), output: "built/all.html", fonts: "none" }, t.at().io);
    expect(full).toBe(0);
    expect((await t.share("rust-basics", { output: "shared-none", fonts: "none" })).exit).toBe(0);
    expect(
      readFileSync(join(t.dir, "shared-none", "rust-basics.html")).equals(
        readFileSync(join(t.dir, "built", "all.html")),
      ),
    ).toBe(true);
  });

  it("prints the page, the version and the size as build counts it; --json is {status, path, version, source}", async () => {
    const t = await rustLibrary();
    const hash = readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string;
    const r = await t.share("rust-basics");
    expect(r.out).toEqual([
      expect.stringMatching(new RegExp(`^written rust-basics\\.html · version ${hash.slice(0, 4)} · \\d+ KB$`)),
    ]);
    expect(r.err).toEqual([]);
    const j = await t.share("rust", { json: true, output: "out" });
    expect(JSON.parse(j.out[0] ?? "")).toEqual({
      status: "written",
      path: "out/rust-basics.html",
      version: hash,
      source: false,
    });
    expect(j.err[0]).toMatch(/^written out\/rust-basics\.html · version /);
  });

  it("replaces a page that is there (G36), and writes nothing in the library: no commit, no lock, no change", async () => {
    const t = await rustLibrary();
    const before = (await git(t.lib, t.env, "log", "--format=%H")).trim();
    writeFileSync(join(t.dir, "rust-basics.html"), "old");
    expect((await t.share("rust-basics")).exit).toBe(0);
    expect(readFileSync(join(t.dir, "rust-basics.html"), "utf8")).toContain("<!doctype html>");
    expect((await git(t.lib, t.env, "log", "--format=%H")).trim()).toBe(before);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("--version builds that version: an earlier one by a prefix; an unknown, a short or a missing one exits 2", async () => {
    const t = await rustLibrary();
    const first = readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string;
    t.write({
      "notes/rust.md": quizText(
        "rust",
        "Rust basics",
        [...QUESTIONS, ["more", "One more?"]],
        "materials:\n  - sheet.md\n",
      ),
    });
    expect((await t.register(["notes/rust.md"], { update: "rust-basics" })).exit).toBe(0);
    const old = await t.share("rust-basics", { version: first.slice(0, 6), output: "old" });
    expect(old.exit).toBe(0);
    expect(old.out[0]).toContain(`version ${first.slice(0, 4)}`);
    const current = await t.share("rust-basics", { output: "new" });
    expect(current.exit).toBe(0);
    expect(readFileSync(join(t.dir, "old", "rust-basics.html"), "utf8")).not.toBe(
      readFileSync(join(t.dir, "new", "rust-basics.html"), "utf8"),
    );
    const none = await t.share("rust-basics", { version: "ffffffff" });
    expect(none.exit).toBe(2);
    expect(none.err[0]).toBe("error: rust-basics has no version ffffffff");
    const short = await t.share("rust-basics", { version: "ab" });
    expect(short.exit).toBe(2);
    expect(short.err[0]).toContain("is too short");
    const unknown = await t.share("rustbasics");
    expect(unknown.exit).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named rustbasics", "    did you mean: rust-basics"]);
  });
});

describe("library share --source", () => {
  it("writes DIR/NAME/ with the version's files, not check.json, and no fullmark.toml for a built-in profile", async () => {
    const t = await rustLibrary();
    const hash = readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string;
    const r = await t.share("rust-basics", { source: true, output: "edit" });
    expect(r.exit).toBe(0);
    expect(names(join(t.dir, "edit", "rust-basics"))).toEqual(["brief.yaml", "rust.md", "sheet.md"]);
    expect(r.out).toEqual([
      `written edit/rust-basics/ · rust.md, 1 asset, brief.yaml · version ${hash.slice(0, 4)}`,
      "next: edit it, then quiz library register edit/rust-basics/rust.md --update rust-basics",
    ]);
    // the source is the stored file, byte for byte
    expect(readFileSync(join(t.dir, "edit", "rust-basics", "rust.md"), "utf8")).toBe(SOURCE);
    const j = await t.share("rust-basics", { source: true, output: "edit2", json: true });
    expect(JSON.parse(j.out[0] ?? "")).toEqual({
      status: "written",
      path: "edit2/rust-basics/",
      version: hash,
      source: true,
    });
  });

  it("refuses a folder that exists and is not empty (exit 2, G36); an empty one is filled; nothing is overwritten", async () => {
    const t = await rustLibrary();
    mkdirSync(join(t.dir, "edit", "rust-basics"), { recursive: true });
    writeFileSync(join(t.dir, "edit", "rust-basics", "mine.md"), "my edit");
    const refused = await t.share("rust-basics", { source: true, output: "edit" });
    expect(refused.exit).toBe(2);
    expect(refused.err).toEqual([
      "error: edit/rust-basics already exists and is not empty",
      "    fix: choose another -o, or remove edit/rust-basics",
    ]);
    expect(names(join(t.dir, "edit"))).toEqual(["rust-basics/mine.md"]);
    const json = await t.share("rust-basics", { source: true, output: "edit", json: true });
    expect(json.exit).toBe(2);
    expect(JSON.parse(json.out[0] ?? "")).toMatchObject({
      status: "error",
      fix: "choose another -o, or remove edit/rust-basics",
    });
    // an empty folder is fine
    mkdirSync(join(t.dir, "empty", "rust-basics"), { recursive: true });
    expect((await t.share("rust-basics", { source: true, output: "empty" })).exit).toBe(0);
    expect(names(join(t.dir, "empty", "rust-basics"))).toContain("rust.md");
    // no temporary folder is left beside it
    expect(readdirSync(join(t.dir, "empty"))).toEqual(["rust-basics"]);
  });

  it("writes the fullmark.toml of a custom profile, and quiz check on the folder finds what the library found (G35)", async () => {
    const t = await newLibrary();
    t.write({
      "notes/fullmark.toml": `[profiles.practice]
extends = "default"
rules."explanation.short" = { level = "warning", min-words = 20 }
rules."choice.in-stem" = "off"

[[profiles.practice.checks]]
id = "custom.few"
kind = "count"
max = 2
level = "warning"
message = "Two questions at most."
`,
      "notes/rust.md": quizText("rust", "Rust basics", QUESTIONS, "profile: practice\n"),
    });
    const registered = await t.register(["notes/rust.md"], { name: "rust-basics" });
    expect(registered.exit).toBe(0);
    const c = t.at();
    const io: ShareIo = { ...c.io, now: clock };
    expect(await runLibraryShare("rust-basics", shareOptions({ source: true, output: "edit" }), io)).toBe(0);
    const folder = join(t.dir, "edit", "rust-basics");
    expect(names(folder)).toEqual(["fullmark.toml", "rust.md"]);
    expect(c.out[0]).toMatch(/^written edit\/rust-basics\/ · rust\.md, fullmark\.toml · version [0-9a-f]{4}$/);

    const options = { profile: null, config: null, strict: false, review: null, json: false, plain: true } as const;
    const shared = checkFile(join(folder, "rust.md"), options, t.at(folder).io);
    const version = join(
      t.lib,
      "quizzes",
      "rust",
      "versions",
      readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string,
    );
    const stored = readCheck(readFileSync(join(version, "check.json"), "utf8"));
    if (!stored.ok || shared.status === "error") throw new Error("could not check");
    const alone = checkFile(join(version, "rust.md"), { ...options, fixed: stored.profile }, t.at(version).io);
    if (alone.status === "error") throw new Error(alone.message);
    const shape = (issues: { rule: string; level: string; line: number; message: string }[]) =>
      issues.map(({ rule, level, line, message }) => ({ rule, level, line, message }));
    expect(shape(shared.issues).length).toBeGreaterThan(0);
    expect(shared.issues.map((i) => i.rule)).toEqual(expect.arrayContaining(["custom.few", "explanation.short"]));
    expect(shape(shared.issues)).toEqual(shape(alone.issues));
    expect(shared.profile).toBe("practice");
  });

  it("a quiz registered under another built-in profile than its own gets `[check] profile = NAME`, and quiz check on the folder reports what the library found (step 5, G38)", async () => {
    const t = await newLibrary();
    // a one-word explanation: a warning under default, an info under draft
    const text = quizText("rust", "Rust basics", QUESTIONS).replaceAll(
      "The first choice is the right one here.",
      "Short.",
    );
    t.write({ "notes/rust.md": text });
    expect((await t.register(["notes/rust.md"], { name: "rust-basics", profile: "draft" })).exit).toBe(0);
    const c = t.at();
    expect(
      await runLibraryShare("rust-basics", shareOptions({ source: true, output: "edit" }), { ...c.io, now: clock }),
    ).toBe(0);
    const folder = join(t.dir, "edit", "rust-basics");
    expect(names(folder)).toEqual(["fullmark.toml", "rust.md"]);
    expect(readFileSync(join(folder, "fullmark.toml"), "utf8")).toBe(`[check]\nprofile = "draft"\n`);
    const options = { profile: null, config: null, strict: false, review: null, json: false, plain: true } as const;
    const shared = checkFile(join(folder, "rust.md"), options, t.at(folder).io);
    if (shared.status === "error") throw new Error(shared.message);
    expect(shared.profile).toBe("draft");
    const levels = shared.issues.filter((i) => i.rule === "explanation.short").map((i) => i.level);
    expect(levels).toEqual(["info", "info", "info"]);
  });

  it("a page of a custom-profile version builds under check.json's profile (a profile the config lacks)", async () => {
    const t = await newLibrary();
    t.write({
      "notes/fullmark.toml": `[profiles.practice]\nextends = "default"\nrules."explanation.short" = "off"\n`,
      "notes/rust.md": quizText("rust", "Rust basics", QUESTIONS, "profile: practice\n"),
    });
    expect((await t.register(["notes/rust.md"], { name: "rust-basics" })).exit).toBe(0);
    // shared from a folder with no such profile: `quiz build` there would say unknown profile
    const c = t.at();
    const exit = await runLibraryShare("rust-basics", shareOptions({ output: "out" }), { ...c.io, now: clock });
    expect(c.err).toEqual([]);
    expect(exit).toBe(0);
  });
});
