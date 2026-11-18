# Step 4: the library

## Handoff (2026-11-16): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 3 ([archive/STEP3.md](archive/STEP3.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox, the screens when there are any) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again in each step; outside the plan one is cited with its step ("step 4, G3"; "STEP4.md, G3" in a code comment), so step 3's G1 to G148 ([archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)) are never confused with these. Decided ones move to [STEP4-GAPS.md](STEP4-GAPS.md).

**Run faster than step 3** (for the owner to confirm with this plan): the design's open questions are raised **together, now** (G1 to G18, all decided on 2026-11-18), not one per slice; slices are fewer and larger, since the library is mostly files and history with little new on screen; any visual polish waits for the last slice. The screens are reproducible (TECHNICAL_DESIGN.md, foundation 8), so a slice's screen diff shows only what it changed.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-16); G8 to G15 added (2026-11-18); the owner decided G4 to G6 and G8 to G14 as recommended (2026-11-18), written into COMMANDS.md and TECHNICAL_DESIGN.md; G3 extended and G16 raised on the owner's questions; G7 and G15 drawn on the canvas; G18 raised and decided as recommended (2026-11-18), written into COMMANDS.md ("Terminal style") and TECHNICAL_DESIGN.md ; G1 to G3, G16 and G17 decided as recommended (2026-11-18), written into COMMANDS.md, TECHNICAL_DESIGN.md and USER_DESIGN.md ; the CLI boards approved (G7, G15) and written into COMMANDS.md (2026-11-18) | this file |
| 4a | built and reviewed (2026-11-18); G19 and G20 decided | `24d99e0`, `ac90c6b` |
| 4b | built and reviewed (2026-11-18); G21 decided, built first in 4c | `c070213`, `eb89812` |
| 4c | built and reviewed (2026-11-18); G22 decided, built first in 4d | `6a72610`, `9ed801f`, `3432db5` |
| 4d | built and reviewed (2026-11-18); G23 to G26 decided (2026-11-19), G25 and G26 built first in 4e | `ac3301f`, `da851a0`, `75be49c`, `6df65f2` |

### Next

1. The planner writes **4e**'s brief (`grade`, `stats`), with G25 and G26 first (G23 and G24 need no code: the docs follow the build).
2. The owner approves it; one implementing agent (Sonnet) builds it.

## Goal

The library: one folder under git that keeps each quiz's versions, the attempts at them and their reports, and the commands over it. TECHNICAL_DESIGN.md section 12, step 4: "Library: init, register, take (with `--section` and `--missed`), replay and the rest"; COMMANDS.md, "Library commands", every command up to and not including `publish` and `import`; USER_DESIGN.md, 4.4.

**Done when** (section 12): **history-based tests pass.** Read here as (G6): a test helper builds a library with a scripted history (registered versions, attempts on old and new versions, grades and regrades, a question changed after it was missed, an essay left ungraded), and the goldens of `list`, `info`, `stats`, `take --missed` (the plan it would serve) and `replay` over it are reviewed and committed. **And:** every library command has a contract test run as a subprocess with `--json`; every command that changes the library commits once and takes the lock (foundation, "Library and shelf writes take a lock"); `check` and the core commands still load nothing from `src/library/` (the command-graph test); `npm run samples` gains a scripted library and a line for `library take`, `library grade --web` and `library replay`, and the owner has tried them.

**Not in step 4:** `library publish` and `library import`, and shelves beyond the reserved `shelves` field and the `public` column (step 5); moving the owner's 0.x history in (step 6); `--background`; the proposals in `docs/design/proposals/`, unless the owner picks one.

## Rules for every slice

Step 3's rules hold ([archive/STEP3.md](archive/STEP3.md), "Rules for every slice", extending step 2's): goldens are the contract; a failure is environmental only when its cause is shown; no real network or real timers in unit tests; a command loads only what it uses; shared pages carry no server code; commits end with the `Co-Authored-By` line of the model that made them, with explicit paths only (never `git add -A`, `-a` or `--amend`); the implementing agent never pushes. Added for step 4:

- **`src/library/` uses core's public API only**, and nothing in `core`, `build` or `serve` imports it (section 7; the lint boundary is added in 4b).
- **Git is real in tests, in a temp folder**: a library test runs real `git` in a fresh temporary folder with a fixed author, committer and date (`GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`), so commits are reproducible. Failure cases (no `git` on the path, a commit that fails) use an injected runner, never a broken machine.
- **The clock and the config folder are injected**: no test reads the owner's real `config.toml` or library (`FULLMARK_CONFIG`, which `check` already reads, points at a temp file in every test).
- **Which tests a slice runs** (G20): every slice runs `npm run build`, the typecheck, Biome, knip and all of Vitest (the startup tests alone first), whatever it touches. Playwright, in Chromium and Firefox, runs only for a slice that touches the page, the server, a form or a built page (`src/page/`, `src/serve/`, `src/build/`, the form folders): **4d**, **4e** and **4f**, not 4b or 4c. The last slice runs everything before the step is accepted. While building, an agent runs the tests it works on; the review runs the set above.
- **Every write is atomic, under the lock**, and a test kills a writer mid-way (or simulates it) and checks the library is the old state or the new one.

## Gaps

The design leaves these open. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands.

