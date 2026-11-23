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
| 7b | built and reviewed (2026-11-23): `npm run check` passes on Windows; `main` fast-forwarded, tagged `v1.2.0`, 1.2.0 installed; zsh and fish wait for the first CI run | `3d3e7a1e`, `bd2243cb`, `634a2e57`, `09b3ec8e`, `8a7e0d2a` and the review |
| CI and licence | CI runs on `main`; typos clean; the grade key row and the shelf phone card hold with Linux's wider fonts; the copyright holder is `hung-nduc` | `97f41a85`, `613e0809`, `f472c391` |
| 7c | built and reviewed (2026-11-21), G14 built: `npm run check` passes on Windows; `main` fast-forwarded, 1.1.1 installed | `2e75de00`, `b62efff9`, `8202c302`, `d07ef96e`, `10c759e7`, `fd2dec97` and the review |

### Next

1. **Done:** 7a built and reviewed (2026-11-20).
2. **Done, `4549bb02`:** a bug the owner found (2026-11-20): the docked top bar stays tall after the Appearance menu closes. `src/page/dock.ts` sets the measured height as the dock's inline `min-height`, so when its content shrinks the box does not, and the `ResizeObserver` on the dock never fires again (reproduced on the owner's quiz: 99 px, 160 px with the menu open, still 160 px after it closed while the content needed 98 px). Anything that shrinks the dock sticks the same way (A−, a wider window). The fix measures the dock's content (each child observed, and again when a child comes or goes: the menu, the dialog, the review bar); a Playwright test opens and closes the menu, and A+ then A−, and checks the dock is back to its content's height. The menu keeps closing on a click outside, as now.
3. **Done (2026-11-20):** fast-forward `1.0`, pack and reinstall from the tarball as in step 6, and check that the `/quiz` skill loads again.
4. **Done (2026-11-20):** the CI fix (the trigger, typos, the two layouts that failed on Linux's wider fonts) and the licence holder; the owner's shelf published as `biomed-quizzes`, linked from the README. CI on Linux confirms the layouts after the owner pushes.
5. **Done (2026-11-21):** 7c finished and reviewed, G14 built, a scroll regression on Start fixed, `npm run check` exit 0; `main` fast-forwarded and 1.1.1 installed from the tarball.
6. **Waiting on the owner:** pushing `main` and the tags `v1.1.0`, `v1.1.1` and `v1.2.0` (`git -C D:/coding-projects/fullmark push origin main v1.1.0 v1.1.1 v1.2.0`), and the shelf (`git -C D:/studying/biomed-quizzes push`), whose last commit republishes with every font and exams A and B under the `exam` profile; after 7c is installed, `quiz library publish` again so the shelf gets the start screen's bar. G11 is open.
7. **Now:** 7b is reviewed (below), and shipped on the owner's yes (2026-11-23): `main` fast-forwarded, tagged `v1.2.0`, installed from `fullmark-dist/fullmark-1.2.0.tgz`. **Next:** after the owner pushes, the planner reads the first CI run: zsh and fish run there for the first time (G16); a failure comes back as a fix (`1.2.1`). Then step 7's Goal is checked and the step closed, or G11, G15 and G18 make a small last slice. Before 7b: slice 7b, Tab completion (G6, G9 decided 2026-11-20; G16, which replaces G7, decided 2026-11-23: zsh and fish are tested in CI): G10 and G17 decided 2026-11-23; the brief goes to the agent. zsh and fish results come only from CI, after the owner pushes: the planner reads the run and brings any failure back as a fix.

## Goal

fullmark 1.0.0 was installed (step 6) without `quiz guide` and `quiz agent-guide`, which COMMANDS.md specifies but no step's plan built. An agent using `quiz` therefore has no authoring reference from the tool, and the owner's Claude Code skill `/quiz` (a link to `D:\coding-projects\fullmark\skill`, which existed only on `main`, 0.x) no longer loads. Meanwhile the CLI guides and the tldr page point agents at `docs/design/QUIZ_SYNTAX.md`. **Done when** both commands print their guides from the installed package, every syntax example in the authoring guide passes `check`, and the `/quiz` skill loads from branch `1.0` and works with the 1.0 commands.

## Rules for every slice

Step 6's rules hold ([archive/STEP6.md](archive/STEP6.md), "Rules for every slice", extending step 5's and earlier). Windows counts; never run a second Vitest beside a running one.

## Gaps

