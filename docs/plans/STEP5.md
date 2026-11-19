# Step 5: `publish` and `import`

## Handoff (2026-11-19): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 4 ([archive/STEP4.md](archive/STEP4.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox when the slice runs Playwright, the screens when there are any, and the commands by hand) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again; outside this plan one is cited with its step ("step 5, G3"; "STEP5.md, G3" in a code comment). Decided ones move to `STEP5-GAPS.md`.

**Run like step 4:** the design's open questions were raised **together** at the start (G1 to G11, decided on 2026-11-19), not one per slice; three slices; the one new screen (the shelf's index page) is drawn on the owner's canvas before the last slice and styled there.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-19); G1 to G11 decided as recommended (2026-11-19), written into COMMANDS.md and TECHNICAL_DESIGN.md | this file |
| 5a | brief approved (2026-11-19), with an implementing agent | |
| 5b | | |
| 5c | | |

### Next

1. Slice 5a is with one implementing agent on Sonnet; the planner reviews it when it reports.
2. Before 5c: the shelf's index page is drawn on the "fullmark themes" canvas (G9).

## Goal

`quiz library publish` and `quiz library import`: TECHNICAL_DESIGN.md section 12, step 5; COMMANDS.md, `quiz library publish` and `quiz library import`; USER_DESIGN.md, 4.5; TECHNICAL_DESIGN.md section 11 ("Determinism", "Round trip", "Privacy") and section 5 ("In the library"). Plus step 4's **G38**, decided and not built ([archive/STEP4-GAPS.md](archive/STEP4-GAPS.md)): `share --source` writes `profile = NAME` when the version's profile is not the one the quiz gets by itself.

**Done when** (section 12): **the round-trip and privacy tests pass.** Read here as:

- **Round trip:** publish a library to an empty folder, `import --into` a second empty folder, publish the second library to the first folder: `unchanged`, and no byte of the folder differs.
- **Privacy:** after publishing the history library (which has results, grades, reports, a review, progress and briefs), no file in the shelf is or holds a results, grades, report, review or progress file, and no `brief.yaml` is there without `--with-brief`; with `--with-brief`, the briefs and nothing more.
- **Determinism:** two publishes of the same library state into two empty folders give byte-identical folders, and a second publish into the same folder is `unchanged` and commits nothing.
- **And:** `publish` and `import` have contract tests run as subprocesses with `--json`; every command that changes the library or a shelf takes its lock and commits once (`test/library-lock.test.ts` gains `publish NAME --on`, the sync and `import`); `check` and the core commands still load nothing from `src/library/`, and `publish` and `import` load nothing from `src/serve/` (the command-graph test); `npm run samples` gains a shelf published from the samples' library and a line for `library publish` and `library import`.

**Not in step 5:** moving the owner's 0.x history in (step 6); the `shelf ...` commands, several shelves and bundles ([proposals/shelves.md](../design/proposals/shelves.md)); `import --clone` ([proposals/import-clone.md](../design/proposals/import-clone.md)); pushing; the other proposals, unless the owner picks one.

## Rules for every slice

Step 4's rules hold ([archive/STEP4.md](archive/STEP4.md), "Rules for every slice", extending step 3's): goldens are the contract; a failure is environmental only when its cause is shown; no real network or real timers in unit tests; a command loads only what it uses; shared pages carry no server code; `src/library/` uses core's public API only; git is real in tests, in a temp folder, with a fixed author, committer and date; the clock and the config folder are injected; every write is atomic, under the lock; commits end with the `Co-Authored-By` line of the model that made them, with explicit paths only (never `git add -A`, `-a` or `--amend`); the implementing agent never pushes. Added for step 5:

- **A shelf is written like the library**: the shelf folder in a test is a fresh temporary folder, a git repository with a fixed author, committer and date when the test needs commits, and the sync's writes are atomic per file under the shelf's lock (TECHNICAL_DESIGN.md, foundation "Library and shelf writes take a lock"). A test kills a sync mid-way (or simulates it) and checks the next sync repairs the folder.
- **What goes out is checked by bytes, not by eye**: the privacy test walks every file of the shelf; the determinism and round-trip tests compare folders byte by byte.
- **Which tests a slice runs** (step 4's G20): every slice runs `npm run build`, the typecheck, Biome, knip and all of Vitest (the startup tests alone first). Playwright, in Chromium and Firefox, runs for a slice that writes pages: **5a** (the shelf's pages and index) and **5c** (everything, before the step is accepted), not 5b.

