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
| 5a | built and reviewed (2026-11-19); G12 to G15 decided as recommended (2026-11-19), G12 and G13 built first in 5b | `fd845f5`, `03976b3`, `5d091f8`, `1f04c50`, `1ea9dec`, `818ae45` |
| 5b | built and reviewed (2026-11-19); G17 decided as recommended (2026-11-19) | `82cf47d`, `d64fe29`, `3d785d0`, `0d7e712`, `da503bf`, `325cf26`, `e5de30d` |
| 5c | built and reviewed (2026-11-19), with G18 and G19's fixes; G20 and G21 decided as recommended (2026-11-19), G20's fix with an implementing agent | `53c4bf7`, `20adbf5`, `dfbf158`, `bdd0639`, `ee75475` |

### Next

1. G20's fix (below) is built and checked; then the owner accepts step 5.
2. The shelf's index page is chosen (G16) and its boards approved by the owner (2026-11-19): the table, ShelfTable and its variants on the canvas and in `docs/mockup/boards/`, the page scrolling with the headings kept at the top (no scroll box of its own); 5c builds it.

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
- **Which tests a slice runs** (step 4's G20): every slice runs `npm run build`, the typecheck, Biome, knip and all of Vitest (the startup tests alone first). Playwright, in Chromium and Firefox, runs for a slice that writes pages: **5a** (the shelf's pages and index) and **5c** (everything, before the step is accepted); 5b runs only `e2e/shelf.spec.ts`, since G13 changes the index page's links.

## Gaps

The design leaves these open. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands.

G1 to G21 are decided ([STEP5-GAPS.md](STEP5-GAPS.md)). New ones found while building are added here from G22.

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

### Review (2026-11-19)

