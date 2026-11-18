# Step 4: the library

## Handoff (2026-11-16): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 3 ([archive/STEP3.md](archive/STEP3.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox, the screens when there are any) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again in each step; outside the plan one is cited with its step ("step 4, G3"; "STEP4.md, G3" in a code comment), so step 3's G1 to G148 ([archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)) are never confused with these. Decided ones move to [STEP4-GAPS.md](STEP4-GAPS.md).

**Run faster than step 3** (for the owner to confirm with this plan): the design's open questions are raised **together, now** (G1 to G15, below), not one per slice; slices are fewer and larger, since the library is mostly files and history with little new on screen; any visual polish waits for the last slice. The screens are reproducible (TECHNICAL_DESIGN.md, foundation 8), so a slice's screen diff shows only what it changed.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-16); G8 to G15 added (2026-11-18) after a read of COMMANDS.md's library commands; waits for the owner: the plan, the slice order and G1 to G15 | this file |

### Next

1. The owner approves this plan and decides G1 to G15.
2. The planner writes the decisions into `docs/design/`, with G15's output samples and JSON shapes, then **4a**'s brief (4a needs none of the gaps and may start first).

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

**G2. What `library.toml` holds.** **Recommendation:** `format`, `version = 2`, `created`, and one table per quiz: `name`, `id`, `source` (the absolute path it was registered from, for the `changed` flag), `current` (a version hash), `versions = [{ hash, added }]` in order, `shelves = []` (step 5). No scores or counts: results files are the truth, and `list` reads them (0.x did, in milliseconds at this scale). Written atomically, sorted by name, so its diff reads well.

**G3. Git.** **Recommendation:** fullmark runs the `git` on the path through one small runner (`src/library/git.ts`), passing names after `--`; each changing command makes **one** commit, message `fullmark: <command> <name>` (e.g. `fullmark: take signals`), with the user's own git identity, falling back to `fullmark <fullmark@localhost>` when none is set. A failed commit is a **warning**, not a failure: the files are written, the exit code is the command's, and `status` lists the uncommitted changes. No `git` on the path: `init` makes the folder without a repository, as `--no-git` does, with a warning; `rm` then needs `--force`, as designed.

**G4. The attempt in progress.** `take` "autosaves, so closing the tab or the server resumes the attempt"; `serve --autosave` (3b) writes progress to a file. **Recommendation:** `take` serves with autosave to `quizzes/<id>/progress/<version>.json` (git-ignored); the next `take` of the same version without `--section` or `--missed` resumes it, as the page's Continue does; the file is removed when the attempt is filed. A `take` with `--section` or `--missed` starts its own attempt and leaves a saved one alone. `register --update` warns about a saved attempt, as designed.

