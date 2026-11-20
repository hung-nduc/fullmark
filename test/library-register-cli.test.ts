import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, libraryEnv, quizCli, tempDir, writeTree } from "./helpers/library";
import { quizText } from "./helpers/library-register";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

afterEach(cleanTemps);

/** `library register` as a program, with real git: the `--json` contract and the lines that name a commit. */
async function setup() {
  const dir = tempDir();
  const env = libraryEnv(dir);
  const run = (...args: string[]) => quizCli(args, dir, env);
  await run("library", "init", "lib");
  return { dir, env, run, lib: join(dir, "lib") };
}
const A: [string, string][] = [
  ["q1", "First question"],
  ["q2", "Second question"],
];

describe("library register --json", () => {
  it("one file and several have the same shape, and name the commit", async () => {
    const { dir, env, run, lib } = await setup();
    writeTree(dir, {
      "a.md": quizText("alpha", "Alpha", A),
      "b.md": quizText("bravo", "Bravo", A),
      "bad.md": "---\ntitle: Bad\nid: bad\n---\n\n## No id {type=single}\n\n- [x] a\n- [ ] b\n",
    });
    const one = await run("library", "register", "a.md", "--json");
    expect(one.exit).toBe(0);
    const head = (await git(lib, env, "rev-parse", "--short", "HEAD")).trim();
    const body = JSON.parse(one.stdout);
    expect(body).toEqual({
      status: "registered",
      registered: [{ file: "a.md", name: "alpha", version: expect.stringMatching(/^[0-9a-f]{64}$/) }],
      unchanged: [],
      refused: [],
      committed: head,
    });
    expect(one.stdout.trim().split("\n")).toHaveLength(1);
    expect(one.stderr).toContain(`committed ${head} fullmark: register alpha`);

    const two = JSON.parse((await run("library", "register", "a.md", "b.md", "--json")).stdout);
    expect(two.status).toBe("registered");
    expect(two.registered.map((r: { name: string }) => r.name)).toEqual(["bravo"]);
    expect(two.unchanged.map((r: { name: string }) => r.name)).toEqual(["alpha"]);

    const same = JSON.parse((await run("library", "register", "a.md", "b.md", "--json")).stdout);
    expect(same).toMatchObject({ status: "unchanged", registered: [], committed: null });
    expect(same.unchanged).toHaveLength(2);

    const refused = await run("library", "register", "bad.md", "--json");
    expect(refused.exit).toBe(1);
    expect(JSON.parse(refused.stdout)).toEqual({
      status: "problems",
      registered: [],
      unchanged: [],
      refused: [
        {
          file: "bad.md",
          reason: expect.stringMatching(/^question\.id-missing: /),
          suggest: expect.stringContaining("quiz ids"),
        },
      ],
      committed: null,
    });
  });

  it("prints the commit line in text too, and the edited-since refusal with its fix", async () => {
    const { dir, env, run, lib } = await setup();
    writeTree(dir, { "a.md": quizText("alpha", "Alpha", A) });
    const first = await run("library", "register", "a.md");
    const head = (await git(lib, env, "rev-parse", "--short", "HEAD")).trim();
    expect(first.stdout.split("\n").at(-2)).toBe(`committed ${head} fullmark: register alpha`);
    writeTree(dir, { "a.md": quizText("alpha", "Alpha", [...A, ["q3", "Third question"]]) });
    const edited = await run("library", "register", "a.md");
    expect(edited.exit).toBe(1);
    expect(edited.stdout).toBe(
      [
        "a.md: error library.edited: registered before as alpha and edited since",
        "    fix: quiz library register a.md --update alpha",
        "nothing registered 0 of 1 file ready, 1 refused",
        "",
      ].join("\n"),
    );
    const updated = await run("library", "register", "a.md", "--update", "alpha", "--json");
    expect(JSON.parse(updated.stdout).status).toBe("registered");
  });

  it("a run error is {status: error, message} with exit 2: no library", async () => {
    const dir = tempDir();
    const env = libraryEnv(dir);
    writeTree(dir, { "a.md": quizText("alpha", "Alpha", A) });
    const r = await quizCli(["library", "register", "a.md", "--json"], dir, env);
    expect(r.exit).toBe(2);
    expect(JSON.parse(r.stdout)).toMatchObject({
      status: "error",
      message: "no library: run `quiz library init PATH`",
    });
  });
});