G1 to G3 and G6 to G9 are decided ([STEP7-GAPS.md](STEP7-GAPS.md)). Open: G4 and G5, small and not blocking (7a's review, below), G11, G15 (7c's review, below), G18 and G19 (7b's review, below); G10 and G12 to G17 are decided ([STEP7-GAPS.md](STEP7-GAPS.md)). New ones are added here from G20.

**G11. `content.names-control` flags "tap" as a word of the electronics.** Found while publishing the owner's shelf: under the `exam` profile, "a bypass capacitor at the tap" (a voltage divider's tap) is an error, because `tap` is one of the English screen words (`src/core/i18n/controls.ts`), matched as a whole word anywhere. `press` has the same risk (a press, pressure). The owner's two quizzes were reworded ("at the divider's midpoint"), so nothing waits on this. **Recommendation:** match `tap`, `press` and `click` only as an instruction, followed by `the`, `on`, `a`, `an`, `here` or `this` ("tap the button"), with a unit test for "at the tap" and "a hydraulic press"; `button`, `sidebar` and `scroll` stay as they are. A small slice of its own, or a task in the next one.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **7a** | `quiz guide`, `quiz agent-guide`, the authoring guide, `AGENTS.md`, `skill/SKILL.md` | G1 to G3 |
| **7b** | Tab completion: `quiz shell-init` for PowerShell, bash, zsh and fish, and the hidden `quiz __complete` | 7a, G6, G7, G9, G10 |
| **7c** | The start screen's bar: A− / A+ and Appearance before Start, one look with the top bar | G12, G13 |

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

- This plan: "Rules for every slice", 7a's review; [STEP7-GAPS.md](STEP7-GAPS.md), G6, G9 and G16 (which replaces G7); G17 here.
- `.github/workflows/check.yml`: the Linux job task 5 extends.
- COMMANDS.md: `quiz shell-init` (all of it), "Conventions" (exit codes, environment), `quiz template`, `quiz rules`, the `--profile` and `--section` options, and every library command the table of library values lists. `proposals/cli-integration.md`, sections 1 and "The seam to keep in v1".
- `src/cli/main.ts` (how commands, options and choices are declared), the startup test and `test/cli-graph.test.ts` (what a command may load), and where the library index, the templates, the profiles and the rule ids are read today: reuse those readers, never a second parser.

### Tasks

