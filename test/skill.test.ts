import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fencedBlocks } from "./helpers/fenced";

/**
 * `skill/SKILL.md` cannot drift from the tool: every `quiz ...` command it shows names a command the CLI has, and every
 * flag in it is a flag that command's own `--help` lists. A command is a code span (or a line of a fenced block) that
 * starts with `quiz`; the words after it that are subcommands of the CLI are followed down (`quiz library take`), the
 * words that start with `--` or `-` are the flags, and everything else is a placeholder (NAME, FILE, a path).
 */
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "dist", "cli.js");
const skill = readFileSync(resolve(root, "skill", "SKILL.md"), "utf8");

function help(path: string[]): string {
  return execFileSync(process.execPath, [cli, ...path, "--help"], { encoding: "utf8" });
}

/** The subcommands a help text lists (its `Commands:` block), `help` left out. */
function subcommands(text: string): string[] {
  const block = /\nCommands:\n([\s\S]*?)(?:\n\n|$)/.exec(text);
  if (!block) return [];
  return [...(block[1] as string).matchAll(/^ {2}([a-z][a-z-]*)\b/gm)]
    .map((m) => m[1] as string)
    .filter((n) => n !== "help");
}

/** The flags a help text lists: `--name` and `-n`. */
function flags(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s,])(--?[a-zA-Z][\w-]*)/gm)) out.add(m[1] as string);
  return out;
}

/** The code spans of the skill, and the lines of its fenced blocks, that are `quiz` commands. */
function commands(): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  const fenced = fencedBlocks(skill);
  skill.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const text = (m[1] as string).trim();
      if (/^quiz(\s|$)/.test(text)) out.push({ text, line: i + 1 });
    }
  });
  for (const block of fenced) {
    block.text.split("\n").forEach((l, i) => {
      if (/^\s*quiz(\s|$)/.test(l)) out.push({ text: l.trim(), line: block.line + 1 + i });
    });
  }
  return out;
}

const cache = new Map<string, string>();
const helpOf = (path: string[]): string => {
  const key = path.join(" ");
  if (!cache.has(key)) cache.set(key, help(path));
  return cache.get(key) as string;
};

describe("skill/SKILL.md", () => {
  it("starts with the front matter of a skill named quiz", () => {
    const m = /^---\nname: quiz\ndescription: (.+)\n---\n/.exec(skill);
    expect(m).not.toBeNull();
    expect((m as RegExpExecArray)[1]?.length).toBeGreaterThan(80);
  });

  it("shows commands", () => {
    expect(commands().length).toBeGreaterThan(30);
  });

  it("sends the agent to quiz agent-guide and quiz guide", () => {
    expect(skill).toContain("`quiz agent-guide`");
    expect(skill).toContain("`quiz guide`");
  });

  for (const { text, line } of commands()) {
    it(`line ${line}: \`${text}\` is a command and flags the CLI has`, () => {
      const words = text.split(/\s+/).slice(1);
      const path: string[] = [];
      let at = 0;
      for (;;) {
        const next = words[at];
        if (next === undefined || next.startsWith("-")) break;
        if (!subcommands(helpOf(path)).includes(next)) break;
        path.push(next);
        at++;
      }
      // a bare `quiz` word that is not a command (a placeholder in the first position) is a mistake
      if (path.length === 0 && words[0] !== undefined && !words[0].startsWith("-")) {
        expect.fail(
          `\`quiz ${words[0]}\` is not a command: \`quiz --help\` lists ${subcommands(helpOf([])).join(", ")}`,
        );
      }
      const known = flags(helpOf(path));
      for (const word of words) {
        const flag = /^(--?[a-zA-Z][\w-]*)/.exec(word);
        if (!flag) continue;
        expect(known.has(flag[1] as string), `${flag[1]} is not an option of \`quiz ${path.join(" ")} --help\``).toBe(
          true,
        );
      }
    });
  }
});
