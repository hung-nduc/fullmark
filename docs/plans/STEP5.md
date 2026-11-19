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
| 5a | built and reviewed (2026-11-19); G12 to G15 raised, waiting for the owner | `fd845f5`, `03976b3`, `5d091f8`, `1f04c50`, `1ea9dec`, `818ae45` |
| 5b | | |
| 5c | | |

### Next

1. The owner decides G12 to G15 (each has a recommendation); then the planner writes slice 5b's brief, starting with them.
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

**G12. An unknown quiz name in `publish NAME --on | --off`.** G10's text, written into COMMANDS.md, says an unknown name "exits 1 as in every library command", but every other library command exits **2** for an unknown quiz (`info`, `take`, `replay`, `review`, `share`, `template add`, `grade`); the slip was the planner's. 5a followed the text and exits 1. **Recommendation:** exit 2, as every library command; COMMANDS.md's `publish` Exit list corrected, the code and its golden (`publish-unknown`) changed first in 5b.

**G13. The index page's links from a file.** The index links each quiz as `ID/`. Over http (GitHub Pages) that serves `ID/index.html`, but a shelf opened from the disk (`file://`), which is how an owner looks at it before pushing, shows a folder listing instead of the quiz. **Recommendation:** link `ID/index.html`, which works both ways; COMMANDS.md's "The index page" says so.

**G14. The favicon request on a shared page over http.** A browser asks a served page for `/favicon.ico`; the CSP of every shared page (since step 2) blocks it, and Firefox logs a CSP error in the console. Nothing breaks and nothing is sent. An empty icon would need `img-src data:` in the CSP. **Recommendation:** no change: the blocked request is the CSP doing its job, and the message is only in the console. The 5a spec ignores that one message, with a comment saying why.

**G15. What 5a chose where the design was silent.** **Recommendation:** accept these and write them into COMMANDS.md, `publish`: (a) a path the sync would write that exists in `DIR`, differs and is not in the manifest (the owner's `rust/index.html` in a folder that is not a quiz folder) exits 1, nothing written, with the fix "move it, or publish into an empty folder"; (b) a manifest that is not valid JSON or not of the schema's shape exits 2, as a foreign one, and one whose `version` is below 2 is foreign; (c) `--json`'s `added`, `updated` and `removed` are arrays of quiz ids, and a dry run gives the same object with `"dry_run": true`; (d) `NAME --on | --off --json` gives `{"status": "on" | "off" | "unchanged", "name", "committed"}`; (e) `--on` or `--off` with a sync option, or both together, exits 2; (f) outside a git repository each sync says "not in a git repository, so nothing was committed".

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

**Done differently, accepted:** the sync in its own chunk; fonts always passed to the build explicitly (otherwise the page's Information tab differs between the first sync and the next, and the second is not `unchanged`), so a shelf page equals `quiz build --fonts X`, not a build with no flag; G38's test uses `draft` rather than `exam` (an `exam` finding is an error, which `register` refuses); `list --json`'s `shelves` lists every entry's shelf name, the `public` mark only `kind = "quiz"`; a dry run lists a manifest line when only the manifest would change, and "files changed" when a quiz's files change with its hash (fonts, the program's version). Raised as gaps: the unknown-name exit (G12), the links (G13), the favicon (G14), the rest of the agent's choices (G15). **To look at in 5c:** the index page carries every theme's token set though it uses only light and dark.
