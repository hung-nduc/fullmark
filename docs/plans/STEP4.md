# Step 4: the library

## Handoff (2026-11-16): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 3 ([archive/STEP3.md](archive/STEP3.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox, the screens when there are any) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered on from step 3: **G149** onward; decided ones move to [STEP4-GAPS.md](STEP4-GAPS.md) (made with the first decision).

**Run faster than step 3** (for the owner to confirm with this plan): the design's open questions are raised **together, now** (G149 to G156, below), not one per slice; slices are fewer and larger, since the library is mostly files and history with little new on screen; any visual polish waits for the last slice. The screens are reproducible (TECHNICAL_DESIGN.md, foundation 8), so a slice's screen diff shows only what it changed.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-16); waits for the owner: the plan, the slice order and G149 to G156 | this file |

### Next

1. The owner approves this plan and decides G149 to G156.
2. The planner writes the decisions into `docs/design/`, then **4a**'s brief.

## Goal

The library: one folder under git that keeps each quiz's versions, the attempts at them and their reports, and the commands over it. TECHNICAL_DESIGN.md section 12, step 4: "Library: init, register, take (with `--section` and `--missed`), replay and the rest"; COMMANDS.md, "Library commands", every command up to and not including `publish` and `import`; USER_DESIGN.md, 4.4.

**Done when** (section 12): **history-based tests pass.** Read here as (G155): a test helper builds a library with a scripted history (registered versions, attempts on old and new versions, grades and regrades, a question changed after it was missed, an essay left ungraded), and the goldens of `list`, `info`, `stats`, `take --missed` (the plan it would serve) and `replay` over it are reviewed and committed. **And:** every library command has a contract test run as a subprocess with `--json`; every command that changes the library commits once and takes the lock (foundation, "Library and shelf writes take a lock"); `check` and the core commands still load nothing from `src/library/` (the command-graph test); `npm run samples` gains a scripted library and a line for `library take`, `library grade --web` and `library replay`, and the owner has tried them.

**Not in step 4:** `library publish` and `library import`, and shelves beyond the reserved `shelves` field and the `public` column (step 5); moving the owner's 0.x history in (step 6); `--background`; the proposals in `docs/design/proposals/`, unless the owner picks one.

## Rules for every slice

Step 3's rules hold ([archive/STEP3.md](archive/STEP3.md), "Rules for every slice", extending step 2's): goldens are the contract; a failure is environmental only when its cause is shown; no real network or real timers in unit tests; a command loads only what it uses; shared pages carry no server code; commits end with the `Co-Authored-By` line of the model that made them, with explicit paths only (never `git add -A`, `-a` or `--amend`); the implementing agent never pushes. Added for step 4:

- **`src/library/` uses core's public API only**, and nothing in `core`, `build` or `serve` imports it (section 7; the lint boundary is added in 4b).
- **Git is real in tests, in a temp folder**: a library test runs real `git` in a fresh temporary folder with a fixed author, committer and date (`GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`), so commits are reproducible. Failure cases (no `git` on the path, a commit that fails) use an injected runner, never a broken machine.
- **The clock and the config folder are injected**: no test reads the owner's real `config.toml` or library (`FULLMARK_CONFIG`, which `check` already reads, points at a temp file in every test).
- **Every write is atomic, under the lock**, and a test kills a writer mid-way (or simulates it) and checks the library is the old state or the new one.

## Gaps

The design leaves these open. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands.

