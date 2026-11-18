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
| 4e | built and reviewed (2026-11-19); G30 to G33 decided (2026-11-19), built first in 4f | `aa78170`, `fa0b3dd`, `63c2d5e`, `a945e7d` |
| 4f | built and reviewed (2026-11-19); G38 raised; step 4 waits for the owner's acceptance | `6e4f6ca`, `49e6611`, `2ff867f`, `3cb7793`, `8dc6236`, `8981d40`, `1c86cd5` |

### Next

1. The owner decides **G38**, looks at the `boxed` style (drawn without the board: see 4f's review), and tries the samples' library: `npm run samples`, then the `library take`, `take --missed`, `grade --web`, `replay` and `review` lines of `samples/index.html`.
2. The owner accepts step 4; G38 is built first in step 5.

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

G1 to G37 are decided ([STEP4-GAPS.md](STEP4-GAPS.md)). Raised in 4f's review, open:

**G38. `share --source` of a quiz registered with `--profile`.** G35 writes no `fullmark.toml` when the version's profile is a built-in one with no change. But a quiz registered with `register --profile exam`, whose own front matter names no profile, then comes out as a folder that `quiz check` checks under `default`, not `exam`: G35's own aim, "`quiz check` on the folder finds what the library found", fails. Tried by hand with `examples/calculus` (clean under both, so the findings agree only by chance). **Recommendation:** no `fullmark.toml` only when the folder would get the same profile anyway (the quiz's own `profile:`, else `default`); otherwise one with `profile = NAME`, and `[profiles.NAME]` only when the rules differ from the built-in's. A test registers under `exam` a quiz with an `exam`-only finding and checks the shared folder.

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

## Slice 4e: `grade`, `stats`

**Approved by the owner on 2026-11-19.** G6, G14, G25 to G29 and the approved boards (LibraryGrade) are written into COMMANDS.md: "How library commands print", "The library folder", `quiz library take`, `quiz library grade`, `quiz library stats`, and `quiz grade` (`--grades`, `--json`, `--web`, the form) and `quiz stats`, which the library commands look up for you. This slice adds the grading of a filed attempt and the numbers over all of them. `--web` serves the grading form, so per G20 it runs **Playwright** too.

### Read first

- This plan: "Rules for every slice"; 4c's and 4d's sections and reviews; STEP4-GAPS.md, G6, G9, G14, G25 to G29.
- COMMANDS.md: `quiz grade` (all of it: the form, "Before it serves", "The submit", the exits), `quiz stats`, `quiz library grade`, `quiz library stats`, `quiz library take` ("The lock"), "How library commands print", "The library folder".
- TECHNICAL_DESIGN.md, section 6 (the grades format, the validator, pending grades in a score), section 7 (the lock, safe writes).
- Code: `src/cli/grade.ts` (`readAttempt`, `gradeOne`, the template), `src/cli/grade-web.ts` (`Prepared`, `gradesSubmitReader`, `runGradeWeb`: where it writes today), `src/cli/stats.ts` and `src/core/stats/` (`summarise`, `renderStats`, `StatsNames`); 4c's `src/cli/library-history.ts` (`readHistory`: the newest report, else graded on the spot), `library-common.ts` (`loadStored`, `findQuiz`, `openLibrary`); 4d's `src/cli/library-take.ts` (the leftover-submit pattern, `fileSubmitted`, the lock), `library-missed.ts`, `library-replay.ts` (the newest grades file of an attempt); `src/library/layout.ts` (`grade`, `reportJson`, `reportMd`); the history helper and its fixture.

### Decided for this slice

**First, G25 and G26** (COMMANDS.md, `quiz library take`):
- **G25.** When `take` resumes a saved attempt whose `plan.source` is `missed`, it works out the marks again: `missedOf` against the version resumed, the `changed` ids kept that are in the plan, served as `served.changed`. A test interrupts a `--missed` take with a changed question, resumes it with a plain `take`, and finds the mark on that card.
- **G26.** After filing a leftover submit, `take` prints `next: quiz library take NAME` after the commit line (COMMANDS.md's Output), and ends, exit 0, as today. The golden or test of that case gains the line.

**`library grade NAME [--attempt STAMP] [--grades FILE] [--json]`.**
- **The attempt:** `--attempt` takes a stamp or a prefix of 4 or more (ambiguous: exit 2 listing the matches, as `replay`). Without it, G28: the newest attempt with an essay or code answer waiting for a grade (`readHistory`'s `pending`), else the newest. No attempts, or an unknown stamp: exit 2. The quiz is the version the attempt names, read by `loadStored` (by `file`).
- **The grades used:** `--grades FILE` when given, checked by `quiz grade --grades`'s validator against that version (exit 1 with every problem, nothing written); else the newest file of that attempt in `grades/` (by the graded stamp in its name); else none, and the essays and code stay pending.
- **Kept:** a `--grades` file is copied as given, its bytes, to `grades/<attempt stamp>-<YYYYMMDD-HHMMSS>-grades.json`, the second stamp the injected clock's local time (the next free second when one exists). Every grades file is kept; none is ever overwritten or removed.
- **The report:** `reports/<stamp>-report.json` and `reports/<stamp>-report.md`, from the grades used, as `quiz grade` builds them (`buildReport`, `renderMarkdown`), replaced each time. `list`, `info`, `replay` and `stats` then read that report.
- **The template (G27):** with `--json`, for an attempt with an essay or code question answered, the empty grades template as `quiz grade --json` writes it, into the working directory as `<name>-<stamp>-grades.json`; an existing one is skipped with `quiz grade`'s warning. `template` is its path, or null.
- **Under the lock, one commit:** the kept grades file and the two report files, `fullmark: grade NAME`.
- **Output and `--json`** exactly as COMMANDS.md's first two samples and its `--json` row: the heading `NAME · attempt STAMP · version HASH`; `grades kept … · KIND, NAME` from the file's grader; `report reports/<stamp>-report.md · 61%* · 1 essay waiting for a grade` (or `nothing pending`); the `next:` line when something waits; the commit.

**`library grade NAME --web [--attempt STAMP] [--name NAME] [--timeout SECONDS] [--port N] [--json]`.**
- The form of `quiz grade --web`, unchanged, for the attempt and its version, **pre-filled from the newest grades file of that attempt** (as `--grades` pre-fills it), with "· pre-filled from GRADER's grades" in the heading when there is one. `quiz grade --web`'s refusals in its order, with its exits (nothing to grade: exit 0, nothing served or written).
- **G29:** no lock while the form is served. On **Save grades**, the server checks the submit as `quiz grade --web` does (400 and still waiting on a problem); the document (`kind: human`) is then written to `progress/<stamp>.grades.json` (git-ignored), and under the lock moved to `grades/<stamp>-<YYYYMMDD-HHMMSS>-grades.json`, the reports written, one commit. `runGradeWeb` gains a way to be told where to write (a hook or an option, as `serveLoaded` was split in 4d), with `quiz grade --web` unchanged: its goldens and tests do not move.
- Lock busy for 10 s: the grades stay in `progress/`, exit 2, "your grades are safe in progress/<stamp>.grades.json", fix "run `quiz library grade NAME` again to keep them". The next `library grade` of the quiz (with or without `--web`) keeps a leftover first, says so, and ends, with `next: quiz library grade NAME` after the commit, as `take` does (G26).
- Timeout or Ctrl+C: exit 2, nothing written, nothing committed. Default timeout `1800`, as `quiz grade --web`.
- Output: COMMANDS.md's third sample; `--json` the `listening` line, then the `written` object.

**`library stats NAME [--json]`.**
- Over every attempt of the quiz, every version, each as `readHistory` grades it (the newest report, else graded on the spot), oldest first: `summarise` with the current version's names (as `quiz stats --quiz`), `renderStats`. No new numbers: `list`, `info`, `--missed` and `stats` read one module.
- The heading `NAME · TITLE · N attempts, M versions`, M the versions among the attempts. One attempt is shown like several (G14); no attempts: exit 2, "no attempts at NAME yet", fix `quiz library take NAME`. Unknown quiz: exit 2 with the near names. Writes nothing and takes no lock.
- `--json`: `quiz stats --json`'s object, over every attempt.
- The plan of each attempt shows as `quiz stats` shows it: `(section S)`, `(missed)`, `(retry)`.

**The history helper** (G6) files its reports through the real `library grade`, no longer by hand, and gains what the step's goal names: an essay graded by an AI with `--grades`, then regraded by a person (two grades files kept, the newest counting), an attempt on an old version graded against it. Its library is regenerated; every `list`, `info`, `replay` and `--missed` golden that changes is explained by those grades.

### Tasks

1. **G25 and G26** (one commit), each with its test.
2. **`library grade`** (one commit): the command without `--web`; unit tests for the default attempt (G28), the grades used (given, newest kept, none), the bytes kept, the report replaced, an invalid `--grades` (exit 1, nothing written, nothing committed), the template (G27, and skipped when it exists), an attempt on an old version; subprocess `--json` contract tests with real git; goldens for COMMANDS.md's first two samples, `--json`, an unknown attempt, an ambiguous prefix, no attempts.
3. **`--web`** (one commit): the write hook in `grade-web.ts` with `quiz grade --web`'s tests and goldens unchanged; pre-filled from the newest grades; the leftover kept first; in-process tests for Save (kept, reported, committed), a submit with a problem (400, still waiting), the lock busy (G29), timeout and Ctrl+C; a Playwright spec, Chromium and Firefox: `library grade --web` on the history library, the form pre-filled from the AI's grades, one score adjusted, the name given, **Save grades**, then the kept file (`kind: human`, `reviewed`), the report and the commit. No new screen: the form is `quiz grade --web`'s.
4. **`library stats` and the helper** (one commit): the command; the helper's grades; goldens over the history library (plain, `--json`), one attempt, no attempts, unknown quiz; the command-graph cases (`stats` loads no page builder, renderer or server; `grade` without `--web` no server; `check` and the core commands still nothing of `src/library/`).
5. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice, with every golden added or changed counted and explained, and anything done differently.

### Done when

`npm run check` passes in Chromium and Firefox (G20); in a temporary library, an example with an essay taken and filed, then `library grade NAME --json` writes the template, `--grades` with it filled keeps it and reports, `--web` pre-fills from it and keeps a second file, and `library stats` shows the attempts; each prints COMMANDS.md's text.

### Review (2026-11-19)

**Built** in `aa78170` (G25: a resumed missed attempt gets its `changed` marks again, against the version resumed, for its plan's ids; `changed` is served without `plan`; G26: `next: quiz library take NAME` after a filed leftover), `fa0b3dd` (`library grade`: `src/cli/library-grade.ts`; `--web`: `src/cli/library-grade-web.ts` and a `LibraryGradeHooks` parameter of `runGradeWeb`; `library stats`: `src/cli/library-stats.ts`; `readAttempt` moved to `src/cli/attempt-read.ts` and `localStamp` to `time.ts`, so `library grade` loads no server; the history helper's reports made by the real `library grade`; the grade goldens), `63c2d5e` (`--web`'s tests and the Playwright spec) and `a945e7d` (`stats`'s tests and goldens). Built on `1.0` in the main checkout: the first agent's worktree was cut from `main`, and it stopped, as told, without writing anything.

**Checked by the planner** (G20: this slice runs Playwright): `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3513 in 140 files, Playwright 837 passed and 527 skipped (the screens specs) in Chromium and Firefox, tsc, Biome and knip clean. The agent's `npm run lint` failed, cause shown: 4d's worktree under `.claude/worktrees/` had its own `biome.json` ("nested root configuration"); that worktree was merged and clean, and is removed (G33). Goldens: 16 cases added (10 `library/grade-*`, 6 `library/stats*`, each an Output block of COMMANDS.md or a refusal the brief names); 2 changed, both in `library/replay-old-version`, since attempt 20261003 is now graded by the helper ("graded 3 Oct", and the page carries the grades); the history fixture gains 3 grades files and 2 report `.md` files, and its 2 reports differ only in the offset of `at`. No other `list`, `info`, `replay` or `--missed` golden changed; `quiz grade --web`'s did not move. **By hand**, on a copy of the history library under real git: `grade study-fixture --json` chose the attempt of 16 Nov (an essay waiting, G28), wrote the template in the working directory (G27) and the report, one commit; a filled file with a score off the step and a grader with no `model` was refused, every problem listed, nothing written or committed; the same file made valid was kept byte for byte as `grades/20261116-201412-20261119-023042-grades.json`, the report replaced ("28% · nothing pending"), one commit holding those three files; `stats` printed COMMANDS.md's blocks over 7 attempts and 3 versions; `list` and `status` agree. `--web` was not driven by hand: the Playwright spec drives it in both browsers (pre-filled from the AI's grades, one score adjusted, the name, **Save grades**, the kept file `kind: human`, the report, the commit).

**Done differently, accepted:** the code of tasks 2 to 4 is in one commit, since each needs the others to build, with the tests and goldens in the next two; `--no-open` on `--web`, as `take`; the refusals of `quiz grade` (`--name` without `--web`, `--grades` with `--web`, `--timeout` and `--port` checked before serving); the saved card names `grades/<stamp>-…-grades.json`, since the second is not known when the page is built; `library-grade-web.ts` takes the helpers it needs as a parameter, so esbuild keeps `grade`'s chunks as the command-graph test expects; an invalid `--grades` with `--json` is `{"status": "problems", …}` as `quiz grade`'s; `graded` counts the graded essay and code answers; an unreadable grades file exits 2; `report.md` names the quiz by its name; with no grades file kept the report is rebuilt without grades (only the old hand-made fixture had one); the newest kept grades file that cannot be applied exits 2 naming it, never falling back to an older one; `stats` leaves out an attempt that cannot be graded; a leftover `progress/<stamp>.grades.json` whose attempt is gone is ignored. **The agent's stuck wait:** its last command waited on `pgrep -f "playwright test"`, which matched itself; stopped by the planner.

**Gaps:** G30 to G33, decided by the owner on 2026-11-19 as recommended.

## Slice 4f: `review`, `share`, `template add`, `rename`, `rm`; acceptance

**Approved by the owner on 2026-11-19.** G10, G13, G16, G18, G30 to G37 and the approved boards (LibraryTidy, LibraryTake, LibraryStyleBordered) are written into COMMANDS.md: "Exit codes", "Terminal style", "How library commands print", "The library folder", `quiz library review`, `share`, `template add`, `rename`, `rm`, `grade`. This is the last slice of step 4: it finishes the commands, gives the terminal its `boxed` style, makes the samples' library, and checks the step's "Done when". It touches a form and the page, so per G20 it runs **everything**, Playwright in Chromium and Firefox.

### Read first

- This plan: "Goal" (the step's "Done when"), "Rules for every slice"; 4b's to 4e's sections and reviews; STEP4-GAPS.md, G10, G13, G16, G18, G30 to G37.
- COMMANDS.md: the sections named above, `quiz review` (all of it), `quiz template add` and `quiz template rm`, `quiz build`'s output, "Terminal style", "Paths in output".
- The boards LibraryTidy (`rename`, `rm`), LibrarySetup (`share`, `template add`), LibraryStyleBordered (the `boxed` style), which COMMANDS.md's Output blocks transcribe.
- Code: `src/cli/review.ts` (`runReview`, `submitReader`), `src/cli/template.ts` (`runTemplateAdd`), `src/cli/table.ts` (`renderTable`, `renderFacts`, `painter`), `src/cli/check.ts`, `inspect.ts` and `stats.ts` (their human output), `src/cli/library-common.ts`, 4d's `library-take.ts` (the serving file and leftover pattern), 4e's `library-grade-web.ts` (the hooks into a form's server, the busy card of G32), `src/library/check-file.ts` (`check.json`'s reader), `scripts/samples.mjs` (its `SERVED` list), `test/cli-graph.test.ts`, `test/helpers/library-history.ts`.

### Decided for this slice

**First, G30 to G33.**
- **G30:** one handler in `main.ts`: an `EPIPE` on stdout stops the writing and exits `0` with nothing on stderr. A subprocess test pipes `rules --all` and `library list` into a reader that closes after one line: exit 0, stderr empty.
- **G31:** `library grade --json` that writes a template prints `next: fill in FILE, then quiz library grade NAME --grades FILE (or --web)`; the `grade-template-json` golden changes by that line.
- **G32:** `--web`'s server answers **Save grades** once the keep was tried; on a busy lock the done card says COMMANDS.md's words, two keys in `src/core/i18n/grade.ts` (en, vi). A test of the busy case reads the card's text.
- **G33:** `biome.json` leaves out `.claude/`.

**`library review NAME [--since] [--timeout SECONDS] [--port N] [--no-open] [--json]`** (G16, G34).
- `quiz review`'s form on the current version (`loadStored` by `file`), with the stored `review.json` as its earlier review (as `quiz review --review` merges); `--since` as `quiz review --since` (no stored review: exit 2). A survey: exit 2. `runReview` gains hooks as `runGradeWeb` did in 4e; `quiz review`'s goldens and tests do not move.
- G34: no lock while serving; **Finish** writes `progress/review.json`, then under the lock moves it to `review.json`, one commit `fullmark: review NAME`; busy: kept in `progress/`, exit 2, the done card's words, the next `library review` files it first and ends with `next:`.
- Output and `--json` as COMMANDS.md; the heading counts the questions and those judged before.
- `register --update` already applies the stored review (4c): a test reviews a question `fix` here, then registers an update that leaves it unchanged and is refused.

**`library share NAME [-o DIR] [--version HASH] [--source] [--json]`** (G35, G36).
- The page: the version (current, or `--version` as `info`'s: a hash or a prefix of 4 or more, ambiguous exits 2) built from its stored source as `quiz build` builds it, with `check.json`'s profile, into `DIR/NAME.html` (default `DIR`: the working directory). It must be **byte-identical** to `quiz build` of the same source and profile (foundation 9): a test builds both and compares.
- `--source`: `DIR/NAME/` with the version folder's files (the source under its file name, assets, sheets, `brief.yaml`), not `check.json`, plus the `fullmark.toml` of G35 when the profile is not a plain built-in. G36 for what is there already.
- Reads the library, writes nothing in it, no lock, no commit. Output and `--json` as COMMANDS.md (`412 KB`: the size as `build` prints it).

**`library template add NAME [--as TEMPLATE] [--version HASH] [--skeleton] [--replace] [--json]`.** The version's source and assets handed to `quiz template add`'s machinery, checked under `check.json`'s profile (not the config's); its options, name rules, exits and `unchanged` as `quiz template add`'s. Writes the user's template folder (under the injected config folder in tests), nothing in the library, no commit. Output as COMMANDS.md.

**`library rename OLD NEW [--json]`.** NEW by G13's rules (`ID_FORMAT`; not another quiz's name or id; "name taken" with the next free `NAME-2`, exit 1). Only `name` in `library.toml` changes (the table moves to keep the file sorted); the id and the folder stay. Under the lock, one commit `fullmark: rename OLD NEW`. Unknown quiz: exit 2 with the near names. Output and `--json` as COMMANDS.md.

**`library rm NAME [--yes] [--force] [--json]`** (G10, G37).
- Asks `[y/N]` on a terminal (the prompt injected in tests), counting versions, attempts and reports, and an attempt in progress (G37). Not on a terminal and without `--yes`: exit 2, as `--json` without `--yes` (G10).
- Refused (exit 1), unless `--force`: no git repository at the root, uncommitted changes under `quizzes/<id>/` (git-ignored `progress/` aside), a `take` of the quiz serving (G37). With `--force` and no git: deleted, no commit, a warning that it cannot be undone.
- Under the lock: the folder is removed (a rename aside first, then removed, so a killed run leaves the quiz or nothing: a test), the table removed from `library.toml`, one commit `fullmark: rm NAME`, then `undo: git -C ROOT revert HASH`. Output and `--json` as COMMANDS.md.

**The `boxed` style and the shared tables** (G18; COMMANDS.md, "Terminal style").
- `src/cli/table.ts` draws `boxed` as the LibraryStyleBordered board: tables in box characters, `library status`'s facts block in a panel; the same colours as `simple`. Used when `[terminal] style = "boxed"` and stdout is a terminal without `--plain` or `NO_COLOR`; it falls back to `simple` when the terminal (its injected width) is narrower than the table.
- `check`, `inspect` and `stats` move their tables and blocks onto `table.ts` (4b's brief deferred this). Their plain output (every golden) must not change: the goldens are the proof, and none of `check/`, `inspect/`, `stats/` changes. Colour tests with a terminal `io` for both styles, including the narrow fallback.

**Acceptance of step 4** ("Goal", Done when).
- **Every library command has a contract test** run as a subprocess with `--json`: a test lists the commands in `main.ts`'s `library` group and fails for one with no such test.
- **Every command that changes the library takes the lock and commits once:** a test runs each (`init`, `register`, `take`, `grade`, `review`, `rename`, `rm`) against a library with the lock held by a live process and finds it waits and then fails with the "busy" error, and, once free, makes exactly one commit.
- **The history goldens complete** (G6): `list`, `info`, `stats`, `take --missed` (its function golden) and `replay` over the history library, each present, reviewed and committed; the helper gains a renamed quiz and a review, so `rename` and `review` are in the history too.
- **The command graph:** `check` and the core commands load nothing of `src/library/`; `share` and `template add` load no server; the library's read-only commands no page builder.
- **The samples** (`scripts/samples.mjs`): `samples/library/`, a copy of the history fixture made a git repository, and `samples/config.toml` naming it, so the owner's own config and library are never touched; lines in `SERVED` for `FULLMARK_CONFIG=samples/config.toml node dist/cli.js library take study-fixture`, `library take study-fixture --missed`, `library grade study-fixture --web` and `library replay study-fixture`, each with what to try, as the other lines; `SERVED`'s page lists them.

### Tasks

1. **G30 to G33** (one commit), each with its test.
2. **`review`** (one commit): the command, the hooks in `review.ts`, G34; in-process tests (Finish written and committed, `--since`, none to ask, busy, timeout, Ctrl+C), a subprocess `--json` test, a Playwright spec in both browsers (the form on the history library, one verdict changed, Finish, `review.json` committed).
3. **`share` and `template add`** (one commit): the commands, G35, G36; the byte-identity test; goldens for COMMANDS.md's Output blocks and `--json`, `--version`, an unknown version, the refused `--source` folder.
4. **`rename` and `rm`** (one commit): the commands, G37; unit tests for each refusal, the prompt, the killed `rm`, the undo line (a real `git revert` brings the quiz back and `status` is healthy); goldens of the Output blocks.
5. **The `boxed` style** (one commit): `table.ts`, `check`, `inspect`, `stats` onto it; the colour tests; no plain golden changes.
6. **Acceptance and the samples** (one commit): the contract-test and lock-and-commit tests, the history goldens completed, the command-graph cases, the samples' library and lines; `npm run samples` run.
7. **Do not edit** `docs/plans/` or `docs/design/`. The agent's report as for every slice, with every golden and screen added or changed counted and explained, and anything done differently.

### Done when

`npm run check` passes in Chromium and Firefox; the step's "Done when" (Goal) holds, each part shown by a test named in the report; `npm run samples` builds the samples' library, and the owner tries `library take`, `library grade --web` and `library replay` from it.

### Review (2026-11-19)

**Built** in `6e4f6ca` (G30: an `EPIPE` on stdout ends quietly, exit 0; G31: the template's `next:` line; G32: the server's `answer` hook, so the form learns whether the grades were filed, with the unfiled card in `src/core/i18n/grade.ts`; G33: `biome.json` leaves out `.claude`), `49e6611` and `2ff867f` (`library review`: `src/cli/library-review.ts`, `LibraryReviewHooks` in `runReview`, the unfiled card in the review form, `CheckOptions.fixed` to check under a stored `check.json`), `3cb7793` (`library share`, `library template add`: `src/cli/library-share.ts`, `library-template.ts`, `src/library/profile-toml.ts` for G35), `8dc6236` (`library rename`, `library rm`; the history's third quiz `tidy`, registered as `tidy-notes`, renamed and reviewed by the real commands; the golden runner's `git.txt`, which makes a case's library a repository with one commit, so the hashes of `rename` and `rm` are reproducible), `8981d40` (the `boxed` style in `src/cli/table.ts` and `look.ts`; `check`, `inspect`, both `stats` and `library info` drawn through it) and `1c86cd5` (acceptance: `test/library-contract.test.ts`, `test/library-lock.test.ts`, the command-graph cases; the samples' library).

**Checked by the planner** (the last slice: everything): `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3644 in 150 files, Playwright 843 passed (425 Chromium, 416 Firefox, and each one's budget test) and 527 skipped (the screens specs), tsc, Biome (with `.claude/` left out) and knip clean. `npm run samples` builds `samples/library/` (the history library as a repository) and `samples/config.toml`. Goldens: 35 cases added (8 `share`, 8 `template-add`, 7 `rename`, 8 `rm`, 4 `review`), each an Output block of COMMANDS.md or a refusal; 6 changed: `grade-template-json` by G31's line, and `list`, `list-json`, `list-flagged`, `list-flagged-json`, `info-unknown-far` by the history's third quiz. None of `quiz review`, `quiz grade --web`, `check`, `inspect` or `stats` changed: the `boxed` work moved code, not output. **By hand**, on a copy of the history library under real git: `share` wrote the page (259 KB) and `--source` the folder; `--source` again was refused (G36); `rename study-fixture study` committed, `rename study tidy` refused with `tidy-2`; `rm study --yes` deleted and printed `undo: git -C … revert 85873f3`, and that revert brought the quiz back with `status` healthy; with `style = "boxed"` on a terminal, `list` drew a box table and `status` its facts in a panel, and at 60 columns `list` fell back to `simple`; G38 found as above.

**The step's "Done when", each part shown:** the history-based tests (`test/golden/library/list*`, `info*`, `stats*`, `replay*`, `test/golden-fn/library-missed-study*.txt`; the last test of `test/library-contract.test.ts` checks they are there and that the history has a renamed and a reviewed quiz); a `--json` contract test for every library command (`test/library-contract.test.ts` reads the `library` group from `main.ts` and fails for a command with none; `take` through `e2e/take.spec.ts`; `path`, which has no `--json`, plainly); the lock and one commit for every changing command (`test/library-lock.test.ts`: `init`, `register`, `take`, `grade`, `review`, `rename`, `rm` each wait, fail busy changing nothing, then commit once); the command graph (`test/cli-graph.test.ts`); the samples (built; the owner has not tried them yet).

**Done differently, accepted:** a third quiz in the history rather than renaming one (renaming would have moved a dozen goldens for nothing); the goldens of `share` and `template add` in commit 4, and commits `2ff867f` and `3cb7793` not green on their own (their goldens need the third quiz); `share` takes `--fonts` (a common option) and does not repeat the source's own check warnings; `--json`'s `source` is a boolean; `template add`'s default name is the quiz's name; `rename` to its own name is refused, exit 1; `rm` declined exits 2, as `template rm`; `rm`'s order (aside, index, removed, commit) with a killed run's `.ID.PID.deleting` cleared by the next `rm`; "judged before" counts verdicts whose hash still matches; one function key per language for G32's words; `ProfileChoice.from` gains `"check.json"`; the samples gain a `library review` line too. **To look at:** the agent could not see the LibraryStyleBordered board and drew `boxed` with standard box characters, each header cell shaded, the facts as an untitled panel; the owner compares it with the board.

**Gaps:** G38, above, waits for the owner.