G1 to G26 are decided ([STEP4-GAPS.md](STEP4-GAPS.md)). New ones found while building are added here from G27.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **4a** | `content.names-control` (step 3's G148, decided): the rule, the word lists from the catalogs, the tests, every example passing | nothing open |
| **4b** | The store: config read and write (the `library` key), `library init`, `status`, `path`, `library.toml` (G2), the layout (G1), the lock, the git runner (G3), the lint boundary; contract tests | G1 to G3 |
| **4c** | `library register` (one file, several, `--update`, `--build-file`, `check.json`, surveys refused), `list` (with `changed`, `ungraded`, the `public` column empty), `info`; the history helper started (G6) | 4b |
| **4d** | `library take` (with `--section`, `--missed`, `--focus`, resume; G4, G5), `replay` | 4c |
| **4e** | `library grade` (with `--grades`, `--json` and `--web`, every grades file kept), `stats` | 4d |
| **4f** | `share`, `template add`, `rename`, `rm`, `review` (G16); the history goldens complete; the samples' library; acceptance | 4e |

Each slice's brief is written here when the one before it is reviewed; 4a's can be written as soon as the plan is approved, since it needs nothing open.

## Slice 4a: `content.names-control`

**Approved by the owner on 2026-11-18.** Step 3's G148, decided: TECHNICAL_DESIGN.md, section 5, the rule catalogue's row for `content.names-control`, and QUIZ_SYNTAX.md, section 8, "Write for the page and the paper alike", say what is wanted. This slice is core only: no library code, no page change.

### Read first

- This plan: "Rules for every slice"; [archive/STEP3-GAPS.md](archive/STEP3-GAPS.md), G146 to G148 (the texts found by reading that this rule would have caught).
- TECHNICAL_DESIGN.md, section 5: "Rule catalogue (v1)", "Ignoring one finding", "Rules for agents"; QUIZ_SYNTAX.md, section 8, and the `check-ignore` attribute (section 6).
- Code: `src/core/rules/quality.ts` (how a quality rule is declared: `id`, `level`, `summary`, `why`, `example`, `fix`, `options`, `run`; `explanation.short` is a close model), `src/core/ir.ts` (where each text a learner reads lives, and its line), `src/core/i18n/en.ts` and `vi.ts` (the control labels: keys `check`, `submit`, `flag`, `hint`), `test/rules/quality.test.ts` and `test/rules/registry.test.ts`, `test/templates.test.ts`.

### Decided for this slice

- **The word lists live next to the catalogs**, in `src/core/i18n/controls.ts`: for each `Lang`, (a) the control labels, **read from the catalogs' values** (`en.check`, `en.submit`, `en.flag`, `en.hint` and the `vi` ones: today "Check", "Submit", "Flag", "Hint"; "Kiểm tra", "Nộp bài", "Đánh dấu", "Gợi ý"), never copied as strings, so a renamed button renames the rule's word; (b) the screen words: `en` "button", "click", "tap", "press", "sidebar", "scroll"; `vi` "nút", "bấm", "nhấn", "thanh bên", "cuộn"; (c) the phrases left alone because they are ordinary words there: `vi` "nhấn mạnh" (emphasise), "cuộn dây" and "cuộn cảm" (a coil, an inductor, which the signals quizzes use). The object is typed `satisfies Record<Lang, …>`, so a language without lists is a compile error.
- **Matching.** Text is NFC and matched case-insensitively. A screen word matches as a whole word, in `en` with its `-s`, `-es`, `-ed`, `-ing` forms and a doubled consonant (`tapped`, `tapping`, `pressed`); in `vi` as a whole sequence of syllables (bounded by a non-letter on each side). A control label matches only where it reads as a control: **in bold** (`**Submit**`, `__Gợi ý__`, the label being the whole bold run, ignoring a trailing `:`), or directly followed by "button" (`en`) or directly after "nút" (`vi`). The lists used are the quiz's `lang`'s only.
- **What is read:** every text a learner reads: the quiz `description`, section intros, question prompts, choices (and the items of `matching` and `ordering`), hints, explanations, rubric criteria and their descriptions, and `materials` sheets. Not titles, ids, `sample_answer` or keys. Before matching, fenced code, inline code and maths (`$…$`, `$$…$$`) are removed, so `` `click()` `` or a variable named `press` never matches.
- **One finding per text** (one prompt, one choice, one hint …), on the line of the first match, so a paragraph that says "click" three times warns once. The message is the catalogue's, exactly: "names a control of the page; the paper has none". The fix names the word found: `reword "click": say what it is, not which control shows it (QUIZ_SYNTAX.md, section 8)`.
- **Level and options:** `warning` in every built-in profile, no options. `check-ignore="content.names-control" because="…"` on the question silences it, as for any quality rule.
- **The rule's own `example`** (for `quiz rules`) is a single question whose hint says "Click **Check** to see the answer."
- **Every example and template passes with no `content.names-control` finding.** If one does not, reword its text (say what the thing is, not which control shows it), and list each change in the report; the built pages' goldens change with it, counted.

### Tasks

1. **The rule, its lists and the tests** (one commit):
   - `src/core/i18n/controls.ts` and the rule in `src/core/rules/quality.ts`, registered as every quality rule is.
   - Tests in `test/rules/names-control.test.ts`: for **each** entry of each list, in each language, one sentence it flags and one it leaves (the leaving one for a label is the label as an ordinary word: "Check your units.", "Kiểm tra lại đơn vị."); each kind of text above flagged once; code, inline code and maths ignored; a bold label flagged and the same word unbolded left; "the Submit button" and "nút Nộp bài" flagged; a `vi` quiz not flagged by an `en`-only word ("click" in a `vi` quiz is left), and the reverse; the three `vi` phrases left; one finding for three matches in one text; `check-ignore` silences it; a catalog label changed in a test double changes what is matched.
   - `test/templates.test.ts` (or the examples' test): every example and template has no finding of this rule.
2. **Goldens** (same commit): `npm run golden:update`; the `quiz rules` goldens gain the rule, and any example reworded changes its page. Count and explain every golden that changes; no other change is expected.
3. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice: what was built, the commits, the tests and goldens counted, every example text reworded, and anything done differently.

### Done when

`npm run build` and `npm run check` pass in Chromium and Firefox (or Chromium only, saying Firefox was not run, when it is not installed); `quiz check` on every example and template gives no `content.names-control` warning; `quiz rules --all` lists the rule.

### Review (2026-11-18)

**Built** in `24d99e0` (`src/core/i18n/controls.ts`: the lists, labels read from the catalogs through `buildControls`; `src/core/rules/names-control.ts`: the matching; the rule registered in `quality.ts`; materials sheets checked in `src/cli/load.ts`, since a rule sees only the quiz; 38 tests in `test/rules/names-control.test.ts`, the two fixtures, the examples and template test) and `ac90c6b` (the examples test skips a folder with no `quiz.md`).

**Checked by the planner:** `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3159, Playwright 831 passed and 519 skipped in Chromium and Firefox, tsc, Biome and knip clean. Goldens: 19 changed, all expected: `check/quality-every-fixture-json` and `check/several-strict` gain the two fixtures; 17 `rules/*` goldens gain the rule's line. No page golden changed; no example or template needed rewording. **By hand**, on an `en` and a `vi` quiz: seven texts flagged once each (description, intro, choice, bold `**Hint:**`, explanation, a sheet under its own file); `check-ignore` silences its question; inline code and maths left; in `vi`, "nhấn mạnh", "cuộn dây", "cuộn cảm" and the English "Click" left, "Bấm **Nộp bài**" flagged; under `exam` all seven are errors, sheets included, under `draft` info.

**The agent's flake, cause shown:** the test of `examples/build.toml` (`test/build/build-file-cli.test.ts`) builds into the real `examples/site/` while the examples test lists `examples/` in parallel; skipping a folder with no `quiz.md` is the right fix. The agent's startup failure (193 ms against 180) was inside the full Vitest run, under load; `npm run check` runs the startup tests alone first, where they pass.

**Done differently, accepted:** a question's `check-ignore` no longer hides a finding in another file (a bug found here: `applyIgnores` matched by line alone; fixed in `src/core/rules/check.ts` with a test); passages, `fields` labels, `scale` labels and a choice's `input` prompt are read too (text a learner reads); when several words match in one text the earliest is named; a `description` finding is on the `description:` key's line. **Not accepted yet:** the levels in `draft` and `exam`, G19.

**Gaps:** G19 and G20, decided by the owner on 2026-11-18 as recommended.

## Slice 4b: the store

**Approved by the owner on 2026-11-18.** G1 to G3, G8, G11, G13 and G18 are decided and written into COMMANDS.md ("Library commands": "How library commands print", "The library folder", "Git", `init`, `status`, `path`; "Terminal style"; "Environment") and TECHNICAL_DESIGN.md (section 7, "Library and shelf writes take a lock"; section 11). This slice builds the store every later library command stands on, and the three commands that need nothing else: `library init`, `library status`, `library path`. No quiz is registered yet; `register` is 4c. Tests per G20: no Playwright.

### Read first

- This plan: "Rules for every slice" (step 4's, with G20); STEP4-GAPS.md, G1, G2, G3, G8, G11, G13, G18.
- COMMANDS.md: "Conventions" (exit codes, common options, "Terminal style", "Paths in output", "Names, ids and stamps", "Environment", the files table), and "Library commands" from its top to the end of `quiz library path`.
- TECHNICAL_DESIGN.md, section 7: "Architecture" (the layers; `src/library/` uses core only), "Files, formats and safe writes" and the lock; section 11: "Contract tests", "Safe writes".
- The CLI boards for `init`, `status` and `path` (docs/mockup/boards: LibrarySetup, LibraryStatus, LibraryTidy; LibraryStyleMiddle for the `simple` style), which COMMANDS.md's Output blocks transcribe.
- Code: `src/cli/main.ts` (how a command is wired, its lazy `import()`), `src/cli/config.ts` (the `Machine`, `userConfigPath`), `src/core/config/parse.ts` (the user config's parse; only `[profiles.*]`, `fonts` and `[brief]` are read today), `src/cli/atomic.ts`, `src/cli/fail.ts`, `src/cli/exit-codes.ts`, `src/cli/paths.ts`, `src/cli/seed.ts` (the `FULLMARK_TEST_SEED` pattern), `src/core/hash.ts`, `src/cli/load.ts`; `test/cli-graph.test.ts`, `test/core-boundary.test.ts`, `test/golden/runner.ts` (`cmd.txt`, `copy.txt`, `env.txt`), `test/helpers/cli.ts`.

### Decided for this slice

**Layers.**
- `src/library/` is the store: the layout's paths, `library.toml`'s schema, reader and writer, the lock, the git runner. It imports `node:*` and `src/core/` only, never `src/cli/`, `src/build/`, `src/serve/` or `src/page/`. Nothing in `src/core/`, `src/build/` or `src/serve/` imports it. A test, `test/library-boundary.test.ts`, checks both directions, as `core-boundary.test.ts` does for core ("the lint boundary").
- The commands are `src/cli/library-init.ts`, `library-status.ts`, `library-path.ts`, wired in `main.ts` under a `library` command group, each by lazy `import()`. What needs the CLI's own helpers (the loader, config, output) stays in `src/cli/`; the version hash check of `status` uses `loadQuiz`, so it lives in `library-status.ts`.
- `test/cli-graph.test.ts`: `check`, `rules`, `ids`, `grade`, `inspect`, `new`, `template`, `stats` and `--version` never load `src/library/`; `library path`, `library status` and `library init` never load the page builder, the page renderer or `src/serve/`.

**The machine config.**
- `config.toml` gains three keys, validated by `parseConfig` for the user config with the file and line of a bad value, as `fonts` is: `library = "PATH"` (a string; a relative path is relative to the config file's folder), `git = "PATH"` (a string), and `[terminal]` with `style = "simple" | "boxed"`. An unknown key in `[terminal]` is an error, as in `[brief]`.
- **Where the library is:** `FULLMARK_LIBRARY` (relative to the working directory) when set, else `library` in `config.toml`, else none (G8: every library command exits 2, "no library", fix `quiz library init PATH`; `path` too).
- **Writing the config** (only `init`): the file's text is kept as it is, comments and order included; a top-level `library = …` line is replaced, or `library = "ABSOLUTE PATH"` is inserted above the first table header (at the end when there is none). The file and its folder are created when missing. Atomic, through `writeFileAtomic`.

**The folder and `library.toml`.**
- `src/library/layout.ts` names every path of COMMANDS.md's tree (`quizzes/<id>/versions/<hash>/`, `results/`, `grades/`, `reports/`, `review.json`, `progress/`), so later slices never build a path by hand. A version folder is named by the quiz hash in full; output shows its first 4 characters (as `inspect` shows `short`), more when two versions of a quiz share them.
- `library.toml`: `format = "fullmark-library"`, `version = 2`, `created` (ISO, local offset), then `[quizzes.<name>]` tables sorted by name with the fixed comparison, each `id`, `title`, `source`, `current`, `versions = [{ hash, added }]`, `shelves = []`. A zod schema in `src/library/index-file.ts`; the reader returns the index or every problem with its line; the writer writes the same bytes for the same index (keys in a fixed order, a final newline), atomically. 4b writes it empty; its tests cover a quiz table, for 4c.
- `.gitignore`: `.fullmark.lock`, `quizzes/*/progress/`, `*.tmp`.
- **A foreign folder:** a `library.toml` with another `format` or `version` (a 0.x library has `version = 1` or no `format`) is refused by every command, "not a fullmark 1.0 library", the decision of 2026-11-16 (STEP4-GAPS.md, first entry).

**The lock** (`src/library/lock.ts`). `.fullmark.lock` in the root, created with exclusive create (`wx`), holding `{"pid", "command", "started"}` as JSON. A second writer polls every 100 ms for up to 10 s, printing the dim waiting line once, then exits 2 with COMMANDS.md's "the library is busy" error. A lock whose process is not running is stale: removed, with a note, and the command goes ahead. Released in a `finally`, commit included. The clock, the sleep and "is this pid alive" are injected; tests never wait 10 real seconds. `status` takes no lock (it only reads); it reports a stale lock as a note and removes it, as the approved board says.

**The git runner** (`src/library/git.ts`), G3 exactly:
- `execFile` of the `git` from `config.toml`, else the one on the path; `-C ROOT`; names after `--`. Injected for tests of failure (no git, a commit that fails); real `git` otherwise.
- `commit(paths, message)`: `git add -A -- PATHS`, then `git commit -m MESSAGE -- PATHS`, so only those paths are committed (new, changed or deleted), and the user's own changes stay out. When `git config user.name` or `user.email` is unset in the repository, that one command gets `-c user.name=fullmark -c user.email=fullmark@localhost`. Returns the short hash (`git rev-parse --short HEAD`). A failed commit is a warning (the files stay written; the exit is the command's).
- `identity()`, `uncommitted()` (from `git status --porcelain`, counting paths), `remote()` (the first of `git remote`), for `init` and `status`.
- **Tests** run real `git` in a temporary folder with `GIT_CONFIG_GLOBAL` at a file the test writes (`init.defaultBranch = main`, and an identity or none, per case), `GIT_CONFIG_NOSYSTEM=1`, and fixed `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` (TECHNICAL_DESIGN.md, section 11), so hashes are the same on every run.

**The clock.** `FULLMARK_TEST_NOW` (an ISO time with offset), read only in `main.ts`, as `FULLMARK_TEST_SEED` is, sets the clock of the library commands for subprocess tests; in-process tests pass `now` through the `io`.

**`quiz library init [PATH] [--force] [--no-git] [--json]`.** Default `PATH`: the working directory.
- A missing folder, an empty one, or one holding only `.git` (an existing repository whose root it is): set up: `library.toml`, `.gitignore`, `quizzes/`, then `git init -q` unless `--no-git` or no repository is wanted, then the first commit `fullmark: init`. A folder holding only `.git` keeps its repository (adopted).
- A folder with a 1.0 `library.toml`: adopted, nothing written but the config, no commit (`"status": "adopted"`).
- Anything else: refused (exit 2), "not empty and is not a library (N files)", fix "choose an empty or new folder". A folder inside another repository but not its root gets its own repository, with a note that the outer repository should ignore it.
- Another library already in the config: exit 2, "a library is already set: PATH", fix "add --force to switch"; `--force` switches. The same library again: `adopted`, exit 0.
- No `git` found: as `--no-git`, with a warning. No identity: COMMANDS.md's note with the two `git config` commands.
- Records the library in `config.toml` (absolute path). Takes the lock once the folder exists. Output and `--json` exactly as COMMANDS.md's.

**`quiz library status [--plain] [--json]`.** G11 and COMMANDS.md's Output: the facts block (library and where it was found, config, git, who commits, counts, checks), then problems and notes in `check`'s issue format, then the verdict line. Problems (exit 1) and notes (exit 0) exactly as COMMANDS.md lists them; the version hash check loads each version's quiz with `loadQuiz` and compares `quizHash` with the folder's name; "orphan files" are files under `quizzes/` outside a known quiz's layout, and files at the root other than `library.toml`, `.gitignore`, `.git/`, `fullmark.toml`, `.fullmark.lock` and `README.md`. The library's `fullmark.toml` is parsed with `parseConfig` (`project`). `--json` is G11's shape. Exit `2` with no library.

**`quiz library path [NAME]`.** The library's folder, or a quiz's (`quizzes/<id>`, looked up by name, then id, G13), absolute, never coloured, nothing else on stdout. Unknown quiz: exit 2 with the near names. No library: exit 2.

**Output and the terminal style** (G18). `src/cli/table.ts` draws what COMMANDS.md's "Terminal style" calls `simple`: aligned columns, a shaded header row, scores by band, coloured tags, `problem` and `note` badges, `dim`, `bold`; colour only on a terminal without `--plain` or `NO_COLOR`. `[terminal] style = "boxed"` is read and validated but drawn as `simple` until slice 4f. The helper is used by `status` here, and by `list` and the others later; `check`, `inspect` and `stats` move onto it in 4f, not now.

### Tasks

1. **The store** (one commit): `src/library/layout.ts`, `index-file.ts`, `lock.ts`, `git.ts`; the config keys; `FULLMARK_TEST_NOW`; unit tests: the index's round trip (same bytes), every reader problem with its line, the lock (wait, timeout, stale, release on throw, the waiting line once), the git runner against real git (commit only the given paths with an unrelated staged change left alone; fallback identity on that commit only, git's config untouched; a deleted path committed; no git; a failing commit as a warning), the config writer (comments and order kept, the line replaced or inserted, a new file), a writer killed mid-way leaves the old `library.toml` or the new one (simulated, as `atomic.ts`'s tests do), the boundary test.
2. **The commands** (one commit): `init`, `status`, `path`, `table.ts`; the cli-graph cases; golden cases under `test/golden/library/` for every Output block in COMMANDS.md for these three commands, in plain text and `--json`, plus no library, a malformed `config.toml` key (file:line), a foreign `library.toml`, `init --force`, `init --no-git`, the same library again, `path NAME` unknown; git-state cases (uncommitted, remote, no identity, inside another repository) as subprocess tests in a temporary folder with the git environment above, comparing the output with expected text. A colour test for `table.ts` with a terminal `io`.
3. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice, with every golden added or changed counted, and anything done differently.

### Done when

`npm run build`, the typecheck, Biome, knip and Vitest pass (G20: no Playwright for this slice); `quiz library init` in a new temporary folder, then `status` and `path`, print COMMANDS.md's text; the boundary and command-graph tests hold.

### Review (2026-11-18)

**Built** in `c070213` (the store: `src/library/layout.ts`, `index-file.ts`, `lock.ts`, `git.ts`; the config keys `library`, `git` and `[terminal]` in `parseConfig`; `src/cli/config-write.ts`; `FULLMARK_TEST_NOW`; the boundary test) and `eb89812` (`library init`, `status`, `path`; `src/cli/table.ts`; `src/cli/library-common.ts`; 55 goldens; the command-graph cases; 13 subprocess tests of git states).

**Checked by the planner** (G20: no Playwright): `npm run build`, the typecheck, Biome and knip pass; Vitest: the startup tests 2 (alone, first), then 3293 in 127 files. Goldens: 55 added under `test/golden/library/` (23 `init-*`, 23 `status-*`, 9 `path-*`), each an Output block of COMMANDS.md or a case the brief named; 2 changed, `top/help` and `top/no-command`, which gain the `library` line. **By hand**, in a temporary folder with a temporary `config.toml` and git config: `status` with no library exits 2 with COMMANDS.md's error; `init lib` writes `library.toml`, `.gitignore`, the commit `fullmark: init` as `fullmark <fullmark@localhost>` (git's config untouched), the identity note, and `library = "…"` above the first table with the comment and order of `config.toml` kept; `status` prints the board's facts and notes, a stray file as `library.orphan`, exit 0; `path` and `path nope` as COMMANDS.md; a second `init` elsewhere exits 2, "a library is already set". The `git` runner commits only the paths it is given.

**Done differently, accepted:** two older tests that used a `[library]` table in `config.toml` now use `[shelves]` (`library` is a string now; step 5 gives `[shelves]` a meaning, and those tests change then); `writeIndex` takes the atomic writer as a parameter, since `src/library/` may not import `src/cli/`; `status`'s `Checks` row only when healthy (as both COMMANDS.md samples); the `library.hash` fix names the full hash so it can be pasted; `status`'s identity note has the `user.name` line only, as the board; codes the design did not name (`library.missing`, `library.index`, `library.version-missing`, `config.invalid`; notes `git.no-repository`, `git.unavailable`, `library.orphan`); a `--json` error may carry `"fix"`; a missing `config.toml` named by `FULLMARK_CONFIG` is not an error for library commands (`init` creates it); the waiting line on stderr; `TZ=UTC` in the goldens' environment, so `created` is the same on every machine.

**Gaps:** G21, decided by the owner on 2026-11-18 as recommended.

## Slice 4c: `register`, `list`, `info`

**Approved by the owner on 2026-11-18.** G1, G2, G4, G5 (the `changed` mark only), G12, G13, G16 (`flagged`, the stored review on `--update`), G17 (the warning), G21 and the approved boards are written into COMMANDS.md: "How library commands print", "The library folder", `quiz library register`, `list`, `info`. This slice fills the library: versions in, and the two commands that read them. Tests per G20: no Playwright.

### Read first

- This plan: "Rules for every slice"; 4b's section and review; STEP4-GAPS.md, G1, G2, G4, G12, G13, G16, G17, G21.
- COMMANDS.md: "Several files", "Names, ids and stamps", "Terminal style", "Library commands" from its top through `quiz library info`, and `quiz check`'s options (`--profile`, `--config`, `--strict`, `--review`) and `quiz build`'s build file.
- TECHNICAL_DESIGN.md, section 4 ("`results-v2`", "`review-v2`"), section 5 ("Where the config comes from", "In the library"), section 7 (safe writes, the lock).
- The boards LibrarySetup (`register`) and LibraryList, LibraryInfo, which COMMANDS.md's Output blocks transcribe.
- Code: 4b's `src/library/` and `src/cli/library-*.ts`, `src/cli/table.ts`; `src/cli/check.ts` (`checkFile`, `FileOutcome`: the issues, the resolved profile and the loaded quiz in one call), `src/cli/load.ts` (`LoadedQuiz`: the text, assets, sheets and hash), `src/cli/build-file.ts` (`planBuildFile`), `src/core/config/resolve.ts` (`ResolvedProfile`), `src/core/inspect.ts` (`summarise`), `src/core/stats/` (what `stats` computes from reports), `src/core/slug.ts`, `src/core/hash.ts`; `test/golden/stats/` and `test/fixtures/stats/` (results and reports to build histories from).

### Decided for this slice

**First, G21:** `init` takes the lock as soon as the folder exists (creating it when missing) and decides what the folder is under the lock. A test starts two `init`s of one new folder together: one `created`, one `adopted`, one commit.

**A version in the library.**
- `register` checks each file with `checkFile` (its profile, config, `--strict`, `--review`; the config looked up from the file, then from the library root, as COMMANDS.md says) and stores the version from the `LoadedQuiz` it returns: the source under its original file name, every asset and sheet at its relative path, `brief.yaml` when one sits next to the source, and `check.json`. Nothing is read twice, so what is stored is what was checked and hashed.
- **`check.json`** is the resolved profile, so a later re-check (`template add` in 4f) needs no config: `{"format": "fullmark-check", "version": 1, "profile", "chain", "rules": [{"id", "level", "options"}], "checks", "allowIgnore"}`, the rules sorted by id, written with sorted keys, two-space indent and a final newline. A reader in `src/library/` turns it back into a `ResolvedProfile`; a test checks a quiz under the stored file and under the original config and gets the same issues.
- **Written safely:** each version is written into `quizzes/<id>/versions/.<hash>.<8 hex>.tmp/` and renamed to `<hash>/` when complete; `library.toml` is written last; all under the lock, then one commit. A folder left by a killed run (`*.tmp`) is removed by the next `register`. A test kills a register mid-way (simulated) and finds the library as it was before.
- **The quiz table:** `name`, `id`, `title`, `source` (the absolute path of the file registered), `current`, `versions = [{ hash, added }]`, `shelves = []`.

**What a file is, against the library** (in this order, for each file):
1. Check errors, or a survey (`library.survey`): refused.
2. Its `source` path is a quiz's `source`: the same hash as that quiz's current version is `unchanged`; another hash is refused, "registered before as NAME and edited since", fix `quiz library register FILE --update NAME`.
3. With `--update NAME`: its `id` must be NAME's (`library.id-mismatch`); the current hash is `unchanged`; a hash among NAME's earlier versions makes that version current again (no new folder, no new entry in `versions`; the output says "an earlier version, now current again"); else a new version.
4. Without `--update`: its `id` already in the library is `library.id-taken` (G12's two fixes); else a new quiz, named `-n NAME` or its slugged title, or its `id` when the title slugs to nothing. A name must match `ID_FORMAT` (`src/core/slug.ts`) and must not be another quiz's name or id (G13): "name taken", the suggestion `NAME-2` (or the next free number).
- **Several files:** all or nothing (COMMANDS.md): every file is checked and every name resolved before anything is written, including two files of the batch with one name or one id; then one commit, `fullmark: register a, b, c` (the names sorted). Globs, sorting, the `[3/12]` line as "Several files" says. `-n` and `--update` with several files exit 2.
- **`--build-file BUILD [FILE...]`:** the files of `planBuildFile`'s entries, reading only `files`, `profile`, `config` and `strict`; a file in several entries with different values of those exits 2; `FILE`s narrow it to those entries.
- **On `--update`:** the quiz's stored `review.json`, when there is one, is passed as `--review` (an explicit `--review` replaces it), so `review.fix` and `review.drop` refuse the version (G16); a saved attempt in `quizzes/<id>/progress/` on the old version gives the G17 warning (exit still 0; 4b's layout names the folder; a test writes a progress file by hand).
- **Output and `--json`** exactly as COMMANDS.md (the Output block and the `--json` row), with `committed`.

**`list`** (G7, COMMANDS.md's Output and field table).
- One row per quiz, every field of the table always present. Content fields (`kind`, `lang`, `profile`, `tags`, `types`, `questions`, `points`) from the current version: `summarise` of the stored source, the profile from `check.json`. `added` and `updated` from `versions`. `shelves` from the table, `[]` in step 4.
- **Attempts** come from `quizzes/<id>/results/` and `reports/`: an attempt's score is its newest report's when there is one, else the attempt graded on the spot against the version it names, as `quiz stats` grades a results file (so a pending essay leaves it with `*`). `score` is the last attempt's percent, `best` the highest, `taken` the last date, `weak` the three weakest tags over all attempts (the rule of `stats`'s Weakest), `ungraded` true when an attempt has essays or code with no grade. One module, `src/cli/library-history.ts`, computes this, so `stats` (4e) and `info` read the same numbers.
- `changed`: the `source` file exists and its hash (`loadQuiz`) is not the current version's. `flagged`: the open `review.fix` and `review.drop` findings of `review.json` against the current version (`0` without one).
- NOTES column: `source changed`, `N ungraded`, `N flagged`, in that order, joined by ` · `.

**`info NAME [--version HASH]`** (COMMANDS.md's Output and `--json`). Every block of its table, in order. Versions newest first, the current one marked; each against the version before by question id and question hash: added, removed, changed. `--version` takes a hash or a prefix of at least 4 characters (an ambiguous prefix exits 2, listing the matches). Unknown quiz: exit 2 with the nearest names, as `path` does.

**The history helper** (G6), started here: `test/helpers/library-history.ts` builds a library through the real commands, in-process with a fixed clock and the git test environment: `init`, `register` of a quiz, `register --update` with a question changed, one removed and one added, then results files filed into `results/` as `take` will file them (built from the fixtures' results or core's attempt API, on the old and the new version), a report for one, an essay left ungraded. 4c's `list` and `info` goldens run over it; 4d and 4e extend it.

### Tasks

1. **G21** (one commit), with its test.
2. **`register`** (one commit): the version store, `check.json` and its reader, the order of decisions above, several files, `--build-file`, `--update` with the review and the progress warning; unit tests for each decision, the batch refusal (nothing written), the killed run, `check.json`'s round trip; subprocess `--json` contract tests; goldens for every Output block of `register` in COMMANDS.md and each refusal.
3. **`list`, `info` and the history helper** (one commit): `src/cli/library-history.ts`; goldens for `list` (plain, empty, `--json`) and `info` (plain, `--version`, unknown, `--json`) over the helper's library; the command-graph cases (`list`, `info` and `register` load no page builder, renderer or server; `check` and the core commands still load nothing of `src/library/`).
4. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice, with every golden added or changed counted, and anything done differently.

### Done when

`npm run build`, the typecheck, Biome, knip and Vitest pass (G20: no Playwright); in a temporary library, registering two examples, editing one and registering it with `--update`, then `list` and `info`, print COMMANDS.md's text with their own numbers.

### Review (2026-11-18)

**Built** in `6a72610` (G21: `init` decides under the lock; two `init`s together give one `created`, one `adopted`, one commit), `9ed801f` (`register`: `src/cli/library-register.ts`, `src/library/check-file.ts`, `src/library/versions.ts`; 37 goldens) and `3432db5` (`list`, `info`: `src/cli/library-history.ts`, `library-row.ts`, `library-list.ts`, `library-info.ts`; the history helper and its library `test/fixtures/library-history/lib`, kept equal to the helper's output by a test; 26 goldens).

**Checked by the planner** (G20: no Playwright): `npm run build`, the typecheck, Biome and knip pass; Vitest: the startup tests 2 (alone, first), then 3415 in 133 files. Goldens: 63 added (37 `register-*`, 9 `list-*`, 17 `info-*`), none changed. **By hand**, in a temporary library with two examples: a batch of two registers in one commit as the git identity set; the same file again is `unchanged`; an edited file is refused with the `--update` command; `--update` adds version 2 ("1 changed") and `list`'s "source changed" goes; `info` lists both versions, newest first; `--update` of another quiz is `library.id-mismatch`; `status` healthy. **One bug, G22:** after `--update` from a file of another name, `status` reports the older versions as damaged.

**The register goldens show no `committed` line:** a golden case cannot hold a repository; the line is checked with real git in the subprocess tests. Accepted; the runner stays as it is.

**Done differently, accepted:** the `--update` flow does not apply step 2 of the order (the file it exists for would be refused); the default name is the slugged title only when it matches `ID_FORMAT`, else the id; the stored review is applied only when the id matches; `check.json`'s rebuilt rules name `check.json` as their origin; `brief.yaml` read a second time when stored; unknown names say `did you mean:` as `info`'s sample; dates in `--json` are dates only, versions full hashes; `info`'s labels 11 wide, empty rows left out; `program.enablePositionalOptions()`, so `info NAME --version HASH` is not the program's `--version`. COMMANDS.md's `register` sample wrote three findings as `error: RULE:`, a slip in the planner's transcription of the boards; corrected to `check`'s `error RULE:`, as built, with the `id-taken` fix line ending "a new `id:` in its front matter".

**Gaps:** G22, decided by the owner on 2026-11-18 as recommended.

## Slice 4d: `take`, `replay`

**Approved by the owner on 2026-11-18.** G4, G5, G9, G17, G22 and the approved boards are written into COMMANDS.md: "How library commands print", "The library folder", `quiz library take`, `quiz library replay`, `quiz serve` (`--autosave`); TECHNICAL_DESIGN.md, section 4 ("Plan and Attempt": the library chooses the plan), section 7 (foundation 9, the lock), section 10 (what *missed* means). This slice is the first that touches the page, so per G20 it runs **Playwright** too.

### Read first

- This plan: "Rules for every slice"; 4b's and 4c's sections and reviews; STEP4-GAPS.md, G4, G5, G9, G17, G22.
- COMMANDS.md: `quiz serve` (all of it: `--autosave`, `--json`, one submit), `quiz replay`, `quiz library take`, `quiz library replay`, "How library commands print"; USER_DESIGN.md 4.4, steps 3 to 5.
- TECHNICAL_DESIGN.md, sections 4 and 10 (missed: wrong or partly right, not answered fully right since; an unanswered question is seen, not missed), section 7 (foundation 9: what a served page carries), section 7's "Temporary files" (`library replay` writes under the temp folder and clears what is older than a day).
- Code: `src/cli/serve.ts` (`runServe`, `ServeIo`, `localStamp`), `src/serve/autosave.ts`, `src/serve/server.ts`, `src/build/page.ts` (`served`: focus, section, autosave, saved), `src/core/plan/index.ts` (`PlanRequest`; `missed` comes from the library), `src/core/attempt/schema.ts` (`PLAN_SOURCES`), `src/page/store.ts` (`retry`: how the page runs a plan of some questions), `src/cli/replay.ts` and `replay-command.ts`; 4c's `src/cli/library-history.ts`, `library-common.ts` (`loadStored`), the history helper; the serve tests (how a test reads the `listening` line and submits).

### Decided for this slice

**First, G22:** each version records its source's file name: `versions = [{ hash, added, file }]`; `register` writes it; `status`, `info`, `list`, `loadStored` and everything in this slice read a version's source by it, never by searching. A test: `register week2.md --update NAME` after `quiz.md`, then `status` is healthy. The history fixture is regenerated by its helper (its diff is `file` lines only).

**`take NAME [--section S] [--missed] [--focus] [--fonts F] [--no-open] [--timeout SECONDS] [--port N] [--json]`.**
- **What is served:** the current version, built in memory from its stored source (`loadStored` by `file`), with the server module, as `serve` builds it, with `served.autosave`. `--section` as `serve`'s. Default timeout `0` (forever).
- **Autosave and resume (G4, G17):** the attempt in progress is kept in `quizzes/<id>/progress/<version>.json` (git-ignored), through `serve`'s `--autosave` machinery. Without `--section` or `--missed`, a saved attempt is resumed: the oldest of the quiz's saved attempts, on whatever version it was started, built from that version's stored source, with COMMANDS.md's "resuming your attempt … on version 41c0; the quiz has been updated since" when it is not the current version. With `--section` or `--missed`, a new attempt, and a saved one is left alone.
- **One take at a time per quiz (G9):** while serving, `take` keeps `progress/<version>.serving.json`, `{"pid", "url", "started"}`, beside the progress file (not inside it: the progress file stays a `results-v2` document, as `serve --autosave` writes it); removed when `take` ends, however it ends. A `take` of that quiz that finds one whose process is alive exits 2 and prints the URL (COMMANDS.md); one whose process is gone is removed.
- **Filing (G9):** `take` holds no lock while serving. The page's submit is written by the server to `progress/<version>.submitted.json` (git-ignored); then, under the lock, it is moved to `results/<YYYYMMDD-HHMMSS>.json` (the submit's local time, from the injected clock), the progress file is removed, and one commit is made, `fullmark: take NAME`. If the lock cannot be had in 10 s, the submitted file stays, the command exits 2 saying the answers are safe and to run `take` again; the next `take` of the quiz files a submitted file it finds before anything else.
- **The score line** is what `serve` prints, in COMMANDS.md's words (`80%* (20 of 21 points, 4 waiting for a grade)`), then `next: quiz library grade NAME --web` when something waits for a grade, then the commit.
- **Ctrl+C or a timeout:** exit 2, the progress kept, "progress is saved: run take again to continue"; nothing committed.

**`--missed` (G5, TECHNICAL_DESIGN.md section 10).**
- **Which questions:** over every attempt of the quiz, on every version, each graded as `list` grades it (4c's module: the newest report, else graded on the spot against its version), a question (by id) is missed when its latest result is wrong or partly right; a fully right answer later clears it; an unanswered question is seen, not missed; an essay or code question with no grade is skipped, and one graded below full marks is missed. With `--section`, only the missed questions of that section.
- **How they are served:** questions still in the current version, in its source order, as a plan `{"source": "missed", "questions": […]}`; those no longer in it are counted as `gone`. A question whose current hash differs from its hash in the version it was missed on is **changed**.
- **One function** in `src/cli/library-missed.ts` returns `{questions, changed, gone}` for a quiz (and a section), so the tests and the history goldens read the plan without a server. Nothing missed: "nothing missed: …", exit 0, nothing served, `{"status": "nothing_missed"}`.
- **The page** (`src/build/page.ts`, `src/page/`): `served` gains `plan` (a plan of some questions, `source` `missed`) and `changed` (question ids). The page starts that plan as it starts a retry: the start screen's line names it with the catalogs' existing `source.missed` ("missed questions") and the count; only those questions are shown. A changed question carries the label **"changed since you missed it"** (`vi`: **"đã sửa sau lần bạn làm sai"**), one new catalog key, in the card's head line after the question's number, muted, as the "flagged" mark is. A shared page never has `plan` or `changed` (foundation 9: a `build` page stays byte-identical).

**`replay NAME [--attempt STAMP] [-o DIR] [--no-open] [--json]`.** The attempt (default the newest; a stamp or a prefix of 4 or more), the version it names (built from its stored source by `file`), the newest grades file of that attempt in `grades/` if any, built as `quiz replay` builds, into `DIR`, or else the temp folder's `fullmark/` (files there older than a day are removed first). Writes nothing in the library. Output and `--json` as COMMANDS.md.

**The history helper** gains what `--missed` needs: attempts on the old and the current version with a question missed then answered right, one missed and changed since, one missed and since removed, an essay graded below full marks, one left ungraded. Its library is regenerated; `list`'s and `info`'s goldens change only where those attempts count, each explained.

### Tasks

1. **G22** (one commit), with its test and the fixture regenerated.
2. **`take`** (one commit): the command, the serving file, filing under the lock, resume across versions; subprocess tests that read the `listening` line and submit as the serve tests do (filed and committed; resumed; resumed on an old version; already open; the lock busy at filing, then filed by the next take; Ctrl+C keeps progress); the cli-graph case (`take` loads the server; `check` and the core commands still load nothing of `src/library/` or `src/serve/`).
3. **`--missed` and the page** (one commit): `library-missed.ts`; its function goldens over the history library under `test/golden-fn/` (the plan, `changed`, `gone`, with and without `--section`); the page's `plan` and `changed`; a Playwright spec: `take --missed` on the history library in Chromium and Firefox, the label on the changed question, Submit, filed with `plan.source` `missed`; a screens spec (`e2e/screens-4d.spec.ts`, as step 3's) of the start screen and a changed card, light and phone, for the owner; the byte-identity test of a `build` page still passes.
4. **`replay`** (one commit): the command; goldens with `-o` over the history library (the page and the `--json` line), the newest grades used, an attempt on an old version.
5. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice, with every golden and screen added or changed counted and explained, and anything done differently.

### Done when

`npm run check` passes in Chromium and Firefox (G20: this slice runs Playwright); in a temporary library, `take` an example, answer some questions wrong, submit; `take --missed` serves only those, marked when changed; `replay` opens the attempt; each prints COMMANDS.md's text.

### Review (2026-11-18)

**Built** in `ac3301f` (G22: `versions = [{ hash, added, file }]`; `register` writes it, `status` and `loadStored` read by it; a test of `register week2.md --update` after `quiz.md`, then `status` healthy), `da851a0` (`library take`: `src/cli/library-take.ts`; `serve.ts` split so `serveLoaded` serves a stored version without checking it again; the serving and submitted files in `layout.ts`), `75be49c` (`--missed`: `src/cli/library-missed.ts`, `missedOf` and `missedFor`; `served.plan` and `served.changed` in `page.ts`; the page runs the plan as a retry, with the start line and the `changedMark` label in both catalogs; the history helper's seventh attempt; the screens) and `6df65f2` (`library replay`: `src/cli/library-replay.ts`, through `runBuild`). The agent worked in a worktree; `1.0` was fast-forwarded to these commits.

**Checked by the planner** (G20: this slice runs Playwright): `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3454 in 136 files, Playwright 835 passed and 527 skipped (the screens specs) in Chromium and Firefox, tsc, Biome and knip clean. Goldens: G22 added `file = …` to 44 input `library.toml` files and the history fixture, and 14 expected `library.toml` outputs of `register` and `init` changed by that line only; 13 `list` and `info` goldens changed only in the attempt count (6 to 7, the helper's new `--missed` attempt); 12 built or replayed pages and 2 `--json` lines changed because the page code and CSS embedded in every page grew (their CSP hashes and the byte count, +803 B), with no `plan`, `changed` or server code in any shared page, and the byte-identity test of a `build` page passes; added: 5 `library/replay-*` goldens and 4 function goldens of `--missed` (`test/golden-fn/library-missed-study*.txt`). Screens: `docs/screens/4d/`, 6 images (the start screen, a changed card, the questions; desktop and phone), looked at: the start line "missed questions · 4", no section picker, the label after the question's number, muted. **By hand**, in a temporary library with `examples/calculus`, driving the page in Chromium: two takes filed and committed (`fullmark: take calculus-i-derivatives`); `take --missed` served the 5 missed of 12, "missed questions · 5 from 2 attempts", filed "0 of 5 right · 0%" with `plan.source` `missed`; `replay -o out` wrote the page with COMMANDS.md's heading, a 4-character prefix matching three attempts exits 2 listing them; `list` counts 3 attempts; `status` healthy; `progress/` empty after each filing.

**Done differently, accepted:** the `take` unit tests run in-process (a real server on 127.0.0.1 driven with `fetch`, the clock, timers, Ctrl+C and the lock injected); the subprocess test is the Playwright spec, which starts `take --json` and reads its lines; a leftover submit is stamped by its own `submittedAt`, a fresh one by the clock; the progress file is removed after filing only when it is the filed attempt's (same `startedAt`); "unanswered is seen, not missed" neither marks nor clears an earlier miss; `--missed` with only gone questions or no attempt says why in its "nothing missed" line; with `--section` and `--missed`, `gone` counts that section's; the heading shows `time limit N s` with `--timeout`; `replay` drives `runBuild` and clears only `.html` files older than a day in its temp folder; function goldens are `.txt` (Biome reformats `.json`) and refresh with `FULLMARK_GOLDEN_UPDATE=1`; commit 1's two Biome issues were fixed in commit 2.

**A leak, cause shown, not 4d's:** the agent's one failed run (44 Firefox failures, "Unknown system error -122" on a write) was `/tmp` full. The e2e specs and serve tests make `fm-*` folders with `mkdtempSync` and never remove them: one `npm run check` here left 1,179 new ones (most `fm-e2e-*`, then `fm-review-`, `fm-grade-`, `fm-brief-`, from steps 2 and 3). A fix for its own (remove them after each test) is offered to the owner.

**Gaps:** G23 to G26, decided by the owner on 2026-11-19 as recommended.
