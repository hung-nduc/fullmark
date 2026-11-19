import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recordLibrary, recordShelf, withLibraryKey, withShelfKey } from "../src/cli/config-write";
import { parseConfig } from "../src/core/config/parse";
import { cleanTemps, tempDir } from "./helpers/library";

afterEach(cleanTemps);

describe("recording the library in config.toml", () => {
  it("replaces the value of an existing top-level library line, keeping the rest of the line", () => {
    const before =
      '# mine\nfonts = "all"\nlibrary = "/old" # where it was\nlibrary_x = 1\n\n[terminal]\nstyle = "boxed"\n';
    expect(withLibraryKey(before, "/new")).toBe(before.replace('"/old"', '"/new"'));
  });

  it("puts a new line above the first table, comments and order kept", () => {
    const before =
      '# mine\nfonts = "all"\n\n# the look\n[terminal]\nstyle = "boxed"\n\n[profiles.mine]\nextends = "default"\n';
    const after = withLibraryKey(before, "/lib");
    expect(after).toBe(
      '# mine\nfonts = "all"\n\n# the look\nlibrary = "/lib"\n\n[terminal]\nstyle = "boxed"\n\n[profiles.mine]\nextends = "default"\n',
    );
    expect(parseConfig(after, "config.toml", "user").errors).toEqual([]);
  });

  it("puts it at the end when there is no table, and makes a file from nothing", () => {
    expect(withLibraryKey('fonts = "all"', "/lib")).toBe('fonts = "all"\nlibrary = "/lib"\n');
    expect(withLibraryKey("# only a comment\n", "/lib")).toBe('# only a comment\nlibrary = "/lib"\n');
    expect(withLibraryKey("", "/lib")).toBe('library = "/lib"\n');
  });

  it("escapes a Windows path and keeps CRLF line endings", () => {
    const after = withLibraryKey(
      'fonts = "all"\r\n\r\n[terminal]\r\nstyle = "boxed"\r\n',
      "C:\\Users\\minh\\quiz library",
    );
    expect(after).toBe(
      'fonts = "all"\r\n\r\nlibrary = "C:\\\\Users\\\\minh\\\\quiz library"\r\n\r\n[terminal]\r\nstyle = "boxed"\r\n',
    );
    expect(parseConfig(after, "c", "user").data?.library).toBe("C:\\Users\\minh\\quiz library");
  });

  it("writes the file atomically, making it and its folder when missing", async () => {
    const dir = tempDir();
    const file = join(dir, "a", "b", "config.toml");
    await recordLibrary(file, "/lib");
    expect(readFileSync(file, "utf8")).toBe('library = "/lib"\n');
    writeFileSync(file, 'library = "/lib"\n\n[brief.purpose.exam-prep]\ncount = 30\n');
    await recordLibrary(file, "/other");
    expect(readFileSync(file, "utf8")).toBe('library = "/other"\n\n[brief.purpose.exam-prep]\ncount = 30\n');
  });
});

describe("the machine config's library, git and [terminal]", () => {
  const read = (text: string) => parseConfig(text, "config.toml", "user");
  const errors = (text: string) => read(text).errors.map((e) => `${e.line}: ${e.message}`);

  it("reads library, git and the terminal style", () => {
    const { data, errors } = read('library = "~/quiz"\ngit = "C:/Git/bin/git.exe"\n\n[terminal]\nstyle = "boxed"\n');
    expect(errors).toEqual([]);
    expect(data).toMatchObject({ library: "~/quiz", git: "C:/Git/bin/git.exe", terminalStyle: "boxed" });
    expect(read("").data).toMatchObject({ library: null, git: null, terminalStyle: null });
  });

  it("names the file's line for a bad value or an unknown key", () => {
    expect(errors('fonts = "all"\nlibrary = 5\n')).toEqual(["2: `library` must be a path, in quotes, not number 5"]);
    expect(errors('library = ""\n')).toEqual(['1: `library` must be a path, in quotes, not string ""']);
    expect(errors("git = true\n")).toEqual(["1: `git` must be a path, in quotes, not boolean true"]);
    expect(errors("terminal = 1\n")).toEqual(["1: `terminal` must be a table, not number 1"]);
    expect(errors('[terminal]\nstyle = "round"\n')).toEqual([
      '2: `style` must be "simple" or "boxed", not string "round"',
    ]);
    expect(errors('[terminal]\nstyle = "simple"\ncolour = 1\n')).toEqual(["3: unknown key `colour` in [terminal]"]);
    expect(errors('[terminal]\nstile = "simple"\n')).toEqual(["2: unknown key `stile` in [terminal]"]);
  });

  it("is read from the machine config only, not from a fullmark.toml", () => {
    expect(parseConfig('library = "x"\n', "fullmark.toml", "project").errors.map((e) => e.message)).toEqual([
      "unknown key `library`",
    ]);
  });
});

describe("recording a shelf's folder in config.toml (step 5, G4)", () => {
  it("adds [shelves] at the end, keeping the rest of the file", () => {
    const before = '# mine\nlibrary = "/lib"\n\n[terminal]\nstyle = "boxed"\n';
    const after = withShelfKey(before, "public", "/sites/quizzes");
    expect(after).toBe(`${before}\n[shelves]\npublic = "/sites/quizzes"\n`);
    expect(parseConfig(after, "config.toml", "user").data?.shelves).toEqual({ public: "/sites/quizzes" });
    expect(withShelfKey("", "public", "/s")).toBe('[shelves]\npublic = "/s"\n');
  });

  it("replaces the value of an existing key, with its comment; adds the key under an existing header", () => {
    const has = '[shelves]\npublic = "/old" # the site\nother = "/o"\n\n[terminal]\nstyle = "boxed"\n';
    expect(withShelfKey(has, "public", "/new")).toBe(has.replace('"/old"', '"/new"'));
    const bare = '# c\n[shelves]\nother = "/o"\n\n[terminal]\nstyle = "boxed"\n';
    expect(withShelfKey(bare, "public", "/new")).toBe(
      '# c\n[shelves]\npublic = "/new"\nother = "/o"\n\n[terminal]\nstyle = "boxed"\n',
    );
  });

  it("writes an inline table again, escapes a Windows path, keeps CRLF, and writes atomically", async () => {
    expect(withShelfKey('shelves = { other = "/o" }\n', "public", "/p")).toBe(
      'shelves = { other = "/o", public = "/p" }\n',
    );
    const crlf = withShelfKey('library = "/l"\r\n', "public", "C:\\sites\\q");
    expect(crlf).toBe('library = "/l"\r\n\r\n[shelves]\r\npublic = "C:\\\\sites\\\\q"\r\n');
    expect(parseConfig(crlf, "c", "user").data?.shelves.public).toBe("C:\\sites\\q");
    const dir = tempDir();
    const file = join(dir, "x", "config.toml");
    await recordShelf(file, "public", "/s");
    expect(readFileSync(file, "utf8")).toBe('[shelves]\npublic = "/s"\n');
    await recordShelf(file, "public", "/t");
    expect(readFileSync(file, "utf8")).toBe('[shelves]\npublic = "/t"\n');
  });
});
