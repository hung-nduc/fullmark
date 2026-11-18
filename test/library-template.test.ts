import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CheckIo } from "../src/cli/check";
import { type LibraryTemplateAddOptions, runLibraryTemplateAdd } from "../src/cli/library-template";
import { cleanTemps, git } from "./helpers/library";
import { newLibrary, quizText } from "./helpers/library-register";

/**
 * `library template add`, in-process with real git in a temp folder (STEP4.md, slice 4f): the version's source and assets
 * go to `quiz template add`'s own machinery, checked under the rules it was registered with, into the config folder
 * (`FULLMARK_CONFIG` is inside the temp folder). The library is read and never changed. The goldens are in
 * test/golden/library/template-add-*.
 */
afterEach(cleanTemps);

const QUESTIONS: [string, string][] = [
  ["own", "Who owns the value?"],
  ["borrow", "What does a borrow do?"],
];

const addOptions = (o: Partial<LibraryTemplateAddOptions> = {}): LibraryTemplateAddOptions => ({
  as: null,
  version: null,
  skeleton: false,
  replace: false,
  json: false,
  ...o,
});

async function rustLibrary(extra: Record<string, string> = {}, front = "materials:\n  - materials/sheet.md\n") {
  const t = await newLibrary();
  t.write({
    "notes/rust.md": quizText("rust", "Rust basics", QUESTIONS, front),
    "notes/materials/sheet.md": "# Sheet\n\nText.\n",
    ...extra,
  });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  const add = async (name: string, o: Partial<LibraryTemplateAddOptions> = {}) => {
    const c = t.at();
    const io: CheckIo & ReturnType<typeof t.at>["io"] = c.io;
    const exit = await runLibraryTemplateAdd(name, addOptions(o), io);
    return { exit, out: c.out, err: c.err };
  };
  const templates = join(t.dir, "templates");
  return { ...t, add, templates };
}

const names = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      join(e.parentPath, e.name)
        .slice(dir.length + 1)
        .replaceAll("\\", "/"),
    )
    .sort();

