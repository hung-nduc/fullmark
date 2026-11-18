# Step 4: the library

## Handoff (2026-11-16): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 3 ([archive/STEP3.md](archive/STEP3.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox, the screens when there are any) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again in each step; outside the plan one is cited with its step ("step 4, G3"; "STEP4.md, G3" in a code comment), so step 3's G1 to G148 ([archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)) are never confused with these. Decided ones move to [STEP4-GAPS.md](STEP4-GAPS.md).

**Run faster than step 3** (for the owner to confirm with this plan): the design's open questions are raised **together, now** (G1 to G17, below), not one per slice; slices are fewer and larger, since the library is mostly files and history with little new on screen; any visual polish waits for the last slice. The screens are reproducible (TECHNICAL_DESIGN.md, foundation 8), so a slice's screen diff shows only what it changed.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-16); G8 to G15 added (2026-11-18); the owner decided G4 to G6 and G8 to G14 as recommended (2026-11-18), written into COMMANDS.md and TECHNICAL_DESIGN.md; G3 extended and G16 raised on the owner's questions; G7 and G15 drawn on the canvas | this file |

### Next

1. The owner decides G1 to G3, G16 and G17, and reviews the CLI boards (G7, G15) on the canvas.
2. The planner writes those decisions into `docs/design/`, with the boards' text and JSON shapes into COMMANDS.md, then **4a**'s brief (4a needs none of the gaps and may start first).

## Goal

The library: one folder under git that keeps each quiz's versions, the attempts at them and their reports, and the commands over it. TECHNICAL_DESIGN.md section 12, step 4: "Library: init, register, take (with `--section` and `--missed`), replay and the rest"; COMMANDS.md, "Library commands", every command up to and not including `publish` and `import`; USER_DESIGN.md, 4.4.

**Done when** (section 12): **history-based tests pass.** Read here as (G6): a test helper builds a library with a scripted history (registered versions, attempts on old and new versions, grades and regrades, a question changed after it was missed, an essay left ungraded), and the goldens of `list`, `info`, `stats`, `take --missed` (the plan it would serve) and `replay` over it are reviewed and committed. **And:** every library command has a contract test run as a subprocess with `--json`; every command that changes the library commits once and takes the lock (foundation, "Library and shelf writes take a lock"); `check` and the core commands still load nothing from `src/library/` (the command-graph test); `npm run samples` gains a scripted library and a line for `library take`, `library grade --web` and `library replay`, and the owner has tried them.

**Not in step 4:** `library publish` and `library import`, and shelves beyond the reserved `shelves` field and the `public` column (step 5); moving the owner's 0.x history in (step 6); `--background`; the proposals in `docs/design/proposals/`, unless the owner picks one.

## Rules for every slice

Step 3's rules hold ([archive/STEP3.md](archive/STEP3.md), "Rules for every slice", extending step 2's): goldens are the contract; a failure is environmental only when its cause is shown; no real network or real timers in unit tests; a command loads only what it uses; shared pages carry no server code; commits end with the `Co-Authored-By` line of the model that made them, with explicit paths only (never `git add -A`, `-a` or `--amend`); the implementing agent never pushes. Added for step 4:

- **`src/library/` uses core's public API only**, and nothing in `core`, `build` or `serve` imports it (section 7; the lint boundary is added in 4b).
- **Git is real in tests, in a temp folder**: a library test runs real `git` in a fresh temporary folder with a fixed author, committer and date (`GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`), so commits are reproducible. Failure cases (no `git` on the path, a commit that fails) use an injected runner, never a broken machine.
- **The clock and the config folder are injected**: no test reads the owner's real `config.toml` or library (`FULLMARK_CONFIG`, which `check` already reads, points at a temp file in every test).
- **Every write is atomic, under the lock**, and a test kills a writer mid-way (or simulates it) and checks the library is the old state or the new one.

## Gaps

The design leaves these open. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands.

