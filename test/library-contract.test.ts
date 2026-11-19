import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every library command has a contract test (STEP4.md, step 4's "Done when"): a test that runs it as a subprocess with
 * `--json` and checks the object it prints. This reads the commands of the `library` group in `src/cli/main.ts` and fails
 * for one with no such test, so a command added later cannot go without.
 *
 * A contract test is either a golden case (`test/golden/library/<case>/`, which runs `node dist/cli.js` as a subprocess and
 * holds `stdout.txt`) whose arguments are `library COMMAND ... --json`, or, for the commands that serve a form and wait
 * for a browser, a Playwright spec that starts the program with `--json` (`serveProcess` in e2e/helpers.ts) and reads
 * its `listening` line and its outcome.
 */
const root = resolve(import.meta.dirname, "..");
const main = readFileSync(join(root, "src", "cli", "main.ts"), "utf8");
const golden = join(root, "test", "golden", "library");

/** The commands of the `library` group, `template add` as `template add`. */
function libraryCommands(): string[] {
  const names = [...main.matchAll(/^ {2}library\n {4}\.command\("([a-z]+)"\)/gm)].map((m) => m[1] as string);
  const nested = [...main.matchAll(/^ {2}libraryTemplate\n {4}\.command\("([a-z]+)"\)/gm)].map(
    (m) => `template ${m[1] as string}`,
  );
  return [...names.filter((n) => n !== "template"), ...nested].sort();
}

/** The golden cases of one command run with `--json`. */
function jsonCases(command: string): string[] {
  const words = command.split(" ");
  return readdirSync(golden).filter((name) => {
    const cmd = join(golden, name, "cmd.txt");
    if (!existsSync(cmd)) return false;
    const args = readFileSync(cmd, "utf8").split("\n").filter(Boolean);
    return args[0] === "library" && words.every((w, i) => args[i + 1] === w) && args.includes("--json");
  });
}

/** The commands that serve a form: their contract test is a Playwright spec that runs the program with `--json`. */
const SERVED: Record<string, string> = {
  take: "e2e/take.spec.ts",
};

/** `path` prints one path and nothing else, for `$(quiz library path NAME)`: it has no `--json`, and its cases are plain. */
const NO_JSON = new Set(["path"]);

describe("the library commands have contract tests", () => {
  const commands = libraryCommands();

  it("finds the commands of the library group", () => {
    expect(commands).toEqual([
      "grade",
      "info",
      "init",
      "list",
      "path",
      "publish",
      "register",
      "rename",
      "replay",
      "review",
      "rm",
      "share",
      "stats",
      "status",
      "take",
      "template add",
    ]);
  });

  for (const command of commands) {
    it(`library ${command}: a subprocess test with --json`, () => {
      if (NO_JSON.has(command)) {
        const plain = readdirSync(golden).filter((n) => n.startsWith("path-"));
        expect(plain.length, `no golden case of library ${command}`).toBeGreaterThan(0);
        return;
      }
      const cases = jsonCases(command);
      const spec = SERVED[command];
      if (cases.length === 0) {
        // a served command: a spec that starts the program with --json and reads what it prints
        expect(spec, `library ${command} has no golden case with --json and no spec of a served form`).toBeDefined();
        const text = readFileSync(join(root, spec as string), "utf8");
        expect(text).toContain(`"library", "${command}"`);
        expect(text).toContain("serveProcess");
        return;
      }
      // every line a golden case prints on stdout is one JSON object, as the contract says
      for (const name of cases) {
        const lines = readFileSync(join(golden, name, "stdout.txt"), "utf8")
          .split("\n")
          .filter(Boolean);
        expect(lines.length, `${name} printed nothing on stdout`).toBeGreaterThan(0);
        for (const line of lines) expect(() => JSON.parse(line), `${name}: ${line}`).not.toThrow();
      }
    });
  }

  it("review and grade --web, which serve a form too, have a spec that runs them with --json", () => {
    for (const [file, command] of [
      ["e2e/library-review.spec.ts", "review"],
      ["e2e/library-grade.spec.ts", "grade"],
    ] as const) {
      const text = readFileSync(join(root, file), "utf8");
      expect(text).toContain(`"library", "${command}"`);
      expect(text).toContain("serveProcess");
    }
  });

  it("the history goldens of G6 are present over the history library: list, info, stats, take --missed and replay, and the commands that change it", () => {
    const cases = readdirSync(golden);
    const over = (name: string): boolean =>
      existsSync(join(golden, name, "copy.txt")) &&
      readFileSync(join(golden, name, "copy.txt"), "utf8").includes("test/fixtures/library-history/lib => lib");
    for (const command of ["list", "info", "stats", "replay"]) {
      const found = cases.filter((n) => n === command || n.startsWith(`${command}-`)).filter(over);
      expect(found.length, `no golden of library ${command} over the history library`).toBeGreaterThan(0);
    }
    for (const command of ["share", "template-add", "rename", "rm", "review"]) {
      const found = cases.filter((n) => n.startsWith(`${command}-`) || n === command).filter(over);
      expect(found.length, `no golden of ${command} over the history library`).toBeGreaterThan(0);
    }
    // `take --missed` serves a form: what it would serve is a function golden over the same library
    expect(existsSync(join(root, "test", "golden-fn", "library-missed-study-plan.txt"))).toBe(true);
    // the history holds a renamed quiz and a review
    const fixture = join(root, "test", "fixtures", "library-history", "lib");
    expect(readFileSync(join(fixture, "library.toml"), "utf8")).toContain("[quizzes.tidy]");
    expect(existsSync(join(fixture, "quizzes", "tidy", "review.json"))).toBe(true);
  });
});
