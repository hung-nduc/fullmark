# Step 6: Windows, then moving the 0.x history in

## Handoff (2026-11-20): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 5 ([archive/STEP5.md](archive/STEP5.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits (never pushes) and reports; the planner reviews and brings every gap to the owner with a recommendation; the owner decides; decisions go into `docs/design/` as plain statements. Commit after every round. Gaps are numbered from **G1**; decided ones move to [STEP6-GAPS.md](STEP6-GAPS.md).

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-20); G1 to G9 decided (2026-11-20), written into COMMANDS.md, TECHNICAL_DESIGN.md and CLAUDE.md | this file |
| 6a | built and reviewed (2026-11-20): `npm run check` passes on Windows, no golden changed; G10 to G12 raised | `892a7b2a`, `51e4b319`, `f642dade`, `7af9e956`, `921b38ef`, `ab837015` |
| 6b | built and reviewed (2026-11-20): `npm run check` passes on Windows; 17 goldens changed, only `source` values; G19 raised and decided | `db5128d8`, `29e77fad`, `c0b94133` |
| 6c | G19 built; the migration rehearsed on copies and reviewed (2026-11-20): `compare.log` shows no unexplained difference; G20 to G24 raised; the real run waits for the owner | `5e4a96ee`; the script's repository `28b0dfc`, `d4ee72b` |

### Next

