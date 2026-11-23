import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  attemptStamps,
  libraryRoot,
  NoAnswer,
  profileNames,
  quizNames,
  ruleIds,
  sectionsOfFile,
  sectionsOfLibraryQuiz,
  templateNames,
} from "../src/cli/complete-sources";
import type { Machine } from "../src/cli/config";
import { cleanTemps, NOW, tempDir } from "./helpers/library";

/**
 * The value sources of Tab completion (COMMANDS.md, `quiz shell-init`): each reads the user's own files and answers with
 * candidates, an empty list when there is nothing, or `NoAnswer` when it cannot say (which `quiz __complete` turns into
 * no candidates and `:default`). The machine is always a temporary folder: the owner's config and library are never read.
 */
afterEach(cleanTemps);

const HISTORY = resolve(import.meta.dirname, "fixtures", "library-history", "lib");

/** A machine whose config is `<dir>/config.toml` (not written until a test writes it) and whose library is `library`. */
function machine(dir: string, env: Record<string, string> = {}): Machine {
  return {
    cwd: dir,
    env: { FULLMARK_CONFIG: join(dir, "config.toml"), ...env },
    platform: "linux",
    home: join(dir, "home"),
  };
}

const write = (path: string, text: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};

const names = (list: { value: string }[]): string[] => list.map((c) => c.value);

const QUIZ = (body: string): string => `---\ntitle: T\n---\n\n${body}`;
const QUESTION = (id: string): string => `## Question ${id} {type=single id=${id}}\n\n- [x] a\n- [ ] b\n\n`;

describe("templateNames", () => {
  it("offers the built-in templates for `new`, each with its source", () => {
    const m = machine(tempDir());
    const list = templateNames(m, false);
    expect(names(list)).toEqual(["calculus", "rust", "ielts", "medical", "exam", "survey", "blank"]);
    expect(list[0]?.description).toBe("built-in template");
  });

  it("offers none for `template rm` when the user has none, and with no templates folder at all", () => {
    expect(templateNames(machine(tempDir()), true)).toEqual([]);
  });

  it("adds the user's own templates, from the folder beside the config, and leaves out one that cannot be used", () => {
    const dir = tempDir();
    write(join(dir, "templates", "mine", "mine.md"), QUIZ(QUESTION("a")));
    write(join(dir, "templates", "two", "a.md"), "x");
    write(join(dir, "templates", "two", "b.md"), "x");
    write(join(dir, "templates", "blank", "blank.md"), QUIZ(QUESTION("a")));
    const m = machine(dir);
    const forNew = templateNames(m, false);
    // `two` holds two quizzes, and `blank` is a built-in name: `new` would not use either
    expect(names(forNew)).toEqual(["calculus", "rust", "ielts", "medical", "exam", "survey", "blank", "mine"]);
    expect(forNew.find((c) => c.value === "mine")?.description).toBe("your template");
    // `template rm` takes only the user's folders, the unusable ones too: they are what the user may want to remove
    expect(names(templateNames(m, true))).toEqual(["blank", "mine", "two"]);
  });

  it("follows FULLMARK_CONFIG for the templates folder", () => {
    const dir = tempDir();
    write(join(dir, "elsewhere", "templates", "mine", "mine.md"), QUIZ(QUESTION("a")));
    const m = machine(dir, { FULLMARK_CONFIG: join(dir, "elsewhere", "config.toml") });
    expect(names(templateNames(m, true))).toEqual(["mine"]);
  });
});

describe("profileNames", () => {
  it("offers the built-in profiles when there is no config at all", () => {
    const dir = tempDir();
    const list = profileNames({ ...machine(dir), env: {} }, null);
    expect(names(list)).toEqual(["default", "draft", "exam", "survey"]);
    expect(list[0]?.description).toBe("built-in profile");
  });

  it("adds the profiles of the machine config and of the nearest fullmark.toml, saying where each comes from", () => {
    const dir = tempDir();
    write(join(dir, "config.toml"), '[profiles.mine]\nextends = "draft"\n');
    write(join(dir, "fullmark.toml"), '[profiles.practice]\nextends = "default"\n');
    const list = profileNames(machine(dir), null);
    expect(names(list)).toEqual(["default", "draft", "exam", "survey", "mine", "practice"]);
    expect(list.find((c) => c.value === "mine")?.description).toBe("profile from config.toml");
    expect(list.find((c) => c.value === "practice")?.description).toBe("profile from fullmark.toml");
  });

  it("reads the file --config names instead of the nearest fullmark.toml", () => {
    const dir = tempDir();
    write(join(dir, "fullmark.toml"), '[profiles.practice]\nextends = "default"\n');
    write(join(dir, "other.toml"), '[profiles.other]\nextends = "default"\n');
    write(join(dir, "config.toml"), "");
    expect(names(profileNames(machine(dir), "other.toml"))).toContain("other");
    expect(names(profileNames(machine(dir), "other.toml"))).not.toContain("practice");
  });

  it("cannot say when a config has errors, or when FULLMARK_CONFIG names a file that is not there (as check says too)", () => {
    const dir = tempDir();
    expect(() => profileNames(machine(dir), null)).toThrow(NoAnswer);
    write(join(dir, "config.toml"), "this is = = not toml\n");
    expect(() => profileNames(machine(dir), null)).toThrow(NoAnswer);
  });
});

describe("ruleIds", () => {
  it("lists every rule with its one-line summary", () => {
    const list = ruleIds();
    expect(names(list)).toContain("choice.correct-longest");
    expect(names(list)).toContain("syntax.front-matter");
    expect(list.every((c) => (c.description ?? "") !== "")).toBe(true);
  });
});

