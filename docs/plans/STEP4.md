# Step 4: the library

## Handoff (2026-11-16): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 3 ([archive/STEP3.md](archive/STEP3.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews (`npm run build`, `npm run check` in Chromium and Firefox, the screens when there are any) and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` as plain statements and become the next brief's first tasks. Commit after every round. Gaps are numbered from **G1** again in each step; outside the plan one is cited with its step ("step 4, G3"; "STEP4.md, G3" in a code comment), so step 3's G1 to G148 ([archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)) are never confused with these. Decided ones move to [STEP4-GAPS.md](STEP4-GAPS.md).

**Run faster than step 3** (for the owner to confirm with this plan): the design's open questions are raised **together, now** (G1 to G18; all decided but G7 and G15, the output, which wait for the owner's review of the CLI boards), not one per slice; slices are fewer and larger, since the library is mostly files and history with little new on screen; any visual polish waits for the last slice. The screens are reproducible (TECHNICAL_DESIGN.md, foundation 8), so a slice's screen diff shows only what it changed.

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-16); G8 to G15 added (2026-11-18); the owner decided G4 to G6 and G8 to G14 as recommended (2026-11-18), written into COMMANDS.md and TECHNICAL_DESIGN.md; G3 extended and G16 raised on the owner's questions; G7 and G15 drawn on the canvas; G18 raised and decided as recommended (2026-11-18), written into COMMANDS.md ("Terminal style") and TECHNICAL_DESIGN.md ; G1 to G3, G16 and G17 decided as recommended (2026-11-18), written into COMMANDS.md, TECHNICAL_DESIGN.md and USER_DESIGN.md | this file |

### Next

1. The owner reviews the CLI boards on the canvas (G7, G15; row "CLI: quiz library").
2. The planner writes the boards' text and JSON shapes into COMMANDS.md (G7, G15 decided), then **4a**'s brief. 4a needs none of the gaps and may start before the boards are approved.

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

**G7. The output of the reading commands.** *Drawn on the canvas (2026-11-18), row "CLI: quiz library (G7, G15)": LibraryList, LibraryInfo, LibraryStatus. Done differently from the recommendation below: `list`'s marks are a last column, NOTES ("source changed", "1 ungraded", and "public" from step 5), not marks after the name, so the name column stays a plain name to copy; a score with grades pending carries an asterisk, as on the page.* `list`, `info` and `status` have `--plain` and `--json`; their terminal look is not drawn. **Recommendation:** the look of `stats` and `inspect` (step 3): a heading line, aligned columns, `--plain` with no colour; `list` one row per quiz, sorted by name, columns name, title, versions, attempts, last, best, taken, with `changed` and `ungraded` as marks after the name. No board: the goldens are the review.

**G15. The output of every other library command.** *Drawn on the canvas (2026-11-18): LibrarySetup, LibraryTake, LibraryGrade, LibraryTidy, with the missing `--json` shapes. The common shape: a bold heading naming the quiz, attempt and version; one coloured verb per outcome (`registered`, `filed`, `report`, `written`, `deleted`); findings in `check`'s issue format with `fix:`; then, dim, `next:` and `committed <hash> <message>`. Once approved, the planner writes them into COMMANDS.md.* G7 covers `list`, `info` and `status`; the human output of `init`, `register`, `take`, `replay`, `grade`, `share`, `template add`, `rename`, `rm` and `path` is not drawn, and `init`, `share`, `rename`, `rm` and `path` have no `--json` shape (`library stats`'s is presumably `quiz stats`'s; `take`'s `status` values are not listed). **Recommendation:** before 4b, the planner writes a text sample and a `--json` shape for every library command into COMMANDS.md, in the style of `inspect` (G7), as one commit for the owner to read; the slices then build to them and the goldens check them.

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
