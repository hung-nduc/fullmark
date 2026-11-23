import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanTemps, tempDir } from "./helpers/library";

/**
 * Tab completion in the real shells (COMMANDS.md, `quiz shell-init`; step 7, 7b, G16 and G17). Each shell loads the script
 * `quiz shell-init SHELL` prints and is asked for candidates without a terminal: PowerShell through `TabExpansion2`,
 * bash by calling the registered function with `COMP_WORDS` and `COMP_CWORD` set, fish through `complete -C`. zsh runs
 * its completion system only inside a line editor, so it is tested lighter: under `zsh -f` with `compinit` the script
 * loads without an error and `quiz` and `fullmark` are registered in `$_comps`. What `quiz __complete` answers for each
 * position is tested in complete-cli.test.ts; these tests show that each script turns the answer into the shell's own
 * candidates, descriptions where the shell shows them, and files of the right kind.
 *
 * A shell that is not on the machine skips its tests, and the skip names it: CI installs zsh and fish and runs all four.
 * The library and the config are copies in a temporary folder, never the owner's.
 */
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "dist", "cli.js");
const HISTORY = resolve(import.meta.dirname, "fixtures", "library-history", "lib");
const windows = process.platform === "win32";
const fwd = (p: string): string => p.replaceAll("\\", "/");

/** A program on the PATH, or null. On Windows bash is Git's, never the WSL launcher in System32. */
function find(names: string[], skip: RegExp | null = null): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir === "" || (skip !== null && skip.test(dir))) continue;
    for (const name of names) {
      const file = join(dir, name);
      if (existsSync(file)) return file;
    }
  }
  return null;
}

/** The program when it starts (found by the system, as a shell would: `pwsh` on Windows is an app alias that `existsSync` cannot see). */
const works = (bin: string | null, args: string[]): string | null =>
  bin !== null && spawnSync(bin, args, { stdio: "ignore", timeout: 30_000 }).status === 0 ? bin : null;

const BINS = {
  powershell: works("pwsh", ["-NoProfile", "-Command", "exit 0"]),
  bash: works(find(windows ? ["bash.exe"] : ["bash"], windows ? /system32/i : null), ["--version"]),
  zsh: works("zsh", ["--version"]),
  fish: works("fish", ["--version"]),
};

/** The name a suite carries: a shell that is missing says so, and that CI runs it. */
const suiteName = (shell: keyof typeof BINS): string =>
  BINS[shell] === null ? `${shell} (not installed on this machine: skipped here, run in CI)` : shell;

let dir: string;
let env: Record<string, string>;
let work: string;

beforeAll(() => {
  dir = tempDir("fm-shell-");
  // the quiz command each shell finds on its PATH: a shim that runs this checkout's build
  const shims = join(dir, "bin");
  mkdirSync(shims);
  for (const name of ["quiz", "fullmark"]) {
    writeFileSync(join(shims, name), '#!/bin/sh\nexec node "$FULLMARK_TEST_CLI" "$@"\n');
    chmodSync(join(shims, name), 0o755);
    // PowerShell on Windows runs a .ps1 beside it, as the one npm writes for a global install does
    if (windows) writeFileSync(join(shims, `${name}.ps1`), "& node $env:FULLMARK_TEST_CLI @args\nexit $LASTEXITCODE\n");
  }
  cpSync(HISTORY, join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "config.toml"), "");
  // a working folder with files of two kinds and a folder, for the file completion
  work = join(dir, "work");
  mkdirSync(join(work, "sub"), { recursive: true });
  writeFileSync(join(work, "notes.md"), "---\ntitle: T\n---\n");
  writeFileSync(join(work, "data.txt"), "x");
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("FULLMARK_")) base[k] = v;
  env = {
    ...base,
    PATH: `${shims}${delimiter}${base.PATH ?? ""}`,
    NO_COLOR: "1",
    HOME: join(dir, "home"),
    FULLMARK_TEST_CLI: fwd(cli),
    FULLMARK_CONFIG: fwd(join(dir, "config.toml")),
    FULLMARK_LIBRARY: fwd(join(dir, "lib")),
    ZDOTDIR: join(dir, "home"),
  };
});
afterAll(cleanTemps);

type Run = { status: number; stdout: string; stderr: string };