## Gaps

The design leaves these open. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands.

G1 to G11 are decided ([STEP5-GAPS.md](STEP5-GAPS.md)). New ones found while building are added here from G12.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **5a** | Step 4's G38; shelf entries as tables in `library.toml` (`shelves = [{ shelf = "public", kind = "quiz" }]`, unknown entries kept; today's code reads `shelves` as strings, always empty); `publish NAME --on \| --off`, `list`'s `public` column and `info`'s shelves; the manifest's zod schema and JSON Schema; the sync (built in memory, written only where changed, removed only where the old manifest lists, the shelf's lock, the commit, `--dry-run`, `--json`, the remembered `DIR`, every exit code); a plain index page; the privacy and determinism tests | G1 to G6, G10 |
| **5b** | `import` (with and without a manifest, `--into`, each quiz under its nearest `fullmark.toml`); the round-trip test; the samples' shelf and their `publish` and `import` lines | 5a, G7, G8, G11 |
| **5c** | The index page from the owner's board (G9): look, phone sizes, axe, screens; acceptance: the contract and lock tests for both commands, the command graph, everything run in both browsers | 5b, G9's board |

Each slice's brief is written here when the one before it is reviewed; 5a's once its gaps are decided.

## Slice 5a: shelf entries, `publish --on | --off`, the sync

**Approved by the owner on 2026-11-19.** What the commands do is written in COMMANDS.md, `quiz library publish` (the whole section, with its Output block) and `quiz library share` (G38); this brief says how to build it and how to show it works. `import` is slice 5b; the index page's final look is 5c.

### Read first

- This plan: "Goal", "Rules for every slice"; [STEP5-GAPS.md](STEP5-GAPS.md), G1 to G6 and G10; [archive/STEP4-GAPS.md](archive/STEP4-GAPS.md), G35 and G38.
- COMMANDS.md: `quiz library publish`, `quiz library share`, `quiz library list` (the `NOTES` marks and the `shelves` field), `quiz library info`, "The library folder" (`library.toml`), "Git", the common options (`--fonts`, `--json`), "Exit codes".
- TECHNICAL_DESIGN.md: section 3 (schemas from zod), section 5 "In the library", section 7 (foundations 6, 9 and "Library and shelf writes take a lock"; the layer boundaries), section 11 ("Determinism", "Privacy").
- Code: `src/library/index-file.ts` (`shelves`, read as strings today), `profile-toml.ts`, `lock.ts`, `git.ts`, `layout.ts`; `src/cli/library-share.ts` (how a stored version is loaded and built, and its `fullmark.toml`), `library-common.ts`, `library-list.ts`, `library-row.ts`, `library-info.ts`, `library-rename.ts` (a small changing command: lock, write, commit), `config-write.ts`, `build.ts` and `src/build/page.ts` (`buildPage`, `builtAt`); `scripts/schemas.mjs`; `test/helpers/library-history.ts`, `test/library-contract.test.ts`, `test/library-lock.test.ts`, `test/cli-graph.test.ts`, the golden runner (`test/golden/runner.ts`, its `git.txt`).

### Decided for this slice

