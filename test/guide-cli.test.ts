import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** `quiz guide` and `quiz agent-guide` print their file as it is, from the package, in whatever folder they run (COMMANDS.md, "First form"). */
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "dist", "cli.js");
const guide = readFileSync(resolve(root, "guide", "GUIDE.md"), "utf8");
const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");

function quiz(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "" },
  });
  return { out: r.stdout, err: r.stderr, code: r.status };
}

describe("quiz guide and quiz agent-guide", () => {
  const dir = mkdtempSync(join(tmpdir(), "fullmark-guide-cli-"));
  it("print the guide byte for byte, from a folder that holds nothing of fullmark", () => {
    const r = quiz(["guide"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe(guide);
    expect(r.err).toBe("");
  });

  it("print AGENTS.md byte for byte", () => {
    const r = quiz(["agent-guide"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe(agents);
  });

  it("accept --plain and --no-pager, which change nothing in the first form", () => {
    expect(quiz(["guide", "--plain", "--no-pager"], dir).out).toBe(guide);
    expect(quiz(["agent-guide", "--plain", "--no-pager"], dir).out).toBe(agents);
  });

  it("print the English guide for --lang vi, with one line on stderr, and exit 0", () => {
    const r = quiz(["guide", "--lang", "vi"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe(guide);
    expect(r.err.trim().split("\n")).toHaveLength(1);
    expect(r.err).toContain("Vietnamese guide is not written yet");
  });

  it("refuse a language other than en and vi with exit 2", () => {
    expect(quiz(["guide", "--lang", "fr"], dir).code).toBe(2);
  });

  it("take no --lang for agent-guide, which is English only", () => {
    expect(quiz(["agent-guide", "--lang", "vi"], dir).code).toBe(2);
  });

  it("clean up", () => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
});
