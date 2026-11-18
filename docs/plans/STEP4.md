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
| 4a | brief approved (2026-11-18); with the implementing agent | this file |

### Next

1. One implementing agent (Sonnet) builds 4a; the planner reviews it and writes the review at the end of its section.
2. Then **4b**'s brief (the store).

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

Every gap of step 4 is decided (G1 to G18, in [STEP4-GAPS.md](STEP4-GAPS.md)). New ones found while building are added here from G19.

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
