# Step 7: the guides

## Handoff (2026-11-20): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 6 ([archive/STEP6.md](archive/STEP6.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet) once the owner approves it; the agent implements and commits (never pushes) and reports; the planner reviews and brings every gap to the owner with a recommendation; the owner decides; decisions go into `docs/design/` as plain statements. Commit after every round. Gaps are numbered from **G1**; decided ones move to [STEP7-GAPS.md](STEP7-GAPS.md).

**Branches:** since G8 (2026-11-20) `main` is 1.0: work is fast-forwarded into `main`, and the old `1.0` branch is kept until the owner deletes it. This machine has no GitHub credentials; the owner pushes `main`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-20); G1 to G3 decided as recommended (2026-11-20), G1 and G2 written into COMMANDS.md | this file |
| 7a | built and reviewed (2026-11-20): `npm run check` passes on Windows; with the dock bug fixed | `d671461e`, `cd2175fa`, `e78158c6`, `0045cbc5`, `325fc8f6`, `08bd7287`, `4549bb02` |
| 7b | briefed (2026-11-20); waits for G10 and the owner's approval | |

### Next

1. **Done:** 7a built and reviewed (2026-11-20).
2. **Done, `4549bb02`:** a bug the owner found (2026-11-20): the docked top bar stays tall after the Appearance menu closes. `src/page/dock.ts` sets the measured height as the dock's inline `min-height`, so when its content shrinks the box does not, and the `ResizeObserver` on the dock never fires again (reproduced on the owner's quiz: 99 px, 160 px with the menu open, still 160 px after it closed while the content needed 98 px). Anything that shrinks the dock sticks the same way (A−, a wider window). The fix measures the dock's content (each child observed, and again when a child comes or goes: the menu, the dialog, the review bar); a Playwright test opens and closes the menu, and A+ then A−, and checks the dock is back to its content's height. The menu keeps closing on a click outside, as now.
3. **Done (2026-11-20):** fast-forward `1.0`, pack and reinstall from the tarball as in step 6, and check that the `/quiz` skill loads again.
4. **Next:** slice 7b, Tab completion (G6, G7, G9 decided 2026-11-20): the owner decides G10 and approves the brief; then one agent builds it.

## Goal

fullmark 1.0.0 was installed (step 6) without `quiz guide` and `quiz agent-guide`, which COMMANDS.md specifies but no step's plan built. An agent using `quiz` therefore has no authoring reference from the tool, and the owner's Claude Code skill `/quiz` (a link to `D:\coding-projects\fullmark\skill`, which existed only on `main`, 0.x) no longer loads. Meanwhile the CLI guides and the tldr page point agents at `docs/design/QUIZ_SYNTAX.md`. **Done when** both commands print their guides from the installed package, every syntax example in the authoring guide passes `check`, and the `/quiz` skill loads from branch `1.0` and works with the 1.0 commands.

## Rules for every slice

Step 6's rules hold ([archive/STEP6.md](archive/STEP6.md), "Rules for every slice", extending step 5's and earlier). Windows counts; never run a second Vitest beside a running one.

## Gaps

G1 to G3 and G6 to G9 are decided ([STEP7-GAPS.md](STEP7-GAPS.md)). Open: G4 and G5, small and not blocking (7a's review, below), G10 and G11. New ones are added here from G12.

**G10. The version after 7b.** A new command (`shell-init`) is more than a fix, as with G3. **Recommendation:** `1.2.0`; about 29 goldens change only in the version string and what follows from it, as in 7a, and are counted in the review.

**G11. `content.names-control` flags "tap" as a word of the electronics.** Found while publishing the owner's shelf: under the `exam` profile, "a bypass capacitor at the tap" (a voltage divider's tap) is an error, because `tap` is one of the English screen words (`src/core/i18n/controls.ts`), matched as a whole word anywhere. `press` has the same risk (a press, pressure). The owner's two quizzes were reworded ("at the divider's midpoint"), so nothing waits on this. **Recommendation:** match `tap`, `press` and `click` only as an instruction, followed by `the`, `on`, `a`, `an`, `here` or `this` ("tap the button"), with a unit test for "at the tap" and "a hydraulic press"; `button`, `sidebar` and `scroll` stay as they are. A small slice of its own, or a task in the next one.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **7a** | `quiz guide`, `quiz agent-guide`, the authoring guide, `AGENTS.md`, `skill/SKILL.md` | G1 to G3 |
| **7b** | Tab completion: `quiz shell-init` for PowerShell, bash, zsh and fish, and the hidden `quiz __complete` | 7a, G6, G7, G9, G10 |

