import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLibraryStats } from "../src/cli/library-stats";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, quizCli } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

afterEach(cleanTemps);

async function stats(name: string, json = false) {
  const t = await buildHistory();
  const c = t.at();
  const exit = runLibraryStats(name, { json }, c.io);
  return { t, exit, out: c.out, err: c.err };
}

describe("library stats", () => {
  it("shows every attempt across the three versions, with the heading of COMMANDS.md", async () => {
    const { exit, out } = await stats("study-fixture");
    expect(exit).toBe(0);
    expect(out[0]).toBe("study-fixture · Study fixture · 7 attempts, 3 versions");
    expect(out[1]).toMatch(
      /^Attempts {3}3 Oct 50% · 10 Oct \(section part-two, 12 points pending\) · 17 Oct 60% .* · 5 Nov 0% \(missed\) · 16 Nov 15% \(3 points pending\)$/,
    );
    // the plan of each attempt shows as `quiz stats` shows it
    expect(out[1]).toContain("31 Oct 100% (retry)");
    expect(out.join("\n")).toContain("Weakest    numbers, writing, logic");
  });

  it("counts the person's regrade over the AI's grades: the first attempt reads 50%, the newest file's", async () => {
    const { t, out } = await stats("study-fixture");
    const grades = readdirSync(join(t.lib, "quizzes", "study", "grades"))
      .filter((f) => f.startsWith(t.stamps.a1 as string))
      .sort();
    expect(grades).toHaveLength(2);
    expect(out[1]).toContain("3 Oct 50% ·");
  });

  it("--json is quiz stats's object over every attempt, and names the same numbers list and info read", async () => {
    const { t, out } = await stats("study", true);
    const summary = JSON.parse(out[0] ?? "") as {
      status: string;
      quiz: { id: string; title: string };
      attempts: { file: string; version: string; percent: number | null }[];
    };
    expect(summary).toMatchObject({ status: "done", quiz: { id: "study", title: "Study fixture" } });
    expect(summary.attempts).toHaveLength(7);
    expect(new Set(summary.attempts.map((a) => a.version)).size).toBe(3);
    expect(summary.attempts[0]?.file).toBe(`results/${t.stamps.a1}.json`);
    // the same module grades them: the last attempt's percent is `list`'s score
    const c = t.at();
    const { runLibraryList } = await import("../src/cli/library-list");
    runLibraryList({ json: true, plain: true }, c.io);
    const row = (JSON.parse(c.out[0] ?? "") as { quizzes: { id: string; score: number | null }[] }).quizzes.find(
      (q) => q.id === "study",
    );
    expect(summary.attempts.at(-1)?.percent).toBe(row?.score);
  });

  it("writes nothing, takes no lock (a held one does not stop it) and commits nothing", async () => {
    const t = await buildHistory();
    const head = await git(t.lib, t.env, "rev-parse", "HEAD");
    const status = await git(t.lib, t.env, "status", "--porcelain", "--untracked-files=all");
    writeFileSync(
      join(t.lib, ".fullmark.lock"),
      `${JSON.stringify({ pid: process.pid, command: "quiz library register x.md", started: "2026-11-18T14:22:10.000Z" })}\n`,
    );
    const lock = readFileSync(join(t.lib, ".fullmark.lock"), "utf8");
    const c = t.at();
    expect(runLibraryStats("study-fixture", { json: false }, c.io)).toBe(0);
    expect(await git(t.lib, t.env, "rev-parse", "HEAD")).toBe(head);
    expect(await git(t.lib, t.env, "status", "--porcelain", "--untracked-files=all")).toBe(status);
    expect(readFileSync(join(t.lib, ".fullmark.lock"), "utf8")).toBe(lock);
  });

  it("exits 2 for a quiz with no attempts and for an unknown quiz, with the near names", async () => {
    const none = await stats("limits-and-continuity");
    expect(none.exit).toBe(2);
    expect(none.err).toEqual([
      "error: no attempts at limits-and-continuity yet",
      "    fix: quiz library take limits-and-continuity",
    ]);
    const unknown = await stats("study-fixtur");
    expect(unknown.exit).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named study-fixtur", "    did you mean: study-fixture"]);
  });
});

describe("library stats, as a subprocess", () => {
  it("prints the summary as one JSON object with --json, and the text without it; exit 2 and {status: error} for no attempts", async () => {
    const t = await buildHistory();
    const json = await quizCli(["library", "stats", "study-fixture", "--json"], t.dir, t.env);
    expect(json.exit).toBe(0);
    const summary = JSON.parse(json.stdout.trim());
    expect(Object.keys(summary)).toEqual([
      "status",
      "quiz",
      "attempts",
      "tags",
      "weakest",
      "questions",
      "criteria",
      "answers",
    ]);
    expect(summary.attempts).toHaveLength(7);
    const text = await quizCli(["library", "stats", "study-fixture"], t.dir, t.env);
    expect(text.stdout.split("\n")[0]).toBe("study-fixture · Study fixture · 7 attempts, 3 versions");
    const none = await quizCli(["library", "stats", "limits-and-continuity", "--json"], t.dir, t.env);
    expect(none.exit).toBe(2);
    expect(JSON.parse(none.stdout.trim())).toMatchObject({
      status: "error",
      fix: "quiz library take limits-and-continuity",
    });
  });
});