**G1. The library's folder layout.** COMMANDS.md names `library.toml`, `check.json` and `quizzes/<id>/reports/`, but no layout. **Recommendation:** 0.x's layout, made simpler by one folder per version:

```text
library.toml                        index (G2)
.gitignore                          .fullmark.lock, progress files, *.tmp
quizzes/<id>/
  versions/<hash>/                  one per version, never changed once written
    <file>.md                       the source, under its original file name
    assets/, materials/, …          every file the quiz uses, at its relative path
    brief.yaml                      when one sat next to the source
    check.json                      the resolved rules it was registered with
  results/<YYYYMMDD-HHMMSS>.json    one per attempt (results-v2; the attempt names its version)
  grades/<stamp>-<YYYYMMDD-HHMMSS>-grades.json   every grades file kept; the newest per attempt counts
  reports/<stamp>-report.json, .md  the report of the newest grades for that attempt
  progress/<version>.json           an attempt in progress (autosave), git-ignored
```

Folders are named by the quiz's `id`, never its name (so `rename` moves nothing). Assets are stored per version, not shared across versions: git stores a file that did not change once, so the repository does not grow, and a version folder is complete on its own (`share --source` copies it).

*Owner's question (2026-11-18): does the library support `review`, where are its verdicts saved, and is an edited quiz the same quiz with a new version or a new quiz?* See **G16**; if G16 is decided as recommended, the layout adds `quizzes/<id>/review.json`.

**G2. What `library.toml` holds.** **Recommendation:** `format`, `version = 2`, `created`, and one table per quiz: `name`, `id`, `source` (the absolute path it was registered from, for the `changed` flag), `current` (a version hash), `versions = [{ hash, added }]` in order, `shelves = []` (step 5). No scores or counts: results files are the truth, and `list` reads them (0.x did, in milliseconds at this scale). Written atomically, sorted by name, so its diff reads well.

**G3. Git.** **Recommendation:** fullmark runs the `git` on the path through one small runner (`src/library/git.ts`), passing names after `--`; each changing command makes **one** commit, message `fullmark: <command> <name>` (e.g. `fullmark: take signals`), with the user's own git identity, falling back to `fullmark <fullmark@localhost>` when none is set. A failed commit is a **warning**, not a failure: the files are written, the exit code is the command's, and `status` lists the uncommitted changes. No `git` on the path: `init` makes the folder without a repository, as `--no-git` does, with a warning; `rm` then needs `--force`, as designed.

*Owner's questions (2026-11-18): where does git run from, and is that set per library (`library.toml`) or per machine (`config.toml`)? Is the git identity part of setup, a warning or `status`? Does fullmark run `git init`, or does the user do their own git?* **Recommendation, added:**
- **Which repository:** always the library's root (`git -C ROOT`), where ROOT comes from `FULLMARK_LIBRARY` or `library` in `config.toml`. The library is its own repository: `init` runs `git init` there (unless `--no-git`), writes `.gitignore` and makes the first commit, `fullmark: init`. An existing repository is adopted only when the folder is its root; a folder inside another repository gets its own, with a note that the outer one should ignore it.
- **Which `git`:** the one on the path, or `git = "PATH"` in `config.toml` when set (Git installed off the path, as GitHub Desktop does on Windows). Never in `library.toml`: that file travels with the repository to other machines, where the path differs.
- **Identity:** not asked for, never written into git's config. `init` and `status` say which identity commits use; when git has none for the library, `init` prints a note with the command to set one (`git -C ROOT config user.name "…"` and `user.email`), and commits pass `fullmark <fullmark@localhost>` for that commit only (`-c user.name=… -c user.email=…`). `status` shows it as a note, never a problem.
- **What fullmark does with git, and nothing more:** `init`, and one commit per changing command holding **only the paths it wrote** (`git commit -- PATHS`), so the user's own staged or unstaged changes in the library are never swept in. It never pushes, pulls, fetches, branches, rebases or rewrites history; remotes, sync between machines and conflicts are the user's own git. `status` reads the repository (uncommitted changes, remote) and changes nothing.

