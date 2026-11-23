import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanTemps, tempDir } from "./helpers/library";

/**
 * `quiz __complete WORDS...` through the real CLI (COMMANDS.md, `quiz shell-init`): which candidates and which directive
 * each position of a command line gets, and that it stays quiet and exits 0 whatever it finds. The values read from the
 * user's files are unit-tested in complete-sources.test.ts; the library and the config here are always a temporary
 * folder's, never the owner's.
 */
afterEach(cleanTemps);

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "dist", "cli.js");
const HISTORY = resolve(import.meta.dirname, "fixtures", "library-history", "lib");

type Answer = {
  values: string[];
  descriptions: Map<string, string>;
  directive: string;
  stderr: string;
  status: number;
};

/** A folder with the library copied in, an (empty) config beside it, and the environment that points at both. */
function setup(extra: Record<string, string> = {}): { dir: string; env: Record<string, string> } {
  const dir = tempDir();
  cpSync(HISTORY, join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "config.toml"), "");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("FULLMARK_")) env[k] = v;
  return {
    dir,
    env: {
      ...env,
      NO_COLOR: "1",
      HOME: join(dir, "home"),
      FULLMARK_CONFIG: join(dir, "config.toml"),
      FULLMARK_LIBRARY: join(dir, "lib"),
      ...extra,
    },
  };
}

function complete(words: string[], { dir, env }: { dir: string; env: Record<string, string> }): Answer {
  const r = spawnSync(process.execPath, [cli, "__complete", ...words], { cwd: dir, env, encoding: "utf8" });
  const lines = r.stdout.replace(/\n$/, "").split("\n");
  const directive = lines.pop() as string;
  const descriptions = new Map<string, string>();
  const values = lines.map((line) => {
    const [value, description] = line.split("\t") as [string, string | undefined];
    if (description !== undefined) descriptions.set(value, description);
    return value;
  });
  return { values, descriptions, directive, stderr: r.stderr, status: r.status ?? -1 };
}

const QUIZ = "---\ntitle: T\n---\n\n# Part one\n\n## One {type=single id=one}\n\n- [x] a\n- [ ] b\n";

describe("subcommands and flags, from the CLI's own definitions", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it("completes a command by its first letters, with its description", () => {
    const a = complete(["lib"], env);
    expect(a.values).toEqual(["library"]);
    expect(a.descriptions.get("library")).toMatch(/^the library/);
    expect(a.directive).toBe(":nofile");
  });

  it("lists every command for an empty word, `help` and `shell-init` among them and `__complete` not", () => {
    const a = complete([""], env);
    expect(a.values).toEqual(
      expect.arrayContaining(["check", "build", "library", "template", "guide", "shell-init", "help"]),
    );
    expect(a.values).not.toContain("__complete");
  });

  it("goes down into a command with subcommands", () => {
    expect(complete(["library", "ta"], env).values).toEqual(["take"]);
    expect(complete(["library", "template", ""], env).values).toEqual(["add"]);
    expect(complete(["template", ""], env).values).toEqual(["list", "add", "rm"]);
  });

  it("completes the commands after `help`", () => {
    expect(complete(["help", "libr"], env).values).toEqual(["library"]);
    expect(complete(["help", "library", "ta"], env).values).toEqual(["take"]);
  });

  it("lists a command's flags for a word that starts with a dash, with their help lines", () => {
    const a = complete(["build", "--fon"], env);
    expect(a.values).toEqual(["--fonts"]);
    expect(a.descriptions.get("--fonts")).toMatch(/which fonts the page embeds/);
    const all = complete(["check", "--"], env);
    expect(all.values).toEqual(expect.arrayContaining(["--profile", "--strict", "--json", "--help"]));
    // a flag of another command is not offered
    expect(all.values).not.toContain("--fonts");
    expect(all.directive).toBe(":nofile");
  });

  it("offers the top-level flags before a command", () => {
    expect(complete(["--"], env).values).toEqual(expect.arrayContaining(["--version", "--acknowledgements", "--help"]));
  });

  it("leaves `--flag=value` to the shell", () => {
    const a = complete(["build", "--fonts=q"], env);
    expect(a.values).toEqual([]);
    expect(a.directive).toBe(":default");
  });
});