describe("library template add", () => {
  it("stores the version's source and its sheets as a user template named by --as, and prints where it came from", async () => {
    const t = await rustLibrary();
    const hash = readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string;
    const r = await t.add("rust-basics", { as: "rust-week" });
    expect(r.exit).toBe(0);
    expect(r.out).toEqual([
      `template added rust-week, from rust-basics version ${hash.slice(0, 4)}`,
      "next: quiz new rust-week PATH",
    ]);
    expect(names(join(t.templates, "rust-week"))).toEqual(["materials/sheet.md", "rust.md"]);
    expect(readFileSync(join(t.templates, "rust-week", "rust.md"), "utf8")).toContain("Who owns the value?");
    // the library is read, never changed: no commit, no lock, no change
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect((await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n")).toEqual([
      "fullmark: register rust-basics",
      "fullmark: init",
    ]);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("is named by the quiz's name when --as is left out; the same content again is unchanged (exit 0)", async () => {
    const t = await rustLibrary();
    expect((await t.add("rust")).exit).toBe(0);
    expect(existsSync(join(t.templates, "rust-basics", "rust.md"))).toBe(true);
    const again = await t.add("rust-basics");
    expect(again.exit).toBe(0);
    expect(again.out[0]).toBe("template rust-basics is already stored with this content: unchanged");
    const j = await t.add("rust-basics", { json: true });
    expect(JSON.parse(j.out[0] ?? "")).toEqual({
      status: "unchanged",
      name: "rust-basics",
      path: "templates/rust-basics",
    });
  });

  it("a name taken by one of yours exits 1 and suggests a free name; --replace overwrites; a built-in name is refused", async () => {
    const t = await rustLibrary();
    expect((await t.add("rust-basics", { as: "mine" })).exit).toBe(0);
    // a second version with other content
    t.write({
      "notes/rust.md": quizText(
        "rust",
        "Rust basics",
        [...QUESTIONS, ["more", "One more?"]],
        "materials:\n  - materials/sheet.md\n",
      ),
    });
    expect((await t.register(["notes/rust.md"], { update: "rust-basics" })).exit).toBe(0);
    const taken = await t.add("rust-basics", { as: "mine" });
    expect(taken.exit).toBe(1);
    expect(taken.err).toEqual([
      `you already have a template called "mine"`,
      "use --replace to overwrite it, or --as mine-2",
    ]);
    const replaced = await t.add("rust-basics", { as: "mine", replace: true });
    expect(replaced.exit).toBe(0);
    expect(replaced.out[0]).toMatch(/^template replaced mine, from rust-basics version [0-9a-f]{4}$/);
    expect(readFileSync(join(t.templates, "mine", "rust.md"), "utf8")).toContain("One more?");
    const builtin = await t.add("rust-basics", { as: "rust", replace: true });
    expect(builtin.exit).toBe(1);
    expect(builtin.err[0]).toBe(`"rust" is a built-in template, and --replace does not change that`);
  });

  it("--version stores that version, by a prefix; an unknown one and an unknown quiz exit 2", async () => {
    const t = await rustLibrary();
    const first = readdirSync(join(t.lib, "quizzes", "rust", "versions"))[0] as string;
    t.write({
      "notes/rust.md": quizText(
        "rust",
        "Rust basics",
        [...QUESTIONS, ["more", "One more?"]],
        "materials:\n  - materials/sheet.md\n",
      ),
    });
    expect((await t.register(["notes/rust.md"], { update: "rust-basics" })).exit).toBe(0);
    const old = await t.add("rust-basics", { as: "old", version: first.slice(0, 5) });
    expect(old.exit).toBe(0);
    expect(old.out[0]).toBe(`template added old, from rust-basics version ${first.slice(0, 4)}`);
    expect(readFileSync(join(t.templates, "old", "rust.md"), "utf8")).not.toContain("One more?");
    const none = await t.add("rust-basics", { version: "ffff" });
    expect(none.exit).toBe(2);
    expect(none.err[0]).toBe("error: rust-basics has no version ffff");
    const unknown = await t.add("rustbasics");
    expect(unknown.exit).toBe(2);
    expect(unknown.err[0]).toBe("error: no quiz named rustbasics");
  });

  it("--skeleton stores the structure without the content", async () => {
    const t = await rustLibrary();
    const r = await t.add("rust-basics", { as: "shape", skeleton: true });
    expect(r.exit).toBe(0);
    expect(r.out[0]).toMatch(/^template added shape \(a skeleton\), from rust-basics version /);
    const text = readFileSync(join(t.templates, "shape", "rust.md"), "utf8");
    expect(text).not.toContain("Who owns the value?");
    expect(names(join(t.templates, "shape"))).toEqual(["rust.md"]);
  });

  it("checks under the rules the version was registered with, not the config's: a custom profile the config lacks", async () => {
    const t = await rustLibrary(
      { "notes/fullmark.toml": `[profiles.practice]\nextends = "default"\nrules."explanation.short" = "off"\n` },
      "profile: practice\n",
    );
    // `quiz template add` on the source would stop at an unknown profile where the source now sits (the library)
    const r = await t.add("rust-basics", { as: "practice-quiz" });
    expect(r.err).toEqual([]);
    expect(r.exit).toBe(0);
    expect(existsSync(join(t.templates, "practice-quiz", "rust.md"))).toBe(true);
  });

  it("--json is quiz template add's: {status, name, path}, the words on stderr", async () => {
    const t = await rustLibrary();
    const r = await t.add("rust-basics", { as: "rust-week", json: true });
    expect(JSON.parse(r.out[0] ?? "")).toEqual({ status: "added", name: "rust-week", path: "templates/rust-week" });
    expect(r.out).toHaveLength(1);
    expect(r.err[0]).toMatch(/^template added rust-week, from rust-basics version/);
  });
});
