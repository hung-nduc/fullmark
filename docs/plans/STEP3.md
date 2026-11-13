# Step 3: the server, the forms and the authoring commands

## Handoff (2026-11-03, updated 2026-11-12): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 2 ([archive/STEP2.md](archive/STEP2.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent**; the agent implements and commits on branch `1.0` (never pushes) and reports; the planner reviews, pushes after the review, and brings every gap to the owner with a recommendation; the owner decides; the decisions go into `docs/design/` and become the next brief's first tasks. Commit after every round. A slice is sized to fit one implementing agent's session (about 150k tokens), and its brief names exactly what to read. Which model plays each role is the owner's choice and may change; the reviews name who built and reviewed each slice.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | approved (2026-11-03), the slice order with it; every gap so far (G1 to G37) decided | this file |
| 3a the one-shot server and `quiz serve` | done, reviewed, gaps decided | `b9ca8c1`, `730a7ae` |
| 3b 3a's fixes, `--section`, `--focus`, `--autosave` | done, reviewed, gaps decided | `7fa0ba3`..`4a1e0bf` |
| 3c `inspect`, `new`, `template` | done, reviewed, gaps decided | `e71ce68`..`3602a3d` |
| 3d 3c's fixes, `stats` | done, reviewed, gaps decided | `fd466d1`, `2dfd341` |
| 3g 3d's fixes, `brief` through flags | done, reviewed, gaps decided | `27a61a4`..`2e6b449` |
| 3i 3g's fixes, `brief --tui` | done, reviewed, gaps decided | `fb5ed78`..`546ccc0` |
| 3j 3i's fixes, `build --watch` and `--serve` | done, reviewed, gaps decided (G35 built in review) | `4a0835f`..`45fe811` |
| 3v the form boards (on the Design canvas) | `review` boards drafted by Opus and reviewed by the owner (2026-11-04); G38 to G47 decided (2026-11-04); boards and images in `docs/mockup/` `grade --web` boards drafted by Opus (2026-11-06) and reviewed by the owner (2026-11-07), with RubricC for G86; G70 to G86 decided, G75 last (2026-11-13, with G102, on the redrawn GradeAI); boards in `docs/mockup/`; images of GradeFinish, GradeBlocked, GradeDone, RubricC, RubricPhone and RubricPhoneReplay exported (2026-11-07), the other Grade boards were taken off the canvas and have no images. `brief --web` boards: not started | |
| 3e G47, the review file, `check --review`, `inspect --review` | done, reviewed, gaps decided (2026-11-04) | `5e9b45c`..`dbcd43e` |
| 3k G51, `quiz review` and its form | done, reviewed, gaps decided (2026-11-04) | `91a8821`..`c326d9f` |
| 3l G50, G56, 3k's fixes, `quiz review --since` | done, reviewed, gaps decided (2026-11-05) | `54214a5`..`4140cf6`, review |
| 3m G63, G64, the stacked sidebar with the materials, and the phone | done, reviewed, gaps decided (2026-11-05) | `182beb3`..`0a68e2d`, review |
| 3n G68, G69 | done, reviewed (2026-11-06), no gaps | `d0e44e4`..`be1629f`, review |
| 3o the rubric box in the replay, G84, G90 | done, reviewed, gaps decided (2026-11-07) | `73d3194`..`bb1cfe4`, `8554eef`, review |
| 3f `grade --web` at 1280 px | done, reviewed, gaps decided (2026-11-07); its fixes in 3f2 | `2246a37`..`0e44c3d`, review |
| 3f2 3f's fixes, G96, G97 | done, reviewed, gaps decided (2026-11-07) | `c81833f`..`d4356e6`, review |
| 3p G98, the grading form on a phone | done, reviewed, gaps decided (2026-11-07) | `3ee9d79`..`1a422e4`, `c7ce6b3`, review |
| 3r G101, then fullmark's own marking from the form (G83) | done, reviewed, gaps decided (2026-11-13); the result badge fixed in review | `972533e`..`e376c8a`, `58484ff` |
| 3r2 G103: the grader's frame without the replay's bar, the 3r screens' spec | brief approved (2026-11-13), handed to the implementing agent | |
| 3q the replay's answer panel and badge (G94) | outline; 3f is done, so it can be briefed | |
| 3p2 `--web --grades`, AI grades pre-filled (G75, G102) | G75 and G102 decided (2026-11-13) on the GradeAI board; can be briefed after 3r2 | |
| 3h `brief --web` | waits for its boards (3v) | |
| 3z acceptance | last | |

Each slice's review, and the owner's decisions on its gaps, are under its own section below (**Review**); the open gaps are in "Gaps" below, and the decided ones in [STEP3-GAPS.md](STEP3-GAPS.md), in number order.

Step 2 is closed ([archive/STEP2.md](archive/STEP2.md), item 75): every "Done when" criterion passes in Chromium and Firefox. What step 2 left for step 3 is now built: the server listens on the page's attach point (`src/serve/module.ts` on `window.fullmark.events`), `serve --focus` sets `PageData.focus`, the served page has its own script hash and `connect-src 'self'`, `build --watch`/`--serve` and `check --review` work, and the six built-in templates ship from `scripts/build-templates.mjs`. `brief.yaml` is still read with no defaults; the defaults belong to `quiz brief`, which writes them.

**Still stubs**, each refused as "not available yet": `brief --web` (3h; `src/cli/brief.ts`) and `grade --web --grades` (3p2, G75; `src/cli/grade.ts`).

### Next steps, in order

How each slice got here is in its own **Review**; the table above is the summary.

