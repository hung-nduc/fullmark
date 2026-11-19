# Step 5: `publish` and `import`

## Handoff (2026-11-19): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 4 ([archive/STEP4.md](archive/STEP4.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox when the slice runs Playwright, the screens when there are any, and the commands by hand) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again; outside this plan one is cited with its step ("step 5, G3"; "STEP5.md, G3" in a code comment). Decided ones move to `STEP5-GAPS.md`.

**Run like step 4:** the design's open questions are raised **together, now** (G1 to G11 below), not one per slice; three slices; the one new screen (the shelf's index page) is drawn on the owner's canvas before the last slice and styled there.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-19); G1 to G11 raised, waiting for the owner | this file |
| 5a | brief written once G1 to G6 and G10 are decided | |
| 5b | | |
| 5c | | |

### Next

1. The owner decides G1 to G11 (each has a recommendation).
2. The planner writes the decisions into COMMANDS.md and TECHNICAL_DESIGN.md, moves them to `STEP5-GAPS.md`, and writes slice 5a's brief for the owner to approve.
3. Before 5c: the shelf's index page is drawn on the "fullmark themes" canvas (G9).

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

**G1. The shelf folder's layout.** COMMANDS.md says what a shelf holds (each quiz's current Markdown, assets and built page, an index page, the manifest) and that a quiz folder not in the manifest exits 1, but not how the folder is laid out or what the page is called. **Recommendation:** one folder per quiz at the top level, **named by the quiz's id** (as in the library, so `rename` moves nothing and a link someone saved keeps working; ids are slugs, so the URLs read well). It holds the version's source under its own file name, every asset and `materials` sheet at its relative path, the built page as `index.html` (so GitHub Pages serves it at `…/ID/`), `brief.yaml` only with `--with-brief`, and never `check.json` (the rules travel as `fullmark.toml`, G3). The top level holds `index.html` (the index page), `fullmark-shelf.json` and nothing else of fullmark's; README, LICENSE, `.github/` and other files of the owner's are left alone.

**G2. The manifest, `fullmark-shelf.json`.** Its fields are not written down, and its zod schema and JSON Schema were due in step 4 and not built (TECHNICAL_DESIGN.md, section 3, now says step 5). **Recommendation:** `{"format": "fullmark-shelf", "version": 2, "ui_lang", "with_brief", "fonts", "quizzes": [{"id", "name", "title", "lang", "hash", "added", "file", "files"}], "files"}`: `version` 2 like every 1.0 format (`results-v2`, `review-v2`); quizzes sorted by id; `hash` and `added` of the published version (so `import` can keep the time and spot a hand-edited file); `file` the source's name; `files` every path the sync wrote for that quiz, and the top-level `files` the paths it wrote at the root, so a later sync removes only paths the manifest lists. No time of publishing, so the same library state gives the same bytes. Written with sorted keys and a trailing newline, like `library.toml`. A manifest whose `format` is not `fullmark-shelf` is foreign and one whose `version` is above 2 is newer: both exit 2, as COMMANDS.md says. The schema goes to `schemas/fullmark-shelf-v2.schema.json` through `npm run schemas`.

**G3. One `fullmark.toml` per quiz folder, not one at the shelf's root.** COMMANDS.md says a shelf holds "a `fullmark.toml` with the custom profiles those quizzes use", and `import` reads it. But step 4's G38 makes `share --source` write `profile = NAME` when a quiz was registered under a profile other than its own, and one root file can name only one profile, so a shelf of quizzes registered under different profiles cannot say each one's. **Recommendation:** each quiz folder gets exactly the `fullmark.toml` `share --source` would write for that version (G35 and G38: none when the quiz would get the same rules by itself), and the root gets none. `quiz check DIR/ID/FILE.md` then finds what the library found, because the nearest `fullmark.toml` is the quiz folder's. `import` checks each quiz under the nearest `fullmark.toml`, as `register` does, so a hand-made folder with one root file still works. COMMANDS.md (`publish`, `import`) and TECHNICAL_DESIGN.md (section 5, "In the library") are reworded to match.

**G4. Where the shelf folder is remembered, and a missing one.** "Remembered in the config after the first successful sync", keyed by shelf name, but the key's shape and what happens when a later sync names another folder are not written down; nor is a `DIR` that does not exist. **Recommendation:** `config.toml` gains `[shelves]` with `public = "/abs/path"` (written by the same writer as the `library` key, keeping the rest of the file and its comments). Each successful sync records its `DIR` there, replacing the one before, and says so in a line when it changes ("remembered DIR as the public shelf"). A missing `DIR` is created (its parents too); fullmark never runs `git init` in it.

**G5. A shelf inside a repository, not at its root.** COMMANDS.md commits only "if `DIR` is its own git repository". GitHub Pages also serves a repository's `docs/` folder, a common place for a site beside other files, and then nothing would be committed. **Recommendation:** commit when `DIR` is anywhere inside a git work tree, with `git -C DIR commit -- PATHS` holding only the paths the sync wrote or removed (as in the library, the owner's own changes are never swept in), message `fullmark: publish`. A failed commit is a warning, as in the library. Never `git init`, never push.

**G6. What a sync refuses in a folder it did not write.** "A quiz folder in `DIR` is not in the manifest" exits 1, but a "quiz folder" is not defined, nor what happens in a non-empty folder with no manifest (the first sync into an existing site). **Recommendation:** a quiz folder is a top-level folder holding an `.md` file and an `index.html` at its top level. With a manifest, such a folder that the manifest does not list exits 1 (a quiz copied in by hand, or another tool's), naming it, with the fix "move it out of DIR, or import it into the library first". With no manifest, the folder may hold anything except a quiz folder (same exit) or an `index.html` at its root (exit 1: the sync would overwrite the owner's page; fix "move it, or publish into an empty folder"). A sync never removes or changes a path its manifest does not list.

