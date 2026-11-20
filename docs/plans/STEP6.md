# Step 6: Windows, then moving the 0.x history in

## Handoff (2026-11-20): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 5 ([archive/STEP5.md](archive/STEP5.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet); the agent implements and commits (never pushes) and reports; the planner reviews and brings every gap to the owner with a recommendation; the owner decides; decisions go into `docs/design/` as plain statements. Commit after every round. Gaps are numbered from **G1**; decided ones move to [STEP6-GAPS.md](STEP6-GAPS.md).

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-20); G1 to G7 decided as recommended (2026-11-20), written into COMMANDS.md, TECHNICAL_DESIGN.md and CLAUDE.md | this file |
| 6a | briefed | |
| 6b | brief written after 6a's review | |

### Next

1. 6a is built and reviewed: the whole suite passes on Windows (and still in the cloud).
2. 6b's brief: the migration script, for the five quizzes the owner chose (below).
3. After 6b: the planner lists loose ends, does a quick pass over `docs/design/proposals/` for the owner, and fullmark 1.0 is installed on the owner's laptop.

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

G1 to G8 are decided ([STEP6-GAPS.md](STEP6-GAPS.md)); G8 (`source` relative to the library) is 6b's first task. New ones are added here from G9.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **6a** | G1 to G7: the suite passes on Windows | G1 to G7 |
| **6b** | G8; the migration script, run on the five quizzes; `stats` and `--missed` compared with 0.x | 6a, G8, its own gaps |

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