1. **3r** (G101, then fullmark's own marking in the form, G83) is **built and reviewed** ("Slice 3r", its Review), the result badge fixed in review. **G103 is decided** as recommended; **3r2's brief is approved** (2026-11-13) and handed to the implementing agent ("Slice 3r2", at the end); its review comes next.
2. **3q** (the replay's answer panel and badge, G94): an outline; it can be briefed now, since 3f is done.
3. **3p2** (`grade --web --grades`, G75 and G102): both decided on 2026-11-13, as recommended, on the redrawn GradeAI board (interactive, on the canvas; its source in `docs/mockup/boards/`), and written into COMMANDS.md (`quiz grade`, "Pre-filled grades") and TECHNICAL_DESIGN.md (section 6, "Grader identity"). They are 3p2's first tasks; its brief follows 3r2's review.
4. **The `brief --web` boards** (3v), then **3h** from them. Not started.
5. **3z**, acceptance.

The other Grade boards (Grade, GradeBanded, GradeCode, GradePhone, GradeVi, GradeAI and the table boards) have no images: they were taken off the canvas on 2026-11-07 ([docs/mockup/README.md](../mockup/README.md)), so they cannot be exported as they stand. Their sources in `docs/mockup/boards/` are the reference; this blocks no slice.

### Open proposals carried over from step 2

- [build-log.md](../design/proposals/build-log.md): stays a proposal, not in step 3. `build --watch --json` already gives one line per rebuild, which is all v1 promises.
- [print-pdf.md](../design/proposals/print-pdf.md) (raised in 2k's review, written in 3j's): stays a proposal, out of v1.
- [TODO.md](../design/TODO.md)'s only item (1.0 and 0.x share `config.toml`) is due before step 4, not here.

## Goal

The one-shot server and everything on it, plus the authoring commands that need no server. TECHNICAL_DESIGN.md section 12, step 3: `serve` (with `--section`), `review`, `grade --web`, `brief` (flags, `--web`, `--tui`), `stats`, `inspect`, `new`, `build --watch`.

**Done when** (section 12): contract tests pass for each command; the same answers through flags, `--web` and `--tui` write byte-identical `brief.yaml` files. **And** (from foundations 4 and 9, section 11): the server rejects a wrong token, `Host` or `Origin`; a `build` page is byte-identical with and without the server features and contains no server code; the two-quiz server seam test passes; every new form passes axe in both themes and has a `vi` scan; `npm run samples` gains a line for each served command, and the owner has tried them by hand.

**Not in step 3:** `library take` and the rest of the library (step 4; the server supports it through `--timeout 0` and the quiz-keyed predicate, nothing more); `--background` ([proposals/background-serve.md](../design/proposals/background-serve.md); the `listening` line is its seam, built here); `quiz guide` and `agent-guide` (not in section 12's step 3; see G4); build logs.

## Rules for every slice

Step 2's rules hold ([archive/STEP2.md](archive/STEP2.md), "Rules for every slice"), including item 73's rule on environmental failures: a failure is environmental only when its cause is shown, and a golden is never reverted to hide a difference. Commits end with the `Co-Authored-By` line of the model that made them; the implementing agent never pushes. Added for step 3:

- **No real network in unit tests.** The server binds 127.0.0.1 on port `0` in tests and is driven with `fetch`; the page side is tested in Playwright against a served page. No test waits on a real timeout: the clock and the timeout are injected.
- **Every served command is tested as a subprocess**: started with `--json`, its `listening` line read, the page or form driven by Playwright or by a POST, then the exit code, the second JSON line and the written file compared with a golden. A helper for this lives in `e2e/helpers.ts` (3a) and every later slice uses it.
- **Ctrl+C is tested** on Linux by sending SIGINT to the subprocess, and the expected file state (nothing written, or the old file intact) is checked. Windows has no SIGINT for a child; the test says so and skips there by name.
- **A command loads only what it uses** (section 7, Budgets): `serve` and the forms load the page builder; `brief` through flags, `stats`, `inspect` and `new` do not; `@clack/prompts` loads only for `brief --tui`. The startup test gains no new limit, but a test checks that `check` still does not load `src/serve/`.
- **Forms are built from the boards** (from 3e on), as pages were from the mockup: colours, sizes and spacing from the board's source; screens to `docs/screens/<slice>/`, committed.

## Gaps

The design docs left these open, or a slice's review found them. Each needs the owner's yes before the slice that depends on it; the recommendation is written so it can go into the docs as it stands. Once decided, it is written into `docs/design/`, which then wins over the text here. A gap stays here while it is open; once decided, it moves, as it stands, to [STEP3-GAPS.md](STEP3-GAPS.md), which holds every decided gap, in number order.

None open.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **3a** | The one-shot server (`src/serve/`): bind, token, `Host` and `Origin`, one POST path, 10 MB cap, the quiz-keyed predicate, timeout, Ctrl+C, the `listening` line; the browser module on the attach point; the served page's CSP; the byte-identity and two-quiz seam tests. `quiz serve FILE` with `--out`, `--timeout`, `--open`, `--port`, `--json`, the `.html` refusal and exit 1 on check errors | G9, G10 |
| **3b** | 3a's fixes; `serve --section`, `--focus`, `--autosave`; Firefox through the whole submit; the samples line | G5 |
| **3c** | `inspect` (with `--review` waiting for 3e), `new TEMPLATE`, `new --from [--skeleton]`, `template list/add/rm`, the built-in templates | G4, G8 |
| **3d** | `stats`: `src/core/stats/` (per question, per tag, per criterion, across versions), the survey table, human and `--json` | G3, G8 |
| **3g** | `brief` through flags: the question file, every option, defaults written with `decided_by`, `brief.vague`, exit 3 and `needs_input`, `--accept-defaults`, `--json`, `content/` | G11 |
| **3i** | 3g's fixes; `brief --tui` with `@clack/prompts`; flags and `--tui` write byte-identical `brief.yaml` | G11, G12, G23 to G25 |
| **3j** | `build --watch` and `--serve`: watching, the last good page, `--json` per rebuild, the reload server | G6 |
| **3v** | The owner's form boards (G7), whenever the owner is ready; no code. Only 3e, 3f and 3h wait for it | G7 |
| **3e** | G47; the review file (`src/core/review/`: schema, reader, merge, the block text), `check --review` with `review.fix`, `review.drop` and `review.unconfirmed`, `inspect --review`. No browser | G1, G2, G47 to G49 |
| **3k** | `quiz review` on the one-shot server and its form (`dist/review.js`): the Review boards at 1280 px (the verdict, then reasons; the stacked sidebar with the materials; the text size and Appearance; Keep the rest; the Finish dialog; the saved card; the keys), the `vi` words of ReviewVi, the refusal of questions without ids, `--out` merged, axe in both themes, screens, the samples line | G3, G38 to G46, 3e |
| **3l** | `review --since`: only the new and changed questions, the earlier verdict and the line diff, the map's "not asked again"; the form on a phone (ReviewPhone) | G44, G45, 3k |
| **3m** | the stacked **Questions & materials** sidebar and the phone (ReviewPhone) | G58, G65 to G67, 3l |
| **3n** | G68 (Vitest's default timeout) and G69 (`--autosave`'s leftover temp files) | G68, G69 |
| **3o** | The rubric box, read-only, in place of the grade table (after Submit and in `quiz replay`), its phone layout; G84 and G90's "chữ" | G84, G86, G89, G90 |
| **3f** | `grade --web` and `--name`: the grading form at 1280 px with the editable rubric box, Finish, the name, the saved card, the report; the `grade` words, en and vi | G70 to G74, G76 to G78, G80 to G82, G86 to G88, G91, 3o |
| **3p** | G98's differences from the boards, then the grading form on a phone (G79) | G79, G89, G96, G98, 3f2 |
| **3r** | fullmark's own marking from the form (G83), as G100 has it | G83, G100, 3p |
| **3r2** | G103: the grader's frame shows the replay without its top bar, in the form's look, with no Download results; the 3r screens' spec, and the screens taken again | G103, 3r |
| **3p2** | `--web --grades`: AI grades pre-filled (G75), and several AI graders, each its own questions (G102) | G75, G102, 3r2 |
| **3q** | The replay's answer panel ("YOUR ANSWER", in place of the read-only textarea) and the result badge as a pill, on the page and in the replay, kept to one or two lines on a phone; built from ResultsReplay and RubricPhoneReplay | G94, 3f |
| **3h** | `brief --web`: the form from the question file, the detail rules, the summary screen, `--language` for the form; the three-way byte-identity test (flags, `--web`, `--tui`) that closes step 3's criterion | G11, boards |
| **3z** | Acceptance: every "Done when" item checked in Chromium and Firefox, samples tried by the owner | |

The order (owner, 2026-11-03) puts the server first, since four commands stand on it, then every slice that needs no form board (3c, 3d, 3g, 3i, 3j), so the owner's form design (3v) can come whenever the owner is ready; the three forms come last. Later briefs stay outlines until the slice before is reviewed.

## Slice 3a: the one-shot server and `quiz serve`

**Approved by the owner on 2026-11-03**, with G9 and G10.

### Read first

- TECHNICAL_DESIGN.md section 7: the `serve/` line of the tree, foundations 3 (the CSP bullet), 4 and 9, "Seams for later features" item 6 and "Running the server in the background", "Temporary files".
- COMMANDS.md: "Common options" (`--json`, `--open`, `--port`, `--timeout`), "Exit codes", `quiz serve`.
- This plan: "Rules for every slice", G9, G10.
- Code: `src/page/events.ts`, `src/page/main.tsx`, `buildPage` and the CSP in `src/build/page.ts`, `src/cli/build.ts` (how a page is built from a file: load, check, build), `src/cli/atomic.ts`, `scripts/build-page.mjs`, `scripts/bundles.mjs`.

### Decided for this slice

- **`src/serve/server.ts`** (Node): `startServer({pages, quizIds, predicate, timeoutMs, port, onSubmit})` returns `{url, port, done}`. It binds `127.0.0.1` only; the token is 32 random bytes, base64url, in the path (`/<token>/`). Every request checks the token, `Host` (`127.0.0.1:<port>` or `localhost:<port>`) and, on POST, `Origin` (the same two); any mismatch is 403 with no body. `GET /<token>/` serves the page; `POST /<token>/submit` takes `{quizId, attempt}` up to 10 MB (413 above), validates it with the `results-v2` schema and the quiz's hash (400 on failure, G9), calls `onSubmit`, and ends when `predicate` says so. Everything else is 404. Responses carry `Cache-Control: no-store`.
- **`src/serve/module.ts`** (browser, built to `dist/serve.js`, G10): reads `window.fullmark.events`, on `submit` POSTs to `./submit` with `fetch` and shows the page's own message on success or failure (catalog strings in `en` and `vi`); on `progress` it does nothing until 3b. Built by `scripts/build-page.mjs`, read only by `src/serve/`.
- **The served page:** `buildPage` gains an internal option that appends the module's script and adds its hash and `connect-src 'self'` to the CSP. A test requires `buildPage` without the option to give the same bytes as before the slice (the build goldens unchanged), and a test scans a built page for the module's code and for `connect-src`.
- **`quiz serve FILE`:** load and check as `build` does (exit 1 on check errors, printed as `check` prints them); a `.html` exits 2 with COMMANDS.md's message; the page is built in memory; with `--json` the first line is `{"status": "listening", "url", "port", "pid"}`, flushed before waiting; on submit the results are written atomically to `--out` (default `<quiz-id>-results-<YYYYMMDD-HHMMSS>.json` beside the source, local time), the score is graded with the shared grader, and the second line is `{"status": "submitted", "results", "score"}`. Timeout: `{"status": "timeout"}`, exit 2. Ctrl+C: G9. `--open` uses the opener `build --open` uses. Without `--json`, stderr says the URL and "waiting for Submit (Ctrl+C to stop)".
- **The seam:** a unit test starts the server with two quiz ids and a predicate "both submitted", posts both, and checks two `onSubmit` calls and that it ends only after the second.

### Tasks

1. `src/serve/server.ts` with unit tests: token, `Host`, `Origin` (each wrong one 403), the size cap, a bad body, a wrong quiz id, the predicate, the injected timeout, port `0`.
2. `src/serve/module.ts`, `dist/serve.js`, its notices entry, and the served-page option of `buildPage`; the byte-identity and no-server-code tests.
3. `quiz serve` in `src/cli/serve.ts` and `src/cli/main.ts`: the options above, contract tests through the subprocess helper (new in `e2e/helpers.ts`), goldens for the two JSON lines (URL, port and pid masked), Ctrl+C on Linux.
4. Playwright: serve an example, answer, Submit, check the written results grade as the page showed; the page's message when the server has gone; axe on the served page.
5. `samples`: a line in `TRY` saying how to try `quiz serve` by hand.

### Done when

`npm run check` passes; `quiz serve examples/calculus/quiz.md --json` prints the two lines and writes a results file that `quiz grade` grades to the same score; the server refuses a wrong token, `Host` and `Origin`; a `build` page is byte-identical to before the slice. Report as the rules say, with the startup numbers before and after.

### Review

**3a's review (2026-11-03).** Typecheck, Biome and Vitest clean: 86 files, **2111 of 2111** (34 new), the 2 startup tests (`--version` 21 ms, `check` 88 ms, both lower than before). Playwright in Chromium: 184 passed, 123 skipped, **1 failed**: `e2e/types.spec.ts:28` ("every simple type…", a `toHaveAttribute` that timed out at 9.7 s against 5.2 s normally). 3a changed nothing in `src/page`, `src/core` or that test, and it passed 3 of 3 runs on its own; **its cause is not shown**, so it is not called environmental: a task for 3b. Firefox not run (not installed here). The runtime is unchanged (56,214 B gzipped); `dist/serve.js` is 785 B gzipped. No `build`, `replay` or `check` golden changed; 2 top-level help goldens gain the `serve` line; 9 new golden cases under `test/golden/serve/`. Tried by hand: the page 200; a wrong token, a wrong `Host` and a POST without `Origin` 403; an unknown quiz id 400 with the reason; the served CSP has `connect-src 'self'`; SIGINT printed `{"status":"interrupted"}` and wrote nothing. **Found in review:** the URL without its trailing slash (`/<token>`) also serves the page, where `./submit` resolves to `/submit` and every submit would be refused. Done differently, accepted in review: `quizIds` is a map of id to hash; the samples line is a "Served commands" section of `samples/index.html`. **3a's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md (`quiz serve`: the synopsis with `--profile`, `--config` and `--fonts`; `{"status": "failed"}` for check errors; a results file that cannot be written) and TECHNICAL_DESIGN.md (foundation 4: 403 outside the token, 403 for a POST without `Origin`, 404 under it, the 308 to the trailing slash; foundation 9: `served: true`, the Submit dialog's line, the `sent` and `send-failed` events, **Sent** owned by the page core). The favicon's 403 stays. They are 3b's first tasks.

## Slice 3b: 3a's fixes, then `--section`, `--focus` and `--autosave`

**Approved by the owner on 2026-11-03**, with G5.

### Read first

- COMMANDS.md: `quiz serve`; "Names, ids and stamps" (how a section is named).
- TECHNICAL_DESIGN.md section 7: foundations 2, 4 and 9 (with the owner's additions of 2026-11-03); section 8: the rows "Submit asks first", "Results (after Submit)" (the **Download results** button) and "Focus mode"; section 4: "Plan and Attempt" (`plan.source`).
- This plan: "Rules for every slice", G5, and 3a's review above.
- Code: `src/serve/`, `src/cli/serve.ts`, `src/page/events.ts`, `src/page/data.ts` (`PageData`, `focus`), `src/page/store.ts` (the plan at Start, `planFor` with `source: "section"`), `src/page/saved.ts` (`Saved`, `readSaved`), `src/page/SubmitDialog.tsx`, `src/page/ResultsCard.tsx`, `src/core/plan/index.ts` (`sectionIds`), the page catalogs in `src/core/i18n`.

### Decided for this slice

- **The redirect:** `GET /<token>` answers 308 to `/<token>/`; a test submits from a page opened at the address without the slash.
- **`served`:** `PageData` gains `served?: true`, set only by `src/serve/`. The Submit dialog adds its line; the module emits `sent` or `send-failed` (with no payload) on the attach point after the POST; the results card shows **Sent** (not a button, `aria-live` polite) or, on failure, keeps **Download results** and shows the could-not-save line. The module's own notice from 3a goes: the page says it. New catalog strings in `en` and `vi`. `dist/page.js` changes, so every page golden changes: report the count, and show in one test that a `build` page's `PageData` has no `served` and its runtime has nothing that emits `sent`.
- **`--section S`:** resolved by slug or title, ignoring case; unknown exits 2 listing the valid ones (slug and title), before anything is served. `PageData` gains `section?: string` (the section id): the start screen shows only that part, with no picker, and Start plans `source: "section"`. The results record it, and `quiz grade` grades them as any section attempt.
- **`--focus`:** sets `PageData.focus`.
- **`--autosave PROGRESS`:** as G5 says once decided. The module writes on `progress`; the server gains one more POST path, `/<token>/progress`, with the same checks, body cap and validation (phase `in-progress`), answering 204; the server writes atomically, at most once a second (the last body wins). A matching file is put in `PageData` as the saved attempt the start screen's resume path already reads (`Saved`); local storage is not used under `--autosave`, so the file is the one copy. Deleted after the results are written.

### Tasks

1. The redirect; `served`, the dialog line, `sent` and `send-failed`, **Sent**; the page goldens regenerated and counted.
2. **`e2e/types.spec.ts:28`**, which failed once in 3a's full Chromium run (a `toHaveAttribute` at 9.7 s, against 5.2 s normally) and passed 3 of 3 alone. Find and show the cause (run the full suite at least twice; read the assertion); fix the test or the page. Never mark it flaky or raise a timeout without the cause.
3. `--section` and `--focus`, with goldens for the unknown section (human and `--json`) and Playwright for a section attempt that `quiz grade` grades to the page's score.
4. `--autosave`: unit tests of the progress path and the write rate (injected clock); Playwright: answer, kill the server, start it again with the same file, resume, Submit; the file gone after; a file of another version exits 1 and is left alone.
5. `samples`: the three new options in "Served commands".

### Done when

`npm run check` passes in Chromium (Firefox on the owner's machine); `types.spec.ts:28` has a shown cause and a fix; a served section attempt and a resumed `--autosave` attempt each grade with `quiz grade` to what the page showed. Report as the rules say, with screens of the dialog line and **Sent** in `docs/screens/3b/`.

### Review

**3b's review (2026-11-03).** Typecheck, Biome and Vitest clean: 88 files, **2153 of 2153**, the 2 startup tests. Playwright in Chromium: **193 passed**, 128 skipped, none failed (run in review). The runtime grew 627 B to 56,769 B gzipped (the `sent` handling moved into the page); `dist/serve.js` is 372 B. 14 page goldens regenerated for the new `dist/page.js`; no other golden changed. Screens in `docs/screens/3b/` reviewed: the dialog's line, **Sent**, the could-not-save line. Tried by hand: an unknown section lists the three slugs and titles and exits 2; `--autosave` and `--out` naming one file exits 2. **`types.spec.ts:28`: cause not shown.** It did not recur in 2 full runs and 64 repeats, some under load; `BlanksPrompt` now marks its boxes in a layout effect (the one asynchronous step found) and a failure attaches the page state. Still open. **A second unexplained failure, older than 3b:** `e2e/start.spec.ts:202` fails 3 or 4 of 40 repeats, on 3b's tree and on `b231c4e` alike: the saved attempt is not found after the reload. **Found in review:** after **Sent** the server has exited, but **Retry missed** and **New attempt** still show; what they do on a served page is not decided. Done differently, accepted in review: `sent` and `send-failed` carry `quizId` (the bundle seam); a served page starts after `DOMContentLoaded` so a timed attempt that expired while the server was down still reaches it; `--section` drops the other sections from `PageData`; under `--autosave` the Rules cell says "In a file on this computer" and nothing goes in `localStorage`.

**3b's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md (`--autosave`: matched by `quizHash` alone, the phase `answering`, an unusable file exits 1, the same file as `--out` exits 2) and TECHNICAL_DESIGN.md (foundation 9: after **Sent**, **Retry missed** and **New attempt** work as practice and are not sent). The page's button is **Download results** everywhere in the design docs (it was "Export" in places). A section attempt keeps the quiz's `time_limit`, since a section's `time` is only a suggestion (QUIZ_SYNTAX.md, section 3): no change. `start.spec.ts:202` is 3c's first task; `types.spec.ts:28` stays open, watched by its new attachment.

## Slice 3c: `start.spec.ts:202`, then `inspect`, `new` and `template`

**Approved by the owner on 2026-11-03**, with G8 for `inspect` and G13.

### Read first

- COMMANDS.md: `quiz inspect`, `quiz new`, `quiz template`, "Exit codes", "Paths in output", "Files".
- QUIZ_SYNTAX.md: section 9 (structure and content), and the **S** and **C** column of the tables in sections 2 to 4.
- TECHNICAL_DESIGN.md section 7, "Files, formats and safe writes" (atomic writes).
- This plan: "Rules for every slice", G4 (decided), G8, G13, and 3b's review (the `start.spec.ts:202` paragraph).
- Code: `src/cli/main.ts`, `src/cli/load.ts`, `src/cli/check.ts` (how a quiz is loaded and checked, and how issues are printed), `src/cli/atomic.ts`, `src/core/rules/quality.ts` (`answers.position-skew`, for the answer positions), `src/core/ir.ts` (the quiz IR), `src/core/parse/` only as far as the skeleton needs, `examples/`, `templates/blank/`, `e2e/start.spec.ts`.

### Decided for this slice

- **`inspect` (G8, for the owner to approve).** It checks the quiz (exit 1 on errors), and prints the summary whenever the quiz parses, with the issues after it, as `check` prints them. Human output:

  ```text
  rust-basics · Rust basics · version 9f3a
  18 questions · 25 points · 3 sections · time limit 25m
  Types      single 8 (10 points) · multi 3 (5) · code 2 (6) · essay 1 (4) · …
  Sections   ownership 6 questions, 8 points · collections 6, 10, pick 4 · …
  Tags       rust 18 · borrowing 5 · … · no tag 2
  Positions  A 5 · B 6 · C 3 · D 2 (correct choices of single and multi, in source order)
  ```

  `--json`: `{"status": "done" | "failed", "quiz": {"id", "title", "hash", "short"}, "questions", "points", "timeLimit", "types": [{"type", "count", "points"}], "sections": [{"id", "title", "questions", "points", "pick", "time"}], "tags": [{"tag", "count", "points"}], "positions": {"A": 5, …}, "errors", "warnings"}`. Points count a bank's `pick`, not its pool. Positions read the source order, as `answers.position-skew` does, and share its counting code. `--review` exits 2 "not available yet" until 3e, which adds `"review": {"keep", "fix", "drop", "notJudged"}`.
- **Built-in templates:** one source each, no copies in the repo: `npm run build` copies `examples/<name>/` (calculus, rust, ielts, medical, exam, survey) and `templates/blank/` into `dist/templates/<name>/`; `dist` is what the package ships. A test checks that `dist/templates` matches its sources and that each template passes `check`.
- **User templates:** the `templates/` folder next to `config.toml` (`FULLMARK_CONFIG` honoured), as COMMANDS.md says, with `list`, `add` and `rm` exactly as specified there.
- **`new`:** G13; never overwrites (an existing target file exits 2 before anything is written); copies the one `.md`, `assets/` and `materials/`; `--skeleton` follows QUIZ_SYNTAX.md section 9 to the letter, in a module of its own under `src/core/` (pure, no `node:*`), shared by `new --from --skeleton` and `template add --skeleton`.

### Tasks

1. **`e2e/start.spec.ts:202`** ("a page reopened after the deadline submits on open"): fails 3 or 4 of 40 repeats since before step 3; after the reload the saved attempt is not found. Show the cause (3b suspected the test's `addInitScript` racing the page's save on unload), then fix the test or the page. No retries, no longer timeouts, no flaky marks without the cause.
2. `inspect`, with goldens: every example, a quiz with check errors, a bank, a quiz with no tags; human and `--json`.
3. The skeleton module with unit tests per QUIZ_SYNTAX.md section 9 bullet; a skeleton of every example fails `check` with one error per emptied field and passes the structural check of `template add --skeleton`.
4. `new TEMPLATE`, `new --from [--skeleton]`, `template list/add/rm`, the built-in templates in `dist/templates/`; goldens for every exit of COMMANDS.md, the `ignored` user template, a name taken by a built-in, `--replace`, `unchanged`.
5. `quiz --help` and the top-level goldens gain the new commands.

### Done when

`npm run check` passes in Chromium, and `start.spec.ts:202` passes 40 of 40 repeats with its cause shown; `quiz new rust demo/` then `quiz ids demo/quiz.md` then `quiz check demo/quiz.md` passes; `quiz new --from examples/rust/quiz.md --skeleton s/` fails `check` with only emptied-field errors. Report as the rules say.

### Review

**3c's review (2026-11-03).** Typecheck, Biome and Vitest clean: 92 files, **2284 of 2284** (74 new golden cases), the 2 startup tests (`--version` 24 ms, `check` 85 ms). Playwright in Chromium: **193 passed**, 128 skipped, none failed. **`start.spec.ts:202`: cause shown.** After `page.reload()`, Chromium handed the reloaded document a `localStorage` snapshot older than the old document's last write; the test's init script read that snapshot (seen empty in every failing run, while a fresh tab saw the key). The page saved correctly and is unchanged; the test now edits the saved text it read from the old page. 40 of 40 in review. Only the two top-level help goldens changed (the three commands). Tried by hand: `template list` shows the seven built-ins; `new rust demo/`, `ids`, `check` pass; `new` again exits 2; a skeleton of `rust` fails `check` with 30 emptied-field errors; `inspect examples/exam/quiz.md` prints the summary. **Found in review:** that example has no `id`, so its id shows as `quiz`, the file name: the same collision as Sonnet's gap 2.

**3c's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md (`quiz new`: `PATH` a folder or an `.md` file, a fresh quiz `id` from the target's name, `--json`, `--from` copies only what the quiz references; `quiz inspect`'s details; `template list` shows `invalid` folders; `template add` and `rm` `--json`) and QUIZ_SYNTAX.md section 9 (`materials` emptied, how each answer shape is emptied, which errors a skeleton gives). `examples/exam` and `examples/medical` get an `id`. The id, `new --json` and `invalid` are 3d's first tasks.

## Slice 3d: 3c's fixes, then `stats`

**Approved by the owner on 2026-11-03**, with G14 and G8 for `stats`.

### Read first

- COMMANDS.md: `quiz stats`, `quiz new`, `quiz template` ("`template list`"), "Several files".
- TECHNICAL_DESIGN.md section 4, "Plan and Attempt" (scores per question and per tag) and section 10, "Decisions on the new features" (missed); section 6, "Where grades show up" (the `stats` row) and the report paragraph of "`grades-v2`".
- This plan: "Rules for every slice", G3, G8, G14, and 3c's decided gaps.
- Code: `src/core/report/build.ts` (`Report`), `src/cli/grade.ts` (loading and grading results), `src/cli/new.ts`, `src/cli/templates.ts`, `src/core/skeleton.ts` (`withoutIdentity`).

### Decided for this slice

- **The fixes from 3c:** `new` writes a fresh quiz `id` (the folder's name for `quiz.md`, else the file's), takes `PATH` ending in `.md` as the file, and has `--json`; `template list` shows `invalid` folders with the reason; `examples/exam` and `examples/medical` gain an `id` (their goldens change: report the count).
- **`stats` (G8, for the owner to approve).** Inputs as G14. Each attempt counts only the questions it had (`plan.questions`), so a section or retry attempt never counts as a low score on the whole quiz. Questions match across versions by id, and without one by question hash (G3). Pending grades count as not yet scored.

  ```text
  rust-basics · Rust basics · 5 attempts, 2 versions
  Attempts   3 Oct 62% · 10 Oct 71% (section ownership) · 17 Oct 80% · …
  Tags       borrowing 54% (13 of 24 points) · traits 70% · ownership 88% · no tag 75%
  Weakest    borrowing, traits
  Missed     q-k7m2qx "Which borrow…" wrong in 4 of 5 · q-a1b2c3 3 of 5 · …
  Criteria   interp 60% over 4 attempts · LR band 5.5 average · …
  ```

  `--json`: `{"status": "done", "quiz": {"id", "title"}, "attempts": [{"file", "submitted", "version", "plan", "earned", "points", "percent", "pending"}], "tags": [{"tag", "earned", "points", "percent", "attempts"}], "weakest": [tag], "questions": [{"id", "hash", "title", "seen", "missed", "earned", "points", "changed"}], "criteria": [{"question", "criterion", "earned", "max", "percent", "band"}]}`. **Weakest:** the up to three tags with the lowest percent, of those seen in at least two attempts. **Missed:** wrong or partly right, by count, then by id; at most ten in human output, all in JSON. A survey shows "Answers over time" instead: per question, each attempt's answer in date order. `--quiz` names questions and tags from the current source; without it, from the newest report.

### Tasks

1. 3c's fixes above, with goldens.
2. `src/core/stats/` (pure, no `node:*`): attempts in, the summary out, with unit tests for sections, retries, two versions, a question without an id, pending grades, surveys and criteria (an IELTS band and an additive rubric).
3. `quiz stats` in `src/cli/stats.ts`: loading reports and results, the G14 refusals, human and `--json`, goldens from fixtures made with `grade --json` (never by hand).

### Done when

`npm run check` passes in Chromium; five attempts over two versions of one fixture give the summary above in shape; a results file of an older version exits 1 with the fix; two quizzes exit 2. Report as the rules say.

### Review

**3d's review (2026-11-03).** Typecheck, Biome and Vitest clean: 93 files, **2334 of 2334**, the 2 startup tests. Playwright in Chromium: **193 passed**, 128 skipped, none failed. Goldens: 56 existing cases changed, all from two causes: `examples/exam` and `examples/medical` gained an `id` (so their versions changed, and the grade cases' results inputs carry the new hash), and each report question gained `hash`; 25 new cases. `new/default-folder` became a unit test (its id is the random temp folder's name). Tried by hand: five attempts over two versions give the summary in the approved shape; a survey gives "Answers over time"; a results file of the old version exits 1 with the fix; two quizzes exit 2; `new rust signals/week3.md --json` writes `id: week3`. **Found in review:** an average IELTS band prints as `5.88`; bands are halves, so two decimals read as false precision. The agent kept re-sending its report while a monitor of its own ran; stopped in review, with nothing left uncommitted.

**3d's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md (`quiz stats`: matched by id only, `--quiz` renames titles and tags, `attempts` on criteria, holistic criteria left out, bands to one decimal, the survey `answers`, unanswered is not missed, a results file without `--quiz` exits 1; `quiz new`: the id from a name starting with a digit, too long, or empty) and TECHNICAL_DESIGN.md section 6 (a report question's `hash`). **G3 changes for `stats`:** the match by question hash is removed (unreachable: a question without an id fails `check`); `review` still refuses such a quiz. Removing that path, the band's one decimal and the id edges are 3g's first tasks.

## Slice 3g: 3d's fixes, then `brief` through flags

**Approved by the owner on 2026-11-03**, with G15 to G18.

### Read first

- COMMANDS.md: `quiz brief` (all of it: the question file, the detail rules, both option tables, "Defaults per purpose", "Also", "The file"), "Exit codes", "Common options" (`--json`).
- TECHNICAL_DESIGN.md section 5: the `brief.*` rows of the rule catalogue and "Where the config comes from" (the profile from the brief); section 9, the `brief` forms row.
- USER_DESIGN.md: the "Brief" step of the loop (item 1) and the agent's limits (the **Author** row).
- This plan: "Rules for every slice", G11 (decided), G15 to G18, and 3d's decided gaps.
- Code: `src/core/ir.ts` (`BriefSchema`), `src/core/rules/brief-read.ts`, `src/core/rules/brief.ts`, `src/cli/atomic.ts`, `src/cli/main.ts`, `src/core/stats/`, `src/cli/new.ts`.

### Decided for this slice

- **3d's fixes:** `stats` loses the match by question hash and its "no id" marking; an average band prints to one decimal; `new`'s id edges (a digit first, over 64, nothing usable), with goldens.
- **The question file** (G11): `src/brief/questions.yaml`, one entry per key in COMMANDS.md's file table, in its order, every text in `en` and `vi`; a zod schema and a test that it covers every `BriefSchema` key exactly once, that every `choice` value is one the schema accepts, and that no `en` or `vi` text is missing. Shipped as data in the bundle: read at run time, never by `check`.
- **The writer:** one pure function in `src/core/brief/` takes the answers (each marked `user`, `default` or `agent`) and returns the YAML text: every key always, in the file table's order, `decided_by` for every key, and the same bytes for the same answers, however they were given. 3h and 3i call the same function; the three-way test in 3h depends on it.
- **Flags:** every option of COMMANDS.md's table, values checked against the question file (a bad one exits 2 naming the allowed values); `--kinds-other` without `other` in `--kinds` exits 2. Defaults from the question file, recorded `default`; human-only values without a flag make the run exit 3 with `{"status": "needs_input", "missing": ["purpose", "scope"], "how": "…"}` (the `how` names the flags and `--web`), nothing written. `--accept-defaults` fills human-only values that have a default (`purpose`), recorded `agent`; `scope` has none, so it still needs a flag.
- **Detail rules:** a text answer under its `min-words` is written with the warning `brief.vague` (the key, the word count, the question file's example), in `--json`'s `warnings`; exit 0.
- **Defaults per purpose:** the question file holds each purpose's defaults; the machine config's `[brief.purpose.<purpose>]` tables replace them, read through the existing config loader, with `config.toml:line` errors (an unknown purpose, key or value).
- **Not in this slice:** `--web` and `--tui` exit 2 "not available yet" (3h, 3i).

### Tasks

1. 3d's fixes above.
2. G15: `commitment` in `BriefSchema` and the brief fixtures; the `brief.*` goldens updated and counted.
3. The question file, its schema and tests (G11, G16's defaults).
4. The writer, with unit tests: byte-identical output for the same answers given in any order; every key present; `decided_by` right for flags, defaults and `--accept-defaults`; the profile resolved from the purpose; Vietnamese text and YAML quoting edges (colons, `#`, leading spaces, multi-line `request`).
5. `quiz brief DIR` with flags: G17 (`brief.no-history` registered as a warning), G18, exit 3, `--json`, `content/` created, goldens for every exit; `check` reads every written brief without `brief.invalid`.
6. `[brief.purpose.<purpose>]` in the machine config, with goldens for a changed default and for each config error.
7. `quiz --help` and the top-level goldens gain `brief`.

### Done when

`npm run check` passes in Chromium; `quiz brief d --purpose exam-prep --scope "lectures 3 to 5, the Fourier transform" --json` writes a `d/brief.yaml` that `check` reads cleanly, and the same answers given in another flag order write the same bytes; without `--scope` it exits 3 and writes nothing. Report as the rules say.

### Review

**3g's review (2026-11-03).** Typecheck, Biome and Vitest clean: 96 files, **2422 of 2422**, the 2 startup tests (run alone, as `npm test` runs them; inside a single run of every file at once the `check` budget test reads 240 ms against 180, which is that invocation's load, not a regression). Playwright in Chromium: **193 passed**, 128 skipped, none failed (run in review). Firefox not run (not installed here, as before). Goldens: 23 existing cases changed (4 `stats` cases for the one-decimal bands, 17 `rules/*` cases for the `brief.no-history` row, `top/help` and `top/no-command` for `brief`); 49 new (5 `new/id-*`, `check/brief-no-commitment`, 29 `brief/*`, 14 `brief/config-*`). The question file ships as `dist/brief/questions.yaml` (13 KB, copied by `scripts/build-brief.mjs`); `brief` and its `--help` are lazy chunks, so startup is untouched. Tried by hand: the "Done when" command writes `d/brief.yaml` and `d/content/`, and `check` on a quiz beside it gives no `brief.invalid`; the flags in another order write the same bytes; without `--scope` exit 3 with `needs_input`, nothing written; `--scope x` and `"ch 3"` write with `brief.vague` (the word count and the example); `--accept-defaults` writes `purpose: self-study` as `agent`; `--purpose exam` exits 2 naming the four values; a second run on the same `DIR` exits 2 with G18's message; a scope with `: ` and `#` and a two-line `request` with leading spaces are written quoted and read back. Done differently, accepted in review unless the owner says otherwise: a whitespace-only `--scope` counts as missing (exit 3); an existing `brief.yaml` is reported before a missing value (exit 2 before exit 3, as G18 says "before asking anything"); `--profile` is checked against the built-in and configured profiles (exit 2 naming them); a `config.toml` error under `[brief.purpose.*]` also stops the other commands, since the file is read once; `--timeout`, `--port` and `--no-open` are accepted and ignored without `--web`; lists are written in the question file's order, so `--kinds a,b` and `b,a` give the same bytes; `decided_by.content` is the strongest of its three answers.

**3g's gaps decided by the owner on 2026-11-03**, all as recommended, and written into TECHNICAL_DESIGN.md section 5 (the `brief.vague` row) and COMMANDS.md (`quiz brief`: the question file's extra fields, `--accept-defaults` fills only the values that need an answer; `quiz stats`: a report question with an empty `id` exits 1). They are 3i's first tasks.

## Slice 3i: 3g's fixes, then `brief --tui`

**Approved by the owner on 2026-11-03**, with G12 and G23 to G25.

### Read first

- COMMANDS.md: `quiz brief` (all of it, especially `--tui`, the question file, the detail rules and "The file"), "Exit codes", "Common options"; `quiz stats`'s `FILE...` row and exit list.
- TECHNICAL_DESIGN.md section 3 (the terminal form row), section 5 (the `brief.*` rows), section 7 (Budgets: `@clack/prompts` loads only for `brief --tui`), the notices paragraph and its allow-list.
- This plan: "Rules for every slice", G12, G19 to G25, and 3g's review.
- Code: `src/cli/brief.ts`, `src/cli/brief-help.ts`, `src/cli/brief-questions.ts`, `src/core/brief/` (`questions.ts`, `write.ts`), `src/brief/questions.yaml`, `src/core/rules/brief.ts`, `src/cli/stats.ts`, `scripts/notices.mjs`, `test/notices.test.ts`, `test/startup.test.ts`, `test/golden/brief/`.

### Decided for this slice

- **3g's fixes:** `brief.vague` registered as a warning beside `brief.no-history` (G19), its `run` returning nothing; the `rules/*` goldens change once, counted. G20, G21 and G22 are already what the code does: only the docs changed, and a test pins each (`--accept-defaults` leaves `commitment` as `default`; a report with an empty question `id` exits 1 with the fix; the question file's schema covers every field COMMANDS.md now names).
- **The dependency** (G12): `@clack/prompts` pinned exactly (1.8.1, or the newest at least two weeks old when the slice starts), loaded by a dynamic `import()` inside the `--tui` path only; a test checks that `brief` through flags and `check` do not load it. `--acknowledgements`, `THIRD_PARTY_NOTICES.md` and the notices test gain it and its dependencies; the allow-list is not widened.
- **The form** reads the question file and nothing else for its words: each section a step with progress (*Quiz 1/2*); each question's label and help; a `choice` as a select and a `multi` as a multi-select, each choice with its hint; the follow-up text box when *other* is picked; `text` with its `min-words` (show the example, ask again); `number` with `min` and `max`; human-only questions start empty and cannot be skipped, an `optional` one may be left empty. The defaults that depend on the purpose (`mix`, `profile`, the machine config's `[brief.purpose.*]`) are filled after purpose is answered, so changing purpose on the way back refills the ones still at their default.
- **The summary screen** lists every answer, marks the defaults (G23), and lets the user go back to any question; only **Write** writes. The answers go through the same writer as the flags (`emitBrief`), so nothing new decides the bytes.
- **Flags with `--tui`** (G24), **the streams, `--json` and Ctrl+C** (G25), as decided. G18's check (an existing `brief.yaml`) runs before the form opens.
- **Not in this slice:** `--web` (3h). Its "not available yet" stays.

### Tasks

1. 3g's fixes above (G19's registration, tests pinning G20 to G22).
2. G12: the dependency, its notices and the load test.
3. The form as a module over injected `input` and `output` streams, so it can be driven in process; the summary screen; going back.
4. `quiz brief DIR --tui`: the terminal check, flags as pre-fills, stderr drawing, `--json`, Ctrl+C, the exits; `--help` and the brief goldens updated (the `tui` golden's "not available yet" goes).
5. **The byte-identity test:** for at least six answer sets (every purpose; English and Vietnamese; *other* with its text; a changed purpose on the way back; a defaults-only run but for purpose and scope; `--weak-topics yes`), the form and the equivalent flags run write the same bytes and the same `decided_by`.
6. One subprocess test under `script(1)`: the real command answers through a pseudo-terminal and writes the brief; a SIGINT mid-form writes nothing. Skipped by name where `script` is not there.
7. `npm run samples` gains a `brief --tui` line for the owner to try by hand.

### Done when

`npm run check` passes in Chromium; `quiz brief d --tui` in a real terminal asks every question in the question file's words, shows the summary, and writes a `d/brief.yaml` byte-identical to the flags run with the same answers; Ctrl+C writes nothing; `quiz brief d --tui < /dev/null` exits 2 with the message; `check` does not load `@clack/prompts`. Report as the rules say.

### Review

**3i's review (2026-11-03).** Typecheck, Biome and Vitest clean: 98 files, **2466 of 2466**, the 2 startup tests. Playwright in Chromium: **193 passed**, 128 skipped, none failed (run in review). Goldens: 19 changed (17 `rules/*` for the `brief.vague` row, once; `brief/tui` for the terminal message in place of "not available yet"; `brief/help` for the `--tui` line); 3 new (`brief/tui-json`, `brief/tui-and-web`, `brief/tui-accept-defaults`). The byte-identity test compares 11 answer sets (every purpose, Vietnamese both ways, *other*, purpose changed on the way back, `--weak-topics yes`, several answers changed, a flag pre-fill kept) through the form and the flags: the whole file, `defaults_applied` and the warnings. `@clack/prompts` 1.8.1 and its four dependencies, all MIT, are in the notices and load only from the form's chunk (`test/cli-graph.test.ts`). **The notices script changed:** clack's MIT text is worded differently, and as the first MIT text it would have become the one the page's Licences popup shows (9 build goldens changed in Sonnet's first run); the script now always takes a shown text from a package the page ships, and gives clack's copyright line in the override, since its file runs title and copyright on one line. Reviewed and accepted; no build golden changed. Tried by hand: `< /dev/null` exits 2 with the message; under `script(1)` the form draws each step heading, the help above each question, a hint beside each choice, and Ctrl+C prints "cancelled: nothing was written", exit 2, no `DIR`. Done differently, accepted in review unless the owner says otherwise: the form returns flag-style answers and `runBrief` writes them, so byte identity holds by construction (G23: an answer left at its default is omitted); going back is from the summary screen, as COMMANDS.md says; `--language` fixes the form's language for the run; the number and word checks moved to `src/core/brief/questions.ts`, shared by the flags and the form; the form's own words (steps, summary, validation) are in `src/cli/brief-tui.ts` in `en` and `vi`.

**3i's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md, `quiz brief` (the exit order; the cursor on the first choice; the step heading; 80 columns for a terminal with no width). G26 and G29 are code: 3j's first tasks.

## Slice 3j: 3i's fixes, then `build --watch` and `--serve`

**Approved by the owner on 2026-11-03**, with G30 to G33.

### Read first

- COMMANDS.md: `quiz build` (all of it: `--watch`, `--serve`, `--json`, several files, the build file), `quiz serve` (the `listening` line), "Exit codes", "Common options"; `quiz brief`'s exit list and `--tui` row (G26, G29).
- TECHNICAL_DESIGN.md: section 3 (Watching: `node:fs.watch` with `recursive`), section 7 (Budgets; "Left until measured": no disk cache), foundation 1 (what the quiz hash covers: the files to watch), foundation 4 (the server's rules), foundation 9 (no server code in a shared page; the reload code).
- This plan: "Rules for every slice", G6, G10, G26, G29, G30 to G33, and 3i's review.
- Code: `src/cli/build.ts`, `src/cli/build-file.ts`, `src/cli/main.ts` (the `LATER` stubs), `src/build/page.ts` (the CSP), `src/serve/server.ts`, `src/serve/module-file.ts`, `scripts/build-page.mjs`, `scripts/bundles.mjs`, `e2e/helpers.ts` (the served-command helper), `src/cli/brief.ts` and `src/cli/brief-tui.ts` (for G26 and G29).

### Decided for this slice

- **3i's fixes:** G26, the flags are checked before an existing `brief.yaml` and before the terminal (the `brief/tui*` goldens that change, counted); G29, the form draws at 80 columns when the output reports 0 or no width, with a unit test on a 0-column stream.
- **What is watched** (G6): each `FILE`, every file its quiz hash covers (assets, `materials` sheets and their assets, found from the last build, good or failed), and the build file; watched by folder, so an editor that saves by rename is seen; changes gathered for 100 ms, then one rebuild of the quizzes they touch. A file the quiz starts or stops referencing is watched from the next rebuild on. A deleted `FILE` is a failed rebuild (its read error), not an exit.
- **The last good page** stays on disk and in the server after a failed rebuild; nothing is written when check fails, as `build` already does. `--print` rebuilds the paper. A build file's entries are re-read when it changes; a build file that no longer parses is a failed rebuild of everything, and the old entries stay watched.
- **The reload server** (G30, G31): not the one-shot server's predicate or submit path. Either `startServer` gains a mode with no `quizIds`, no submit and an events path, or a small sibling in `src/serve/` shares its token, `Host` and refusal code; Sonnet picks the smaller change and says which. It holds the pages in memory and writes nothing. It runs until Ctrl+C, which exits 0 (G6).
- **Outputs** (G32) and **the index** (G33), as decided.
- **Determinism:** a `build --watch` page on disk is byte-identical to `build` of the same input (with `--built-at`); only the served copy carries the reload code.
- **Not in this slice:** a disk cache; a build log ([proposals/build-log.md](../design/proposals/build-log.md)); the PDF through the browser (a proposal written in this slice's review, as "Open proposals" says).

### Tasks

1. 3i's fixes above (G26, G29).
2. The watcher in its own module over an injected file-system watcher and clock, so unit tests never wait: debounce, the watched set following the last build, rename saves, deletion, the build file.
3. `build --watch` without `--serve`: rebuilds, the human line and the JSON lines, the last good page kept, `--print`, several files, the build file, Ctrl+C exits 0 with `{"status": "stopped"}`.
4. `dist/reload.js` (G31) and the served copy: its CSP, the byte-identity test (a page on disk with and without `--watch`), a test that a `--serve` page holds no submit code.
5. The reload server (G30): token paths, `Host`, the event stream, the keep-alive comment, the index (G33); `--port`, `--open`.
6. Subprocess tests with the served-command helper: start `build --watch --serve --json`, read `listening`, open the page in Playwright, edit the quiz, see the page reload with the change; save an error, see the terminal's errors and the page unchanged; fix it, see it reload; SIGINT exits 0. The same for two files through the index.
7. `quiz build --help`, the `LATER` stubs removed, goldens for every new exit and usage error; `npm run samples` gains a `build --watch --serve` line.

### Done when

`npm run check` passes in Chromium; `quiz build examples/rust/quiz.md --watch --serve --open` opens the page, a saved edit reloads it within a second, a saved error leaves it as it was and prints the errors, and Ctrl+C exits 0; the page on disk is byte-identical to `build`'s; `check` does not load `src/serve/`. Report as the rules say.

### Review

**3j's review (2026-11-03).** Typecheck, Biome and Vitest clean: 101 files, **2525 of 2525**, the 2 startup tests. Playwright in Chromium: **197 passed** (4 new in `e2e/watch.spec.ts`), 128 skipped, none failed (run in review). No existing golden changed; 13 new (`brief/tui-bad-flag` for G26; 7 `build/*` usage errors and a missing file; `top/help-build`; the index in `en` and `vi`; 2 e2e `jsonl` goldens). `dist/reload.js` is 178 B (170 gzipped); `dist/serve.js` unchanged; the watch code is its own CLI chunk, which `build` and `check` never load. The reload server is a sibling, `src/serve/reload-server.ts`, with no POST path at all, sharing the one-shot server's token, `Host` and refusal code; the served copy is made by `withReload` on the finished page or paper, so a paper is served the same way. Tried by hand on a copy of `examples/rust`: `--watch --serve --json` gives `listening`, `built`, a `built` line and one `reload` event for a saved edit, a `failed` line with the errors and "kept the last good page" (no event) for a saved error; the page 200, a path outside the token 403; SIGINT printed `{"status":"stopped"}`, exit 0, no process left. Done differently, accepted in review unless the owner says otherwise: each watched file's folder gets a non-recursive watch (TECHNICAL_DESIGN.md section 3 says `recursive`); the 100 ms window starts at the first event and does not slide; a reload event names its page, so with several files an edit reloads only that page and the index; an unusable input at start exits 2 before anything is watched; the human line goes to stderr with and without `--json`. **Written in review:** [proposals/print-pdf.md](../design/proposals/print-pdf.md), as "Open proposals" planned.

**3j's gaps decided by the owner on 2026-11-03**, all as recommended, and written into COMMANDS.md (`quiz build`: the index's note on the next load; `--open` with `--watch --serve` opens the index; the config needs a restart) and TECHNICAL_DESIGN.md section 3 (the Watching row). G35's line was made in review, with a test in `test/build/watch.test.ts`.

## Slice 3e: G47, then the review file, `check --review` and `inspect --review`

**Approved by the owner on 2026-11-04**, with G48 and G49 as recommended. 3e as first listed (the format, the checks, the form, `--since`) is three Sonnet sessions, not one, so it is cut in three (the slice table): **3e** the file and the two commands that read it, with no browser; **3k** `quiz review` and its form; **3l** `--since` and the phone. This brief is 3e's; 3k and 3l stay outlines until 3e is reviewed.

### Read first

- COMMANDS.md: `quiz check` (the `--review` row and the exit list), `quiz inspect` (all of it), `quiz review` (the form's rules, for what the file must hold), `quiz ids`, "Exit codes", "Files".
- TECHNICAL_DESIGN.md: section 4, "`review-v1`" (the type, the rules on keys, reasons, merging and `assumed`, and the table of `review.fix`, `review.drop`, `review.unconfirmed`); section 5 (the rule catalogue: where these three go); foundation 1 (what the question hash covers); foundation 6 (versioned files; 0.x files refused).
- This plan: "Rules for every slice", G1, G2, G3, G47, G48, G49.
- Code: `src/core/ir.ts` (`QuestionBase`: `id`, `hash`), `src/core/parse/question.ts` (lines 300 to 325: the block the hash is taken over), `src/core/rules/types.ts` (`RuleContext`), `src/core/rules/fixed.ts` (the `fixed(...)` helper, `raisedBy: "check"`), `src/core/rules/quality.ts`, `src/core/rules/registry.ts`, `src/core/rules/check.ts` (`runChecks`), `src/cli/check.ts` (the `--review` stub, line 263), `src/cli/inspect.ts` (its stub), `src/core/inspect.ts` (`summarise`, `summaryLines`), `src/cli/main.ts` (the two `--review` options and their "not available yet"), `src/core/attempt/schema.ts` (how a versioned file is read and refused); for G47, `src/core/i18n/en.ts` and `vi.ts` (`fontName`), `src/page/Appearance.tsx` (line 150), `src/core/fonts.ts` (`FONT_REGISTRY[id].family`).
- Goldens: `test/golden/rules/`, `test/golden/check/`, `test/golden/inspect/`, `test/golden/top/` (help).

### Decided for this slice

- **G47 first:** the page's Font row names each font by category, from the catalogs: `en` System, Sans, Serif, Readable; `vi` Hệ thống, Sans, Serif, Dễ đọc. Each pill's `title` is the family from `FONT_REGISTRY` (none for System). The Information tab keeps the family names. TECHNICAL_DESIGN.md section 8 (the Appearance row) says so. Goldens of built pages that hold the font row's strings change: count them.
- **The file** (G48): `{"format": "fullmark-review", "version": 2}` and the fields of section 4's type. A zod schema in `src/core/review/schema.ts` is the source of the TS type; a reader in `src/core/review/read.ts` returns the review or every problem found: not JSON, wrong `format` or `version` (a file with `"version": 1` and no `format`, as 0.x wrote, is refused with "a fullmark 0.x review: 1.0 does not read it; judge the quiz again with `quiz review`"), a missing or wrongly typed field, an unknown verdict, an unknown reason id, a reason given with the wrong verdict, `reasons` not empty for `keep` or empty for `fix` and `drop`, an `other` reason with an empty `note`, `assumed` on a `fix` or `drop`, `source` on a `keep`. A reason for essays and code (`rubric-loose`, `points-misallocated`, `criterion-unclear`) on a question that is in the quiz and is not `essay` or `code` is a problem too; on a question no longer in the quiz it is not judged.
- **Writing and merging** (`src/core/review/merge.ts`), for 3k to call, tested here: `merge(old, judged, quiz)` replaces the entries judged, keeps every other entry (also those of questions no longer in the quiz), sets `quizHash` and `reviewedAt`, and writes keys sorted, so the same inputs give the same bytes. `source` is the question's block as hashed (foundation 1): export it from the parser beside the hash (for example a `blockText(lines, region, parts)` used by both), without adding it to the IR, so no IR golden changes.
- **The three rules.** `review.fix` and `review.drop` are fixed rules (`raisedBy: "check"`, level error); `review.unconfirmed` is a quality rule (warning by default) that runs only when a review is given. `RuleContext` gains `review: Review | null` (null everywhere except `check --review`). Each finding is on the question's heading line and names the verdict's date and reasons ("marked fix on 28 Oct (unclear): the question has not changed since"); the fix hints are section 4's. Entries for questions no longer in the quiz are ignored; a `keep` is never a finding. The `rules/*` goldens change once for the three new rules: count them.
- **`check --review REVIEW`**: one quiz only (several files exit 2, "--review takes one quiz"); an unreadable or invalid review exits 2 listing every problem; a review whose `quizId` is another quiz's exits 2 naming both ids. A review of another *version* of the same quiz is the normal case and is fine. `--json` is as without `--review`, the findings among `issues`.
- **`inspect --review REVIEW`** (G49): the same reading and the same exits as `check --review`; the summary gains one row and the JSON one key.
- **Not in this slice:** `quiz review` and its form (3k); `--since` (3l); the reason labels in the catalogs (3k, from the ReviewVi board): the CLI's messages are English only.

### Tasks

1. G47 (one commit): the catalogs, the tooltip, TECHNICAL_DESIGN.md section 8, the goldens that change, counted; a unit test that the Font row shows the categories and the families as tooltips.
2. `src/core/review/` (one commit): the schema, the reader with every problem above (one fixture each), the block text from the parser (a test that the `source` of a question hashes to its `hash`), `merge` with its determinism test.
3. The three rules and `RuleContext.review` (one commit): unit tests for each finding and each non-finding (changed fix, removed fix, changed drop, removed drop, keep, an entry for a removed question, a changed fix that was judged again in a later run); the `rules/*` goldens, counted.
4. `check --review` and `inspect --review` (one commit): the stubs and the "not available yet" help text removed; goldens for a clean review, each finding, `--json`, every exit 2 (several files, unreadable, invalid, 0.x file, another quiz); `inspect --review` in human and `--json`.
5. The docs (with the code that makes them true): G48 and G49 into TECHNICAL_DESIGN.md section 4 and COMMANDS.md, `review-v1` renamed `review-v2` where it names the format (this plan's history keeps the old name).

### Done when

`npm run check` passes in Chromium (Firefox only if the environment has it; say which ran); a review fixture with one fix, one drop and one keep makes `quiz check examples/<quiz> --review review.json` exit 1 with `review.fix` and `review.drop`, exit 0 with `review.unconfirmed` once both questions are changed and the drop removed, and exit 2 on a 0.x review; `quiz inspect --review` prints the counts; `check` still does not load `src/serve/`. Report as the rules say, with every golden that changed counted and explained.

### Review

**3e's review (2026-11-04).** Six commits, `5e9b45c`..`dbcd43e`. Typecheck and Biome clean; the 2 startup tests and `test/cli-graph.test.ts` pass alone (`check` still does not load `src/serve/`). Vitest: **2539 passed**, 51 failed, 3 skipped. The 2 startup tests fail only in the parallel run, as before; the other **49 fail identically on the baseline `261bf3e`** (run in review in a worktree there: the same six files, the same counts), for the causes in G51. None of the failures is a 3e test. Playwright in Chromium: 190 passed, 133 skipped, 2 failed. `watch.spec.ts:167` fails on the baseline too (`EPERM` on a temp folder, G51). `budget.spec.ts` passes alone on HEAD, twice, but only on its retry (first measure 1074 and 1106 ms against 1000 ms, then 564 and 527 ms); G47 adds only a `title`, so this is the laptop's cold start, to watch in 3z. Firefox was not run.

**Goldens**, all explained: G47 changed **14 files in 9 cases** (8 `build/*` and `replay/good`: the Font row's four words and the tooltip); the three new rules changed **17 `rules/*` cases** (two lines in the fixed group, one in the quality list); `check/review-with-several` and `top/help-check` changed with the stub's message and the option's help; **19 added** (13 `check/review-*`, 6 `inspect/review-*`); **3 removed** (the "not available yet" stubs).

**Tried by hand** on a copy of `examples/calculus`, with a review made by `merge` and `serialiseReview` (fix on `chain-rule`, drop on `product-rule`, keep on `related-rates`): exit 1 with `review.fix` and `review.drop` on the heading lines; after changing `chain-rule`'s answer and removing `product-rule`, exit 0 with `review.unconfirmed` only (exit 1 with `--strict`); `inspect --review` printed `Review    keep 1 · fix 1 · drop 1 · not judged 9 · 28 Oct`, and the JSON key as G49 says (`fixChanged: 1`, `drop: 0` after the edits); exit 2 for a 0.x file (G48's message), two quizzes or a glob ("--review takes one quiz"), another quiz's review (both ids named), and a file that is not JSON (with `problems` in `--json`). The `source` written is the block without its id, as foundation 1 hashes it. The schema's problems use zod's wording ("Invalid input: expected string, received undefined"), as the results and grades readers already do.

**Done differently, accepted in review unless the owner says otherwise:** `review.unconfirmed` sits in its own `REVIEW_RULES` group, so `quiz rules` lists it last, after the build rules; `review.fix` and `review.drop` are raised by `runChecks` itself, beside the profile's rules, and cannot be ignored (fixed rules never can); a finding names the review's one `reviewedAt` (an entry has no date of its own) and the reason ids, not their labels (labels come with 3k); the `--json` error object gains `problems`, written into COMMANDS.md; `merge` takes a `ReviewTarget` built by `reviewTarget(quiz, quizHash, blocks, reviewedAt)`, so it stays pure; the other-quiz check comes before the rubric-reason check; the parser gives the blocks through an optional `ParseOptions.blocks` map, so no IR golden changed. No example `review.json` was added (the brief asked for none).

**3e's gaps decided by the owner on 2026-11-04**, both as recommended: G50 (the unconfirmed hint names the real files) is 3l's first task, G51 (local Windows runs green) is 3k's.

**Left on the disk by the implementing agent** (its own cleanup was blocked): the worktree `D:\coding-projects\fm-base` at `261bf3e` (used again in this review for the baseline), whose `node_modules` is a junction to this repo's, and six `D:\tmp_*.txt` logs. With the owner's go-ahead the junction and the worktree were removed in review (the real `node_modules` kept); the logs are left for the owner to delete, since the safety check refuses removals at the root of `D:`.

## Slice 3k: G51, then `quiz review` and its form

**Approved by the owner on 2026-11-04**, with G52 to G55 as recommended. Built from the Review, ReviewFinish and ReviewVi boards (`docs/mockup/boards/`, images in `docs/mockup/images/`) at 1280 px. The stacked sidebar with the materials, `--since` and the phone are 3l's (G52).

### Read first

- COMMANDS.md: `quiz review` (all of it), `quiz serve` (the options, the `listening` line, the exits 3k copies), `quiz check` (`--review`), "Exit codes", "Files".
- TECHNICAL_DESIGN.md: section 4, "`review-v2`"; section 7, foundations 4, 6 and 9 (the locked-down server, one module for every form, a built page holds nothing of a server); section 8, the Sidebar, Question map and Appearance rows and the text size; the catalogs (the `vi` rules).
- This plan: "Rules for every slice", G38 to G46, G48, G51 to G55, and 3e's Review.
- Code: `src/serve/server.ts` (`startServer`, and how a POST body is read and checked), `src/serve/module.ts`, `src/cli/serve.ts` (`runServe`: the refusals, `--json`, the timeout, Ctrl+C), `src/cli/atomic.ts`, `src/cli/review-file.ts`, `src/core/review/` (all), `src/core/parse/index.ts` (`ParseOptions.blocks`), `src/build/page.ts` (`pageQuizOf`, `buildPage`, the CSP), `scripts/bundles.mjs` and `scripts/build-page.mjs` (the IIFE bundles), `src/page/data.ts` (`PageQuiz`, `KeyBlob`, `openKey`), `src/page/questions/Card.tsx` and the type components (their after-Submit state), `src/page/Appearance.tsx`, `src/page/look.ts`, `src/page/Sidebar.tsx` and `src/page/map.ts` (`Part`, `Ring`, the cells: their look, not their store), `src/page/styles/`, `src/core/i18n/en.ts` and `vi.ts`, `e2e/helpers.ts` (`serveProcess`, `expectGolden`, `noViolations`), `scripts/samples.mjs`, `test/cli-graph.test.ts`.
- For G51: `test/golden/golden.test.ts` (how a case's environment is set), `src/cli/templates.ts` (where the user folder comes from), `test/watch/watcher.test.ts`, `test/build/watch.test.ts`, `test/serve/server.test.ts`, `test/build/several-cli.test.ts`, `test/build/build-file-cli.test.ts`, `e2e/watch.spec.ts`.

### Decided for this slice

- **G51 first:** the golden runner sets the user config folder of every case itself, on every platform, so the `template/*` and `new/user-template*` goldens pass on win32 unchanged (a golden that would have to change is a sign the fix is wrong: stop and report). Temp folders in tests are removed with retries. Each watch, watcher and server test that waits on real time takes its time from the injected clock or the injected timer; one that cannot is named in the report with the reason. The two example tests that time out get a timeout sized to what they build, said in the test. Done when Vitest has no failure on win32 here, run twice.
- **The server takes other submits** (foundation 6: every form runs on one module). `startServer` gains the reader of a submit body as an option: given the parsed JSON, it returns the quiz id and the value, or a plain-words problem (400). `serve` passes the attempt reader it has today, so no `serve` test or golden changes. Each server keeps the one POST path, `./submit`; `review` has no progress path.
- **The command:** `quiz review FILE [--out REVIEW] [--open] [--timeout SECONDS] [--port N] [--json]`, as COMMANDS.md says. It refuses, in this order: a usage error, exit 2 (a built page, as `serve` refuses one; `--since`, with "quiz review --since is not available yet"); a survey, exit 2 (G54); check errors, exit 1, printed as `check` prints them; questions without an id, exit 1, all named, with "run `quiz ids FILE` first: a verdict follows its question by id"; an `--out` file that `check --review` would refuse (unreadable, invalid, 0.x, another quiz), exit 2 with the same messages. Then it serves the form, with the `listening` line under `--json`, `--open`, the timeout (default 1800 s) and Ctrl+C as `serve` has them. Nothing is written unless a Finish is accepted, and an interrupted run leaves an existing `--out` byte for byte as it was.
- **The submit:** `{"quizId", "quizHash", "judged": {"<id>": {"verdict", "reasons", "note", "assumed"?}}}` with one entry for every question of the quiz, the earlier verdicts kept under G53 included. The server checks it with the review's own rules (the entry schema, rubric reasons only on essays and code) and answers 400 to another version, a missing or unknown id, or a broken entry. It then writes `merge(old, judged, reviewTarget(...))`, with `reviewedAt` from the injected clock (local offset) and `serialiseReview`, atomically, and ends. It prints `review.json written: 26 keep (14 not looked at), 3 fix, 1 drop` and the next command, `quiz check FILE --review REVIEW`. With `--json` it prints `{"status": "written", "review": PATH, "keep", "fix", "drop"}`, counted over the quiz's current questions as `inspect --review` counts them (`keep` includes the assumed). A timeout prints `{"status": "timeout"}` and exits 2.
- **The form** lives in `src/review/`, bundled to `dist/review.js` as its own IIFE beside `dist/serve.js`. The CLI builds its page in memory (`src/build/review-form.ts`) from the quiz's page data (`pageQuizOf`), the earlier verdicts kept under G53, the page's CSS and the form's own, and a CSP with the form's script hash and `connect-src 'self'`. `build`'s output does not change: no `build` golden moves. What it shows is COMMANDS.md's "The form" and the boards: the cards in key state (G55) with Keep, Fix, Drop, the reasons and the note (G41); the bar with the label, the sidebar button, the joined text size, Appearance only under `look: free`, Keep the rest and Finish (G42); the status line; the plain Questions sidebar with its collapsible parts, rings and 40 px cells (G39, G52); the keys `1`, `2`, `3`, `N`, `Q`, `Esc`, none while typing, with `aria-keyshortcuts` (G38); the Keep the rest and Finish dialogs (G43); the saved card. Colours, sizes and spacing come from the boards' source.
- **Words:** English from COMMANDS.md and the boards, Vietnamese from G46 (the ReviewVi board), in a `review` group of the catalogs; the quiz's `ui_lang` chooses. The CLI's own lines are English only.
- **Loading:** `quiz review` loads the page builder and `src/serve/`; `check` still loads neither, and `test/cli-graph.test.ts` names the review chunk.
- **Not in this slice:** `--since`, the stacked Questions & materials sidebar and the phone (3l, G52); G50's hint (3l).

### Tasks

1. G51 (one commit): the runner's user folder, the retries, the clocks and the timeouts; Vitest clean on win32 twice, the counts in the report.
2. The server's body reader (one commit): the option, `serve` unchanged, unit tests with a second reader (port 0, `fetch`).
3. The command without the form (one commit): every refusal and exit, a golden each (`test/golden/review/`); the submit read and written as a unit test with a POST (merge into an existing file, the clock injected, G53's kept verdicts written back unchanged), and the `--json` lines.
4. The form (one or more commits): the components, the bundle, `review-form.ts`; Playwright through `serveProcess`: judge every question by mouse and by keys; a Fix with no reason, or Other with no note, holds Finish back; Keep the rest and the Finish dialog write `assumed`; the written file against a golden and read back by `quiz check --review`; the saved card; a second run opens with the first run's verdicts (G53); a `vi` quiz; axe in light and dark; screens of the Review, ReviewFinish and ReviewVi states to `docs/screens/3k/`, committed.
5. The rest (one commit, with the code that makes it true): the samples line for `quiz review`; G52 to G55 into COMMANDS.md (`quiz review`) and TECHNICAL_DESIGN.md (section 4 for G53); the slice table's 3k and 3l rows as G52 says.

### Done when

`npm run check` passes on win32 here with no Vitest failure (G51) and in Chromium (Firefox only if the environment has it; say which ran). `quiz review examples/rust/quiz.md --open` opens the form in the quiz's look; judging every question by keys and pressing Finish writes `review.json`, and `quiz check examples/rust/quiz.md --review review.json` then exits 1 with `review.fix` and `review.drop` for what was marked. A second `quiz review` opens with those verdicts in place. A survey exits 2; a quiz with a question without an id exits 1. `check` still does not load `src/serve/`. The screens are committed. Report as the rules say, every golden that changed counted and explained.

### Review

**3k's review (2026-11-04).** Seven commits, `91a8821`..`c326d9f`. Typecheck, Biome and knip clean. Vitest, run twice in review after a fresh build: **2668 passed**, 3 skipped, and in each run only the 2 startup tests failed, because the run was parallel; alone (as `npm test` runs them) they pass, 2 of 2. So **G51 holds: no other failure on win32**, where 3e's review had 49. Playwright in Chromium: 205 passed, 140 skipped, 1 failed, `budget.spec.ts` under the full run's load (1134 ms against 1000); alone it passes at 592 ms. `dist/page.js`, `serve.js`, `reload.js` and `page.css` are byte-identical to before 3k, so the shared page is unchanged. Firefox was not run, and the Ctrl+C e2e test is skipped on win32: both need a Linux run, in 3z at the latest.

**Goldens**, all explained: **2 changed** (`top/help` stdout and `top/no-command` stderr, each the three lines of the new `review` entry); **19 added** under `test/golden/review/` (every refusal and its `--json` form) and 3 e2e goldens (`review-written`, `review-types`, `review-keep-rest`); none removed, no `build` golden moved.

**Tried by hand** on a copy of `examples/rust`. `quiz review quiz.md --json`: the `listening` line, the form in the quiz's look. `1` gave Keep, `N` moved and scrolled to the next, `2` gave Fix. Finish with that Fix having no reason wrote nothing and listed it ("1 question needs a reason or a note…: 2"). After picking Unclear, Keep the rest opened its dialog, and Mark them Keep and finish wrote `{"status":"written","review":"review.json","keep":9,"fix":1,"drop":0}`, exit 0, with `assumed` on the 8 not looked at. `check --review` then exited 1 with `review.fix` on `which-compile` (reason "unclear"), and `inspect --review` printed `keep 9 (8 not looked at) · fix 1 · drop 0 · not judged 0`. After editing the `largest` question, a second `quiz review` opened at "Judged 9 of 10" with only `largest` not judged (G53). Killing that run left `review.json` byte for byte. `quiz review examples/survey/quiz.md` exits 2 with G54's message; `--since` exits 2, "not available yet".

**Done differently, accepted in review unless the owner says otherwise:**

- The form's words are in their own catalog file, `src/core/i18n/review.ts`, not a group in `en.ts` and `vi.ts`: adding them there changed `dist/page.js` and every build golden.
- G51 was met by finding the causes, not by moving every wait onto the injected clock. The watcher watched folders whose drive letter had been case-folded (a real Windows bug, fixed in `src/cli/watcher.ts`). The server answered 413 while the client was still writing, and Windows dropped the answer; it now reads up to twice the cap before answering. The example-building tests got timeouts sized and explained in the test, and the golden test's went from 60 to 180 s. No test was named as still waiting on real time; the two clean runs are the evidence.
- In the server the 409 "already submitted" now comes after the body is read and checked, not before.
- "Ask for `quiz ids`" applies only when every check error is `question.id-missing`; with other errors too, the errors are printed as `check` prints them.
- The human output leaves out "(0 not looked at)"; the two progress lines go to stderr; the form's `lang` is the quiz's `ui_lang`; `test/serve/module.test.ts`'s guard skips `src/cli/review.ts`, which uses the server as `serve.ts` does.

**Small things for 3l's fixes** (no decision needed):

- In both dialogs `quiz review --since` breaks at its hyphen; it should be a code span that does not wrap.
- COMMANDS.md says "until slice 3l" twice (the stacked sidebar and `--since`); 3l removes both when it builds them.
- A one-question part shows its heading row as the cell, as on the page (`singleRow`), so "3 · Write some code" has no count: as designed.
- Fixed in review: a form-feed byte in a comment of `test/golden/runner.ts` (the `\f` of `%APPDATA%\fullmark`, written by a shell).

**3k's gaps decided by the owner on 2026-11-04**, both as recommended: G56 (a matching question's distractors, listed as "Matches nothing") is built in 3l; G57 (the six strings not on the boards) keeps them as written.

**Left on the disk:** nothing in the repo; the review's copies are in the session scratchpad.

## Slice 3l: G50, G56 and 3k's fixes, then `quiz review --since`

**Approved by the owner on 2026-11-05**, with G58 to G62 as recommended. As G58 decided, the stacked Questions & materials sidebar and the phone are 3m's. Built from the ReviewSince board (`docs/mockup/boards/ReviewSince.dc.html`, image in `docs/mockup/images/ReviewSince.png`) at 1280 px, with the plain Questions sidebar that 3k built in place of the stacked one drawn there.

### Read first

- COMMANDS.md: `quiz review` (all of it, "With `--since`" above all), `quiz check` (`--review`), `quiz inspect` (`--review`: how the date is written).
- TECHNICAL_DESIGN.md: section 4, "`review-v2`" ("What the form opens with", `source`, `assumed`).
- This plan: "Rules for every slice", G43, G44, G50, G53, G56, G58 to G62, and 3k's Review (its "done differently" and "small things").
- Code: `src/cli/review.ts` (the refusals, `readOld`, the submit reader), `src/build/review-form.ts` (`earlierVerdicts`, `ReviewData`), `src/review/` (all), `src/core/i18n/review.ts`, `src/core/review/` (all), `src/core/rules/review.ts` and `src/core/rules/types.ts` (`RuleContext`), `src/cli/check.ts` (where `RuleContext` is built), `test/golden/review/`, `e2e/review.spec.ts`, `e2e/screens-3k.spec.ts`.

### Decided for this slice

- **G50 first:** `RuleContext` carries the quiz's path and the review file's path as `check` shows them, so `review.unconfirmed`'s hint reads "run `quiz review quiz.md --since review.json` and judge the change" with the real names. `quiz rules` keeps `FILE` and `REVIEW`. Every golden that changes is counted in the report.
- **G56:** a matching question in the form lists its distractors under the pairs, in source order, each marked "Matches nothing" (vi: "Không ghép với mục nào").
- **3k's small fixes:** in both dialogs the command is a code span that does not wrap; with G62 the sentence becomes "a later `quiz review` can still judge them" (vi: "lần `quiz review` sau vẫn có thể xét lại"). COMMANDS.md loses "until slice 3l" for `--since` (the stacked sidebar's stays until 3m).
- **The command** (G59, G60): `quiz review FILE --since REVIEW [--open] [--timeout SECONDS] [--port N] [--json]`. The refusals keep 3k's order, with `--since` in place of `--out`: a built page; `--out` naming a file other than REVIEW ("--since merges into its own review: leave out --out"), exit 2; a survey, exit 2; check errors and questions without ids, exit 1; REVIEW missing ("--since needs an existing review; run quiz review FILE first"), or refused as `check --review` refuses one, exit 2. With nothing new or changed: "nothing new or changed since your review of 28 Oct", exit 0, `{"status":"unchanged","review":PATH}`, the file untouched, nothing served. The date is written as `inspect --review` writes it.
- **What is asked:** the questions with no entry for their current hash: new ones (no entry) and changed ones (an entry whose hash is another). Every other question keeps its earlier verdict and is not shown. The submit is 3k's, one verdict for every question, the ones not asked coming back unchanged (G53), so the server's reader, `merge` and the output do not change.
- **The form with `--since`** (the ReviewSince board): only the asked questions are cards, in source order. The status line starts "Asked again: N questions new or changed since your review of 28 Oct", and "Judged", the progress bar and the counts cover those N; "Question K of M" keeps the quiz's numbering. A changed question shows, above its text, the box "Your verdict on 28 Oct" with the verdict in its colour, the reason chips and the note in quotes, then "What changed since" and a line diff of its `source` against its current block: unchanged lines plain, removed lines with `−` on `--bad-wash`, added with `+` on `--ok-wash`, monospaced. A changed question that was kept has the box with "Keep" (and "not looked at" when assumed) and "Changed since; a Keep does not store the earlier text" in place of the diff (G61). A new question has no box. In the map the questions not asked are muted, with a dashed border, not focusable by `N`, and the legend adds "not asked again". Keep the rest and the Finish dialog count and touch the asked questions only. The saved card and the output are 3k's.
- **The diff** is a line diff (longest common subsequence) written in `src/core/review/` with no package added, pure and unit tested; the form gets the old and new text in its data, both as hashed, and renders the diff itself. Words are added to `src/core/i18n/review.ts`, en and vi.
- **Not in this slice:** the stacked Questions & materials sidebar and the phone (3m, G58).

### Tasks

1. G50 (one commit): `RuleContext`, the hint, the goldens that change counted.
2. G56 and 3k's small fixes (one commit): the distractors, the dialog code span and sentence, COMMANDS.md; the e2e golden that changes counted.
3. The command (one commit): `--since` read and refused, `--out` beside it, nothing to ask; a golden per refusal and for `unchanged` (`test/golden/review/since-*`, replacing 3k's two "not available yet" cases, counted); a unit test that a `--since` run writes back every question not asked byte for byte.
4. The form (one or more commits): the diff with unit tests (equal texts, a line changed, lines added and removed, a whole block replaced, trailing newlines); the asked cards, the earlier verdict box, G61's line, the muted map and legend, the counts; Playwright through `serveProcess` on a copy of `examples/calculus` with a review from a first run, then one fix question changed, one kept question changed and one added: only those three are cards, the diff shows on the first, G61's line on the second, nothing on the third; Keep the rest marks only them; the file then has the other entries unchanged; a `vi` run; axe in light and dark; screens of the ReviewSince state to `docs/screens/3l/`, committed.
5. The rest (one commit): the samples line for `--since`; G58 to G62 into COMMANDS.md (`quiz review`) and TECHNICAL_DESIGN.md (section 4: what `--since` asks, G61); the slice table's 3l and new 3m rows.

### Done when

`npm run check` passes in Chromium (startup tests alone, as `npm test` runs them; Firefox only if the environment has it; say which ran). On a copy of `examples/rust`: `quiz review` with a Fix on one question, then that question edited, then `quiz check --review` warns `review.unconfirmed` naming `quiz review quiz.md --since review.json`; that command opens the form with only that question, its earlier verdict and the diff; Keep on it and Finish write the file with every other entry as it was, and `check --review` no longer warns. Run again with no change, it prints "nothing new or changed" and exits 0. The screens are committed. Report as the rules say, every golden that changed counted and explained.

### Review

Built by Sonnet in six commits, `54214a5`..`4140cf6`, from the brief alone; reviewed by Opus on 2026-11-05. Every "Done when" holds.

**Tests, run by the reviewer.** Typecheck, Biome and knip clean. Vitest: the startup tests alone 2 of 2, the rest 2691 passed, 3 skipped. Playwright, Chromium and Firefox both: 412 passed, 295 skipped, 1 failed, `budget.spec.ts:53` in Firefox (3418 ms against 1000). **Cause shown:** 3l does not touch the page (`git diff 630df71..HEAD` is empty for `src/page`, `src/build/page.ts`, `en.ts`, `vi.ts`), and `630df71`, built in a separate worktree on the same laptop, fails the same test alone in Firefox (1407 to 3231 ms); 3l's tree alone gives 1449 to 1775 ms, and Chromium passes alone. The laptop was loaded by other sessions; the budget is a machine measurement, as in 3k's review. The implementing agent saw the same test fail in both browsers under the full run and pass alone.

**Fixed in review** (one commit): the first full run failed on two `test/notices.test.ts` tests at Vitest's 5 s default. They wait for `generate()`, which bundles the CLI and the page runtimes with esbuild: 1.9 s with the file alone, past 5 s beside 108 other files on 4 cores. They now take a named 60 s timeout with that reason in a comment; the second run passed them. Not caused by 3l, which adds no bundle.

**Goldens**, as the report says and checked in the diff: **6 changed** (the G50 hint, one line each, in `check/review-unconfirmed`, `-json`, `-strict`, `inspect/review-counts`, `-json`; the `--since` line of `review/help`), **2 removed** (3k's `review/since` and `review/since-json`, "not available yet"), **7 added** (`review/since-out-other`, `-json`, `since-missing`, `-json`, `since-invalid`, `since-unchanged`, `-json`), 1 e2e golden added (`review-since-written.jsonl`). No `build` golden moved.

**Read in the code.** `askedIds` asks every question whose entry is missing or has another hash, in source order; the refusals keep 3k's order with `--since` in place of `--out`, and an `--out` naming the same file is accepted. The unasked questions start from `earlier` (hash equal), so each has a verdict, and the state's `N`, Keep the rest and Finish, which still walk all `items`, touch the asked ones only; the bar, the dialog and the sidebar counts use the asked `scope`. `lineDiff` is a plain LCS with a changed stretch's deletions first. The distractors are the `rights` past the pairs, which holds because the form's plan keeps source order.

**Tried by hand** on a copy of `examples/rust`, the form driven by POSTing its submission as the e2e helpers do (the agent's script, extended to compare entries). `quiz review --json` with a Fix on `which-compile` (unclear, "Which edition?") and Keep the rest wrote `keep 9 · fix 1`; `check --review` exited 1 with `review.fix`. After editing that question's heading it exited 0 with `review.unconfirmed` and "fix: run `quiz review quiz.md --since review.json` and judge the change". `--since review.json` served a form asking `which-compile` alone of 10, with the earlier verdict and both blocks; Keep on it wrote `keep 10 · fix 0`, the nine other entries identical to the first file's, and `check --review` then gave 0 errors, 0 warnings. Again with no change: "nothing new or changed since your review of 5 Nov", exit 0, and `{"status":"unchanged","review":"review.json"}` under `--json`. `--out other.json` and a missing `nope.json` both exit 2 with G59's messages. The screens in `docs/screens/3l/` match the ReviewSince board but for the plain sidebar (3m) and G63.

**Done differently, accepted in review unless the owner says otherwise:**

- The diff shows the stored `source` and the current block, both as hashed, so a heading's `id=` is in neither.
- In `vi` the date is written `28/10`, as the ReviewSince board writes it; `en` keeps `inspect --review`'s `28 Oct`.
- Two `vi` strings not on the boards, in `src/core/i18n/review.ts`: `keptChanged` "Đã đổi kể từ đó; Giữ không lưu bản trước" and `notLookedAt` "chưa xem"; the English "Asked again" line also has a singular form. Like G57, the owner reads them in the form and names a change.
- The diff is a `figure` with an `aria-label`, its `pre` focusable (axe's `scrollable-region-focusable`), with Biome's `noNoninteractiveTabindex` suppressed there and the reason in a comment.
- A part with nothing asked shows no count; a part's count covers the asked ones ("0/1"). A cell not asked is a disabled button.
- The saved card and the `--json` counts cover the whole review, as 3k's do; the status line covers the asked.
- The refusal order is 3k's (built page, `--since` with another `--out`, `--timeout`, `--port`, check, survey, ids, review): it differs from the brief only for a survey given with a conflicting `--out`, both exit 2.
- The e2e helper copies the quiz's `assets` folder, which the calculus copy needs.

**Not a gap:** the agent's first proposed gap (axe's `label` on a choice whose label is only maths, in the form on `examples/calculus`). Step 2 settled it: axe reads no text from MathML, browsers name the choice from it, and the page's own axe tests skip `label` and `select-name` on maths pages (`e2e/maths-code.spec.ts`, `MATHML_NAMES`). The form follows the page. The second (a large block carries both texts in the form's data) needs nothing: blocks are a few dozen lines. The third is G64.

**Small things for 3m's fixes** (no decision needed):

- An axe run of the form on a copy of `examples/calculus`, skipping `MATHML_NAMES` as the page's test does (3l's axe runs on rust only).

**3l's gaps decided by the owner on 2026-11-05**, both as recommended: G63 (the diff's lines wrap) and G64 (a `fix` or `drop` entry needs its `source`) open 3m's brief.

**Left on the disk:** nothing in the repo; the by-hand copies and scripts are in the session scratchpad.

## Slice 3m: G63, G64 and 3l's fixes, then the stacked sidebar with the materials, and the phone

**Approved by the owner on 2026-11-05**, with G65 to G67 as recommended. Built from the Review board (`docs/mockup/boards/Review.dc.html`, image `docs/mockup/images/Review.png`) for the stacked **Questions & materials** sidebar, the ReviewSince board for it with `--since`, and the ReviewPhone board (`ReviewPhone.png`) for the phone. This closes the `review` boards: after 3m, `quiz review` is as COMMANDS.md says.

### Read first

- COMMANDS.md: `quiz review`, "The form" (all of it: the sidebar, the keys, `--since`, the phone).
- TECHNICAL_DESIGN.md: section 4, "`review-v2`" (the reader, `source`); section 8, the rows "Sidebar", "Question map" and "Materials".
- This plan: "Rules for every slice", G52, G58, G61, G63 to G67, and 3l's Review (its "done differently" and "small things").
- Code: `src/review/` (all), `src/build/review-form.ts`, `src/cli/review.ts` (where `loaded.sheets` is at hand), `src/core/review/schema.ts` and the review reader it feeds (`loadReview`), `src/core/i18n/review.ts`; of the page, to follow and not to change: `src/page/Sidebar.tsx` (the stacked form, `PartRing`), `src/page/map.ts` (`ringOf`), `src/page/Materials.tsx` (`Sheets`), `src/page/keys.ts` (`M`), `src/page/App.tsx` (the phone top bar), `src/page/styles/25-sidebar.css` (the `max-width: 759px` block); tests `e2e/review.spec.ts`, `e2e/screens-3l.spec.ts`, `e2e/maths-code.spec.ts` (`MATHML_NAMES`), `test/golden/review/`, `test/golden/check/`.

### Decided for this slice

- **G63 first:** the `--since` diff's lines wrap (`white-space: pre-wrap`, breaking inside a long word when needed); a wrapped line keeps its `−` or `+` column and its wash, so the sign stays at the start of the first row and the continuation rows are indented under the text, not under the sign. The region no longer scrolls sideways.
- **G64:** the review reader requires `source` on every `fix` and `drop` entry. A file without it is refused by `check --review`, `inspect --review` and `quiz review` (also with `--since`) as the reader refuses a missing field today, the message naming the entry. COMMANDS.md and TECHNICAL_DESIGN.md section 4 say so. A golden for the refusal under `check/`.
- **3l's small fix:** an axe run of the form on a copy of `examples/calculus`, skipping `MATHML_NAMES` as the page's test does, in light and dark.
- **The stacked sidebar** (the Review board), for a quiz with materials: one block, 40% of the width, named **Questions & materials** (the top-bar button's name too). On top, **Questions**: the master and detail split 35/65 of the page's stacked map, the parts as a vertical tab list, each entry "Part N" over its name with a ring for the share judged (`ringOf`, an arc in the accent; a full disc with the tick cut out when every question is judged), the chosen part outlined in the accent; beside it the chosen part's heading, "6 of 12 judged · 3 fix · 1 drop" (the fix and drop parts only when not zero) and its grid of 40 × 40 cells in the verdict states. Each entry's accessible name gives its counts. A one-part quiz shows the grid without the list. Then the legend and the keys, as in the plain sidebar. Then a **Materials** heading over one chip per sheet and the open sheet, read-only, the first sheet open at first; the sheets are rendered at build as the page renders them (`pageQuizOf` given `loaded.sheets`), so maths and code in a sheet look as on the page. A quiz without materials keeps 3k's plain Questions sidebar.
- **With `--since`** in the stacked map (the ReviewSince board): the cells not asked are muted and dashed, disabled, as in 3l's plain map; a part's ring and counts cover its asked questions ("0 of 4 judged"); a part with none asked is G67.
- **Keys:** `Q` opens and closes the sidebar, `Esc` closes it, as now; `M` is G66.
- **The phone**, below 760 px (the page's `PHONE_QUERY` and its `max-width: 759px`), from the ReviewPhone board: the compact top bar ("Review: TITLE" over "Judged 15 of 32 · Question 20", and with `--since` "Judged 0 of 3 · Question 5"), the sidebar button a 44 px icon; the status line is not shown. On each card Keep, Fix and Drop share the card's width in three columns, the reason chips wrap, the note box takes the width. **Keep the rest** and **Finish** leave the top bar for a bar docked at the foot of the screen, side by side, each half the width, 44 px tall at least; the cards' column keeps room for it so the last card is never hidden. The dialogs and the saved card fit the width. The sidebar and the look controls on a phone are G65. Cells are 44 × 44 with the 6 px gap, as the page's phone map.
- **Nothing under `src/page/` changes**, and no `build` golden moves: the form follows the page's components in its own code under `src/review/`, importing only the page's pure helpers (`ringOf` and its like, as 3k imports the question bodies) and its CSS classes. A page component that would need a change to be shared is copied into `src/review/` with a comment naming the original, and reported under "done differently".
- Words are added to `src/core/i18n/review.ts`, en and vi; the vi ones follow the page's own (`Câu hỏi và tài liệu`, `Tài liệu`), and any not on the boards are listed in the report as G57's were.
- COMMANDS.md loses "until the stacked one is built (slice 3m)" and "(slice 3m)"; G65 to G67 go into it as plain statements.

### Tasks

1. G63, G64 and the calculus axe run (one commit): the CSS and its e2e check that no diff line is wider than the card; the reader, its unit test and the `check/` golden for the refusal; COMMANDS.md and TECHNICAL_DESIGN.md section 4; every golden that changes counted.
2. The stacked sidebar (one or more commits): the sheets in the form's data, the stacked map with rings and counts, the legend and keys, Materials with its chips and open sheet; `--since` in it (muted cells, the asked counts, G67); `M` (G66). Unit tests for the counts and the ring under `--since`; Playwright through `serveProcess` on a copy of `test/fixtures/page/materials.md` with its `materials/` folder (three sheets, three parts, 12 questions with ids; no example has materials): the button's name, the tab list moving the grid, a verdict updating the ring and the counts, a chip opening its sheet, `M` and `Q`; once with `--since`; axe in light and dark (with `MATHML_NAMES` when the quiz has maths).
3. The phone (one or more commits): the compact bar, the three-column verdicts, the foot bar, the full-screen sidebar and the look controls as G65 says. Playwright at 390 × 844 (the board's width) in Chromium: the compact line, the foot bar's two buttons working, nothing wider than the screen (`scrollWidth` equals `clientWidth`), the sidebar opening on the whole screen and its back link closing it, the 44 px targets; a `vi` run; axe in light and dark.
4. Screens (one commit): to `docs/screens/3m/`, the Review state with materials at 1280 px in light and dark, the ReviewSince state in the stacked sidebar, the ReviewPhone state at 390 px with and without a reason picked, the phone sidebar, and one `vi`; through a spec like `e2e/screens-3l.spec.ts`.
5. The rest (one commit): G63 to G67 into COMMANDS.md (`quiz review`, "The form"); the slice table's 3m row.

### Done when

`npm run check` passes in Chromium (startup tests alone, as `npm test` runs them; Firefox when the environment has it; say which ran; a budget failure is reported with its cause shown, as 3l's review did). On a copy of a quiz with materials: `quiz review` opens with the **Questions & materials** sidebar as on the Review board; a verdict moves the part's ring and counts; a chip opens its sheet. At 390 px the form is the ReviewPhone board: the compact bar, three verdict buttons across the card, Keep the rest and Finish at the foot, the sidebar on the whole screen; Finish writes the review as at 1280 px. A review file with a `fix` lacking `source` is refused by `check --review`. Nothing under `src/page/` changed and no `build` golden moved. The screens are committed. Report as the rules say, every golden that changed counted and explained.

### Review

Built by Sonnet in five commits, `182beb3`..`0a68e2d`, from the brief alone; reviewed by Opus on 2026-11-05. Every "Done when" holds. Nothing under `src/page/` changed and no `build` golden moved (`git diff ca9ee9b..HEAD` is empty there).

**Tests, run by the reviewer.** Typecheck, Biome and knip clean. Vitest: the startup tests alone 2 of 2, the rest 2706 passed, 3 skipped (second run). Playwright, Chromium and Firefox both: 442 passed, 309 skipped, 3 failed.

- `budget.spec.ts:53`, both browsers (1408 and 3412 ms against 1000): the loaded laptop, as 3l's review showed on the commit before 3l; 3m loads nothing the test measures.
- `serve.spec.ts:318`, Firefox: after the `--autosave` run, a `.progress.json.202fecd5.tmp` was left in the folder. **Cause read in the code, not caused by 3m** (the server and `atomic.ts` are untouched): the autosaver chains its writes and `finish` waits for them before removing the file, so the temp file is not the second run's; the test `SIGKILL`s the first server, and a kill during a progress write leaves its temp file, whose random name nothing cleans. That is G69.
- The agent's `headings.spec.ts:95` Firefox failure did not come back in either of the reviewer's two runs.

**Fixed in review** (one commit):

- The first Vitest run failed `test/build/fonts-cli.test.ts`'s "same bytes" test at the 5 s default: 0.3 s alone, 5.5 s beside 108 other files. It now has a named 60 s timeout with the reason, as 3l's review did for the notices tests. Three such fixes in two slices is G68.
- On a phone the card's status read "✎ Fix · 1 reason" on two cramped lines beside the question number; the ReviewPhone board has "✎ Fix" alone. On a phone the status is now the verdict alone (the reasons are in view under the buttons). The three phone screens it shows in are retaken (`phone-fix`, `phone-fix-reason`, `phone-vi`); the review e2e passes in Chromium after it.
- TECHNICAL_DESIGN.md section 4 had `source: string` in the `Review` type, as if a keep had one; it is `source?: string` again, the comment saying it is required on `fix` and `drop` and never on `keep`.

**Goldens**, as the report says and checked in the diff: **1 added** (`check/review-no-source`, exit 2 naming both entries), **4 changed in 3 cases** (`review/out-invalid` stderr, `review/out-invalid-json` stderr and stdout, `review/since-invalid` stderr: each hand-made invalid review has a `fix` without `source`, so the reader now lists that line too), none removed, no `build` golden moved.

**Read in the code and the screens.** The stacked map, its rings (`ringOf`), the counts "3 of 5 judged · 1 fix · 1 drop" and the tabs' names match the Review board; under `--since` the asked counts and G67's part ("nothing asked again", an empty ring, its grid all muted) match the ReviewSince board. G64 is one rule in the schema's refinement. `M` and the phone's Questions and Materials tabs follow `src/page/keys.ts`. On a phone a wide sheet table scrolls in its own box, as the page's does. The by-hand run was the agent's (`dist/cli.js review` driven through Playwright on a copy of `test/fixtures/page/materials.md`, at 1280 px then `--since` at 390 px), and the reviewer's e2e run covers the same steps.

**Done differently, accepted in review unless the owner says otherwise:**

- `Ring` and `Sheets` are copied into `src/review/Side.tsx`, each with a comment naming the original (the page's `Ring` is not exported and its `Sheets` takes `QuizState`); `tabKeys`, `ringOf`, `Icon`, `Html` and the look controls are imported.
- `src/review/main.tsx` writes its own `(max-width: 759px)` query rather than import `PHONE_QUERY`, to keep `src/page/store.ts` out of the form's bundle.
- The reason chips' CSS is scoped to `.fm-reason-box`, since unscoped it restyled the sheet chips, which share the class.
- On a phone Keep the rest and Finish are rendered in the foot bar only; the foot bar is hidden while the sidebar covers the screen; the sidebar closes when the window narrows to a phone.
- The plain map's one-question row is now muted under `--since` too (3l missed it), its accessible name holding the "Part N" text.
- The page's double-click jump from a part tab is not copied; the phone's Questions tab is the plain collapsible map, as on the page; the phone's compact bar has no "Asked again" line.
- The diff is a `pre` of lines, each a grid of the sign and the text; it no longer scrolls, so its `tabIndex` and Biome suppression are gone.

**Words not on the boards**, in `src/core/i18n/review.ts`, for the owner to read in the form as G57's were: `partStats` ("6 of 12 judged · 3 fix · 1 drop" / "đã xét 6 / 12 · 3 sửa · 1 bỏ"), G67's "nothing asked again" / "không hỏi lại câu nào" and its tab name, `materialsKey` ("materials" / "tài liệu"), `phoneTitle` ("Review: TITLE" / "Rà soát: TITLE").

**3m's gaps decided by the owner on 2026-11-05**, both as recommended: G68 (`testTimeout: 30_000` in `vitest.config.ts`) and G69 (`serve --autosave` removes its file's leftover temp files) open the next slice.

**Left on the disk:** nothing in the repo; the agent's by-hand copies and scripts are in the session scratchpad.

**The `review` boards are done**: `quiz review` is as COMMANDS.md says. What is left of step 3 waits for the `grade --web` and `brief --web` boards (3v), then 3f, 3h and 3z.

## Slice 3n: G68 and G69

**Approved by the owner on 2026-11-06**: a slice of its own, ahead of the `grade --web` boards, since neither gap waits on a board. It holds G68 and G69 as decided, and nothing else.

### Read first

- This plan: "Rules for every slice", G51, G68, G69, and 3m's Review (the `fonts-cli` and `serve.spec.ts:318` items).
- COMMANDS.md: `quiz serve`, the `--autosave` row. TECHNICAL_DESIGN.md: "Files, formats and safe writes".
- Code: `vitest.config.ts`; `src/cli/atomic.ts` (the temp file's name); `src/cli/serve.ts` (where `progressFile` is resolved and checked, and the autosaver it builds); `src/serve/autosave.ts` (`finish`); tests `test/serve/autosave.test.ts`, `test/serve/serve-cli.test.ts`, `e2e/serve.spec.ts` (the test at line 318), and the named timeouts in `test/build/fonts-cli.test.ts`, `test/notices.test.ts`, `test/build/build-file-cli.test.ts`.

### Decided for this slice

- **G68:** `vitest.config.ts` sets `testTimeout: 30_000`, with a comment saying why: CPU-bound tests slow down under the full parallel run on a 4-core machine; a test that waits on a real timer is still a bug (G51). The named timeouts of 30 s are now the default and are removed; those longer than 30 s (60 s) stay, each with its reason.
- **G69:** `quiz serve --autosave FILE` removes the temp files left beside FILE by an earlier run that was killed during a write: in FILE's folder, the names matching exactly `.<basename of FILE>.<8 lower-case hex>.tmp`, nothing else (not another file's temp files, not a name with other hex lengths or upper case). It does so once, before it serves (after the existing file's checks pass, so a run that exits 1 or 2 on the progress file touches nothing), and again in `finish`, after the progress file is removed. A temp file that cannot be removed is not an error: it is left. `atomic.ts` keeps its random names. One helper, pure of the clock, beside `writeFileAtomic` in `src/cli/atomic.ts` (for example `removeStaleTemps(file)`), so `review --out` and the rest can use it later; only `serve --autosave` calls it in this slice.
- COMMANDS.md's `--autosave` row gains one sentence: temp files a killed run left beside the file are removed when the server starts and when the results are written. TECHNICAL_DESIGN.md's "Files, formats and safe writes" says how the temp file is named and that `--autosave` clears its own.

### Tasks

1. G68 (one commit): the config and its comment; the 30 s named timeouts removed; the count of each kept or removed in the report.
2. G69 (one commit): the helper and its unit test (planted temp files: two of FILE's, one of another file, one with 7 hex, one with upper-case hex, a folder of FILE's name pattern; only FILE's two go; FILE itself untouched); `serve` calling it before serving and in `finish`, tested in `test/serve/serve-cli.test.ts` with a planted temp file (gone after start; one planted during the run gone after submit; left alone when the run exits 1 on a wrong progress file). `e2e/serve.spec.ts` unchanged.
3. The docs (one commit): COMMANDS.md and TECHNICAL_DESIGN.md as above; the slice table's 3n row.

### Done when

`npm run check` passes (startup tests alone first, as `npm test` runs them; say which browsers ran; a budget failure is reported with its cause shown). Vitest runs with no 30 s named timeout left and the 60 s ones kept. A temp file planted beside a progress file is gone once `quiz serve --autosave` is listening. No golden changes; if one does, it is counted and explained.

### Review

Built by Sonnet in three commits, `d0e44e4`..`be1629f`, from the brief alone; reviewed by Opus on 2026-11-06. Every "Done when" holds, nothing was done differently, and no gap is raised.

**Tests.** The agent's `npm run check`: typecheck, Biome and knip clean; Vitest, the startup tests alone 2 of 2, the rest 2710 passed (2706 and the 4 new), 3 skipped; Playwright, Chromium and Firefox both, 443 passed, 309 skipped, 2 failed, both `budget.spec.ts:53` (1008 and 1630 ms against 1000) under the full run's load. The reviewer reran the typecheck, `test/atomic-temps.test.ts` and `test/serve/` (85 of 85), and `budget.spec.ts:53` alone with one worker on the idle laptop: Chromium 985 ms, Firefox 911 ms, both pass. So the failure is the load, as in 3l's and 3m's reviews, now shown. `serve.spec.ts:318`, G69's flake, passed in both browsers.

**Read in the diff.** G68: `testTimeout: 30_000` with its reason; 6 named 30 s timeouts removed (`build-file-cli`, `maths-code`, `several-cli` 2, `vi-scan`, `watch`), 7 longer ones kept (60 s: `build-file-cli`, `fonts-cli`, `maths-code`, `ids`, `startup` 2; 120 s: `parse/robust`). `tui-pty.test.ts`'s `30000` is the helper's own wait, not a Vitest timeout, and stays. G69: `removeStaleTemps` in `src/cli/atomic.ts` matches only regular files named `.<basename>.<8 lower-case hex>.tmp` and swallows every failure; `serve` calls it after the progress file's checks and the `--out` clash, just before the server starts, and the autosaver's `remove` calls it after deleting the progress file, so `finish` clears them. The unit test plants the near misses (another file's, 7 and 9 hex, upper case, a suffix, no dot, a dot-as-wildcard name, a folder); the CLI tests cover the start, a temp planted during the run, and the exit 1 that leaves it. COMMANDS.md and TECHNICAL_DESIGN.md say it as the brief asked.

**Goldens:** none changed, added or removed. Nothing under `src/page/` changed.

**Next:** the `grade --web` boards (3v).

## Slice 3o: the rubric box, read-only, in place of the grade table

**Approved by the owner on 2026-11-07**, with G89 and G90 as recommended. It builds G86's box on the page after Submit and in `quiz replay`, and G84's "chữ", so that 3f's form starts from a box the page already has. The editable box is 3f's. Built from the RubricC board's left column (`docs/mockup/boards/RubricC.dc.html`, its "scale" Tweak on `box`, the default), in the page's frame as the ResultsReplay board draws it (redrawn with the box on 2026-11-07); on a phone, from RubricPhoneReplay (G89).

### Read first

- TECHNICAL_DESIGN.md: section 6, "Where grades show up" and "The rubric box"; section 8, the "Answer panels" row and the results map's colours; the catalogs (the `vi` rules).
- COMMANDS.md: `quiz replay`.
- This plan: "Rules for every slice", G84, G86, G89, G90.
- The board: `RubricC.dc.html` (its `renderVals()` holds the five token sets and every size; read the replay side only, the cards with `edit` false), and `docs/mockup/README.md`.
- Code: `src/page/questions/Graded.tsx` (`GradeTable`, which this slice replaces), `src/page/questions/Open.tsx` (where it is used, and the before-Submit `Rubric`, which stays), `src/page/questions/Card.tsx` (the result badge), `src/page/data.ts` (`PageGradeDetail`, `PageGrader`, `PageGradedCriterion`), `src/build/page.ts` (`gradesOf`), `src/core/rubric/` (the resolved rubric: `step`, `scale`), `src/page/styles/20-quiz.css` (the `fm-grade` rules), `src/page/results.ts`, `src/core/i18n/en.ts` and `vi.ts`, tests `e2e/answer-panels.spec.ts`, `e2e/replay-grades.spec.ts`, `e2e/screens-2j2.spec.ts`, `e2e/vi-scan.spec.ts`, `test/page/replay-grades.test.ts`, and the page budget test.

### Decided for this slice

- **G84 and G90 first:** in `vi.ts` every word count says "chữ": the page's `words`, `wordsMin`, `wordsMax`, `wordsRange` and the report group's `words`. In `wordsRange` the second "từ" means "from" and stays: "71 chữ, từ 120 đến 300". en does not change.
- **The data:** `PageGradeDetail` gains what the head needs and loses nothing a test needs: the rubric's `step` (additive and holistic, `null` when the rubric has none) and, for banded, the whole scale (`min`, `max`, `step`) in place of `scaleMax`. `gradesOf` fills them from the resolved rubric. Nothing is added up in the page: the numbers stay `applyGrades`'s.
- **The component:** `RubricBox` in `src/page/questions/RubricBox.tsx`, replacing `GradeTable`. It is written to be shared: the head, a section, the slot, the total section and the note are separate exported pieces. 3f's form imports them and adds the controls, so nothing in them assumes the page's store. It draws TECHNICAL_DESIGN.md's "The rubric box" for the read-only case, with RubricC's values: the 8 px radius (4 px under the `white` theme, as the board has it), the `surface` fill, 1 px `line` rules, the head (card fill, 52 px, 2 px `line-strong` rule), the 262 px slot column (284 px for verdicts), the slot's result colours, the total section (card fill, 2 px rule over it, the label in `accent`), muted notes with an empty one left out, then "Why this score" and "To improve" as the last sections. The `fm-feedback` panel and the `fm-grader` line are no longer used for grades; the explanation keeps its panel. Code is drawn as points per criterion.
- **The words** come from the board, in the page's catalogs, en and vi:
  - the type: "Points per criterion", "A band per criterion", "One score";
  - the step line: "step 0.25"; "bands 0 to 9, step 0.5";
  - who graded: "Graded by NAME (agent)" for `kind: ai`, "Graded by NAME" for `kind: human`, over the date;
  - the total's label and its muted line, as RubricC writes them for each mode;
  - the verdicts: "Met", "Partly", "Missed" (en's "Partly met" becomes "Partly"; vi keeps "Đạt", "Đạt một phần", "Chưa đạt").
  - The catalog keys only the table used (`gradeCriterion`, `gradeAwarded`, `gradeMax`, `gradeNote`, `gradeOverallBand`, `gradedBy`) are removed once nothing reads them. Every number goes through `num` (a decimal comma in vi).
- **G89, as recommended:** under 520 px each section stacks (name, the slot at full width, the note) and the head's two sides stack. The box is a `<ul>` of sections, with the head and the total outside it. Each slot has an accessible name in words ("1.25 of 1.5 points", "band 6.5 of 9", "verdict: met", "no verdict"); the visible "/" is hidden from assistive technology.
- **Not changed:** the rubric before Submit (`Rubric` in `Open.tsx`); a question with no grade (no box, the badge pending, as today); the results map; the report's Markdown tables. `build`'s page changes only by the bundle and the CSS.
- **Budget:** the page runtime stays under 60 KB; say its size before and after.

### Tasks

1. G84 and G90 (one commit): the catalog, and every golden that changes with it, counted and explained.
2. The data and the box (one or more commits): `PageGradeDetail`, `gradesOf`, `RubricBox` and its CSS in place of the `fm-grade` rules, `Open.tsx` using it. `test/page/replay-grades.test.ts` rewritten for the box (each mode, a missing date, a human grader, an empty note left out, no verdict). The e2e tests that read the table read the box. axe in light and dark, the `vi` scan, a 390 px phone check of G89's stacking with no sideways scroll.
3. Goldens and screens (one commit): `npm run golden:update`, then every changed golden counted and explained (the 12 build goldens that carry the page bundle, `replay/good`, and G90's). Screens to `docs/screens/3o/`, committed: a replay of each mode at 1280 px in light, one in dark, one in paper with the serif font, one vi, one at 390 px. Each is set beside RubricC's left column for the review.
4. The docs (one commit, with the code that makes it true): G89 into TECHNICAL_DESIGN.md's "The rubric box"; the slice table's 3o row.

### Done when

`npm run check` passes (the startup tests alone first; say which browsers ran; a budget failure is reported with its cause shown). `quiz replay` on the `replay/good` golden's input shows the box in place of the table for every graded answer, and the screens match RubricC's replay side in layout, colours and sizes (any difference listed). A vi page counts "71 chữ". No table is left in a graded answer. Report as the rules say, every golden that changed counted and explained.

### Review

**Reviewed by Opus on 2026-11-07.** Built by Sonnet in `73d3194`..`bb1cfe4` (the first agent was stopped in Task 1, and a second one took up its uncommitted work), with one review fix, `8554eef`.

**Checked.** `npm run check` passes: the 2 startup tests alone, then Vitest 2716 of 2716 (111 files), Biome, the typecheck and Playwright 457 passed, 303 skipped (the opt-in screens specs), in Chromium and Firefox. After the fix, Vitest 2718 of 2718 (112 files, the startup tests included), and the replay, answer-panels and vi-scan specs pass in both browsers. Page runtime 56 895 → 57 679 bytes gzipped (limit 61 440).

**By hand.** `quiz replay` on `test/fixtures/replay/essay*` shows five boxes (additive, banded twice, holistic, code as additive), no table in any graded answer and no sideways scroll at 390 px, and every slot has its spoken name. A vi build counts "19 chữ". The `replay/good` golden's input has no grades file, so it shows no box and changes through the bundle and CSS only.

**Against RubricC and RubricPhoneReplay.** The layout, colours and sizes match: the 52 px head with the 2 px `line-strong` rule, the 262 px slot (284 px for verdicts), the 44 px slot, the result colours (full on `ok-wash`, part with a 2 px `warn` edge, none on `bad-wash`, a band neutral), the total on the card fill under a 2 px rule with its label in `accent`, the muted notes, and "Why this score" and "To improve" at the foot with their tags, as RubricC's replay side draws them. The radius is `min(8px, var(--card-radius))`, which gives 8 px and, under `white` (whose card radius is 4), 4 px. At 390 px the head's two sides stack and each section stacks as G89 says. Differences:
- the banded total's muted line is a fixed text (G92);
- the vi words (G93);
- the answer's frame and the result badge around the box are the page's from before step 3, not ResultsReplay's (G94);
- `7-holistic-vi.png` and `8-additive-vi.png` are in dark, since the screens spec's `emulateMedia` carries over from the dark screen. They still show the vi words; `5-additive-dark` is the dark screen.

**Goldens.** 28 changes over two commits, plus the same 14 files again in the review fix: the 12 build pages and `replay/good` change in their CSP hashes, `<style>` and `<script>` only; `build/json-built` and `build/json-two-files` change `"bytes"` only. The vi word count is in the bundle's catalog, and no Markdown golden shows a vi word count, so G90 changed no report golden. Nothing was reverted.

**Fixed in the review** (`8554eef`): a slot's spoken name said "0.5 of 1 points"; it says "of 1 point" now, and `test/page/replay-grades.test.ts` asserted the wrong form, so it was corrected too. The 14 goldens carry the bundle.

**Done differently, accepted.** The new words as the board writes them, the unused table keys removed, the group role spread for Biome, a holistic head with no `step` showing the type alone, the tall screens viewport. The read-only box keeps the "· optional" and "· required for one score" tags, because RubricC's replay side draws them.

**Decided by the owner on 2026-11-07:** G92 to G95, as recommended. G92, G93 and G95 are 3f's first tasks; G94 is slice 3q, after 3f.

## Slice 3f: `grade --web` and `--name`, at 1280 px

**Approved by the owner on 2026-11-07**, with G87, G88 and G91 as recommended. It starts after 3o's review, and 3o's gaps (G92, G93, G95) are its first tasks. Built from the Grade, GradeBanded, GradeCode, GradeFinish, GradeBlocked, GradeDone and GradeVi boards, and from RubricC's right column for the rubric (`docs/mockup/boards/`), at 1280 px. The phone (G79), fullmark's own marking in the form (G83) and `--grades` with `--web` (G75, still open) are 3p's.

### Read first

- COMMANDS.md: `quiz grade` (all of it, "The form" included), `quiz review` (the command 3f copies: the refusals, the submit, the output, the saved card), `quiz serve` (the options, the `listening` line, the exits), "Exit codes", "Files".
- TECHNICAL_DESIGN.md: section 6 (all of it: the template, grader identity, validation, computed totals, the score while grades are pending, "The rubric box"); section 7, foundations 4, 6 and 9; section 8, Sidebar, Appearance and the text size; the catalogs.
- This plan: "Rules for every slice", G70 to G88, G91 to G93 and G95, 3k's brief and Review (the form that 3f follows), 3o's Review.
- The boards: those named above, and `docs/mockup/README.md`. The Grade boards' rubric is superseded by RubricC; the rest of each board stands.
- Code: `src/cli/grade.ts` (the stubs `--web` and `--name`) and `src/cli/main.ts`; `src/cli/review.ts` and `src/build/review-form.ts` (the model for the command and the form's page); `src/review/` (all: the model for the form's bundle); `scripts/bundles.mjs` and `scripts/build-page.mjs`; `src/serve/server.ts` (the body reader option of 3k); `src/cli/atomic.ts`; `src/core/rubric/` (the template, the validator, the totals, IELTS rounding); `src/core/report/`; `src/page/questions/RubricBox.tsx` (3o); `src/page/Appearance.tsx`, `src/page/look.ts`; `src/core/i18n/en.ts`, `vi.ts`; `e2e/helpers.ts` (`serveProcess`, `expectGolden`, `noViolations`), `e2e/review.spec.ts`; `test/golden/grade/` (the `web-*`, `name-not-available` and `several-with-web` cases); `test/cli-graph.test.ts`; `scripts/samples.mjs`.

### Decided for this slice

- **The command:** `quiz grade RESULTS --quiz FILE --web [--name NAME] [--open] [--timeout SECONDS] [--port N] [--json]`.
  - It refuses, in this order:
    - a usage error, exit 2: several results files with `--web` (as today); `--grades` with `--web`, "--grades with --web is not available yet"; `--name` without `--web`, "--name names the grader of --web".
    - the results file and the quiz, as `quiz grade` refuses them, with the same exits and messages: a hash mismatch exits 1.
    - G91: nothing to grade, exit 0, nothing served.
    - G87: an existing grades file that holds grades, exit 2.
  - Then it serves the form with the `listening` line under `--json`, `--open`, the timeout (default 1800 s) and Ctrl+C, as `review` has them.
  - Nothing is written unless **Save grades** is accepted. A timeout or Ctrl+C leaves an existing template byte for byte.
- **The submit:** the filled grades document, `grades-v2` as section 6 has it, with `grader: {kind: "human", name}` (the name from `--name`, else the dialog). `at` comes from the injected clock, with the local offset, set by the server, not the page.
  - The server checks it with the validator `quiz grade --grades` uses, against this attempt's template, and answers 400, still waiting, with the problems for anything it refuses: another version, a half-filled question, a lost mark with no note, an empty name.
  - It then writes the grades file atomically (G87's path) and the report, as `quiz grade RESULTS --quiz FILE --grades GRADES` writes it, then ends.
  - Output is G88's lines.
- **The form** lives in `src/grade-form/`, bundled to `dist/grade.js` as its own IIFE beside `dist/review.js`, under the 60 KB budget. Its page is built in memory by `src/build/grade-form.ts` from the quiz's page data, the attempt's answers to its essay and code questions, the template, the page's CSS and the form's own, with a CSP carrying the form's script hash and `connect-src 'self'`. `build`'s output does not change.
- **What it shows:** COMMANDS.md's "The form", at 1280 px. That is:
  - the layout and the top bar (G70); the **To grade** sidebar (G70); the answer and the sample (G77);
  - the editable rubric box, 3o's pieces with the controls added (G71, G86): the slot [erase | − | value | +] / [max], the typed value, the empty start, the full-mark box, the verdict group, the erasers and **Clear this question**;
  - notes and reasons (G72); the card's badge; the running total (G76); an unanswered question read-only (G82);
  - Finish and its two dialogs (G73); the name (G74); the saved card (G78, without G75's line);
  - the keys (G80).
  - "The other 26 questions are marked by fullmark" is a line, not yet a link (3p opens it). Colours, sizes and spacing come from the boards' source. Undo after Clear this question is not built.
- **Words:** a `grade` group in the catalogs, en from COMMANDS.md and the boards, vi from GradeVi (G81), the quiz's `ui_lang` choosing. The CLI's own lines are English only.
- **Loading:** `quiz grade` without `--web` loads neither `src/serve/` nor the form; `check` still loads neither; `test/cli-graph.test.ts` names the form's chunk.

### Tasks

1. 3o's gaps, one commit each, every golden that changes counted:
   - G92: `PageGradeDetail` gains `mean` and `round` (banded only), filled by `gradesOf` from the core's totals (`src/core/rubric/`), and the banded total's muted line reads them, one wording per rule. The page still adds nothing up. The form's line, once every band is given, uses the same words.
   - G93: in `vi.ts`, "Vì sao cho điểm này" for the justification, "(AI)" for an AI grader, and the box's and the form's words one set; "Đạt một phần" stays.
   - G95: in `src/core/i18n/en.ts`, the report's `scoreLine` says "point" when the total is 1; the three report goldens that show "1 of 1 points" change.
2. The command without the form (one commit): every refusal and exit, a golden each in `test/golden/grade/` (the `web-not-available` and `name-not-available` cases are replaced: count them); the submit read, checked and written as a unit test with a POST (an accepted file, each 400, the clock injected, an empty template replaced); G88's `--json` lines.
3. The form (one or more commits): the components, the bundle, `grade-form.ts`. Playwright through `serveProcess`:
   - grade an additive, a banded, a holistic and a code question by mouse, and by typing a value;
   - a lost mark without a note, or a holistic score without its reason, holds Finish at **Some grades are not finished**;
   - the erasers and Clear this question;
   - the name asked, then given by `--name`;
   - the written grades file against a golden, read back by `quiz grade --grades` (same report) and by `quiz replay` (the box shows it);
   - the saved card;
   - a vi quiz;
   - axe in light and dark.
   - Screens of the Grade, GradeBanded, GradeCode, GradeFinish, GradeBlocked, GradeDone and GradeVi states to `docs/screens/3f/`, committed.
4. The rest (one commit, with the code that makes it true): the samples line for `quiz grade --web`; G87, G88 and G91 into COMMANDS.md (`quiz grade`); the slice table's 3f row.

### Done when

`npm run check` passes (the startup tests alone first; say which browsers ran). `quiz grade` on an attempt with essays and code, `--web --open`, opens the form in the quiz's look. Grading every question and pressing **Save grades** writes `RESULTS-grades.json` with `kind: human` and the report, and `quiz replay` on the same results then shows the grades in the box with no option. A second `--web` on the same results exits 2 (G87). `check` and `grade` without `--web` load no server code. The screens are committed. Report as the rules say, every golden that changed counted and explained.

### Review

**Reviewed by Opus on 2026-11-07.** Built by Sonnet in `2246a37`..`0e44c3d`.

**Checked.** `npm run check`: the 2 startup tests alone, Vitest 2739 of 2739 (113 files), the typecheck, Biome and knip pass; Playwright 474 passed, 317 skipped (the opt-in screens specs), 1 failed, in Chromium and Firefox. The failure is the page budget test in Firefox, and it is not 3f's (G97). The 9 `e2e/grade.spec.ts` tests pass in both browsers. `dist/grade.js` is 30 319 bytes gzipped (budget 60 KB); the page runtime 57 679 → 57 863 bytes gzipped, for G92's words.

**Task 1 (G92, G93, G95)** is as decided: the banded line reads "mean 6.25, IELTS rounding to 6.5"; the vi words; "1 of 1 point" in 3 report goldens. Goldens: 14, 14 and 17 changes, each counted in its commit.

**Task 2 (the command)** is as the brief says, in order: the refusals, the hash, G91, G87; the submit read and checked with the `--grades` validator, the grader set by the server, both files written atomically; G88's lines. `test/golden/grade/`: 3 cases replaced, 12 added, 2 changed (`several-with-web`, `top/help-grade`), each explained in the report.

**Against the boards** (the screens in `docs/screens/3f/`, set beside GradeFinish, GradeBlocked, GradeDone and RubricC's right column). The box's controls, the slot, the badges, the notes' red edge and "Required: a mark was lost, say why", the total's "2 of 3 criteria given", the status line and the dialogs' words are as drawn. To fix:
1. **The layout** is G96's, now decided: the answer across the card, the box under it, the sample beside the answer on a button.
2. **The sidebar** is short of the boards: no state icons (its text marks render as clipped glyphs: `1-grade.png`, Question 2), no legend ("Graded", "Half graded", "Needs a note", "Not graded", "current", "required"), no collapsible groups with their chevrons and counts ("2 of 4 graded"), no row tints (graded green, a problem red), no "Not answered" group, and "Scored by fullmark" as a header and a line, not the boards' row ("26 questions, marked on submit · choice, fill-in, numeric", 34 / 40). Built from GradeFinish's sidebar.
3. **The dialogs' buttons** sit at the left: the row uses `fm-dialog-actions`, whose rule is in `review.css`, which the grade form does not load. They go at the right, as the boards and Review have them. In **Some grades are not finished**, **Go back** is the outlined button, as GradeBlocked draws it, not the primary.
4. **The saved card** leaves the sidebar open, its rows live, after the server has stopped. GradeDone closes it and centres the card; the score line is bold.
5. **The vi values:** after − or +, a slot shows "0.5" and "1.25" (`String(next)` in `src/grade-form/state.ts:105-106`) beside maximums "0,5" and "1,5". Every number the form writes into a slot goes through `num`.
6. **Images:** `grade-web.ts` gives the form `assets: []`, so an image in a prompt or a sample answer does not show. It passes the quiz's assets, as `review` does (`loaded.assets`), with a test.
7. **The note's placeholder** on a criterion with no score reads "Note (optional: full marks)"; the board writes "Note (optional)", and "(required: a mark was lost)" once a mark is lost.

**Done differently, accepted:** the form's words in `src/core/i18n/grade.ts` (COMMANDS.md reworded to say so); the G87 message without "(G75)"; "nothing is graded yet" refused by the server as well as the button; `--timeout` and `--port` checked after the hash; the holistic stepper's 0.5 when the rubric has no `step`; the mean shown to 2 decimals; `createFormLook` shared.

**Not tried by hand yet:** `quiz grade --web --open` on the samples, which waits for the fixes.

**Decided by the owner on 2026-11-07:** G96, and G97 as recommended. The 7 fixes and G97 are **3f2**, before 3p.

## Slice 3f2: 3f's fixes, G96 and G97

**Approved by the owner on 2026-11-07.** 3f's review found seven differences from the boards and two bugs; G96 changes the form's layout and G97 the budget test. One Sonnet round, before 3p.

### Read first

- COMMANDS.md: `quiz grade`, "The form" (G96's layout and the sample button are in it now).
- This plan: "Rules for every slice", G96, G97, 3f's brief and its Review (the numbered list "To fix").
- The boards: GradeFinish (the sidebar, the dialog), GradeBlocked, GradeDone, RubricC's right column (`docs/mockup/boards/`, the images in `docs/mockup/images/`).
- Code: `src/grade-form/` (all), `src/cli/grade-web.ts`, `src/cli/review.ts` (how it passes `loaded.assets`), `src/review/review.css` (`fm-dialog-actions`), `src/review/Side.tsx` (Review's sidebar, the model for the icons and groups), `e2e/grade.spec.ts`, `e2e/screens-3f.spec.ts`, `e2e/budget.spec.ts`, `playwright.config.ts`.

### Tasks

1. **G97** (one commit): the budget test in a Playwright project of its own that runs first with one worker; the other projects depend on it; the limit stays 1000 ms. Then `npm run check` must pass in both browsers with no budget failure; say the times it measured.
2. **G96** (one commit): the answer across the card, the rubric box across the card under it; the sample hidden, **Show the sample answer** over the answer opening it beside the answer (half the card each), **Hide the sample answer** closing it, no button without a sample; en and vi words in `src/core/i18n/grade.ts` (vi from GradeVi where it has one, else say what you wrote). A long criterion name never breaks inside a word. e2e: the button, both states, a question with no sample.
3. **The fixes** (one commit each, an e2e or unit test with each):
   - the sidebar from GradeFinish: the state icons (SVG, not text glyphs), the legend, the collapsible groups with their chevrons and counts, the row tints, the "Not answered" group, the "Scored by fullmark" row as the boards draw it (still not a link: 3p opens it);
   - the dialogs' buttons at the right; **Go back** outlined in **Some grades are not finished**;
   - the saved card: the sidebar closed, the card centred, the score line bold, as GradeDone;
   - every number written into a slot through `num` (vi "0,5");
   - the quiz's assets passed to the form, with a test that an image in a prompt shows;
   - the note placeholder "Note (optional)", and "Note (required: a mark was lost)" once a mark is lost, en and vi.
4. **Screens and the row** (one commit): `docs/screens/3f/` taken again (each state 3f took, plus the sample open), the 3f2 row in the slice table.

### Done when

`npm run check` passes in Chromium and Firefox, the budget test included. The screens match GradeFinish, GradeBlocked, GradeDone and RubricC's right column, each difference listed. Report as the rules say, every golden that changed counted and explained.

### Review

**Reviewed by Opus on 2026-11-07.** Built by Sonnet in `c81833f`..`d4356e6`. No golden changed, and `build`'s output is unchanged.

**Checked.** `npm run check` passes: the 2 startup tests alone, Vitest 2739 of 2739 (113 files), the typecheck, Biome and knip; Playwright 487 passed, 319 skipped (the opt-in screens specs), none failed, in Chromium and Firefox. G97 holds: the budget test runs first and alone, 379 ms in Chromium and 638 ms in Firefox (limit 1000 ms). `dist/grade.js` is 31 249 bytes gzipped.

**By hand** (`quiz grade samples/grade/results.json --quiz samples/grade/quiz.md --web --json`, in a copy): the `listening` line, then the form loads with no console error; a POST from another origin gets 403; Ctrl+C prints `{"status":"interrupted"}`, "stopped; nothing was written", exits 2 and writes nothing. With a grades file that holds grades beside the results, `--web` exits 2 before serving and leaves the file byte for byte (G87). Saving and reading back by `--grades` and `replay` is covered by `e2e/grade.spec.ts` against its golden.

**Against the boards.** Every item of 3f's "To fix" is done: G96's layout with the sample on its button (`10-sample-open.png`); the sidebar as GradeFinish draws it, its icons, legend, folding groups with their counts, row tints, "Not answered" and "Scored by fullmark"; the dialogs' buttons at the right, **Go back** outlined when blocked; the saved card as GradeDone; "0,5" in vi; the quiz's images in the form (tested both ways); the note placeholders. What is left is small and listed in G98.

**Done differently, accepted:** SVG chevrons and close icon; half graded tinted red, as the board's row wash; the sample's open state kept per card; a blank card's sample left in its `details`; the old "The other N questions…" line removed, the boards' row in its place, with COMMANDS.md's sidebar bullet updated.

**Decided by the owner on 2026-11-07:** G98 and G99, as recommended. 3f is done; **3p** (G98, the phone, G83) is next; G75 still waits for its board.

## Slice 3p: G98, then the grading form on a phone

**Approved by the owner on 2026-11-07**, with G100 as recommended. G98's differences first, then G79's phone. Fullmark's own marking (G83) is 3r (G100); `--web --grades` (G75) waits for its board. Built from GradeFinish, GradeDone and RubricC for G98, and from GradePhone and RubricPhone for the phone (`docs/mockup/boards/`, the images in `docs/mockup/images/`: RubricPhone.png; GradePhone has no image, so read its source). Where GradePhone and RubricPhone differ on the box, RubricPhone wins, as RubricC does over the Grade boards.

### Read first

- COMMANDS.md: `quiz grade`, "The form" (all of it, the phone bullet and G96's layout included).
- This plan: "Rules for every slice", G79, G89, G96, G98, G99, 3m's brief and Review (Review's phone, the model), 3f2's Review.
- The boards: GradePhone, RubricPhone (its Tweaks: the form and each rubric type), GradeFinish, GradeDone, RubricC's right column, and `docs/mockup/README.md`.
- Code: `src/grade-form/` (all), `src/review/review.css` (the rules under 760 px), `src/review/Side.tsx` and `src/review/Body.tsx` (Review's compact bar, foot bar and full-screen sidebar), `src/page/styles/25-sidebar.css`, `src/page/questions/RubricBox.tsx` (the stacking under 520 px), `e2e/grade.spec.ts`, `e2e/phone.spec.ts`, `e2e/screens-3f.spec.ts`.

### Decided for this slice

- **G98, as the boards draw it:**
  - the form's card about 862 px wide at 1280 px with the sidebar open (lifted for the form only; `build`'s page keeps its 48.25rem);
  - the sidebar icon on **Questions**;
  - the key row on one line;
  - the dialog about 150 px from the top;
  - the saved card's file names in grey chips, with no colon;
  - the open sample's head level with the answer's;
  - an empty required note with the amber dashed edge;
  - the "Scored by fullmark" row's sub-line naming the kinds it holds ("choice, fill-in, numeric"), from the form's data, which gains the auto-marked questions' kinds.
- **The phone (G79), below 760 px, as Review's:**
  - the compact top bar: "Grade: TITLE" over "Graded 1 of 4 · Question 21", the sidebar icon and Appearance;
  - the card stacks the answer (open, in a `details`, "Answer · 41 words"), the sample (closed, in a `details`: G96's button is for the wide form only), then the rubric box;
  - the box as RubricPhone draws it: each section stacked (the name, the slot at full width, the note), the head's two sides stacked (G89); the slot and the full-mark box 44 px tall; every target at least 44 px;
  - the foot bar: ← Previous, **Finish**, Next →, the arrows 44 px icons with names;
  - the sidebar takes the whole screen with a back link, as in Review (G65);
  - no sideways scroll at 390 px, in any state.
  - G79's "step buttons in rows of four" is superseded by RubricPhone's slot.
- **Not changed:** the submit, the command, the grades file, the words (but the new ones), the wide form apart from G98.

### Tasks

1. **G98** (one commit each, or grouped by place: the card and the bar; the sidebar; the dialogs and the saved card; the box), each with a check in `e2e/grade.spec.ts` where it can be measured.
2. **The phone** (one or more commits): the bar, the card's stacking, the box, the foot bar, the full-screen sidebar. Playwright at 390 × 844:
   - grade an additive, a banded, a holistic and a code question by touch;
   - Finish from the foot bar, both dialogs, the saved card;
   - the sidebar opened and closed with its back link;
   - no sideways scroll;
   - axe in light and dark.
3. **Screens and the row** (one commit): `docs/screens/3p/`: G98's states at 1280 px (each set beside its board), and at 390 px each of RubricPhone's rubric types, the open sidebar, the Finish dialog and the saved card. The slice table's 3p row.

### Done when

`npm run check` passes in Chromium and Firefox, the budget test included. Every screen set beside its board, each difference listed. Report as the rules say, every golden that changed counted and explained.

### Review

**Reviewed by Opus on 2026-11-07.** Built by Sonnet in `3ee9d79`..`1a422e4` (G98 and the phone share one commit, since both live in the same files), with one review fix, `c7ce6b3`. No golden changed; `build`'s page is unchanged.

**Checked.** `npm run check` passes: the 2 startup tests alone; Vitest 2740 of 2740 (113 files); the typecheck, Biome and knip; Playwright 507 passed, 341 skipped (the opt-in screens specs and named platform skips), none failed, in Chromium and Firefox. The budget test, alone and first, measured 380 ms in Chromium and 671 ms in Firefox. `dist/grade.js` 32 166 bytes gzipped (31 249 before); `dist/page.js` unchanged.

**By hand at 390 × 844, with touch** (a copy of `samples/grade/`, `--web --json --name "Hand Test"`): the compact bar, the open answer and closed sample, the box stacked; full marks tapped on each criterion, then **Finish** on the foot bar and **Save grades**; the saved card; the command exits 0 and writes `results-grades.json` with `{"kind":"human","name":"Hand Test"}` and a local `at`, and the report. `quiz grade --grades` reads the file back.

**Against the boards.** G98 is done:
- the card 862 px at the default size;
- the icon on **Questions**;
- the key row on one line;
- the dialog 150 px from the top;
- the file chips;
- the level heads;
- the amber edge, then red once Finish was tried;
- the kinds in the fullmark row.

The phone matches RubricPhone in the bar, the stacking, the box's head and sections, the 44 px slot with its "/" and maximum, the foot bar and the full-screen sidebar with its back link. What is left is G101.

**Fixed in the review** (`c7ce6b3`): `7-phone-additive-box.png` was the same image as `6-phone-additive-top.png`: the screens spec scrolled to the box's viewport offset after the box was already in view, so it scrolled back to the top. It now scrolls by that offset, and screens 7 and 8 were taken again.

**Done differently, accepted:**
- the card's width in rem, so it follows the text size;
- no foot bar after Save;
- the box stacked across the phone's whole range (below 760 px), not only below 520;
- the dialog 64 px from the top on a phone;
- the kinds' words: en "choice", "fill-in", "numeric", "ordering", "matching", "scale"; vi "trắc nghiệm", "điền", "số", "sắp xếp", "ghép cặp", "thang đo", the first three GradeVi's;
- the foot bar's names "Previous question", "Next question" ("Câu trước", "Câu sau") and "Chấm: TITLE";
- the sidebar's keys shown on a phone, as Review's are.

**Decided by the owner on 2026-11-07:** G101, as recommended; it is 3r's first tasks.

## Slice 3r: G101, then fullmark's own marking from the form

**Approved by the owner on 2026-11-13** (drafted 2026-11-07), and handed to one Sonnet agent. G101's differences first, then G83 as G100 decides it: the attempt's replay, served beside the form and shown in a frame in the form's main column. Built from GradeFinish, GradeDone and RubricPhone for G101, and from ResultsReplay (`Results.dc.html`, mode `replay`) and RubricC's left column for the replay in the frame.

### Read first

- COMMANDS.md: `quiz grade`, "The form" (the "fullmark's own marking" bullet); `quiz replay`.
- TECHNICAL_DESIGN.md: section 7, foundations 4 and 9; section 8, the results map and its filter.
- This plan: "Rules for every slice", G83, G100, G101, 3p's Review.
- The boards: GradeFinish, GradeDone, RubricPhone (G101); Results (mode `replay`), RubricC's left column.
- Code: `src/cli/grade-web.ts`, `src/build/grade-form.ts`, `src/grade-form/` (all); `src/cli/replay.ts` and `src/cli/replay-command.ts` (how a replay page is built); `src/build/page.ts` (`buildPage`, its CSP); `src/page/data.ts` (`PageReplay`), `src/page/App.tsx` (the replay's opening and Retry missed), `src/page/ResultsCard.tsx`, `src/page/map.ts` (the filter); `src/serve/server.ts` (`pages`, under the token); `e2e/grade.spec.ts`, `e2e/grade-phone.spec.ts`, `e2e/replay-grades.spec.ts`; `test/cli-graph.test.ts`.

### Decided for this slice

- **G101, as the boards draw it:**
  - each card state's badge with its icon and wash, wide and on a phone;
  - the card's head as "Question 21 · 3 points · essay";
  - the saved card 768 px wide at 160 px from the top;
  - the amber dot beside a required note;
  - the sidebar's keys in the monospace font with the thicker lower edge.
  The sidebar stays 300 px.
- **The second page (G100).**
  - `quiz grade --web` builds the attempt's replay as `quiz replay RESULTS --quiz FILE` builds it, with no grades (the grades are being made), and the server holds it beside the form at `/<token>/marked`. It carries no server code (foundation 9).
  - `PageReplay` gains `grader: true` for this page only. With it the page opens on the Missed filter, offers no **Retry missed**, and stores nothing in the browser. A page from `quiz replay` or `build` never sets it.
  - The essays and code in it show as pending, as in a replay without grades.
- **In the form.**
  - The "Scored by fullmark" row is chosen like a question row (the current-row edge, `aria-current`).
  - The form's main column then shows the second page in a frame, filling the column, with a title naming it ("Marked by fullmark: N questions") for assistive technology.
  - Choosing a question row brings the card back. The frame is made once and kept, so the replay keeps its scroll and filter, and the form never unloads (nothing typed is lost).
  - The form's CSP gains `frame-src 'self'`. The second page's CSP is `buildPage`'s.
  - On a phone the row works the same, and the sidebar closes as it does for a question.
  - The keys stay as they are: `N` skips the row.
- **Not changed:** the submit, the grades file, the report, `quiz replay`'s own page, and `build`'s page apart from the bundle (the new flag's code).

### Tasks

1. **G101** (one or more commits), each item with a check in `e2e/grade.spec.ts` or `e2e/grade-phone.spec.ts` where it can be measured.
2. **The second page** (one commit): `PageReplay.grader` and its three effects in the page, unit-tested. The replay built and served at `/marked`, tested through `serveProcess`: it loads under the token, its CSP has no `connect-src`, and it is refused without the token. Every build golden that changes with the bundle, counted and explained.
3. **The frame** (one commit): the row, the frame, the CSP. Playwright, wide and at 390 px:
   - the row opens the replay on Missed, with no Retry missed;
   - a question row brings the card back with its typed values intact;
   - the replay's filter is kept when the row is chosen again;
   - Save grades still works after the row was used;
   - axe in light and dark with the frame shown.
4. **Screens and the docs** (one commit): `docs/screens/3r/` (G101's states beside their boards; the frame wide and on a phone); G100 into COMMANDS.md ("fullmark's own marking"); the slice table's 3r row.

### Done when

`npm run check` passes in Chromium and Firefox, the budget test included. The "Scored by fullmark" row shows the attempt's replay inside the form, on Missed, and nothing typed is lost. A `build` page carries no server code and is byte-identical with and without the server features. Every screen set beside its board, each difference listed. Report as the rules say, every golden that changed counted and explained.

### Review

**Reviewed by Opus on 2026-11-13.** Built by Sonnet in `972533e`..`e376c8a`, from the brief alone, with one review fix (the result badge, below).

- **`npm run check` exits 0**, run in review over Sonnet's commits with the review fix's Form and tests in the Playwright build. Typecheck, Biome and knip clean. The 2 startup tests, then Vitest: 114 files, **2745 of 2745**. Playwright: **525 passed** (266 Chromium, 257 Firefox, the 2 budget projects), 341 skipped (the `screens-*` specs, which run only with `FULLMARK_SCREENS`), none failed. Firefox ran (installed in `~/.cache/ms-playwright`). After the fix, typecheck, Biome, Vitest (2745 of 2745) and `grade.spec.ts` with `grade-phone.spec.ts` in both browsers (70 of 70) were run again.
- **Goldens: 9 cases, 14 files**, all from the page runtime growing by 259 bytes with `PageReplay.grader`: in 12 HTML pages the runtime, its CSP hash and the two lines around it; in 2 `stdout.txt` the `bytes` count (246020 to 246279). Read in review; nothing else moved, none reverted. A `build` page is still byte-identical with and without the server features.
- **G101** as the boards draw it: the card's head ("Question 2 · 3 points · essay"), the state badges with their icons and washes, the saved card (768 px at 160 px), the amber dot by a required note, the keys in the monospace font; the sidebar stays 300 px.
- **G100**: `grade --web` builds the attempt's replay with `buildPage` (no server module, no `connect-src`) and serves it at `/<token>/marked`; `PageReplay.grader` opens it on Missed, drops Retry missed and makes the browser storage read-only. The "Scored by fullmark" row is chosen like a question row and shows it in a frame titled "Marked by fullmark: N questions", made once and hidden, not unloaded; typed values, the replay's filter and its scroll survive; the form's CSP gains `frame-src 'self'`. Checked wide and at 390 px, with axe in light and dark.
- **Fixed in review: the graded card's badge.** Sonnet kept "✓ Graded · 2 / 3" in green; COMMANDS.md ("The card's state") and RubricC give a graded card the replay's result badge. It now reads **Correct**, **Partly right** or **Wrong** with the score, in the results colours (`ok`; `warn` on `surface` with a 2 px `warn` border; `bad`), with RubricC's icons, from the page's own words (`status`). Two Playwright checks changed with it ("Partly right · 2.25 / 3"). The screen `3-wide-graded.png` still shows the old badge: the 3r screens were taken by hand, with no `screens-3r` spec, so they cannot be taken again by a command (below).
- **Tried by hand:** the screens, read against the boards. Not driven in a browser outside Playwright.

**Done differently, accepted in review unless the owner says otherwise:** the replay opens on Missed even when nothing was missed (the page's own empty Missed list); the form's `<main>` is named "Scored by fullmark" while the frame shows, since the replay has its own `main` and axe asks landmarks to be unique; while the frame shows, only its row carries `aria-current`; the replay is built with no profile, fonts or `ui_lang` given, so its Information tab is a default `build` page's; on a phone the frame stops above the foot bar, and Previous or Next brings the card back; `Prepared` carries the materials sheets, so the frame shows them as `quiz replay` does; the dot sits beside the note field, outside it, as the board's dot slot does.

**Found in review:**
- **The frame shows the replay's whole page, its top bar included** (the owner's question on the screens): a second title row with its own **Questions**, **Focus mode**, text size and Appearance, under the form's bar; on a phone, two rows of icons. The brief named only three effects of `grader` and did not say to drop the page's chrome: a gap in the brief, G103. Sonnet's own gap, that the form's look does not reach the frame, is part of it.
- **The 3r screens have no spec.** `docs/screens/3r/` was taken by hand; earlier slices took theirs with a `screens-<slice>.spec.ts` run by `FULLMARK_SCREENS`. The next slice adds `e2e/screens-3r.spec.ts` (or extends 3p's) and takes them again, the badge included.
- **Sonnet's second gap** (the frame named twice to assistive technology, by the iframe's title and the `main`'s name): left as it is; it goes with G103, which changes what the frame holds.

**G103 for the owner.**

## Slice 3r2: G103, the grader's frame without the replay's bar

**Approved by the owner on 2026-11-13.** G103 as decided, then the 3r screens taken by a spec, as every slice before 3r took its own. Small: one page flag's effects, one form effect, one spec.

### Read first

- COMMANDS.md: `quiz grade`, "The form", the "fullmark's own marking" bullet (its second page and its frame, G103's sentences included).
- TECHNICAL_DESIGN.md: section 7, foundation 9.
- This plan: "Rules for every slice", G100 and G103 (STEP3-GAPS.md), 3r's Review.
- Code: `src/page/App.tsx` (the dock and `fm-topbar`, around `QuizView`), `src/page/ResultsCard.tsx` (`grader`, Download results), `src/page/store.ts` (`PageReplay.grader`), `src/page/look.ts` (`applyLook`: `data-theme`, `data-size`, `data-font` on a root), `src/page/Appearance.tsx`; `src/grade-form/Form.tsx` (the frame, around `state.marked`), `src/grade-form/main.tsx`; `e2e/grade.spec.ts`, `e2e/grade-phone.spec.ts`, `e2e/screens-3p.spec.ts` (the screens' pattern).

### Decided for this slice

- **No top bar in the grader's frame (G103).** With `PageReplay.grader` the page draws no `fm-topbar`, wide or on a phone: no title row, no **Questions**, **Focus mode**, text size or Appearance, and none of their keys act. It starts at the Replay banner, then the All · Missed · Flagged filter, the results card and the question cards. The page's own sidebar (the results map) is not shown.
- **No Download results** in the frame's results card. The score, points, time, goal and the pending note stay.
- **The frame follows the form's look.** The form puts its theme, text size and font on the frame's document root (the same `data-theme`, `data-size` and `data-font` that `applyLook` sets) when the frame loads and whenever they change. The frame stores nothing and reads no stored look of its own.
- **One name.** The frame is named by the iframe's title alone; the form's `main` keeps its own name and no longer takes "Scored by fullmark" (3r's review, Sonnet's second gap). axe still passes, so if `landmark-unique` fails, report it with what it says and do not rename silently.
- **Not changed:** `quiz replay`'s page and `build`'s, apart from the bundle; the form's own bar, sidebar and keys; the submit and the files written.

### Tasks

1. **The page** (one commit): the three effects of `grader` above, unit-tested. Every build golden that changes with the bundle, counted and explained.
2. **The form** (one commit): the look sent to the frame, and the one name. Playwright, wide and at 390 px: the frame has no `fm-topbar` and no Download results; dark chosen in the form shows the frame dark, and a larger text size shows in it, both before and after the frame is first opened; axe in light and dark with the frame shown.
3. **The screens' spec** (one commit): `e2e/screens-3r.spec.ts`, after `screens-3p.spec.ts`, that takes every screen in `docs/screens/3r/` (3r's set, the graded card's result badge included, and the frame in light and dark), run with `FULLMARK_SCREENS=1`. Each screen beside its board, each difference listed. The slice table's 3r2 row.

### Done when

`npm run check` passes in Chromium and Firefox, the budget test included. The frame shows the replay from its banner down, in the form's look, with no second bar and no Download results; `quiz replay`'s own page is as it was. `docs/screens/3r/` is taken by its spec. A `build` page carries no server code and is byte-identical with and without the server features. Report as the rules say, every golden that changed counted and explained.

### Review