**G7. The output of the reading commands.** *Drawn on the canvas (2026-11-18), row "CLI: quiz library (G7, G15)": LibraryList, LibraryInfo, LibraryStatus. Done differently from the recommendation below: `list`'s marks are a last column, NOTES ("source changed", "1 ungraded", and "public" from step 5), not marks after the name, so the name column stays a plain name to copy; a score with grades pending carries an asterisk, as on the page.* `list`, `info` and `status` have `--plain` and `--json`; their terminal look is not drawn. **Recommendation:** the look of `stats` and `inspect` (step 3): a heading line, aligned columns, `--plain` with no colour; `list` one row per quiz, sorted by name, columns name, title, versions, attempts, last, best, taken, with `changed` and `ungraded` as marks after the name. No board: the goldens are the review.

**G15. The output of every other library command.** *Drawn on the canvas (2026-11-18): LibrarySetup, LibraryTake, LibraryGrade, LibraryTidy, with the missing `--json` shapes. The common shape: a bold heading naming the quiz, attempt and version; one coloured verb per outcome (`registered`, `filed`, `report`, `written`, `deleted`); findings in `check`'s issue format with `fix:`; then, dim, `next:` and `committed <hash> <message>`. Once approved, the planner writes them into COMMANDS.md.* G7 covers `list`, `info` and `status`; the human output of `init`, `register`, `take`, `replay`, `grade`, `share`, `template add`, `rename`, `rm` and `path` is not drawn, and `init`, `share`, `rename`, `rm` and `path` have no `--json` shape (`library stats`'s is presumably `quiz stats`'s; `take`'s `status` values are not listed). **Recommendation:** before 4b, the planner writes a text sample and a `--json` shape for every library command into COMMANDS.md, in the style of `inspect` (G7), as one commit for the owner to read; the slices then build to them and the goldens check them.

**G16. Reviews in the library.** The design has `quiz review` on a file and `register --review REVIEW`, but no review of a quiz already in the library, and no place for its verdicts. **Recommendation:**
- **`quiz library review NAME [--since] [--timeout SECONDS] [--port N] [--no-open] [--json]`**: `quiz review` with the lookup done, as `library replay` is `quiz replay`. It serves the review form on the current version; `--since` asks only what is new or changed since the stored review. Finish writes, under the lock, and commits (`fullmark: review NAME`).
- **Saved at `quizzes/<id>/review.json`**: one review per quiz, not per version. `review-v2` already keys each verdict by question id with the question's hash, and merges, so one file follows the quiz across versions; git keeps its history.
- **An edit is the same quiz, a new version.** The id stays (G12) and the question ids stay, so attempts, `--missed` and `stats` carry over: a fixed question has a new hash, and `--missed` marks it changed (G5); a dropped question is gone (counted in `gone`). The edit is made on the original source, or on a copy from `share --source`, and comes back with `register FILE --update NAME`. A new quiz (new id, no history) is only made on purpose, with `quiz new --from`.
- **`register --update` applies the stored review** as `check --review` does: `review.fix` and `review.drop` refuse the version until every flagged question has changed or gone (exit `1`), and `review.unconfirmed` warns until a `library review NAME --since` judges it again. `--review REVIEW` given explicitly replaces the stored one for that run.
- **`list` and `info`** gain a field `flagged`: the count of `fix` and `drop` verdicts still open on the current version (added, never renamed, as `list`'s fields promise).
- **In slice 4f**, with `share`.

**G17. Resuming an attempt after `register --update`.** COMMANDS.md says an attempt saved on the old version "stays tied to the version it started on", and G4 resumes only "the same version": so after an update, `take` builds the new current version and the saved attempt can never be resumed. **Recommendation:** a plain `take` (no `--section`, `--missed`) resumes a saved attempt on any version, oldest saved first, saying so ("resuming your attempt of 18 Nov 14:02 on version 41c0; the quiz has been updated since"); it is filed against that version; the next `take` uses the current one. `register --update`'s warning says this (drawn on LibrarySetup).

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