1. **Done:** the migration (2026-11-20). G20 to G24 decided as recommended; the owner approved the real run and the planner ran it: `D:/studying/fullmark-library-1.0` holds the five quizzes and four attempts, `compare.mjs` reports 0 unexplained differences (6 explained, as in the rehearsal), so step 6's "Done when" holds. The cloud checks of 6a to 6c were not run (no cloud environment from the laptop).
2. **Paused here by the owner (2026-11-20).** 6d is built and committed by its agent (`1058f8c9` G23, `6444fffc` G24) but **not reviewed**: the agent was stopped while its final `npm run check` ran, and that check was stopped too, so it has no result and no report. Next session: read both commits' diffs and the new goldens (`git diff e331356b..6444fffc`), check that no existing golden changed, run `npm run build` then `npm run check` once on Windows with nothing else running (about 20 minutes), and write 6d's review here.
3. Then (owner's yes, 2026-11-20): step 6 is archived, branch `1.0` fast-forwarded, and fullmark installed as `1.0.0` from a packed tarball.

## Goal

TECHNICAL_DESIGN.md section 12, step 6: a throwaway script, written by an agent and kept outside the product, converts the owner's 0.x library into a new 1.0 library. **Done when** `stats` and `--missed` in the new library agree with 0.x's on the same history.

Before that, **the suite passes on Windows** (slice 6a). The owner's laptop is Windows and every check so far ran only in the Linux cloud environment. The first full run on Windows (2026-11-20, `npm run check`, 4 cores) gave: typecheck, Biome and knip pass; Playwright 861 passed, 0 failed (559 skipped, all by design: screenshots made on request, SIGINT, touch drags, `page.pdf()`); Vitest 52 failed of 3,774; the startup test failed on its first runs after a fresh build; Firefox's 300-question budget measured 2.2 s against 1 s and, as a dependency, skipped every other Playwright project. The causes are G1 to G7.

### What is moved (owner, 2026-11-20)

The 0.x library is `D:/studying/fullmark-library` (format `fullmark-library` version 1, 31 commits, last attempt 2026-11-12). The six quizzes of the course `radiation-and-electrical-safety` are **not** moved (`gwbczt`, `abe4qo`, `6fupv4`, `jkaiiu`, `yrsefu`, `jrbj2y`); they stay in the 0.x library. These five are:

| 0.x id | name | results | also |
|---|---|---|---|
| 5wanzo | ch10-digital-radiography | 1 | |
| 4pmi5u | biomedical-sensors-and | 1 | reports |
| nua2si | biosignal-circuits | 0 | an unfinished attempt (`progress.json`) |
| vukyql | biosignal-exam-a | 1 | reports |
| xkpbyf | biosignal-exam-b | 1 | |

Each has one version; none has grades; every source file still exists. Whether unfinished attempts and 0.x reports move is a gap for 6b's brief.

## Rules for every slice

Step 5's rules hold ([archive/STEP5.md](archive/STEP5.md), "Rules for every slice", extending step 4's and step 3's). Added for step 6:

- **Windows counts.** A slice is checked on the owner's Windows laptop as well as in the cloud. A failure seen only on Windows is a bug or a gap like any other, never "environmental" without its cause shown.
- **Never run a second Vitest while one is running** in the same checkout: Vitest's global setup runs `npm run build`, which cleans `dist/` under the running suite (G7).

## Gaps

G1 to G24 are decided ([STEP6-GAPS.md](STEP6-GAPS.md)): G8 to G12 are slice 6b, G13 to G17 and G19 to G22 slice 6c, G23 and G24 loose ends after the migration; G18 (the agent's, about `register --update` not following a moved file) is left as it is, by the agent's recommendation, and not decided separately. New ones are added here from G25.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **6a** | G1 to G7: the suite passes on Windows | G1 to G7 |
| **6b** | G8 to G12: `source` relative to the library, the lock's host and boot, the budget run alone, the last paths | 6a, G8 to G12 |
| **6d** | (built, not reviewed) Loose ends before install: G23 (`core.longpaths`), G24 (`take --dry-run`) | 6c, G23, G24 |
| **6c** | G19; the migration script (outside the repository), rehearsed on copies of the five quizzes; `stats` and `--missed` compared with 0.x; the real run after the owner's yes | 6b, G13 to G17, G19 |

## Slice 6a: the suite on Windows

What fullmark does is written in COMMANDS.md ("Paths in output") and TECHNICAL_DESIGN.md (foundation "Library and shelf writes take a lock"; section 7, "Budgets"; section 11, "Budgets"); this brief says how to build it and how to show it works.

### Read first

- This plan: "Goal", "Rules for every slice"; [STEP6-GAPS.md](STEP6-GAPS.md), G1 to G7.
- COMMANDS.md, "Paths in output". TECHNICAL_DESIGN.md, foundation "Library and shelf writes take a lock", section 7 "Budgets", section 11 "Budgets".
- `src/cli/paths.ts`, `src/library/git.ts`, `src/library/lock.ts`, `src/library/index-file.ts`, the config writer, `src/cli/library-info.ts`, `test/golden/golden.test.ts`, `test/startup.test.ts`, `playwright.config.ts`.

### Tasks

1. **G1, `/` in every written path.** Every path fullmark writes into a file uses `/`: `library.toml`'s `source` (register, register --update, import), the config's `library` and `[shelves]` entries, and any path in a shelf manifest. Do it once, where the value is made or written, not at each caller; read paths back as they are (Node accepts `/` on Windows). `Git.outerRepository()` returns the path normalised the same way and compares with `realpathSync` as now. Fix the tests that expect `\` where fullmark prints or writes `/`: `test/library/git.test.ts` ("finds a repository that contains the library"), `test/library-cli.test.ts` (the outer-repository note), `test/library-rm.test.ts` (the undo line), `test/library-import.test.ts` (the "edited after it was published" warning, which prints the path through `shownPath`). The history helper (`test/library-history.test.ts`) must pass with the same fixture.
2. **G2, a stored path shown as stored.** Where `info` (and any other command) shows a stored `source`, it prints the stored text with `/`, never `resolve`d against the working directory or drive: `/home/minh/notes/study.md` read on Windows stays that. Whether the file exists is still checked (it is reported gone). The `library/info*` goldens pass unchanged.
3. **G3, the lock on Windows.** In `withLock` (and the shelf's lock, if it has its own create), a create that fails with `EPERM` or `EBUSY` is treated like `EEXIST`: read the holder, and look again after `pollMs`. If the file then cannot be read, loop as for a lock that went away. `test/library-init-race.test.ts` passes on Windows; add a unit test with an injected create that fails once with `EPERM`.
4. **G4, the stale-lock fixture.** `library/status-stale-lock`'s `.fullmark.lock` was never committed (the fixture library's own `.gitignore` ignores it). Make the golden runner write it into the copied input before the command runs (a small, general hook, such as an `input-extra` file or a per-case setup keyed by name; your choice, reported), with the same content the golden expects (pid 999999999, command `quiz library take signals`). The golden's expected output does not change.
5. **G5, timeouts for git-heavy tests on Windows.** The files that run real git many times per test (`test/library-*.test.ts`, `test/shelf-*.test.ts`, `test/library/git.test.ts`, and any other that timed out: `test/terminal-style.test.ts` "inspect draws its block", `library-replay`, the killed sync) set their own timeout, 120 s when `process.platform === "win32"` and the default otherwise, with a comment giving the reason (a git call costs about 225 ms on the owner's laptop). First find out why `terminal-style`'s inspect test is slow: if it is not git, say what it is.
6. **G6, timing tests.** `test/startup.test.ts` runs each command once, untimed, before its rounds. In `playwright.config.ts`, `chromium` and `firefox` no longer list the budget projects as dependencies; the budget projects still run (Firefox's after Chromium's). Remove the claim in the config's comment that every other project depends on them.
7. **G7, the note.** CLAUDE.md already says not to run a second Vitest beside a running one (the planner wrote it); nothing to build.

### Done when

- On Windows, in the worktree, with nothing else running: `npm run build`, then `npm run check`: typecheck, Biome, knip, Vitest (all files, startup first), Playwright in Chromium and Firefox. Every test passes except Firefox's page budget, which may still fail (G6: it is kept, to revisit) and then must not skip any other test. Report each part's counts and times.
- **No golden changes.** The goldens were made on Linux and already hold `/`; if one must change, stop and report it.
- The same `npm run check` passes in the cloud environment, or the agent says it could not run it there.
- One commit per task or a few, explicit paths, the `Co-Authored-By` line of the model, no push.

### Report

What was done per task, anything done differently and why, the counts and times, and any new gap (from G8) with a recommendation.

### Review (2026-11-20)

Built by one agent (Sonnet) from the brief; reviewed by the planner on Windows.

**Checked by the planner.** `npm run build`, then `npm run check` with nothing else running: typecheck, Biome, knip pass; the startup test 2 of 2 (4.3 s); Vitest 3,778 passed, 3 skipped, 0 failed (333 s); Playwright 863 passed, 559 skipped by design, 0 failed (10.8 min; both budgets passed on their retry, see G10); exit 0 in 16.6 minutes. **No expected golden changed:** the only changes under `test/golden/` are the runner's `input-extra/` hook and three files under `input-extra/`. The source diff (51 lines added, 19 removed, in 9 files) was read in full.

**Per task.**
- **G1:** `slashed()` in `src/library/layout.ts`, applied where values are written (`renderIndex`, both config writers including the inline `shelves` table, `Git.outerRepository()`). The first full run found a real bug it caused: `register` matched a quiz by `q.source === job.abs`, which failed once the stored source had `/` (a false `library.id-taken`); it now compares both slashed. Ten test files now expect `/`.
- **G2:** `storedPath()` in `src/cli/paths.ts`, used by `info`; `info --json`'s `source.path` slashed; `test/stored-path.test.ts`. Covers a Linux path on Windows only (G12).
- **G3:** `EEXIST`, `EPERM` and `EBUSY` count as taken; `withLock` takes an injected `create`. **Done differently, accepted:** an `EPERM` or `EBUSY` with no lock to read waits `pollMs` and, once `waitMs` is up, is rethrown, so a real permission refusal cannot loop forever. Two unit tests.
- **G4:** the golden runner copies an optional `input-extra/` over `input/`. **Found while building, accepted:** `library/register-update` and `register-update-json` had the same fault as G4 (their `progress/` file hidden by the fixture's `.gitignore`), so they failed on any fresh clone; their file is now in `input-extra/`, expected output unchanged.
- **G5:** `gitHeavy()` in `test/helpers/git-timeout.ts` sets 120 s a test on Windows, called by every library and shelf test file, `library/git.test.ts` and `terminal-style.test.ts` (whose slowness is git too: its setup builds the history library twice).
- **G6:** the startup test warms bare Node and the CLI once; `chromium` and `firefox` no longer depend on the budget projects (which raised G10).
- **G7:** nothing to build.

**Not run:** `npm run check` in the cloud environment.

**Gaps raised:** G10, G11 (the agent's), G12 (the planner's, from reading the diff).

## Slice 6b: `source` relative to the library, the lock's host and boot, the budget alone

**Briefed on 2026-11-20 from G8 to G12, decided by the owner as recommended.** What fullmark does is written in COMMANDS.md ("Paths in output", "The library folder", `quiz library import`) and TECHNICAL_DESIGN.md (foundation "Library and shelf writes take a lock"; section 11, "Budgets"); this brief says how to build it.

### Read first

- This plan: "Rules for every slice", slice 6a and its review; [STEP6-GAPS.md](STEP6-GAPS.md), G8 to G12.
- COMMANDS.md: "Paths in output", "The library folder" (`library.toml`), `quiz library register`, `quiz library import`, `quiz library info`, `quiz library status`. TECHNICAL_DESIGN.md: foundation "Library and shelf writes take a lock", section 11 "Budgets".
- `src/library/layout.ts` (`slashed`), `src/cli/paths.ts` (`shownPath`, `storedPath`), `src/library/index-file.ts`, `src/cli/library-row.ts` (`sourceOf`), `src/cli/library-register.ts`, `src/cli/library-import.ts`, `src/cli/library-info.ts`, `src/library/lock.ts`, `src/cli/library-status.ts` (its stale check), `package.json`, `playwright.config.ts`.

### Tasks

1. **G12 first, a stored absolute path on any system.** One helper says whether a stored path is absolute on *some* system: after `slashed`, it starts with `/`, `//` or a drive letter and `:/` (`D:/`). `storedPath` prints such a path as stored on every system, never `resolve`d; a relative stored path is resolved against the folder it is relative to (G8) and shown with `shownPath`. Unit tests for both directions on both platforms (the platform passed in or injected, since the suite runs on one system at a time).
2. **G8, `source` relative to the library.** Where a `source` is made (`register`, `register --update`, `import`), it is written relative to the library folder with `/` when the file and the library are on the same drive (on Windows the same root, compared case-insensitively; elsewhere always), and absolute with `/` only across Windows drives. Where it is read (`list`'s and `info`'s `changed` flag through `sourceOf`, `register`'s match by source, `info`'s Source row and `--json` `source.path`, and any other reader you find), a relative one is resolved against the library folder and an absolute one is used as it is; one absolute on another system (G12) is simply not found. `register --update`, and a plain `register` that finds the quiz by its source, rewrite an absolute `source` relative. `info --json`'s `source.path` is the stored text, slashed. **Goldens:** this changes every golden whose `library.toml` (or JSON output) holds a `source`. Run `npm run golden:update`, then read every changed file: the only differences allowed are `source` values. List each changed golden in the report with what changed; any other difference is a bug to fix or a gap to report, and is reverted before committing.
3. **G9, the lock's host and boot.** `LockHolder` gains `host` (`os.hostname()`) and `boot` (the ISO time this machine started: now minus `os.uptime()`), both from `LockEnv` so tests inject them. A lock is stale when its `host` is not this machine's, or its `boot` is more than 60 s from this machine's; otherwise when its process is not running, as now. A lock without `host` or `boot` is judged by its process alone (so `library/status-stale-lock`'s fixture works unchanged). `library status`'s stale check uses the same rule: one shared function for `lock.ts` and `library-status.ts`, not two. The note on removing a lock says why: "left by pid 4120 on another machine (HOST)", "left before this machine last started", or as now. Unit tests: another host; an earlier boot; the same boot within 60 s with a dead and with a live process; no host or boot. A golden whose output shows a lock's content may change only by the new fields; list it.
4. **G10, the budget alone.** `npm run test:e2e` builds, then runs the two budget projects in one `playwright test --project=budget-chromium --project=budget-firefox --workers=1` call, then the rest (`--project=chromium --project=firefox`) in a second call whatever the first gave, and exits non-zero if either did. Write it as a small Node script in `scripts/` (cross-platform, no shell `||` tricks), called from `package.json`; knip must accept it. `budget-firefox` no longer depends on `budget-chromium` (with one worker they run one after the other anyway), so a Chromium budget failure does not skip Firefox's. Update `playwright.config.ts`'s comment.
5. **G11, `info --json`'s `path`.** The quiz folder's `path` uses `/`, matching what the text output prints. Goldens made on Linux do not change.

### Done when

- On Windows, with nothing else running: `npm run build`, then `npm run check` passes: typecheck, Biome, knip, Vitest with the startup test first, Playwright through the new `test:e2e` in both browsers. Report each part's counts and times, and both budgets' measurements.
- Every changed golden is listed with its change (tasks 2 and 3); no other golden changes.
- By hand, in a temporary folder: a library made by `register` on Windows holds a `source = "../notes/quiz.md"`-style line (quote it in the report), and `list` shows the quiz `unchanged`; after moving the folder that holds both the library and the notes (and pointing `FULLMARK_CONFIG` at a config naming the new place), `list` still shows it `unchanged`.
- One commit per task or a few; explicit paths; the `Co-Authored-By` line of the model; no push. The cloud check is not run (say so).

### Report

What was done per task, anything done differently and why, the changed goldens, the counts and times, and any new gap (from G18) with a recommendation.

### Review (2026-11-20)

Built by one agent (Sonnet) from the brief; reviewed by the planner on Windows.

**Checked by the planner.** `npm run build`, then `npm run check` with nothing else running: typecheck, Biome, knip pass; the startup test 2 of 2; Vitest 3,795 passed, 3 skipped, 0 failed (363 s); Playwright through the new `test:e2e`: the budget call 2 passed (Chromium 944 ms; Firefox 1706 ms, then 665 ms on its retry), the rest 861 passed, 559 skipped by design, 0 failed (13.3 min); exit 0 in 19.8 minutes. **Goldens:** 17 `library.toml` files changed, and the only changed lines are 25 `source` values, each from `<dir>/X` to `../X` (checked by value with `git diff`). The source diff was read in full.

**Per task.** G12 and G8: `src/cli/source-path.ts` (`isStoredAbsolute`, `absoluteHere`, `sourceToStore`, `resolveSource`, `sameFile`, each taking the platform so both systems are tested on one); `storedPath` shows a path absolute on another system as stored and resolves a relative one against the library. G9: `staleReason` and `staleNote` in `lock.ts`, used by `withLock` and `library status`. G10: `scripts/test-e2e.mjs`. G11: `info --json`'s `path` slashed.

**Done differently, accepted.** The helpers live in `src/cli/`, since `check` loads `paths.ts` and must never load `src/library/` (the command-graph test caught the first placement). `storedPath` still shortens a path of this system under the working directory, as `shownPath` always did. The history fixture keeps its absolute `/home/minh/...` sources, as an older library holds them. A plain `register` of an unchanged quiz with an absolute source rewrites it relative and commits (which raised G19).

**Noted, no gap.** G9's `boot` comes from `os.uptime()`. With Windows Fast Startup on, a shutdown does not reset it, so a lock left before a Linux session may count as the same boot and fall back to the process-id check, as before G9. Fast Startup must be off on a dual-boot disk anyway (it leaves NTFS in use).

**Not run:** the cloud check.

**Gaps raised:** G18 (the agent's: `register --update` on an unchanged quiz does not follow a file that moved; left as it is) and G19 (the planner's: the rewrite is a quiet write under `unchanged`; decided).

## Slice 6c: moving the five quizzes in

**Briefed on 2026-11-20 from G13 to G17 and G19, decided by the owner as recommended.** Apart from G19 (task 0), this slice writes no product code: the script lives outside the repository (TECHNICAL_DESIGN.md, section 12, step 6; G17). What a 1.0 library holds is written in COMMANDS.md ("The library folder", `quiz library register`, `quiz library stats`, `quiz library take`); the quiz syntax in QUIZ_SYNTAX.md (section 11 lists every change from 0.10.2); the results format in `schemas/results-v2.schema.json` and TECHNICAL_DESIGN.md.

### What is moved

Five quizzes of the 0.x library at `D:/studying/fullmark-library` (format `fullmark-library` version 1): `5wanzo` ch10-digital-radiography, `4pmi5u` biomedical-sensors-and, `nua2si` biosignal-circuits, `vukyql` biosignal-exam-a, `xkpbyf` biosignal-exam-b. Their sources are the `source` paths in its `library.toml` (all under `D:/studying/lectures/2026.1/`). Only their results move (four attempts; `nua2si` has none). Not moved (G16): `nua2si`'s `progress.json`, the 0.x reports, and the six quizzes of `radiation-and-electrical-safety`. **The 0.x library is read, never written.**

### Read first

- This plan: "Goal", "What is moved", "Rules for every slice", slice 6b and its review; [STEP6-GAPS.md](STEP6-GAPS.md), G8, G13 to G17, G19.
- QUIZ_SYNTAX.md (all; section 11 above all), COMMANDS.md (`quiz library init`, `register`, `stats`, `take` with `--missed` and `--dry-run` if it has one, "The library folder", "Git"), `schemas/results-v2.schema.json`, TECHNICAL_DESIGN.md (the results format and "Hashes survive machines").
- 0.x: `D:/coding-projects/fullmark-py` (read only), its results format (`fullmark-results` version 1), how its `library stats` computes what it prints, and how it picks a question as missed.

### Rehearsal first, then the real run

The script takes the places it works on as arguments (the 0.x library, the five sources' root, the config file, the new library's folder), so the same script runs twice. **The agent runs only the rehearsal:** it copies the five sources (with their folders' assets) and the 0.x config into a temporary folder, points every path there (`FULLMARK_CONFIG` for both CLIs, the new library in the temporary folder), runs the whole migration and `compare`, and reports. It never writes under `D:/studying/` or `%APPDATA%`. **The real run** is one command, given in the report, which the planner runs only after the owner has seen the rehearsal's `compare.log` and said yes.

### Tasks

0. **G19, in fullmark's repository.** `quiz library register`'s line for an unchanged quiz whose `source` it rewrote relative reads `unchanged (source made relative)`, and `--json`'s `unchanged` entry gains `"source_rewritten": true` (false or absent otherwise: follow how the other `--json` fields are written, and say which). Test it in `test/library-register.test.ts` (6b added the rewrite's test there), and run the register goldens and that file. Commit on the branch, as in 6a and 6b. Then `npm run build`: the script uses this `dist/`.

1. **The script's home (G17).** A new folder `D:/coding-projects/fullmark-0x-migration/`, its own git repository (`git init`, a README of a few lines saying what it is and that it is thrown away after step 6), never inside fullmark's. Node, no dependencies beyond what Node has, unless one is needed (say why). It calls fullmark 1.0 as `node D:/coding-projects/fullmark/.claude/worktrees/fullmark-1-0-migration-b09951/dist/cli.js` (build it first) and 0.x as `fullmark-py`. It has a `--dry-run` that writes nothing and prints the plan, and writes a log (`migration.log`, kept in its folder) of every file read, converted and written.
2. **The config (G13).** Rename `%APPDATA%\fullmark\config.toml` to `config-0x.toml` in the same folder (refuse if `config-0x.toml` exists). Nothing is deleted. Then check that `FULLMARK_CONFIG=%APPDATA%\fullmark\config-0x.toml fullmark-py library list` still lists the eleven quizzes.
3. **The quizzes (G15).** For each of the five: convert its source from 0.10.2 syntax to 1.0 syntax, by the rules of QUIZ_SYNTAX.md section 11, keeping every question's id exactly (where 0.x gave a question no id, it had the default `q1`, `q2`...; write those ids explicitly, so the results map one to one), and keeping the text otherwise as it is. Run `quiz check` on each converted file until it passes; anything the conversion cannot decide (a type that 0.x inferred ambiguously, a feature with no 1.0 form) is a gap (from G18) brought to the planner, never guessed. Then write it over the source in place, after copying the original beside it as `NAME.0x.md` (`quiz.0x.md` for `quiz.md`). Assets the quiz references stay where they are.
4. **The library (G14, G8).** `quiz library init D:/studying/fullmark-library-1.0`, then `quiz library register` each converted source (one call for all five is fine). Its `library.toml` then holds `source = "../lectures/2026.1/..."` lines (G8): check that it does.
5. **The results.** For each 0.x results file of the five: write a results-v2 file into the new library as `library take` would file it (the same folder, file name from the attempt's start, the version hash of the registered quiz), converted field by field: the attempt's times, mode, bank, time limit and elapsed time; each question's response and status; the score. Validate every file against `schemas/results-v2.schema.json`. Where a 0.x field has no 1.0 place, or a 1.0 field has no 0.x value, say what you did in the log and the report. Then commit them in the library's git, one commit, message `fullmark: move 4 attempts from 0.x`, paths explicit.
6. **The proof (G17).** A second script, `compare`, prints for each of the five quizzes, side by side: `fullmark-py library stats` (with `FULLMARK_CONFIG` on the old config) and `quiz library stats` on the new library (attempts, each attempt's score and percent, per-question results), and the questions 1.0's `quiz library take NAME --missed` would ask (from `--dry-run` or `--json` if it has one; otherwise from what the command prints before serving, without serving a page) against the questions not answered correctly in the newest 0.x attempt. Every difference is listed; a difference is a bug in the conversion or a gap, never left unexplained. Its output goes into `compare.log`.
7. **Check the new library.** `quiz library status` on it says healthy; `quiz library list` shows the five, `unchanged`, with their attempts.

### Done when

- In the rehearsal, `compare.log` shows no unexplained difference for any of the five quizzes: the same attempts, scores and percents, the same per-question results, and `--missed` asking the questions missed in the newest attempt (for `nua2si`, with no attempt, `--missed` says there is nothing to retry, as COMMANDS.md says).
- In the rehearsal: `quiz library status` healthy; `list` shows the five `unchanged`; `fullmark-py library list` on the renamed config still shows the eleven; each converted source has its `.0x.md` copy.
- Nothing under `D:/studying/` or in `%APPDATA%\fullmark\` changed (`git -C D:/studying/fullmark-library status` clean with the same last commit; the config's bytes the same).
- The migration folder is committed in its own repository; in fullmark's, only G19's commit. `npm run check` is not needed for G19 alone: the register goldens, `test/library-register.test.ts`, typecheck and Biome pass. The report gives the real run's command.

### Report

What the script does, step by step; every conversion choice; the `compare.log` summary per quiz; every gap (from G18) with a recommendation; what you could not check.

### Review (2026-11-20)

Built by one agent (Sonnet); reviewed by the planner.

**Checked by the planner.** The owner's data is untouched: `git -C D:/studying/fullmark-library status` clean at `cdb5ee20`, the same commit; `%APPDATA%\fullmark\config.toml` the same SHA-256 (`573df8a7…`) and alone in its folder; no `.0x.md`, no candidate file and no `fullmark-library-1.0` under `D:/studying/`. The script's repository holds `migrate.mjs`, `compare.mjs`, `rehearse.mjs`, `lib/` and the rehearsal's logs, in two commits. `compare.log` read: for each quiz, the attempts, scores and percents agree; per question 73/73, 69/69, 52/52 and 51/51 agree on status, earned and points; every tag agrees; `--missed` gives the same 0, 0, 0, 7 and 12 questions as 0.x's wrong or partly right ones. **G19:** one golden line changed (`register-update-unchanged-json`: `"source_rewritten":false` added); the agent made the field always present, accepted and written into COMMANDS.md.

**Explained differences, accepted.** ch10's `possible` is 112 in 0.x and 126 in 1.0: 0.x leaves unanswered essay and code points out as pending, 1.0 counts them as 0; earned is 0 in both. 0.x's Retry missed also took unanswered questions; 1.0's `--missed` leaves them out by design (COMMANDS.md, `quiz library take`).

**Conversion, accepted.** Every heading gets the `type` 0.x inferred (checked against each attempt's recorded type); `> [!explanation]` and `> [!hint]` become `:::` containers; `on_timeout: submit` and `show_sample: true` are dropped (1.0 behaves so); ids kept, but for G20; quiz names kept with `-n`; results-v2 from each 0.x results file (responses, times, flags; the score is graded again by 1.0; what has no 1.0 place is listed per file in `migration.log`).

**Not checked:** the converted quizzes in a browser; answer types other than `single` (none in the four attempts; any other stops the script); `take --missed` itself for exams A and B (derived, G24); `npm run check` after G19 (its tests, the register goldens, typecheck and Biome pass); the real run.

**Gaps raised:** G20 to G24.

### The real run (2026-11-20)

Run by the planner after the owner's yes, from the worktree's `dist/` (built with G19): `migrate.mjs --dry-run` first (the plan matched the rehearsal), then `migrate.mjs` and `compare.mjs` on the real places (exit 0 both).

- `%APPDATA%\fullmark\config.toml` renamed to `config-0x.toml`; 1.0's `library init` wrote a fresh `config.toml`.
- The five sources converted in place, each original kept beside it as `*.0x.md`; the diffs show only the conversion's changes.
- `D:/studying/fullmark-library-1.0`: seven commits (`init`, five `register`, `move 4 attempts from 0.x`); every `source` is `../lectures/2026.1/...`; `library status` healthy, 5 of 5 hashes match; `list` shows exams A and B at 81% and 71%, the two empty attempts at 0%, the midterm practice never taken.
- The 0.x library is untouched (`cdb5ee2`, clean).
- `compare.mjs`: per question 73/73, 69/69, 52/52, 51/51 agree; every tag agrees; `--missed` gives 0, 0, 0, 7 and 12 questions as in 0.x. UNEXPLAINED differences: 0. Logs in `D:/coding-projects/fullmark-0x-migration/` (`migration.log`, `compare.log`, git-ignored).

## Slice 6d: `core.longpaths` and `take --dry-run`

**Briefed on 2026-11-20 from G23 and G24, decided by the owner as recommended.** Written in COMMANDS.md: "Git" (the long-paths sentence) and `quiz library take` (`--dry-run`, its `--json` and the Output example).

### Tasks

1. **G23.** The git runner (`src/library/git.ts`) passes `-c core.longpaths=true` before every git command when the platform is `win32` (the platform injected, as 6b's helpers take it, so a unit test checks both). Nothing else changes; goldens do not.
2. **G24.** `quiz library take NAME [--section S] [--missed] --dry-run [--json]`, exactly as COMMANDS.md now says: it computes the plan the real take would serve (the same code path up to serving, so the two cannot drift), prints it, and stops before the server, the lock, any write or any filing. Golden cases for: a plain take (all questions), `--section`, `--missed` with a changed and a gone question, `--missed` with nothing missed, a quiz with a progress file (`would resume`), and each in `--json`. Use the library history fixture the `take` tests already use. The command graph: `--dry-run` must not load `src/serve/` (extend `test/cli-graph.test.ts` if it can tell; say so if it cannot).

### Done when

`npm run build`, then `npm run check` passes on Windows, nothing else running. The new goldens are listed; no other golden changes. One commit per task; explicit paths; the model's `Co-Authored-By` line; no push.
