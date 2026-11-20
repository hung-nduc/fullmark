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

### Next

1. **Done:** 7a built and reviewed (2026-11-20).
2. **Done, `4549bb02`:** a bug the owner found (2026-11-20): the docked top bar stays tall after the Appearance menu closes. `src/page/dock.ts` sets the measured height as the dock's inline `min-height`, so when its content shrinks the box does not, and the `ResizeObserver` on the dock never fires again (reproduced on the owner's quiz: 99 px, 160 px with the menu open, still 160 px after it closed while the content needed 98 px). Anything that shrinks the dock sticks the same way (A−, a wider window). The fix measures the dock's content (each child observed, and again when a child comes or goes: the menu, the dialog, the review bar); a Playwright test opens and closes the menu, and A+ then A−, and checks the dock is back to its content's height. The menu keeps closing on a click outside, as now.
3. **Done (2026-11-20):** fast-forward `1.0`, pack and reinstall from the tarball as in step 6, and check that the `/quiz` skill loads again.

## Goal

fullmark 1.0.0 was installed (step 6) without `quiz guide` and `quiz agent-guide`, which COMMANDS.md specifies but no step's plan built. An agent using `quiz` therefore has no authoring reference from the tool, and the owner's Claude Code skill `/quiz` (a link to `D:\coding-projects\fullmark\skill`, which existed only on `main`, 0.x) no longer loads. Meanwhile the CLI guides and the tldr page point agents at `docs/design/QUIZ_SYNTAX.md`. **Done when** both commands print their guides from the installed package, every syntax example in the authoring guide passes `check`, and the `/quiz` skill loads from branch `1.0` and works with the 1.0 commands.

## Rules for every slice

Step 6's rules hold ([archive/STEP6.md](archive/STEP6.md), "Rules for every slice", extending step 5's and earlier). Windows counts; never run a second Vitest beside a running one.

## Gaps

G1 to G3, G6 and G8 are decided ([STEP7-GAPS.md](STEP7-GAPS.md)). Open: G4 and G5, small and not blocking (7a's review, below); G7 and G9, for slice 7b. New ones are added here from G10.

**G7. Where zsh and fish get a real Tab test.** This laptop has PowerShell and Git Bash only. **Recommendation:** the agent tests the zsh and fish shims' text and every `__complete` answer here; the real Tab test runs once on a lab workstation (`ibmelabc05` or `ibmelab-pc`) over SSH, if zsh and fish are there, with the owner's yes at the time. Not installing them on Windows (MSYS2) only for a test.

**G9. The Starship segment.** The proposal (`proposals/cli-integration.md`, section 4) shows `📚 FOLDER` anywhere inside a library "so it is clear where `quiz library ...` will act", but library commands never look at the current folder: they act on the configured library, or on `FULLMARK_LIBRARY` (COMMANDS.md, "Git"). Inside another library's folder the segment would mislead. **Recommendation:** leave the walk-up hook out of 7b and correct the proposal's sentence; the case worth showing, `FULLMARK_LIBRARY` set in this shell, needs no fullmark code (Starship's `env_var` module, three lines in `starship.toml`, which the owner adds or not).

## Slices

| Slice | Content | Needs |
|---|---|---|
| **7a** | `quiz guide`, `quiz agent-guide`, the authoring guide, `AGENTS.md`, `skill/SKILL.md` | G1 to G3 |

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
