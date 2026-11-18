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
| 4c | built and reviewed (2026-11-18); G22 waits for the owner | `6a72610`, `9ed801f`, `3432db5` |

### Next

1. The owner decides G22 (4c's review).
2. The planner writes **4d**'s brief (`take`, `replay`), with G22 as its first task.

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

G1 to G18 are decided ([STEP4-GAPS.md](STEP4-GAPS.md)). G19 to G21 are decided too. Open:

**G22. Each version's file name.** Raised in 4c's review: `library.toml` records one `source` per quiz, the latest; `status` looks for every version's source under that file's name, so after `register week2.md --update rust-basics` the versions stored as `quiz.md` are reported damaged (`library.hash`), with a `git checkout` fix that cannot help. `loadStored` works around it by trying every `.md` in the folder. **Recommendation:** record it: `versions = [{ hash, added, file }]`, `file` being the source's name in the version folder; `register` writes it, and `status`, `info`, `list` and every later command read the source by it, never by searching. `library.toml` stays version 2 (no library exists yet outside tests); the history fixture is regenerated by its helper. The first task of 4d's brief, with a test of exactly this case.

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

**Gaps:** G22.