**Built** by one agent on Sonnet in `fd845f5` (step 4's G38: `profileToml(profile, own)`, null only for the quiz's own built-in profile with no change; another built-in gives `[check] profile = NAME` alone), `03976b3` (shelf entries as tables in `library.toml`, unknown entries and fields kept; `publish NAME --on | --off`; `list`'s `public` mark, `info`'s shelves; `[shelves]` in `config-write.ts`), `5d091f8` (the manifest's zod schema in `src/core/ir.ts`, `schemas/fullmark-shelf-v2.schema.json`, `src/library/shelf.ts` with the pure `planSync`), `1f04c50` (the sync in `src/cli/library-sync.ts`, loaded by a dynamic import from `library-publish.ts` so `--on` loads no page builder; `buildOne` gains an in-memory build; `Git` gains `insideWorkTree()` and `commitPaths()`; the plain index page in `src/build/shelf-index.ts`), `1ea9dec` (`test/shelf-privacy.test.ts`, `test/shelf-determinism.test.ts`) and `818ae45` (`e2e/shelf.spec.ts`).

**Checked by the planner:** `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3737 in 156 files, Playwright 847 passed (686 lines each in Chromium and Firefox) and 527 skipped (the screens specs), tsc, Biome and knip clean. Goldens: 15 cases added (`publish-on`, `-on-json`, `-off-not-on`, `-unknown`; `publish-sync`, `-sync-json`, `-sync-dry-run`, `-sync-unchanged`, `-sync-swap`, `-sync-git`, `-no-dir`, `-inside-library`, `-foreign-manifest`, `-quiz-folder-unlisted`, `-index-in-the-way`), none changed; no `share` golden moved with G38. **By hand**, on a copy of the samples' library: `publish study-fixture --on` and `tidy --on` committed once each, a second `--on` said "already on the public shelf", exit 0; `list` marked both `public`; `--dry-run` into an empty git repository holding a README listed `study/`, `tidy/` and `index.html` (folders by id: `study-fixture`'s is `study`); the sync wrote them and the manifest, left the README alone, recorded `[shelves] public`, and committed only its paths; a second publish was `unchanged` with no commit; `tidy --off` then a publish removed `tidy/` and updated the index; no results, grades, report or review JSON anywhere in the shelf.

**Done differently, accepted:** the sync in its own chunk; fonts always passed to the build explicitly (otherwise the page's Information tab differs between the first sync and the next, and the second is not `unchanged`), so a shelf page equals `quiz build --fonts X`, not a build with no flag; G38's test uses `draft` rather than `exam` (an `exam` finding is an error, which `register` refuses); `list --json`'s `shelves` lists every entry's shelf name, the `public` mark only `kind = "quiz"`; a dry run lists a manifest line when only the manifest would change, and "files changed" when a quiz's files change with its hash (fonts, the program's version). Raised as gaps and decided by the owner on 2026-11-19 as recommended: the unknown-name exit (G12), the links (G13), the favicon (G14), the rest of the agent's choices (G15). **To look at in 5c:** the index page carries every theme's token set though it uses only light and dark.

## Slice 5b: `import`, the round trip, the samples' shelf

**Approved by the owner on 2026-11-19.** What `import` does is written in COMMANDS.md, `quiz library import` (the whole section, with its Output block); this brief says how to build it and how to show it works. The index page's final look is 5c.

### Read first

- This plan: "Goal" (the round trip), "Rules for every slice", slice 5a's brief and review; [STEP5-GAPS.md](STEP5-GAPS.md), G3, G7, G8, G11, G12, G13.
- COMMANDS.md: `quiz library import`, `quiz library publish`, `quiz library register` (all or nothing, names, `--update`, `library.survey`, the refusals and their suggestions), `quiz library init` (which folders it takes, the config), "The library folder", "Git".
- Code: `src/cli/library-register.ts` (the batch: check, names, ids, version files, one commit), `library-init.ts`, `library-publish.ts`, `library-sync.ts`, `src/library/shelf.ts` (the manifest reader), `index-file.ts`, `src/cli/config.ts` (the nearest `fullmark.toml`), `config-write.ts`; `scripts/samples.mjs`; `test/library-contract.test.ts`, `test/library-lock.test.ts`, `test/cli-graph.test.ts`, `test/shelf-determinism.test.ts`.

### Decided for this slice

- **G12 and G13 first:** `publish NAME --on | --off` with an unknown name exits 2 (the `publish-unknown` golden changes; say so); the index page links `ID/index.html` (the `publish-sync*` goldens' index pages change; count them), and `e2e/shelf.spec.ts` follows the link from `file://`, with no static server.
- **One register path.** `import` registers through the same code as `register`: move the batch's core (check under the nearest `fullmark.toml`, the survey refusal, ids, names and their suggestions, the version's files, the index entry, all or nothing) out of `runLibraryRegister` into a function both commands call, with what differs passed in: the id and name each quiz takes (G7, G8), the `added` time, the shelf entry, `source`. **No `register` golden or test changes**; if one has to, stop and report it.
- **`import` in `src/cli/library-import.ts`**, loaded by a dynamic import like every library command. Order: `--into` first (G11: `init`'s folder rules; the config written only when it names no library yet, else the note line); read the manifest when `DIR/fullmark-shelf.json` exists (refused as `publish` refuses: foreign or newer, exit 2) and match each listed quiz by id (G7), else find every `DIR/*/*.md` whose front matter parses (G8); check them all, each under its nearest `fullmark.toml` (the quiz folder's, else one higher up, never above `DIR`); if anything is refused, print every problem and exit 1 with nothing written; else, under the library's lock, write the versions and the index and make one commit, `fullmark: import NAME…` (the names sorted). An `import` that changes nothing (every quiz unchanged) writes and commits nothing, status `unchanged`.
- **The times.** A version imported from a manifest keeps the manifest's `added` when its file's hash is the manifest's; otherwise, and without a manifest, `added` is the injected clock's now. The round trip depends on this: the second library's versions carry the first's times, so its pages are built with the same `built_at`.
- **What comes back with a version:** the quiz folder's files the way `publish` wrote them, less `index.html` and `fullmark.toml` (the rules travel as the version's `check.json`, which `import` writes from the profile it checked under); `brief.yaml` when the shelf has one.