## Slice 7a: the guides and the skill

**Briefed on 2026-11-20 from G1 to G3, decided by the owner as recommended.** What the commands do is written in COMMANDS.md (`quiz guide`, `quiz agent-guide`, and its "First form" paragraph); what the agent rules say is in USER_DESIGN.md ("Rules in `AGENTS.md`") and TECHNICAL_DESIGN.md (section 5, "Rules for agents"; section 6, grader identity; section 7, "Seams for later features", the `quiz-example` blocks).

### Read first

- This plan; COMMANDS.md: `quiz guide, quiz agent-guide`, `quiz brief`, `check`, `serve`, `review`, `grade`, the library commands (for the skill's workflow); USER_DESIGN.md, sections on roles and "Rules in `AGENTS.md`"; QUIZ_SYNTAX.md, all of it.
- 0.x's versions, for shape only (they describe 0.x commands and syntax; never copy a command or a syntax rule from them without checking it against 1.0): `git show main:skill/SKILL.md`, `git show main:AGENTS.md`, `git show main:docs/GUIDE.md`.
- `test/cli-graph.test.ts` and the startup tests: what a command may load.

### Tasks

1. **The authoring guide** (`guide/GUIDE.md`, English only: G2). Written for an author, not a designer: from QUIZ_SYNTAX.md, every question type with a minimal example, the front matter, sections, banks, materials, assets, maths and code, and how `check` and profiles hold a quiz to rules. Every syntax example is a fenced `quiz-example` block holding a valid quiz or quiz fragment, as TECHNICAL_DESIGN.md section 7 says. Where QUIZ_SYNTAX.md and the parser disagree, the parser is not changed: report it as a gap.
2. **`AGENTS.md`** (English): the rules of USER_DESIGN.md's table, each with its one-line why; the grading contract (fill only the questions you were given, leave the rest `null`, `grader` and `reviewed` as TECHNICAL_DESIGN.md section 6 says); the JSON formats by name with their schema files; exit codes (3 means ask the user). It refers to `quiz guide` for the syntax and never repeats it.
3. **The commands.** `quiz guide [--lang en|vi] [--plain] [--no-pager]` and `quiz agent-guide [--plain] [--no-pager]` print their file as it is (COMMANDS.md, "First form"), read from the installed package (both files added to `package.json`'s `files`; resolved from `dist/`, so they work from any folder after `npm install -g` of the tarball). Each is its own chunk and loads nothing of the page builder, the server or the library: extend `test/cli-graph.test.ts`. Goldens for both, with `--plain`, `--no-pager`, and `--lang vi` (the English guide, a note on stderr, exit 0: COMMANDS.md, G2).
4. **The guide's examples pass.** A test extracts every `quiz-example` block from `guide/GUIDE.md` and runs it through the same `check` as the CLI; any failure names the block's line. A fragment that is not a whole quiz is wrapped the same way for every block (say how).
5. **The skill** (`skill/SKILL.md`): the 0.x skill's workflow redone for 1.0. Front matter `name: quiz` and a description of when to use it. It sends the agent to `quiz agent-guide` and `quiz guide` before writing or grading, and covers: the brief (`quiz brief`, exit 3 means ask, `--web` for the form), make (template or `new --from`, write, `check --strict`, `inspect`), review (`quiz review`, then `check --review`), the library (`library status --json`, `register --json`, never `init` unasked, end with the `quiz library take NAME` line), take and retry (`library take`, `--missed`, `--dry-run`), and grading (`grade` / `library grade` with `--json`, then `--grades`). Every command and flag in it is one that `quiz --help` lists: a test checks the skill's commands against the CLI's own help, so the skill cannot drift from the tool.
6. **The version becomes `1.1.0`** (G3), then `npm run golden:update`: list every changed golden and show that each differs only in the version, the byte count and the commit hash that follows from them.

### Done when

- On Windows, nothing else running: `npm run build`, then `npm run check` passes. Report each part's counts and times.
- `npm pack` lists `guide/GUIDE.md`, `AGENTS.md` and nothing else new; installed from the tarball into a temporary prefix (`npm install -g --prefix TMP`, not over the owner's install), `quiz guide` and `quiz agent-guide` print from any folder.
- The new goldens are listed; the changed ones are explained (task 6); no other golden changes.
- One commit per task or a few; explicit paths; the model's `Co-Authored-By` line; no push.

### Report

What was done per task, anything done differently and why, every place QUIZ_SYNTAX.md and the parser disagreed, the changed goldens, the counts and times, and any new gap (from G4) with a recommendation.

### Review (2026-11-20)

The agent's report and the planner's review, with one full check after the dock fix (below) covering both.

- **Done as briefed:** `guide/GUIDE.md` (`d671461e`; 31 `quiz-example` blocks, each checked as `quiz.md` under the `default` profile with strict on, so a warning fails too; a block that does not start with `---` gets a three-line front matter put before it, and the sandbox holds the assets the examples name); `AGENTS.md` (`cd2175fa`); the commands in `src/cli/guide.ts` (`e78158c6`, `0045cbc5`), which print the file byte for byte from the package and load nothing of the page builder, the server, the library or the prompts; `skill/SKILL.md` with `test/skill.test.ts`, which checks every `quiz ...` command and flag in it against the CLI's own help and fails on a bogus flag (`325fc8f6`); version `1.1.0` (`08bd7287`). The agent probed about 90 claims of QUIZ_SYNTAX.md against the parser and found no disagreement.
- **Done differently:** guide examples must pass `check --strict`, not only without errors (kept: the skill tells agents to use `--strict`); `Io` gained an optional `outRaw`, so a guide is printed without an added newline; a README row for the new commands. **A nit, left:** `src/cli/brief.ts` repeats the version as a default (`"1.1.0"`) beside `VERSION` in `main.ts`; the next version bump must change both.
- **Goldens:** 40 new files (`guide/` 6 cases, `agent-guide/` 2, `top/help-guide`, `top/help-agent-guide`). 29 changed: 26 only in the version string (the same length, so no byte count moves), 1 in a commit hash that follows from it (`library/publish-sync-git`), and `top/help` and `top/no-command`, which list the two new commands. Checked by the planner by normalising those three things: nothing else differs.
- **The dock bug** (Next, item 2), fixed by the planner (`4549bb02`): `watchDock` observes the dock's children, and again when one comes or goes, instead of the dock, whose min-height kept it from ever shrinking. The page, the review form and the grade form share it. A Playwright test in `e2e/looks.spec.ts` closes the menu by a click outside, the button and Esc, then does A+ A+ A− A−, and checks the dock is back to its height and `--dock-h` with it; run against the old `dock.ts` it fails at the click outside, as the owner saw. 28 goldens change only in the inlined script, its CSP hash, the byte counts and one commit hash. README's status line, stale since step 3, was brought up to date in the same commit.
- **A Windows note:** a second `npm run golden:update` right after the first failed to open 17 golden files for writing (`UNKNOWN: unknown error, open`); nothing was written, the first run had already regenerated all 776 cases, and the full check below compares every golden. A file briefly held by another process (likely the virus scanner on files just written) is the probable cause, not shown.
- **Check on Windows**, nothing else running: `npm run build`, then `npm run check`, exit 0 in 24.5 min. Startup test 2 passed; Vitest 3,926 passed, 3 skipped (163 files, 536 s); budgets passed, Chromium 911 ms, Firefox 2,413 ms then 807 ms on its retry (limit 1,000 ms; a cold first measurement, as in step 6); Playwright 863 passed (the two dock tests new), 559 skipped by design (15.0 min).
- **New gaps from the agent,** both small and not blocking: **G4**, `--plain` and `--no-pager` do nothing in the first form, as COMMANDS.md says: nothing to decide until the styled output is built. **G5**, `templates/blank/quiz.md` keeps a commented `on_timeout` line for a key that 1.0 dropped (`syntax.unknown-key` if uncommented); removing it changes the `new/*` goldens that copy the template. Recommendation: remove it in the next slice that touches the templates.

## Slice 7b: Tab completion

**Briefed on 2026-11-20 from G6, G7 and G9, decided by the owner, and G10.** What the commands do is written in COMMANDS.md (`quiz shell-init`, with the hidden `quiz __complete`); `proposals/cli-integration.md`, section 1, is the background and the reasons, and COMMANDS.md wins where they differ. The prompt segment (its section 4) is not part of this slice (G9).

### Read first

- This plan: "Rules for every slice", 7a's review; [STEP7-GAPS.md](STEP7-GAPS.md), G6, G7, G9.
- COMMANDS.md: `quiz shell-init` (all of it), "Conventions" (exit codes, environment), `quiz template`, `quiz rules`, the `--profile` and `--section` options, and every library command the table of library values lists. `proposals/cli-integration.md`, sections 1 and "The seam to keep in v1".
- `src/cli/main.ts` (how commands, options and choices are declared), the startup test and `test/cli-graph.test.ts` (what a command may load), and where the library index, the templates, the profiles and the rule ids are read today: reuse those readers, never a second parser.

### Tasks

1. **The definitions are the source.** Every fixed set of values a flag takes is a declared choice in commander (`.choices()`), not a check inside an action, so help and completion read the same list. Change the declarations that are not yet; a declared choice must give the same message and exit code as the check it replaces, or the change is reported. Goldens whose help text changes are listed.
2. **`quiz __complete WORDS...`**, hidden, exactly as COMMANDS.md says: the candidates, the descriptions, the directive line, the rules (read-only, quiet, no lock, every error giving no candidates, `:default` and exit `0`). It walks the commander tree to find the position, then asks the value source the table names. Each value source is a small function with unit tests (an empty library, no library, a broken index, no config, a user template, a quiz with and without sections). It must not load the page builder, the renderer, the server, the highlighter or `@clack/prompts`: extend `test/cli-graph.test.ts`.
3. **Its budget.** A test in the startup tests' style times `__complete` for a subcommand and for a library quiz name on the history fixture: within the startup budget, and a library value within 100 ms on this laptop (report the measurements).
4. **The four scripts**, printed by `quiz shell-init powershell|bash|zsh|fish`, each registering `quiz` and `fullmark`, each a few dozen lines at most, kept as files in the package and printed as they are. PowerShell: `Register-ArgumentCompleter -Native`, with the descriptions as tooltips; bash: a `complete -F` function that works with and without the `bash-completion` package, and in Git Bash; zsh: a `compdef` function using `_describe`, so the descriptions show; fish: `complete -c` with the descriptions. Each honours the directive (files of a kind, no files, the shell's default). An unknown shell exits `2` naming the four. `quiz shell-init --help` gives the four start-up lines of COMMANDS.md. Before writing them, look at `@bomb.sh/tab` and `tabtab`; use one only if it fits COMMANDS.md's protocol and adds nothing to the startup path, and say why either way. A new dependency is named in the report with its size and licence.
5. **Real Tab tests where the shell is here** (G7). PowerShell and Git Bash: a smoke test that loads the script into a real shell and completes `quiz lib`, `quiz library take ` on the history fixture (with `FULLMARK_CONFIG` pointing at a test config, never the owner's), a `--fonts ` value and a `.md` file. For zsh and fish, which this laptop lacks: tests of the scripts' text and of every `__complete` answer they rely on, and a small script that runs the same smoke test, to be run once on a Linux workstation with zsh and fish (skipped here, and the skip says so). Do not install a shell.
6. **The guides.** `guide/GUIDE.md` gains a short section on setting completion up (the four lines); `skill/SKILL.md` and `AGENTS.md` say nothing about it (completion is for people). The skill test still passes.
7. **The version** (G10), then `npm run golden:update`: list every changed golden and show that each differs only in the version string and what follows from it, or explain it (task 1's help text).

### Done when

- On Windows, nothing else running: `npm run build`, then `npm run check` passes. Report each part's counts and times, the budgets, and `__complete`'s measurements.
- By hand in PowerShell and Git Bash, with the scripts loaded from a build in a temporary prefix (as in 7a, never over the owner's install): Tab completes a subcommand, a flag, a fixed value, a library quiz name with its title, and a quiz file. Quote what you saw.
- The zsh and fish smoke script exists, runs its tests when the shells are there, and is named in the report for the planner to run on the workstation.
- No golden changes except those listed and explained; one commit per task or a few; explicit paths; the model's `Co-Authored-By` line; no push.

### Report

What was done per task, anything done differently and why, the library choice (task 4), the changed goldens, the counts, times and measurements, what could not be checked here, and any new gap (from G11) with a recommendation.