**G7. `import` into a library that already has some of the quizzes.** COMMANDS.md covers the same hash (unchanged) and a different one ("adds a version, with a warning if the file was edited after publishing"), but not a name taken by another quiz, a shelf older than the library, or which version becomes current. **Recommendation:** quizzes are matched **by id**. Same id: the library's name is kept (a rename in the library is the owner's), and a note says when the shelf calls it otherwise. The shelf's hash is the current version: unchanged. It is an older version of the quiz: unchanged, with a note "the shelf has an older version (HASH)"; nothing goes backwards. A new hash: a new version, made current, as `register --update` does, with `added` the manifest's time when the file still matches the manifest's hash, else now, with the warning that it was edited after publishing. New id: registered under the shelf's name; a name already taken by another quiz refuses the import (all or nothing, exit 1), with the suggestion of a free name as `register` gives. Every imported quiz gets the `public` shelf entry, and `source` is the file's absolute path in `DIR` (so `list` shows `changed` when the shelf's file is edited later).

**G8. `import` without a manifest: which id.** COMMANDS.md says every `DIR/*/*.md` is registered "with a new id and its slugged title", but a 1.0 quiz carries its `id` in its front matter, and `register` takes it from there and refuses a taken one. **Recommendation:** as `register`: the front matter's id, the slugged title as the name (else the id), all or nothing, a taken id or name refused with its suggestion; no shelf entry, since no shelf owned the folder; `added` is now. Two `.md` files in one folder are two quizzes, each registered with the folder's assets.

**G9. The shelf's index page.** COMMANDS.md says it lists every quiz with its `lang` badge and has `--ui-lang` for its own chrome, but not what else it shows or how it looks. It is the one new screen of the step, and a phone opens it first (TECHNICAL_DESIGN.md, foundation 8: phones are supported through a shelf). **Recommendation:** a static page with no script at all: a heading (the shelf folder's name), then one row per quiz sorted by title, each with its title as the link to `ID/`, the `EN`/`VI` badge, the number of questions and the time limit when there is one. The page's theme tokens with light and dark through `prefers-color-scheme`, system fonts (no embedded font), a CSP with only its own style sheet's hash, the phone sizes of foundation 8. The planner draws it on the "fullmark themes" canvas, styled like the form boards, for the owner to approve before slice 5c; 5a writes a plain version with the same content.

**G10. The output of `publish` and `import`.** COMMANDS.md has no Output block for either. **Recommendation:** these, with the `--json` shapes COMMANDS.md already gives:

```text
$ quiz library publish signals --on
signals is on the public shelf
committed 1a2b3c4 fullmark: publish signals --on
next: quiz library publish

$ quiz library publish ~/sites/quizzes --dry-run
would publish 3 quizzes to /home/minh/sites/quizzes
  add     signals/    new on the shelf
  update  calculus/   version 7c1e → 2b9d
  remove  old-quiz/   off the shelf
  update  index.html
nothing written (--dry-run)

$ quiz library publish ~/sites/quizzes
published 3 quizzes to /home/minh/sites/quizzes: 1 added, 1 updated, 1 removed
remembered /home/minh/sites/quizzes as the public shelf
committed 5d6e7f8 fullmark: publish (in /home/minh/sites/quizzes)
next: git -C /home/minh/sites/quizzes push   (fullmark never pushes)

$ quiz library publish
unchanged: /home/minh/sites/quizzes already matches the library (3 quizzes)

$ quiz library import ~/sites/quizzes --into ~/quiz-library-2
library ready /home/minh/quiz-library-2 (new folder, git repository)
imported 3 quizzes: calculus, rust-basics, signals (on the public shelf)
committed 9a8b7c6 fullmark: import calculus rust-basics signals
note a shelf holds no results, reports or older versions: import restores quizzes, not a backup
```

`--on` for a quiz already on the shelf (and `--off` for one that is not) says so, commits nothing and exits 0. An unknown name exits 1 as in every library command.

**G11. `import --into` when the machine already has a library.** "Create a library at `PATH` first, with the rules of `library init`": `init` records the new library in `config.toml` and, without `--force`, refuses to switch from another one. `import` has no `--force`, so on a machine with a library `--into` would always fail, the round-trip test included. **Recommendation:** `--into` creates the library with `init`'s rules for the folder (new, missing or empty; refused otherwise, exit 2) and records it in the config only when the config names no library yet. Otherwise the config is left alone, and the output adds a line "your library is still OLD; use this one with `FULLMARK_LIBRARY=PATH` or `quiz library init PATH --force`".

## Slices

| Slice | Content | Needs |
|---|---|---|
| **5a** | Step 4's G38; shelf entries as tables in `library.toml` (`shelves = [{ shelf = "public", kind = "quiz" }]`, unknown entries kept; today's code reads `shelves` as strings, always empty); `publish NAME --on \| --off`, `list`'s `public` column and `info`'s shelves; the manifest's zod schema and JSON Schema; the sync (built in memory, written only where changed, removed only where the old manifest lists, the shelf's lock, the commit, `--dry-run`, `--json`, the remembered `DIR`, every exit code); a plain index page; the privacy and determinism tests | G1 to G6, G10 |
| **5b** | `import` (with and without a manifest, `--into`, each quiz under its nearest `fullmark.toml`); the round-trip test; the samples' shelf and their `publish` and `import` lines | 5a, G7, G8, G11 |
| **5c** | The index page from the owner's board (G9): look, phone sizes, axe, screens; acceptance: the contract and lock tests for both commands, the command graph, everything run in both browsers | 5b, G9's board |

Each slice's brief is written here when the one before it is reviewed; 5a's once its gaps are decided.