### Tasks

1. **G12 and G13** (one commit), with their goldens counted and the spec changed.
2. **The shared register path** (one commit): the move, with every `register` test and golden unchanged.
3. **`import`** (one commit, or two if large): the command, every case of COMMANDS.md and G7, G8, G11 with a test (a new library from a shelf; into a library that has the quizzes: same hash, an older version with its note, a new hash made current, a file edited after publishing with its warning, a name the library changed with its note, a name taken by another quiz refused with its suggestion; without a manifest, a taken id refused; two `.md` in one folder; a survey refused; a check error refused, nothing written; `--into` an existing library's folder, a non-empty folder (exit 2), with and without a library in the config; each quiz under its own `fullmark.toml` and under one at `DIR`'s top); the lock and its single commit in `test/library-lock.test.ts`; `import` in `test/library-contract.test.ts` and `test/cli-graph.test.ts` (it loads nothing from `src/serve/` or `src/build/`); goldens of COMMANDS.md's two Output blocks and of `--json` for `imported`, `unchanged` and `problems`.
4. **The round trip** (one commit): `test/shelf-round-trip.test.ts`: publish the history library, with quizzes registered under a profile other than their own (G38) and one with a brief published `--with-brief`, into an empty folder; `import --into` a second empty folder; publish the second library into the first folder: `unchanged`, no commit, and every byte of the folder the same; then the same with the second library publishing into a third empty folder, compared byte for byte with the first.
5. **The samples** (one commit): `npm run samples` puts two of the samples' library's quizzes on the shelf and publishes it into `samples/shelf/` (a git repository made when the samples are built), and gains a line for `library publish` (with `--dry-run`, and after `--off`) and one for `library import` (`--into samples/library-2`, then `FULLMARK_LIBRARY` to list it), each with a "try" text like the others; the samples' config is never the owner's.
6. **Do not edit** `docs/plans/` or `docs/design/`. The report as for every slice: every golden added or changed, counted and explained; anything done differently; anything the design left open, as a question, not a choice.

### Done when