1. **The definitions are the source.** Every fixed set of values a flag takes is a declared choice in commander (`.choices()`), not a check inside an action, so help and completion read the same list. Change the declarations that are not yet; a declared choice must give the same message and exit code as the check it replaces, or the change is reported. Goldens whose help text changes are listed.
2. **`quiz __complete WORDS...`**, hidden, exactly as COMMANDS.md says: the candidates, the descriptions, the directive line, the rules (read-only, quiet, no lock, every error giving no candidates, `:default` and exit `0`). It walks the commander tree to find the position, then asks the value source the table names. Each value source is a small function with unit tests (an empty library, no library, a broken index, no config, a user template, a quiz with and without sections). It must not load the page builder, the renderer, the server, the highlighter or `@clack/prompts`: extend `test/cli-graph.test.ts`.
3. **Its budget.** A test in the startup tests' style times `__complete` for a subcommand and for a library quiz name on the history fixture: within the startup budget, and a library value within 100 ms on this laptop (report the measurements).
4. **The four scripts**, printed by `quiz shell-init powershell|bash|zsh|fish`, each registering `quiz` and `fullmark`, each a few dozen lines at most, kept as files in the package and printed as they are. PowerShell: `Register-ArgumentCompleter -Native`, with the descriptions as tooltips; bash: a `complete -F` function that works with and without the `bash-completion` package, and in Git Bash; zsh: a `compdef` function using `_describe`, so the descriptions show; fish: `complete -c` with the descriptions. Each honours the directive (files of a kind, no files, the shell's default). An unknown shell exits `2` naming the four. `quiz shell-init --help` gives the four start-up lines of COMMANDS.md. Before writing them, look at `@bomb.sh/tab` and `tabtab`; use one only if it fits COMMANDS.md's protocol and adds nothing to the startup path, and say why either way. A new dependency is named in the report with its size and licence.
5. **Real completion tests in every shell, zsh and fish in CI** (G16, G17). One Vitest file of shell smoke tests, each loading the printed script into the real shell and asking it for candidates without a terminal: PowerShell through `TabExpansion2`, bash (Git Bash here, bash on Linux) by calling the function with `COMP_WORDS` and `COMP_CWORD` set, fish through `complete -C`. Each completes `quiz lib`, `quiz library take ` on the history fixture (with `FULLMARK_CONFIG` pointing at a test config, never the owner's), a `--fonts ` value and a `.md` file, and checks the descriptions where the shell shows them. zsh as G17 decides: under `zsh -f` with `compinit`, the script loads without an error and `quiz` and `fullmark` are in `$_comps`; no `zsh/zpty`. A shell that is not on the machine skips its tests, and the skip names the shell and says CI runs it; nothing else is skipped. **CI:** the `check` job in `.github/workflows/check.yml` installs zsh and fish before `npm run check` (`sudo apt-get install -y zsh fish`), so all four shells run on Linux on every push to `main`; the PowerShell tests run on Linux too if `pwsh` is on the runner, and are skipped otherwise. Do not install a shell on this laptop.
6. **The guides.** `guide/GUIDE.md` gains a short section on setting completion up (the four lines); `skill/SKILL.md` and `AGENTS.md` say nothing about it (completion is for people). The skill test still passes.
7. **The version** `1.2.0` (G10), then `npm run golden:update`: list every changed golden and show that each differs only in the version string and what follows from it, or explain it (task 1's help text).

### Done when

- On Windows, nothing else running: `npm run build`, then `npm run check` passes. Report each part's counts and times, the budgets, and `__complete`'s measurements.
- By hand in PowerShell and Git Bash, with the scripts loaded from a build in a temporary prefix (as in 7a, never over the owner's install): Tab completes a subcommand, a flag, a fixed value, a library quiz name with its title, and a quiz file. Quote what you saw.
- The shell smoke tests run PowerShell and Git Bash here and skip zsh and fish, saying so; the CI change is committed. zsh and fish are confirmed by the first CI run after the owner pushes, which the planner reads.
- No golden changes except those listed and explained; one commit per task or a few; explicit paths; the model's `Co-Authored-By` line; no push.

### Report

What was done per task, anything done differently and why, the library choice (task 4), the changed goldens, the counts, times and measurements, what could not be checked here, and any new gap (from G11) with a recommendation.

### Review (2026-11-23)

The agent's report (two hand-backs; the second corrects the first's "check still running") and the planner's review. Five commits, nothing pushed: `3d3e7a1e` (tasks 1, 2, 4), `bd2243cb` (tests), `634a2e57` (CI, guide, README), `09b3ec8e` (goldens), `8a7e0d2a` (version `1.2.0` and its goldens).

- **Done as briefed:** `quiz __complete` (`src/cli/complete.ts`) walks the commander tree once and asks a value source (`src/cli/complete-sources.ts`: templates, profiles, rule ids, library quiz names with titles, attempt stamps, sections), which loads in its own chunk only when a value needs it; any error is no candidates, `:default` and exit 0. `quiz shell-init` prints `shell/quiz.{ps1,bash,zsh,fish}` (20 to 33 lines) byte for byte; an unknown shell exits 2 naming the four. No library: `@bomb.sh/tab` 0.0.23 (MIT, 76 kB, 0.x) brings its own protocol and generated scripts, `tabtab` 3.0.2 (MIT, 2.5 MB, inquirer, no PowerShell) is worse; no new dependency. CI installs zsh and fish (after Playwright's `--with-deps` has run `apt-get update`), and a CI-only test fails if either is missing there. GUIDE.md section 15; the skill and `AGENTS.md` untouched.
- **Done differently:** the fixed values are declared on their options (`argChoices`, through `src/cli/choices.ts`) but still checked in the commands, not by commander's `.choices()`, which would print its own message, ignore `--json` and change the order of checks: kept. Help now adds "(choices: ...)" after descriptions that already name the values (G18). `__complete` is hidden by being dispatched before commander. PowerShell needs PowerShell 7 and the `.ps1` shim npm writes, and cannot stop its own file fallback after `:nofile`. `library publish NAME` ends with `:default` (it also takes a folder). `--flag=value` is left to the shell. A missing `FULLMARK_CONFIG` file gives no profile candidates, as `check` treats it.
- **Read by the planner:** the source diff (`complete.ts` in full, the four scripts, `choices.ts`, the CI step, the shell test's probes). A note for CI: zsh's `_describe` splits a value at `:`; no value source gives one today (names, ids, stamps, sections).
- **Goldens:** 22 new cases (`shell-init` 7, `complete` 15, 96 files). 9 changed for task 1 and 6: `top/help` and `top/no-command` list `shell-init`, `serve/help` and `top/help-build` show the declared choices, and 5 `guide` goldens end with section 15. 27 changed for the version: checked by the planner by masking the version, every removed line has its added twin; `library/publish-sync-git` differs only in the commit hash that follows. G15's cases did not move.
- **Check on Windows.** The agent's run: exit 1, the Firefox page budget at 3,271 ms then 1,035 ms (limit 1,000 ms), the rest passing. The planner's run, nothing else running: `npm run build`, then `npm run check`, **exit 0 in 28 min**. Biome 595 files; typecheck and knip pass; startup tests 4 passed (`__complete`'s budgets, from the agent: subcommand 24 ms over bare Node against 60 ms, a library quiz name 62 ms against 100 ms); Vitest 4,005 passed, 6 skipped (zsh, fish and the CI-only check; 166 files, 575 s); budgets on their retry, Chromium 1,096 then 412 ms, **Firefox 2,465 then 998 ms**; Playwright 885 passed, 567 skipped by design (18.0 min). G19.
- **By hand** (the planner), from `npm pack` installed into a temporary prefix (`fullmark 1.2.0`), a copy of the history library and an empty config. PowerShell 7, `TabExpansion2`: `quiz lib` gave `library` with its description; `quiz build --fo` gave `--fonts`; `quiz build --fonts ` gave `quiz | all | none`; `quiz library take ` gave `limits-and-continuity (Limits and continuity) | study-fixture (Study fixture) | tidy (Tidy notes)`; `quiz check ` gave `sub | notes.md` (not `data.txt`); `fullmark rules content.na` gave `content.names-control` with its line. Git Bash, the function called with `COMP_WORDS`: `library`; `quiz all none`; the three names; `notes.md sub`; `fullmark library gr` gave `grade`; `quiz shell-init ` gave the four shells. <!-- spellchecker:disable-line: a flag typed in part -->
- **Not checked here:** zsh and fish, whose scripts and probes have never run: the first CI run after the owner pushes is their test (G16), and the planner reads it. A real key press in a terminal.

**G18. Help repeats the values.** With the choices declared, commander adds "(choices: ...)" after descriptions that already list them: `--fonts` "quiz (the quiz's own), all or none (choices: "quiz", "all", "none")", `--ui-lang` "en or vi (choices: "en", "vi")". **Recommendation:** keep commander's line and drop the hand-written "X, Y or Z" where it only lists the values, keeping what explains them ("quiz, the quiz's own"); a help-goldens task in the next slice that touches the CLI.

**G19. The Firefox budget's margin.** Its retry measured 1,035 ms and 998 ms today against 707 to 807 ms in 7a and 7c, with no change to the page but the version string; the whole Playwright run was slower too (18.0 min against 12.5 to 15.0). A slower machine today is the likely cause, not shown. **Recommendation:** no change now; if it fails on its retry once more with nothing else running, measure Firefox alone and bring the numbers back before touching the limit.

## Slice 7c: the start screen's Appearance bar

**Briefed on 2026-11-20 from G12 and G13, decided by the owner (version `1.1.1`).** What the page does is written in TECHNICAL_DESIGN.md, section 8, "The look", under **Where they are**. The owner found it on the published shelf: the Font row exists only after Start, so on a timed quiz the choice costs exam time.

### Read first

- This plan: "Rules for every slice"; [STEP7-GAPS.md](STEP7-GAPS.md), G12.
- TECHNICAL_DESIGN.md, section 8: "The look" (all of it, **Where they are** included), the rows "Start screen and part picker" and "Focus mode", and the phone sizes ("Where pages work").
- The board `docs/mockup/boards/Start.dc.html`: the `<header>` (its status line, A− / A+ and the Appearance button) and the menu it opens; `Quiz.dc.html`'s Appearance button (line 49) and the menu it opens, which the top bar already follows. Archive/STEP2.md, slice 2g's "Read first", which left these out, and the slices that built the look (`src/page/Appearance.tsx`, `src/page/look.ts`).
- `src/page/App.tsx` (the start screen, around `fm-start`; the top bar), `src/page/dock.ts` and its test in `e2e/looks.spec.ts` (the step 7 dock bug), `e2e/textsize.spec.ts`.

### Tasks

1. **The bar.** The start screen gets the board's header: the status line on the left, A− / A+ and **Appearance** on the right. The status line shows what the board shows from what the page already carries; if the page does not carry something the board shows (whether the quiz is an exam, say), leave it out and report it rather than adding it to the page data. The bar scrolls with the start screen unless the board says otherwise; it is not the docked top bar.
2. **The same controls, not copies.** A− / A+ and the Appearance menu are the components the top bar uses, with the same accessible names, keys and closing (outside click, the button, Escape) and the same rules: under `look: locked` no Appearance and no light/dark toggle, A− / A+ always; the Font row lists only the embedded fonts (`--fonts`).
3. **One look.** A theme, font or size chosen on the start screen is the one in use after Start, and after Continue on a resumed attempt; both places show the current choice, and **Default look** resets it in both. Storage stays as it is (per quiz); when storage is blocked, the choice still holds for this page's life.
4. **Phones** (under 520 px): the bar keeps all its controls inside the screen, with 44 px targets, as the top bar does on a phone; the status line may wrap or shorten, the controls never leave the screen. If the board gives no answer for something here, take the top bar's phone rule and report it.
5. **Tests.** Playwright, both browsers: the bar is on the start screen; Readable and A+ chosen before Start are the font and size after Start (computed style, not only the pill's state), and after a reload on the start screen; `look: locked` shows A− / A+ and no Appearance; the menu closes three ways; no axe violations on the start screen with the menu open; at 360 px nothing overflows the screen. A unit test where the look logic is pure.
6. **The version** (G13), then `npm run golden:update`: list every changed golden and show that each differs only in the bundle and the version string, or explain it.
7. **Screenshots** in `docs/screens/7c/`: the start screen with the menu open in light and dark, the `locked` page, and a phone at 360 px.

### Done when

- On Windows, nothing else running: `npm run build`, then `npm run check` passes. Report each part's counts and times.
- By hand, from a build in a temporary prefix (never over the owner's install): `quiz build` a quiz with `--fonts all`, pick Readable and A+ on the start screen, press Start and see them hold; a `locked` quiz shows no Appearance. Quote what you saw.
- No golden changes except those listed and explained; one commit per task or a few; explicit paths; the model's `Co-Authored-By` line; no push.

### Report

What was done per task, anything done differently and why (task 1's status line, task 4's phone layout), the changed goldens, the counts and times, and any new gap (from G14) with a recommendation.

### Review (2026-11-21)

The agent was stopped at the session's end, during `npm run golden:update`, and left no report; the review reads its commits instead (`2e75de00`, `b62efff9`, `8202c302`) and finishes task 6.

- **Done as briefed:** the bar (`StartBar` in `src/page/App.tsx`), on the start screen before Start and after a reload with Continue, gone after Start; it scrolls with the page (`position: static`). A− / A+ and the Appearance menu are the top bar's components (`TextSize`, `AppearanceButton`, `AppearanceMenu`), so the names, keys, closing and the `look: locked` and `--fonts` rules are the same; one look store, so a choice holds across Start and Continue, and Default look resets both. Closing the start bar's menu on Start, so the docked bar opens without it. Tests: `e2e/startbar.spec.ts` (11 tests a browser: the bar, Readable and A+ before Start then after it and after a reload, a resumed attempt with Default look, `locked`, the Font row, three ways to close, axe with the menu open, 360 and 390 px free and locked with 44 px targets and no overflow at the largest size) and three unit tests in `test/page/look.test.ts`; screenshots in `docs/screens/7c/` (light and dark menus, `locked`, the phone bar and its menu); version `1.1.1` in all five places, `src/cli/brief.ts` included.
- **Done differently:** the status line holds only `version abcd`: the board's "Practice quiz" is not carried by the page (task 1 said to leave it out). The phone rule is the page's existing one (`max-width: 759px`, `store.ts`), not "under 520 px": on a phone the Appearance button is the icon alone, as on the top bar, and the bar keeps A− / A+ (the menu does not repeat them). The bar is drawn only for the page's first quiz; a page holds one quiz in v1 (COMMANDS.md, `build`), so nothing follows from it.
- **Goldens** (`d07ef96e`): the interrupted run's half-written files were overwritten by a fresh `npm run build` and `npm run golden:update` (776 cases passed, 153 s); nothing was deleted and no `exit.txt` changed. 31 changed: 25 pages differ only in the bundle, the CSP hashes, the version and the start bar's markup (checked by normalising those four; nothing else differs), and 6 text files only in byte counts (`253022` to `255410`; `250 KB` to `252 KB`), one publish commit hash that follows from the pages, and `top/version`.
- **Check on Windows**, nothing else running: `npm run build`, then `npm run check`, **exit 1**. Biome 587 files clean; typecheck and knip pass; startup test 2 passed; Vitest 3,929 passed, 3 skipped (163 files, 560 s); Playwright 883 passed, 567 skipped by design (step 6's 559 and the 7c screens spec), **2 failed** (13.3 min): `e2e/foot.spec.ts:18`, "390 x 844, on the start screen the button is at the window's bottom", in both browsers. The start screen of `tiny.md` at 390 × 844 is now 865 px tall: it was 800 px, and the bar is 65 px (44 px of slack). Not environmental: the bar is the cause. The agent did not run `npm run check`, so it was not seen. G14.
- **By hand**, from `npm pack` installed with `npm install -g --prefix` into a temporary folder (`fullmark 1.1.1`), `quiz build map.md --fonts all`, the page driven in Chromium: Readable and A+ picked on the start screen gave `Lexend`, 19 px, the pill `1.12×`; after Start, `Lexend`, 19 px, `1.12×`, and no start bar. A `look: locked` build: 0 Appearance buttons, A+ there. Seen in a screenshot: the bar sits 12 px below the window's top (`.fm-quiz` has `padding-top: 12px`), where the board draws it flush. G14.

**G14. The start bar makes the start screen scroll at 390 × 844.** `e2e/foot.spec.ts` expects a short quiz's start screen to fit the window from 390 px up; with the bar it is 21 px too tall, as it already was at 360 px. The design asks only that the ⓘ button be at the foot and never over content, which still holds (TECHNICAL_DESIGN.md, section 3 and section 8, "Phone sizes"); fitting the window was the test's assumption. Making the bar fit would need more than the bar: flush with the top (−12 px) and a tighter phone padding (65 to 45 px) still leave 1 px over. **Recommendation:** accept that a phone's start screen may scroll: the test keeps "fits the window" for desktop and checks the button at the page's end on all three phones; and put the bar flush with the window's top, as the board draws it (no `.fm-quiz` top padding before Start). One goldens round for the padding (the 25 pages' bundle, as above).

**After G14** (decided 2026-11-21 as recommended; written into TECHNICAL_DESIGN.md, section 8, **Where they are**):

- **The change** (`10c759e7`): the start phase's 12 px top padding is gone, so the bar is flush with the window's top (`e2e/startbar.spec.ts` checks it); `e2e/foot.spec.ts` asks a short quiz's start screen to fit the window on desktop only, and on the phones checks the ⓘ button at the page's end. 28 goldens: 25 pages only in the stylesheet and its CSP hash, 3 text files in byte counts and the hash that follows.
- **A regression it showed** (`fd2dec97`): the next check failed `e2e/sidebar.spec.ts:235` in both browsers (question 1 not in view after Start and Back at 700 × 940). The page kept the start screen's scroll after Start, and Start sits at the screen's end: 1.1.0 landed at scrollY 42 by luck, 7c's first version at 203 (question 1 half under the dock), and with the bar flush scroll anchoring threw it to 4852, the quiz's end. Start now scrolls to the top before the questions render; the start bar test checks `scrollY` is 0 after Start. Fixed without a gap: the existing test already expected question 1 in view. Continue is not changed: it sits at the start screen's top. 28 goldens only in the bundle and its hash.
- **A runner race, seen once:** an interrupted `golden:update` was run again; one run gave `publish-sync-unchanged` "2 updated" and `publish-sync-swap` a new folder, because those cases copy `publish-sync/files/shelf` (another golden's output) as input, and that run read it before it was regenerated. The next run gave neither. Not a behaviour change; a golden that takes another's output depends on order. **G15**, below.
- **Check on Windows**, nothing else running: `npm run build`, then `npm run check`, **exit 0 in 23 min**. Biome 587 files; typecheck and knip pass; startup test 2 passed; Vitest 3,929 passed, 3 skipped (163 files, 506 s); budgets passed on their retry (Chromium 1,117 then 366 ms, Firefox 1,739 then 707 ms, limit 1,000 ms; a cold first measurement as before); Playwright 885 passed, 567 skipped by design (14.2 min). Screenshots in `docs/screens/7c/` retaken: the bar is flush.

**G15. Goldens that copy another golden's output.** `publish-sync-unchanged` and `publish-sync-swap` take `test/golden/library/publish-sync/files/shelf` through `copy.txt`, so after a bundle change a single `golden:update` can write them from the stale shelf; a second run fixes it. **Recommendation:** build their shelf in the case itself (a first `publish` step, or a fixture shelf under `test/fixtures/` refreshed by the runner before the cases), so no case reads another's output; a task in the next slice that touches the runner.
