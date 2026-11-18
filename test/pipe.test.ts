import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanTemps, libraryEnv, tempDir } from "./helpers/library";
import { newLibrary } from "./helpers/library-register";

afterEach(cleanTemps);

const CLI = resolve(import.meta.dirname, "..", "dist", "cli.js");

/**
 * Runs the CLI with its stdout piped into a reader that has closed before the command writes: what `quiz … | head -1`
 * comes to when `head` is quicker than the command. The command's first write meets a closed pipe (`EPIPE`).
 */
function readerGone(args: string[], cwd: string, env: Record<string, string>) {
  return new Promise<{ stderr: string; exit: number | null }>((done, fail) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.stdout.destroy();
    child.on("error", fail);
    child.on("close", (exit) => done({ stderr, exit }));
  });
}

describe("a closed pipe (G30)", () => {
  it("ends `rules | head -1` (the whole catalogue) with exit 0 and nothing on stderr", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "config.toml"), "");
    const got = await readerGone(["rules"], dir, libraryEnv(dir));
    expect(got.stderr).toBe("");
    expect(got.exit).toBe(0);
  });

  it("ends `library list | head -1` with exit 0 and nothing on stderr", async () => {
    const t = await newLibrary();
    const got = await readerGone(["library", "list"], t.dir, { ...t.env, FULLMARK_LIBRARY: t.lib });
    expect(got.stderr).toBe("");
    expect(got.exit).toBe(0);
  });

  it("the handler is the one in main.ts: an EPIPE on stdout exits 0, any other error is not swallowed", () => {
    const source = readFileSync(resolve(import.meta.dirname, "..", "src", "cli", "main.ts"), "utf8");
    expect(source).toContain('error.code === "EPIPE"');
    expect(source).toContain("throw error");
  });
});

describe("biome and worktrees (G33)", () => {
  it("biome.json leaves out .claude/, so another checkout's biome.json is never read", () => {
    const config = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "biome.json"), "utf8")) as {
      files: { includes: string[] };
    };
    expect(config.files.includes).toContain("!.claude");
  });
});