Vitest, the typecheck, Biome and knip pass, and `e2e/shelf.spec.ts` in Chromium and Firefox (this slice changes the index page's links; the rest of Playwright runs in 5c); the round-trip test passes; by hand, the planner imports the samples' shelf into a new library and publishes it back with `unchanged`.

### Review (2026-11-19)

**Built** by one agent on Sonnet in `82cf47d` (G12: an unknown name exits 2; G13: the index links `ID/index.html`, and the spec follows it from `file://`), `d64fe29` (`src/cli/library-batch.ts`: the check, the refusals, the names, the version files and the one commit, shared by `register` and `import`), `3d785d0` (`src/cli/library-import.ts`; `findProjectConfig` gains `stopAt`, so the nearest `fullmark.toml` is never looked for above `DIR`; `init` gains a `record` option for G11), `0d7e712` (`test/shelf-round-trip.test.ts`), `da503bf` (the samples' shelf in `samples/shelf/`, a git repository, and the `library publish` and `library import` lines), `325cf26` and `e5de30d` (two test fixes for G13).

**Checked by the planner:** `npm run build` and `npm run check` pass: the startup tests 2 (alone, first), Vitest 3765 in 158 files, Playwright 847 passed (686 lines each in Chromium and Firefox) and 527 skipped, tsc, Biome and knip clean; the whole of Playwright ran, though the brief asked only for the shelf spec. No `register` test or golden changed (the brief's condition for the shared path). Goldens: 6 changed (`publish-unknown` by G12; the index pages of `publish-sync`, `-sync-json`, `-sync-swap`, `-sync-git` by G13, and `publish-sync-git`'s commit hash with them), 5 added (`import-into`, `import-into-config-kept`, `import-json`, `import-unchanged-json`, `import-problems-json`). **By hand**, on the copy of the samples' library from 5a's review: with `study-fixture` and `tidy` on the shelf, `import site --into lib2` on a machine with a library made `lib2`, left the config alone with the note, registered both quizzes on the public shelf in one commit; `list` in `lib2` marked both `public`; publishing `lib2` back to the shelf was `unchanged`, and the shelf's git status stayed clean; `import site` into the first library was `unchanged`.

**Done differently, accepted:** `import --into` runs `init` through a dynamic import (a static one would merge `init` into a shared chunk and break the command graph); `register`'s failed branch no longer pushes an empty warning (it printed nothing); the three `--into` goldens run without git (`library.toml` keeps `source` as an absolute temp path, so the commit hash differs on every run), so their stdout has no `committed` line, which `test/library-import.test.ts` checks instead; the import cases copy their shelf from `publish-sync`'s golden, so a change there reaches them. Raised as G17 and decided by the owner on 2026-11-19 as recommended: the agent's choices where the design was silent.

## Slice 5c: the index page as a table; acceptance

**Approved by the owner on 2026-11-19.** The last slice of step 5. What the index page shows and how it behaves is written in COMMANDS.md, `quiz library publish`, "The index page" (G9, G13, G16); how it looks is the ShelfTable boards in `docs/mockup/boards/` (ShelfTable, ShelfTableDark, ShelfTableVi, ShelfTablePhone, ShelfTablePhoneDark, ShelfTableLong, ShelfTablePhoneLong), whose values (colours, sizes, spacing, borders, radii, shadows) are in each board's inline styles and `renderVals()`. Where a board and COMMANDS.md disagree, COMMANDS.md wins; report it.

### Read first

- This plan: "Goal" (the step's "Done when"), "Rules for every slice", the briefs and reviews of 5a and 5b; [STEP5-GAPS.md](STEP5-GAPS.md), G9, G13, G16.
- COMMANDS.md: `quiz library publish` (all of it), `quiz library import`; TECHNICAL_DESIGN.md section 7 (foundations 8 "Where pages work", with the phone sizes and reproducible screens, and 9), section 11 ("Determinism", "Round trip", "Privacy").
- `docs/mockup/README.md` (how boards are read) and the ShelfTable boards; `ShelfTable.dc.html` holds everything, the others only import it.
- Code: `src/build/shelf-index.ts` (5a's plain page) and its test, `src/cli/library-sync.ts`, the page's theme tokens (where `build` takes the light and dark sets), the catalogs (`src/core/i18n/`: the question type names in `paper.ts`, the start screen's time limit wording), `e2e/shelf.spec.ts`, `e2e/phone-sizes.spec.ts`, a recent screens spec (`e2e/screens-4d.spec.ts`) and how `docs/screens/4d/` was made.

### Decided for this slice

- **One table, restyled on a phone.** The index page is one `<table>` (a caption for screen readers, `<th scope="col">` headings, each row's quiz title in a `<th scope="row">`). Under 520 px the same table is restyled by CSS into one card per row, the numbers labelled from a `data-label` attribute through `::before`, as ShelfTablePhone draws it; no second copy of the content. No `style` attribute anywhere (foundation 3): one style sheet, by hash in the CSP.
- **What each cell holds** (COMMANDS.md, "The index page"): Type is Exam when the published version's stored profile (its `check.json`) is `exam` or extends it, else Practice; "instant feedback" under it when the quiz has `feedback: instant`. The question types under the title are the type names of the paper's catalog (`paper.ts`) in the index's `--ui-lang`, in the default type order (QUIZ_SYNTAX.md, `type_order`), first letter capitalised, joined with " · ". Questions and points as the start screen counts them; the time limit as the start screen's tile writes it; a pass mark as `60%`; a dash for none. The count line uses the catalogs' plurals in both languages. Everything comes from the published version, so the manifest does not change.
- **Light and dark only**, each from the page's own token sets, light by default and dark under `prefers-color-scheme: dark` (5a's review: the plain page carried every theme's tokens). System fonts.
- **The headings stay at the top** while the page scrolls (`position: sticky` on the heading cells; the table's box clips its corners with `overflow: clip`, never `overflow: auto`, so the headings stick to the page). The page has no scroll box of its own.
- **Screens** go to `docs/screens/5c/`, taken by `e2e/screens-5c.spec.ts` as the step-4 screens are (fixed clock, the `FULLMARK_SCREENS` run): the samples-like shelf of five quizzes in light and dark, `--ui-lang vi`, a phone at 390 × 844 in light and dark, a long shelf of 24 quizzes scrolled half-way (the headings at the top), an empty shelf.

### Tasks

1. **The index page** (one commit): `shelf-index.ts` rebuilt as above; its unit tests (each column's value for an exam, a practice quiz with instant feedback, a quiz with no time limit or pass mark, a `vi` quiz on an `en` index, a `vi` index; the type order; the count line in both languages; no `style` attribute; the CSP hash matches the style sheet); the 5a and 5b goldens whose index pages change, counted and explained (only `index.html` and the commit hashes that follow it may move; a manifest or quiz page that changes is a bug).
2. **The browser** (one commit): `e2e/shelf.spec.ts` gains: axe on the index in light and dark; no sideways scroll at 360 × 780, 390 × 844 and 430 × 932, with 44 px targets for each row's link; the headings at the top of the viewport after scrolling a long shelf (desktop); the link from a phone card opens the quiz from `file://`. The screens spec and `docs/screens/5c/`.
3. **Acceptance** (one commit): show the step's "Done when" (Goal) test by test in the report: the round trip, privacy and determinism tests; a `--json` contract test for `publish` (both forms) and `import`; `test/library-lock.test.ts` for `publish NAME --on`, the sync (the shelf's lock) and `import`; the command graph (`check` loads nothing from `src/library/`; `publish` and `import` nothing from `src/serve/`; `import` nothing from `src/build/`); the samples' shelf and lines. Add any test that is missing. Run `npm run samples`.
4. **Do not edit** `docs/plans/` or `docs/design/`. The report as for every slice: every golden and screen added or changed, counted and explained; anything done differently; anything the boards or the design left open, as a question, not a choice.

### Done when

`npm run check` passes in Chromium and Firefox (everything: the last slice); the screens are committed; the step's "Done when" is shown test by test in the report; by hand, the planner publishes the samples' library and opens `samples/shelf/index.html` in both colour schemes and at phone width, and compares it with the boards.

### Fixes (G18, G19)

**Approved by the owner on 2026-11-19.** Two findings from 5c's screens, decided before the review ([STEP5-GAPS.md](STEP5-GAPS.md), G18, G19; COMMANDS.md, "The index page").

1. **G18:** in `src/build/shelf-index.ts`, every question type name after the first wholly in lower case, the first with only its first letter capitalised. Unit test: a `vi` index lists "Một lựa chọn · đúng/sai · …"; an `en` one "Single choice · true or false · …".
2. **G19:** in the index's phone style (under 520 px), the card's four numbers in a grid whose time column is wider than the others, with a gap between cells, each value free to wrap at a space. `e2e/shelf.spec.ts`: at 360 × 780, 390 × 844 and 430 × 932, in `en` and `vi`, with the longest time limit of the fixture ("2 h 20 min", "2 giờ 20 phút"), no two value boxes in a card overlap or touch (at least 8 px apart), and nothing overflows its card.
3. The goldens whose index pages change (count them; only `index.html` and the commit hashes that follow may move), the screens of `docs/screens/5c/` that change, taken again (name them). One commit. The full check in both browsers; `npm run samples`.

### Review (2026-11-19)

**Built** by one agent on Sonnet in `53c4bf7` (the index page as one table from the ShelfTable boards: `src/build/shelf-index.ts`; `lightDarkCss()` in `src/core/themes.ts`, carrying only the light and dark tokens; the shelf's words in `src/core/i18n/shelf.ts`; `ShelfEntry` gains points, pass mark, exam, instant feedback and the question types, filled by `library-sync.ts` from the published version), `20adbf5` (`e2e/shelf.spec.ts`: axe in light and dark, the three phone sizes, 44 px links, the headings at the top after scrolling a long shelf, a phone card's link from `file://`; `e2e/shelf-fixture.ts`; `e2e/screens-5c.spec.ts` and `docs/screens/5c/`), `dfbf158` and `bdd0639` (acceptance: the `--json` contract of `publish` and `import`, the command graph); then, by a second agent on Sonnet, `ee75475` (G18 and G19).

**Checked by the planner:** `npm run build` and `npm run check` pass after the fixes: the startup tests 2 (alone, first), Vitest 3776 in 158 files, Playwright 877 passed (709 lines each in Chromium and Firefox) and 543 skipped (the screens specs), tsc, Biome and knip clean. Goldens: 5 changed in 5c and the same 5 in the fixes (the index pages of `publish-sync`, `-sync-json`, `-sync-swap`, `-sync-git`, and `publish-sync-git`'s commit hash with them); 2 added (`publish-sync-unchanged-json`, `publish-sync-dry-run-json`); no manifest, quiz page or `register` golden changed. Screens: 8 added in `docs/screens/5c/`, 4 of them taken again by the fixes (the two phone screens, the `vi` desktop, the long phone). **By eye**, against the boards: the five-quiz table in light and dark, the `vi` index (G18 found there), the phone cards (G19 found there, and G20 in its fix), a long shelf scrolled half-way with the headings at the top. The samples' shelf index is one table of 7.3 KB, with no `style` attribute and only the light and dark tokens.

**The step's "Done when", each part shown:** the round trip (`test/shelf-round-trip.test.ts`); privacy (`test/shelf-privacy.test.ts`); determinism (`test/shelf-determinism.test.ts`); a `--json` contract for `publish`, both forms, and `import` (`test/library-contract.test.ts`); the lock and one commit for `publish NAME --on`, the sync (the shelf's lock) and `import` (`test/library-lock.test.ts`); the command graph (`test/cli-graph.test.ts`: `check`, `grade`, `inspect`, `stats` load nothing from `src/library/`; `publish`, the sync and `import` nothing from `src/serve/`; `import` no page builder); the samples' shelf and their `library publish` and `library import` lines (`npm run samples`, 33 pages).

**Done differently, accepted:** the screens built from `buildShelfIndex` on the boards' quizzes rather than a published shelf (the narrowest way to five varied quizzes); the command graph checks that `import` loads no page builder, not nothing from `src/build/` (it reads the manifest's schema from there); the type names are the paper's ("Single choice", not the board's "Multiple choice"); the time limit as the start screen writes it ("1 h 30 min"); `line-strong` from the theme (`#88877f`), a hair off the board's; a phone link's 44 px minimum leaves a little more room above the types than the board; G19's fix uses the columns `1.1fr .9fr 1.4fr .8fr`, a 12 px gap and narrower letter-spacing on the labels so "QUESTIONS" fits at 360 px. Raised, and decided by the owner on 2026-11-19 as recommended: G20 (the broken line), G21 (the type order and the empty shelf).

### Fix (G20)

**Approved by the owner on 2026-11-19** ([STEP5-GAPS.md](STEP5-GAPS.md), G20; COMMANDS.md, "The index page"). In `src/build/shelf-index.ts`, under 520 px, the line above a card's numbers is drawn once, across the card (on the row of numbers, or as the row's own border), not on each cell; the cells keep G19's columns and gap below it. `e2e/shelf.spec.ts`: at 360 × 780, the line's box spans the card's content width as one element. The goldens whose index pages change (count them; only `index.html` and the commit hashes that follow may move); the phone screens of `docs/screens/5c/` taken again. One commit; the full check in both browsers; `npm run samples`.