describe("a flag's fixed values", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it("are its declared choices", () => {
    expect(complete(["build", "--fonts", ""], env).values).toEqual(["quiz", "all", "none"]);
    expect(complete(["library", "take", "tidy", "--fonts", "a"], env).values).toEqual(["all"]);
    expect(complete(["guide", "--lang", ""], env).values).toEqual(["en", "vi"]);
    expect(complete(["build", "--ui-lang", "v"], env).values).toEqual(["vi"]);
    expect(complete(["build", "--print", "--answers", ""], env).values).toEqual(["none", "key", "inline"]);
    expect(complete(["build", "--materials", ""], env).values).toEqual(["none"]);
    expect(complete(["replay", "--fonts", ""], env).values).toEqual(["quiz", "all", "none"]);
    expect(complete(["library", "publish", "--ui-lang", ""], env).values).toEqual(["en", "vi"]);
  });

  it("are `shell-init`'s four shells", () => {
    expect(complete(["shell-init", ""], env).values).toEqual(["powershell", "bash", "zsh", "fish"]);
    expect(complete(["shell-init", "z"], env).values).toEqual(["zsh"]);
  });

  it("are the brief question file's choices, with their hints", () => {
    const a = complete(["brief", "dir", "--mode", ""], env);
    expect(a.values).toEqual(["each-question", "at-the-end", "timed-exam"]);
    expect(a.descriptions.get("timed-exam")).toMatch(/time limit/);
    expect(complete(["brief", "--language", ""], env).values).toEqual(["en", "vi"]);
    expect(complete(["brief", "--difficulty", ""], env).values.length).toBeGreaterThan(1);
    // a number or a text has none: no files either
    const free = complete(["brief", "--count", ""], env);
    expect(free.values).toEqual([]);
    expect(free.directive).toBe(":nofile");
  });
});

describe("values read from the user's own files", () => {
  it("templates: the built-in ones, then the user's own; `template rm` only the user's", () => {
    const env = setup();
    mkdirSync(join(env.dir, "templates", "mine"), { recursive: true });
    writeFileSync(join(env.dir, "templates", "mine", "mine.md"), QUIZ);
    expect(complete(["new", ""], env).values).toEqual([
      "calculus",
      "rust",
      "ielts",
      "medical",
      "exam",
      "survey",
      "blank",
      "mine",
    ]);
    expect(complete(["new", "m"], env).values).toEqual(["medical", "mine"]);
    expect(complete(["template", "rm", ""], env).values).toEqual(["mine"]);
    // with --from the first argument is a folder, not a template
    const from = complete(["new", "--from", "q.md", ""], env);
    expect(from.values).toEqual([]);
    expect(from.directive).toBe(":default");
  });

  it("profiles: the built-in ones and those of the config and the nearest fullmark.toml", () => {
    const env = setup();
    writeFileSync(join(env.dir, "config.toml"), '[profiles.mine]\nextends = "draft"\n');
    writeFileSync(join(env.dir, "fullmark.toml"), '[profiles.practice]\nextends = "default"\n');
    expect(complete(["check", "--profile", ""], env).values).toEqual([
      "default",
      "draft",
      "exam",
      "survey",
      "mine",
      "practice",
    ]);
    expect(complete(["build", "--profile", "pr"], env).values).toEqual(["practice"]);
    expect(complete(["rules", "--profile", "e"], env).values).toEqual(["exam"]);
    expect(complete(["brief", "d", "--profile", "e"], env).values).toEqual(["exam"]);
  });

  it("library quizzes: names with their titles, for every command that takes one", () => {
    const env = setup();
    const a = complete(["library", "take", "t"], env);
    expect(a.values).toEqual(["tidy"]);
    expect(a.descriptions.get("tidy")).toBe("Tidy notes");
    expect(a.directive).toBe(":nofile");
    for (const command of ["info", "stats", "grade", "review", "share", "replay", "rename", "rm", "path"])
      expect(complete(["library", command, ""], env).values, command).toEqual([
        "limits-and-continuity",
        "study-fixture",
        "tidy",
      ]);
    expect(complete(["library", "register", "--update", "s"], env).values).toEqual(["study-fixture"]);
    expect(complete(["library", "template", "add", "l"], env).values).toEqual(["limits-and-continuity"]);
    // a second argument is not a quiz: `rename OLD NEW`
    expect(complete(["library", "rename", "tidy", ""], env).values).toEqual([]);
  });

  it("`library publish` takes a quiz or a folder: the names, and the shell's own completion when none match", () => {
    const env = setup();
    const names = complete(["library", "publish", "ti"], env);
    expect(names.values).toEqual(["tidy"]);
    expect(names.directive).toBe(":default");
  });

  it("attempts: the stamps of that quiz, newest first", () => {
    const env = setup();
    const a = complete(["library", "grade", "study-fixture", "--attempt", ""], env);
    expect(a.values[0]).toBe("20261116-201412");
    expect(a.values).toHaveLength(7);
    expect(a.values).toEqual([...a.values].sort().reverse());
    expect(complete(["library", "replay", "study", "--attempt", "2026101"], env).values).toEqual([
      "20261017-100000",
      "20261010-100000",
    ]);
    // no quiz typed yet: nothing to read
    expect(complete(["library", "grade", "--attempt", ""], env).values).toEqual([]);
  });

  it("sections: the sections of the quiz asked about, from the library or from a file", () => {
    const env = setup();
    const a = complete(["library", "take", "study-fixture", "--section", ""], env);
    expect(a.values).toEqual(["part-one", "part-two"]);
    expect(a.descriptions.get("part-one")).toBe("Part one");
    // a quiz without sections has none, and no files are offered either
    const none = complete(["library", "take", "tidy", "--section", ""], env);
    expect(none.values).toEqual([]);
    expect(none.directive).toBe(":nofile");
    writeFileSync(join(env.dir, "q.md"), QUIZ);
    expect(complete(["serve", "q.md", "--section", "p"], env).values).toEqual(["part-one"]);
  });

  it("rule ids, with their summaries", () => {
    const env = setup();
    const a = complete(["rules", "choice.correct-l"], env);
    expect(a.values).toEqual(["choice.correct-longest"]);
    expect(a.descriptions.get("choice.correct-longest")).toMatch(/right choice/);
  });
});