**G5. `--missed` across versions.** COMMANDS.md says which questions; not how a missed question of an old version is served. **Recommendation:** questions are matched by `id` across versions. A question missed on an old version and still in the current one is served **as it is now**; when its hash differs from the one missed, the page marks it "changed since you missed it" (one label in both catalogs, next to the question's number). A missed question no longer in the current version is left out and counted in the `--json` output (`"gone": N`). The plan's `source` is `"missed"`.

**G6. "History-based tests".** **Recommendation:** as the Goal says: one helper, `test/helpers/library-history.ts`, that builds a library through the real commands (register, update, files results and grades as `take` and `grade` would, with a fixed clock), used by the unit tests and the samples; its goldens are the step's acceptance.

**G7. The output of the reading commands.** `list`, `info` and `status` have `--plain` and `--json`; their terminal look is not drawn. **Recommendation:** the look of `stats` and `inspect` (step 3): a heading line, aligned columns, `--plain` with no colour; `list` one row per quiz, sorted by name, columns name, title, versions, attempts, last, best, taken, with `changed` and `ungraded` as marks after the name. No board: the goldens are the review.

**G8. The exit code for "no library".** COMMANDS.md disagrees with itself: `register`, `info`, `template add` and `import` exit `3`, `status` and `list` exit `2`. Exit `3` means "a human-only value is missing", which a library is not (it is set up once, by `init`). **Recommendation:** `2` for every library command, with the message "no library: run `quiz library init PATH`"; `import`'s "no library and no `--into`" becomes `2` too.

**G9. `take` and the lock.** `take` serves with no time limit, and the lock is held "until done". Holding it while the page is open would make every other changing command (`grade`, `register`, a second `take`) wait 10 seconds and fail for as long as a quiz is open. **Recommendation:** `take` takes the lock only to file the result and commit, never while serving. Two `take`s of the same quiz are kept apart by the progress file instead: it holds the serving process's id and URL, and a second `take` of that quiz while the first's process is alive exits 2, printing the URL to open; a progress file whose process is gone is resumed (G4).

**G10. `library rm --json` without `--yes`.** `--json` never prompts, and `rm` asks. **Recommendation:** as `template rm`: with `--json` and without `--yes`, exit 2, with the fix "add `--yes`".

**G11. What `library status` counts as a problem.** It lists diagnostics and exits `1` on "problems", without saying which. **Recommendation:** **problems** (exit `1`): the configured folder missing or not a library, `library.toml` that does not parse or names a version folder that is missing, a version whose files no longer match its hash, a library `fullmark.toml` that does not parse or names unknown rules. **Notes** (exit `0`, printed): uncommitted changes, no remote, no git repository (`--no-git`), orphan files, a stale lock, `FULLMARK_LIBRARY` set. `--json`: `{"status": "healthy" | "problems", "library", "config", "git": {"repository", "uncommitted", "remote"}, "counts": {"quizzes", "versions", "attempts", "reports"}, "problems": [{"code", "path", "message", "fix"}], "notes": [{"code", "path", "message"}]}`.

**G12. Quiz ids in the library.** G1 names folders by the quiz's `id`, and `new` warns that two quizzes sharing an id would mix their histories, but `register` does not say what happens when they do. **Recommendation:** a new quiz (no `--update`) whose `id` is already in the library is refused (exit `1`, rule `library.id-taken`) with two fixes: "if it is the same quiz, `--update NAME`; if not, give it a new `id:`"; two files in one batch with the same id are refused the same way. `--update NAME` with a file whose `id` is not that quiz's is refused (`library.id-mismatch`), since a version keeps its quiz's id.

**G13. What a name is.** A quiz is named "by its name or its id", and the default name is the slugged title, but no rule says what a valid name is or what happens when one quiz's name is another's id. **Recommendation:** a name is a slug (`a`–`z`, `0`–`9`, `-`, 1 to 64 characters, as `new` makes ids), checked by `register -n`, `--update` and `rename`; it may equal the quiz's own id but not another quiz's name or id (exit `1`, "name taken", with a free name suggested). Lookup tries names first, then ids, so it is never ambiguous.

**G14. `library stats` with one attempt.** `quiz stats` needs two files; `library stats` exits 2 on "no attempts" and says nothing of one. **Recommendation:** one attempt is shown (the same blocks, `Weakest` left out until a tag is seen twice, as its rule already says); only no attempts exits 2.

**G15. The output of every other library command.** G7 covers `list`, `info` and `status`; the human output of `init`, `register`, `take`, `replay`, `grade`, `share`, `template add`, `rename`, `rm` and `path` is not drawn, and `init`, `share`, `rename`, `rm` and `path` have no `--json` shape (`library stats`'s is presumably `quiz stats`'s; `take`'s `status` values are not listed). **Recommendation:** before 4b, the planner writes a text sample and a `--json` shape for every library command into COMMANDS.md, in the style of `inspect` (G7), as one commit for the owner to read; the slices then build to them and the goldens check them.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **4a** | `content.names-control` (step 3's G148, decided): the rule, the word lists from the catalogs, the tests, every example passing | nothing open |
| **4b** | The store: config read and write (the `library` key), `library init`, `status`, `path`, `library.toml` (G2), the layout (G1), the lock, the git runner (G3), the lint boundary; contract tests | G1 to G3 |
| **4c** | `library register` (one file, several, `--update`, `--build-file`, `check.json`, surveys refused), `list` (with `changed`, `ungraded`, the `public` column empty), `info`; the history helper started (G6) | 4b |
| **4d** | `library take` (with `--section`, `--missed`, `--focus`, resume; G4, G5), `replay` | 4c |
| **4e** | `library grade` (with `--grades`, `--json` and `--web`, every grades file kept), `stats` | 4d |
| **4f** | `share`, `template add`, `rename`, `rm`; the history goldens complete; the samples' library; acceptance | 4e |

Each slice's brief is written here when the one before it is reviewed; 4a's can be written as soon as the plan is approved, since it needs nothing open.