function run(bin: string, args: string[]): Run {
  const r = spawnSync(bin, args, { cwd: work, env, encoding: "utf8", timeout: 120_000 });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** The command lines each shell is asked to complete: a trailing space means the cursor is on a new word. */
const LINES = [
  "quiz lib",
  "fullmark lib",
  "quiz library take ",
  "quiz library take ti",
  "quiz build --fonts ",
  "quiz build --fon",
  "quiz check ",
] as const;

/** The probe's output, by command line: each candidate as `[value, description]`. */
function blocks(stdout: string): Map<string, [string, string][]> {
  const out = new Map<string, [string, string][]>();
  let current: [string, string][] = [];
  for (const line of stdout.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("### ")) {
      current = [];
      out.set(line.slice(4), current);
    } else if (line !== "") {
      const [value, ...rest] = line.split("\t");
      current.push([value as string, rest.join("\t")]);
    }
  }
  return out;
}

const values = (b: Map<string, [string, string][]>, line: string): string[] => (b.get(line) ?? []).map(([v]) => v);
const stripSlash = (v: string): string => v.replace(/[\\/]$/, "");

/** What every shell must show for the lines of `LINES`; `described` is whether the shell shows descriptions. */
function expectCandidates(b: Map<string, [string, string][]>, described: boolean): void {
  expect([...b.keys()]).toEqual([...LINES]);
  // a command, for both names the script registers
  expect(values(b, "quiz lib")).toEqual(["library"]);
  expect(values(b, "fullmark lib")).toEqual(["library"]);
  // a library quiz name, with its title; the first letters narrow it
  expect(values(b, "quiz library take ")).toEqual(["limits-and-continuity", "study-fixture", "tidy"]);
  expect(values(b, "quiz library take ti")).toEqual(["tidy"]);
  // a flag's fixed value, and a flag
  expect(values(b, "quiz build --fonts ")).toEqual(["quiz", "all", "none"]);
  expect(values(b, "quiz build --fon")).toEqual(["--fonts"]);
  // a quiz file: the .md and the folder to look in, not the other file
  const files = values(b, "quiz check ").map(stripSlash);
  expect(files).toContain("notes.md");
  expect(files).toContain("sub");
  expect(files).not.toContain("data.txt");
  if (described) {
    expect(b.get("quiz library take ti")?.[0]?.[1]).toBe("Tidy notes");
    expect(b.get("quiz lib")?.[0]?.[1]).toMatch(/^the library/);
    expect(b.get("quiz build --fon")?.[0]?.[1]).toMatch(/which fonts the page embeds/);
  } else {
    // bash shows the values only
    for (const [, list] of b) for (const [, description] of list) expect(description).toBe("");
  }
}

describe(suiteName("powershell"), () => {
  it.skipIf(BINS.powershell === null)(
    "Register-ArgumentCompleter: TabExpansion2 gives the candidates, with the descriptions as tooltips",
    () => {
      writeFileSync(join(dir, "probe.ps1"), PS_PROBE);
      writeFileSync(join(dir, "lines.txt"), `${LINES.join("\n")}\n`);
      const r = run(BINS.powershell as string, [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(dir, "probe.ps1"),
      ]);
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      expectCandidates(blocks(r.stdout), true);
    },
    120_000,
  );
});

const PS_PROBE = `$ErrorActionPreference = 'Stop'
quiz shell-init powershell | Out-String | Invoke-Expression
foreach ($line in (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lines.txt'))) {
    "### $line"
    $r = TabExpansion2 -inputScript $line -cursorColumn $line.Length
    foreach ($m in $r.CompletionMatches) { "$($m.CompletionText)\`t$($m.ToolTip)" }
}
`;

describe(suiteName("bash"), () => {
  it.skipIf(BINS.bash === null)(
    "complete -F: the function called with COMP_WORDS and COMP_CWORD gives the values, without bash-completion",
    () => {
      writeFileSync(join(dir, "probe.sh"), BASH_PROBE);
      writeFileSync(join(dir, "lines.txt"), `${LINES.join("\n")}\n`);
      // --norc --noprofile: nothing of the user's, and no bash-completion package either
      const r = run(BINS.bash as string, ["--norc", "--noprofile", fwd(join(dir, "probe.sh"))]);
      expect(r.status).toBe(0);
      const text = r.stdout.replace(/\r/g, "");
      expect(text).toMatch(
        /^registered: complete -F _fullmark_complete quiz\nregistered: complete -F _fullmark_complete fullmark\n/,
      );
      expectCandidates(blocks(text), false);
    },
    120_000,
  );
});