**G149. 1.0 and 0.x share `config.toml`** ([TODO.md](../design/TODO.md), "Before step 4"). Both read `%APPDATA%\fullmark\config.toml` (`~/.config/fullmark/config.toml`); `library init` writes its `library` key, so a 1.0 init would point 0.x at a 1.0 library, and the other way round. 0.x stays in use (as `fullmark-py`, for surveys) until step 6. **Recommendation:** keep one file and one key, and make each refuse the other's library clearly: 1.0's `library.toml` is `format = "fullmark-library"`, `version = 2`; 1.0 refuses a version 1 library (0.x's) with a pointer to the step 6 move-in script, and 0.x already refuses a version newer than its own. `library init` switches the key only with `--force`, as designed, and its message says that 0.x then no longer finds its library. No second config folder: the docs keep one path, and after step 6 there is one library.

**G150. The library's folder layout.** COMMANDS.md names `library.toml`, `check.json` and `quizzes/<id>/reports/`, but no layout. **Recommendation:** 0.x's layout, made simpler by one folder per version:

```text
library.toml                        index (G151)
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

**G151. What `library.toml` holds.** **Recommendation:** `format`, `version = 2`, `created`, and one table per quiz: `name`, `id`, `source` (the absolute path it was registered from, for the `changed` flag), `current` (a version hash), `versions = [{ hash, added }]` in order, `shelves = []` (step 5). No scores or counts: results files are the truth, and `list` reads them (0.x did, in milliseconds at this scale). Written atomically, sorted by name, so its diff reads well.

**G152. Git.** **Recommendation:** fullmark runs the `git` on the path through one small runner (`src/library/git.ts`), passing names after `--`; each changing command makes **one** commit, message `fullmark: <command> <name>` (e.g. `fullmark: take signals`), with the user's own git identity, falling back to `fullmark <fullmark@localhost>` when none is set. A failed commit is a **warning**, not a failure: the files are written, the exit code is the command's, and `status` lists the uncommitted changes. No `git` on the path: `init` makes the folder without a repository, as `--no-git` does, with a warning; `rm` then needs `--force`, as designed.

**G153. The attempt in progress.** `take` "autosaves, so closing the tab or the server resumes the attempt"; `serve --autosave` (3b) writes progress to a file. **Recommendation:** `take` serves with autosave to `quizzes/<id>/progress/<version>.json` (git-ignored); the next `take` of the same version without `--section` or `--missed` resumes it, as the page's Continue does; the file is removed when the attempt is filed. A `take` with `--section` or `--missed` starts its own attempt and leaves a saved one alone. `register --update` warns about a saved attempt, as designed.

**G154. `--missed` across versions.** COMMANDS.md says which questions; not how a missed question of an old version is served. **Recommendation:** questions are matched by `id` across versions. A question missed on an old version and still in the current one is served **as it is now**; when its hash differs from the one missed, the page marks it "changed since you missed it" (one label in both catalogs, next to the question's number). A missed question no longer in the current version is left out and counted in the `--json` output (`"gone": N`). The plan's `source` is `"missed"`.

**G155. "History-based tests".** **Recommendation:** as the Goal says: one helper, `test/helpers/library-history.ts`, that builds a library through the real commands (register, update, files results and grades as `take` and `grade` would, with a fixed clock), used by the unit tests and the samples; its goldens are the step's acceptance.

**G156. The output of the reading commands.** `list`, `info` and `status` have `--plain` and `--json`; their terminal look is not drawn. **Recommendation:** the look of `stats` and `inspect` (step 3): a heading line, aligned columns, `--plain` with no colour; `list` one row per quiz, sorted by name, columns name, title, versions, attempts, last, best, taken, with `changed` and `ungraded` as marks after the name. No board: the goldens are the review.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **4a** | `content.names-control` (G148, decided): the rule, the word lists from the catalogs, the tests, every example passing | nothing open |
| **4b** | The store: config read and write (the `library` key; G149), `library init`, `status`, `path`, `library.toml` (G151), the layout (G150), the lock, the git runner (G152), the lint boundary; contract tests | G149 to G152 |
| **4c** | `library register` (one file, several, `--update`, `--build-file`, `check.json`, surveys refused), `list` (with `changed`, `ungraded`, the `public` column empty), `info`; the history helper started (G155) | 4b |
| **4d** | `library take` (with `--section`, `--missed`, `--focus`, resume; G153, G154), `replay` | 4c |
| **4e** | `library grade` (with `--grades`, `--json` and `--web`, every grades file kept), `stats` | 4d |
| **4f** | `share`, `template add`, `rename`, `rm`; the history goldens complete; the samples' library; acceptance | 4e |

Each slice's brief is written here when the one before it is reviewed; 4a's can be written as soon as the plan is approved, since it needs nothing open.