describe("libraryRoot", () => {
  it("is FULLMARK_LIBRARY, relative to the working directory", () => {
    const dir = tempDir();
    expect(libraryRoot(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toBe(join(dir, "lib"));
  });

  it("is `library` in the config, relative to the config's folder, when FULLMARK_LIBRARY is not set", () => {
    const dir = tempDir();
    write(join(dir, "config.toml"), 'library = "mine"\n');
    expect(libraryRoot(machine(dir))).toBe(join(dir, "mine"));
  });

  it("cannot say with no library, with no config file, or with a config that has errors", () => {
    const dir = tempDir();
    expect(() => libraryRoot(machine(dir))).toThrow(NoAnswer);
    expect(() => libraryRoot({ ...machine(dir), env: {} })).toThrow(NoAnswer);
    write(join(dir, "config.toml"), "library = \n");
    expect(() => libraryRoot(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toThrow(NoAnswer);
  });
});

describe("quizNames", () => {
  it("lists the library's quizzes by name, with the title as the description", () => {
    const list = quizNames(machine(tempDir(), { FULLMARK_LIBRARY: HISTORY }));
    expect(list).toEqual([
      { value: "limits-and-continuity", description: "Limits and continuity" },
      { value: "study-fixture", description: "Study fixture" },
      { value: "tidy", description: "Tidy notes" },
    ]);
  });

  it("is an empty list for an empty library", () => {
    const dir = tempDir();
    write(join(dir, "lib", "library.toml"), `format = "fullmark-library"\nversion = 2\ncreated = "${NOW}"\n`);
    expect(quizNames(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toEqual([]);
  });

  it("cannot say with no library, a folder that is not one, or a broken index", () => {
    const dir = tempDir();
    expect(() => quizNames(machine(dir))).toThrow(NoAnswer);
    mkdirSync(join(dir, "lib"));
    expect(() => quizNames(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toThrow(NoAnswer);
    write(join(dir, "lib", "library.toml"), "not toml at all = =\n");
    expect(() => quizNames(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toThrow(NoAnswer);
    write(join(dir, "lib", "library.toml"), 'format = "fullmark-library"\nversion = 99\ncreated = "x"\n');
    expect(() => quizNames(machine(dir, { FULLMARK_LIBRARY: "lib" }))).toThrow(NoAnswer);
  });

  it("never writes: the library holds the same files afterwards, and no lock", async () => {
    const m = machine(tempDir(), { FULLMARK_LIBRARY: HISTORY });
    const before = readdirSync(HISTORY, { recursive: true }).sort();
    quizNames(m);
    attemptStamps(m, "study");
    await sectionsOfLibraryQuiz(m, "study");
    const after = readdirSync(HISTORY, { recursive: true }).sort();
    expect(after).toEqual(before);
    expect(after).not.toContain(".fullmark.lock");
  });
});

describe("attemptStamps", () => {
  const m = (): Machine => machine(tempDir(), { FULLMARK_LIBRARY: HISTORY });

  it("lists a quiz's attempts, newest first, each with its date", () => {
    const list = attemptStamps(m(), "study-fixture");
    expect(names(list)).toEqual([
      "20261116-201412",
      "20261105-190300",
      "20261031-100000",
      "20261024-100000",
      "20261017-100000",
      "20261010-100000",
      "20261003-100000",
    ]);
    expect(list[0]?.description).toBe("2026-11-16 20:14");
  });

  it("takes the quiz's id as well as its name, and is empty for a quiz never taken", () => {
    expect(names(attemptStamps(m(), "study"))).toHaveLength(7);
    expect(attemptStamps(m(), "tidy")).toEqual([]);
  });

  it("cannot say for a quiz the library does not have", () => {
    expect(() => attemptStamps(m(), "nope")).toThrow(NoAnswer);
  });
});

describe("sections", async () => {
  it("lists the titled sections of a quiz file, by slug, with their titles", async () => {
    const dir = tempDir();
    const file = join(dir, "q.md");
    write(file, QUIZ(`# Part one\n\n${QUESTION("a")}# Part two {id=second}\n\n${QUESTION("b")}`));
    expect(await sectionsOfFile(file)).toEqual([
      { value: "part-one", description: "Part one" },
      { value: "second", description: "Part two" },
    ]);
  });

  it("is empty for a quiz with no section headings", async () => {
    const dir = tempDir();
    const file = join(dir, "q.md");
    write(file, QUIZ(QUESTION("a")));
    expect(await sectionsOfFile(file)).toEqual([]);
  });

  it("cannot say for a file that is missing or has errors", async () => {
    const dir = tempDir();
    await expect(sectionsOfFile(join(dir, "missing.md"))).rejects.toThrow(NoAnswer);
    write(join(dir, "bad.md"), "no front matter\n");
    await expect(sectionsOfFile(join(dir, "bad.md"))).rejects.toThrow(NoAnswer);
  });

  it("reads a library quiz's current version, with and without sections", async () => {
    const m = machine(tempDir(), { FULLMARK_LIBRARY: HISTORY });
    expect(names(await sectionsOfLibraryQuiz(m, "study-fixture"))).toEqual(["part-one", "part-two"]);
    expect(await sectionsOfLibraryQuiz(m, "tidy")).toEqual([]);
    await expect(sectionsOfLibraryQuiz(m, "nope")).rejects.toThrow(NoAnswer);
  });
});