const BASH_PROBE = `eval "$(quiz shell-init bash)" || exit 11
echo "registered: $(complete -p quiz)"
echo "registered: $(complete -p fullmark)"
while IFS= read -r line; do
    echo "### $line"
    IFS=' ' read -ra COMP_WORDS <<<"$line"
    [[ $line == *' ' ]] && COMP_WORDS+=("")
    COMP_CWORD=$((\${#COMP_WORDS[@]} - 1))
    COMPREPLY=()
    _fullmark_complete
    printf '%s\\n' "\${COMPREPLY[@]}"
done <"$(dirname "$0")/lines.txt"
`;

describe(suiteName("fish"), () => {
  it.skipIf(BINS.fish === null)(
    "complete -C: fish gives the candidates, with the descriptions",
    () => {
      writeFileSync(join(dir, "probe.fish"), FISH_PROBE);
      writeFileSync(join(dir, "lines.txt"), `${LINES.join("\n")}\n`);
      const r = run(BINS.fish as string, ["--no-config", join(dir, "probe.fish")]);
      // fish runs only in CI: a failure carries all fish said, so one run shows every difference, not the first
      try {
        expect(r.stderr).toBe("");
        expect(r.status).toBe(0);
        expectCandidates(blocks(r.stdout), true);
      } catch (e) {
        throw new Error(`${(e as Error).message}
--- fish's stdout:
${r.stdout}
--- fish's stderr:
${r.stderr}`);
      }
    },
    120_000,
  );
});

const FISH_PROBE = `quiz shell-init fish | source
for line in (cat (dirname (status filename))/lines.txt)
    echo "### $line"
    complete -C "$line"
end
`;

describe(suiteName("zsh"), () => {
  it.skipIf(BINS.zsh === null)(
    "under zsh -f with compinit the script loads without an error and registers quiz and fullmark",
    () => {
      writeFileSync(join(dir, "probe.zsh"), ZSH_PROBE);
      const r = run(BINS.zsh as string, ["-f", join(dir, "probe.zsh")]);
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("quiz=_fullmark_complete fullmark=_fullmark_complete\n");
    },
    120_000,
  );
});

const ZSH_PROBE = `autoload -Uz compinit
compinit -u -d "\${0:A:h}/zcompdump"
eval "$(quiz shell-init zsh)" || exit 11
print -r -- "quiz=\${_comps[quiz]} fullmark=\${_comps[fullmark]}"
`;

describe("the scripts are the package's files, printed as they are", () => {
  it("each `quiz shell-init SHELL` prints its file byte for byte, and registers both names", () => {
    const files = { powershell: "quiz.ps1", bash: "quiz.bash", zsh: "quiz.zsh", fish: "quiz.fish" } as const;
    for (const [shell, file] of Object.entries(files)) {
      const r = spawnSync(process.execPath, [cli, "shell-init", shell], { env, encoding: "utf8" });
      const text = readFileSync(join(root, "shell", file), "utf8");
      expect(r.status, shell).toBe(0);
      expect(r.stdout, shell).toBe(text);
      expect(r.stdout, shell).toMatch(/quiz/);
      expect(r.stdout, shell).toMatch(/fullmark/);
      // a few dozen lines at most (COMMANDS.md): the logic is in `quiz __complete`
      expect(r.stdout.split("\n").length, shell).toBeLessThanOrEqual(50);
    }
  });

  it("an unknown shell exits 2 and names the four", () => {
    const r = spawnSync(process.execPath, [cli, "shell-init", "nushell"], { env, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    for (const shell of ["powershell", "bash", "zsh", "fish"]) expect(r.stderr).toContain(shell);
  });
});

describe("CI", () => {
  // the skip above is for a laptop; on the runner a missing zsh or fish means the install step broke, and four shells
  // would quietly become two
  it.runIf(process.env.CI === "true")("has zsh and fish, so the tests above ran in all four shells' place", () => {
    expect(BINS.zsh, "zsh: install it in .github/workflows/check.yml").not.toBeNull();
    expect(BINS.fish, "fish: install it in .github/workflows/check.yml").not.toBeNull();
    expect(BINS.bash).not.toBeNull();
  });
});