describe("files are left to the shell, by kind", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it("quizzes are .md", () => {
    for (const command of [
      ["check"],
      ["build"],
      ["inspect"],
      ["serve"],
      ["review"],
      ["ids"],
      ["library", "register"],
      ["template", "add"],
    ])
      expect(complete([...command, ""], env), command.join(" ")).toMatchObject({ values: [], directive: ":files:md" });
    expect(complete(["grade", "r.json", "--quiz", ""], env).directive).toBe(":files:md");
  });

  it("results, grades and reviews are .json", () => {
    for (const command of [["grade"], ["replay"], ["stats"]])
      expect(complete([...command, ""], env), command.join(" ")).toMatchObject({
        values: [],
        directive: ":files:json",
      });
    expect(complete(["grade", "r.json", "--grades", ""], env).directive).toBe(":files:json");
    expect(complete(["check", "--review", ""], env).directive).toBe(":files:json");
    expect(complete(["serve", "q.md", "--out", ""], env).directive).toBe(":files:json");
  });

  it("other paths, and an unknown command, are the shell's own", () => {
    expect(complete(["build", "-o", ""], env)).toMatchObject({ values: [], directive: ":default" });
    expect(complete(["build", "--config", ""], env).directive).toBe(":default");
    expect(complete(["bogus", "x", ""], env)).toMatchObject({ values: [], directive: ":default" });
  });

  it("a number or a name has no file", () => {
    expect(complete(["serve", "q.md", "--port", ""], env)).toMatchObject({ values: [], directive: ":nofile" });
  });
});

describe("it is quiet and never fails", () => {
  it("no library, no config, a broken index or a broken config: no candidates, :default, nothing on stderr, exit 0", () => {
    const noLibrary = setup({ FULLMARK_LIBRARY: "" });
    const brokenIndex = setup();
    writeFileSync(join(brokenIndex.dir, "lib", "library.toml"), "= = not toml\n");
    const brokenConfig = setup();
    writeFileSync(join(brokenConfig.dir, "config.toml"), "= = not toml\n");
    const noConfigFile = setup({ FULLMARK_CONFIG: "missing.toml", FULLMARK_LIBRARY: "" });
    for (const [label, env, words] of [
      ["no library", noLibrary, ["library", "take", ""]],
      ["a broken index", brokenIndex, ["library", "take", ""]],
      ["a broken config", brokenConfig, ["library", "take", ""]],
      ["a broken config", brokenConfig, ["check", "--profile", ""]],
      ["a config file that is missing", noConfigFile, ["check", "--profile", ""]],
      ["an unknown quiz", setup(), ["library", "grade", "nope", "--attempt", ""]],
      ["an unreadable quiz", setup(), ["serve", "nope.md", "--section", ""]],
    ] as const) {
      const a = complete([...words], env);
      expect(a, label).toMatchObject({ values: [], directive: ":default", stderr: "", status: 0 });
    }
  });

  it("no words at all is the first word", () => {
    const a = complete([], setup());
    expect(a.status).toBe(0);
    expect(a.values).toContain("check");
  });

  it("changes nothing in the library, takes no lock and writes no file", () => {
    const env = setup();
    const listing = (): string[] => readdirSync(env.dir, { recursive: true }).map(String).sort();
    const before = listing();
    for (const words of [
      ["library", "take", ""],
      ["library", "grade", "study", "--attempt", ""],
      ["library", "take", "study", "--section", ""],
      ["new", ""],
      ["check", "--profile", ""],
    ])
      complete(words, env);
    expect(listing()).toEqual(before);
  });

  it("is hidden: not in any help, nor in the guides", () => {
    const env = setup();
    const help = spawnSync(process.execPath, [cli, "--help"], { cwd: env.dir, env: env.env, encoding: "utf8" });
    expect(help.stdout + help.stderr).not.toContain("__complete");
    for (const file of ["guide/GUIDE.md", "AGENTS.md"])
      expect(readFileSync(join(root, file), "utf8"), file).not.toContain("__complete");
  });
});