- **G38 first** (step 4's): `profileToml` gets the quiz's own profile (its front matter's `profile:`, else `default`) and returns null only when the version's profile is that one and a built-in with no change; otherwise `[check] profile = NAME`, with `[profiles.NAME]` only when the rules differ from the built-in's. `share --source` and the sync both use it. Test: register under `--profile exam` a quiz with an `exam`-only finding; `quiz check` on the shared folder, and on its shelf folder, reports it.
- **Shelf entries** in `library.toml` become `shelves = [{ shelf = "public", kind = "quiz" }]` (an inline table per entry, `version` kept when present). The reader accepts any entry with a string `shelf` and `kind` and keeps every field of entries it does not know, writing them back unchanged; the writer stays sorted and atomic. `list --json`'s `shelves` is the names (as COMMANDS.md says), `list`'s `NOTES` gains `public`, `info`'s Shelves row names them. No library on disk has an entry yet, so nothing is migrated; an old `shelves = []` reads as before.
- **`publish NAME --on | --off`**: under the library's lock, write `library.toml`, commit `fullmark: publish NAME --on` (or `--off`). `--json` (proposed by this brief, as no shape is written): `{"status": "on" | "off" | "unchanged", "name", "committed"}`.
- **Where the code goes:** the command in `src/cli/library-publish.ts`; the manifest (read, validate, write) and the sync's plan (what to add, update and remove, from the old manifest and the new files: a pure function) in `src/library/shelf.ts`; the manifest's zod schema beside the others (TECHNICAL_DESIGN.md section 7 puts it in `src/core/ir.ts`), and `schemas/fullmark-shelf-v2.schema.json` through `npm run schemas`; the index page in `src/build/shelf-index.ts`, its words in the catalogs (`en` and `vi`). `src/library/` imports nothing from `build` or `serve`; the command wires them together.
- **The sync**, in this order: read the library (no library lock: it only reads); refuse what COMMANDS.md refuses (exit 2 and 3 first, before any build); build every quiz on the `public` shelf in memory: its current version loaded as `share` loads it, checked under its `check.json`, the page by `buildPage` with `builtAt` the version's `added` time, the fonts from `--fonts`, else the manifest, else `config.toml`, else `quiz`; the quiz folder's files (the version folder without `check.json`, without `brief.yaml` unless `--with-brief`, plus `fullmark.toml` from `profileToml` when it is not null, plus `index.html`); the index page; the manifest. Then take the shelf's lock (`withLock` on `DIR`), apply G6's refusals, and write: **first the manifest listing the union of the old and new paths, then each changed file atomically, then each removed path (and a quiz folder left empty), then the final manifest.** A sync killed at any point leaves a manifest that lists everything it may have written, so the next sync repairs the folder and refuses nothing. Commit per G5 (`git rev-parse --is-inside-work-tree` from `DIR` through the git runner; commit `-- PATHS` relative to the work tree's root). Record `DIR` in `config.toml` (`[shelves]`, `public`) through `config-write.ts`, keeping the rest of the file. `--dry-run` stops before the lock and prints the plan. `unchanged` writes, commits and records nothing.
- **The plain index page** (G9's look comes in 5c): valid HTML, the content G9 lists, no script, its own style sheet by hash in the CSP, light and dark from the theme tokens, `lang` and `--ui-lang` honoured. Deterministic: no time in it.

### Tasks

1. **G38** (one commit), with its test and the `share` goldens it moves (count and explain each).
2. **Shelf entries and `publish NAME --on | --off`** (one commit): the reader and writer, `list`'s mark, `info`'s row, the command; unit tests (unknown entries kept byte for byte, `--on` twice, `--off` twice, an unknown name, the lock busy, one commit); goldens of the `--on` Output block and its `--json`.
3. **The manifest and its schema** (one commit): zod schema, `npm run schemas`, the committed schema test; read refusals (foreign, newer, malformed) with tests.
4. **The sync** (one commit, or two if large): the command, the index page, every exit code with a test; goldens of COMMANDS.md's sync Output blocks (dry run, published, unchanged) over the history library put on the shelf in the golden case; a test that a shelf page is byte-identical to `quiz build` of the version's source with the same `--built-at` and `--fonts`; a killed sync (a `withLock` hook or an injected writer that throws after N files) followed by a clean sync; G6's refusals; G5 with `DIR` at a repository's root, in its `docs/` folder, and outside any repository; G4's remembered folder (first sync, a second `DIR`, no `DIR` and none remembered: exit 3).
5. **The privacy and determinism tests** (one commit): `test/shelf-privacy.test.ts` publishes the history library (with its results, grades, reports, review, progress and a brief) and walks every file of the shelf: no file named or shaped like a results, grades, report, review or progress file, none holding a results or report JSON (`"format"` of those formats), no `brief.yaml` without `--with-brief` and only the briefs with it. `test/shelf-determinism.test.ts`: two publishes into two empty folders are byte-identical; a second publish into the same folder is `unchanged`, writes nothing (mtimes kept) and commits nothing.
6. **Playwright** (one commit): `e2e/shelf.spec.ts` in both browsers: open the shelf's `index.html` from the file system, follow a quiz's link, the quiz loads and answers; the quiz page's CSP has no `connect-src`. The command graph: `publish` loads nothing from `src/serve/`.
7. **Do not edit** `docs/plans/` or `docs/design/`. The report as for every slice: every golden and screen added or changed, counted and explained; anything done differently; anything the design left open, as a question, not a choice.

### Done when

`npm run check` passes in Chromium and Firefox; each task's tests are named in the report; by hand, on a copy of the samples' history library under real git, the planner puts two quizzes on the shelf, publishes into an empty git repository, publishes again (`unchanged`), takes one off and publishes (`removed`), and finds no private file in the shelf.
