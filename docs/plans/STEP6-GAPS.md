# Step 6: decided gaps

Every gap of step 6 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The plan is [STEP6.md](STEP6.md). Step 6 numbers its gaps from G1.

All seven come from the first full run of the suite on Windows (2026-11-20).

**G1. Paths written into files use `/`.** COMMANDS.md says printed paths use `/` on Windows too, but not paths written into files: `library.toml`'s `source`, the config's `library` and `[shelves]` were written with `\` on Windows (45 failing tests, most of them goldens). **Recommendation:** every path fullmark writes into a file uses `/`, so a library or config reads the same on every system, as 0.x's library already does.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output".

**G2. A stored path from another system.** `info` printed `/home/minh/notes/study.md` as `C:/home/minh/notes/study.md` on Windows, resolving it against the drive (6 goldens). **Recommendation:** a stored path is shown as stored, never resolved; a file it names is simply reported missing.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output".

**G3. The lock's create on Windows.** Two commands started together: the exclusive create of `.fullmark.lock` failed with `EPERM` while the first command was still removing its lock, and the second command crashed (`test/library-init-race.test.ts`). **Recommendation:** `EPERM` and `EBUSY` on that create count as taken, like `EEXIST`, and are tried again.

**Decided by the owner on 2026-11-20, as recommended.** Written into TECHNICAL_DESIGN.md, foundation "Library and shelf writes take a lock".

**G4. The stale-lock golden's fixture was never committed.** The fixture library's own `.gitignore` ignores `.fullmark.lock`, so `library/status-stale-lock` fails on any fresh clone, Linux too. **Recommendation:** the golden runner writes the lock into the copied input before the command runs.

**Decided by the owner on 2026-11-20, as recommended.** A test matter; built in 6a.

**G5. Git-heavy tests time out on Windows.** A git call costs about 225 ms on the owner's laptop against a few ms on Linux; five tests ran past the 30 s default under the full parallel run. **Recommendation:** the git-heavy library and shelf test files set their own 120 s timeout on Windows, with the reason; the default stays 30 s.

**Decided by the owner on 2026-11-20, as recommended.** A test matter; built in 6a.

**G6. Timing tests and the machine.** The startup test failed on a cold disk cache right after a build; Firefox's 300-question budget measured 2.2 s against 1 s, and as every other project's dependency it skipped all 1,420 other Playwright tests. **Recommendation:** the startup test runs each command once before timing it; the budget tests still run first, but the other projects no longer depend on them; Firefox's 1 s limit is kept for now and revisited later.

**Decided by the owner on 2026-11-20, as recommended.** Written into TECHNICAL_DESIGN.md, section 7 "Budgets" and section 11 "Budgets".

**G7. A second Vitest run beside a running one breaks it.** Vitest's global setup runs `npm run build`, which cleans `dist/`; a second run started during the full one deleted `dist/cli.js` under it (15 "Cannot find module" failures, caused by the planner). **Recommendation:** a line in CLAUDE.md.

**Decided by the owner on 2026-11-20, as recommended.** Written into CLAUDE.md and this step's "Rules for every slice".

**G8. `source` relative to the library.** `library.toml`'s `source` was the absolute path a quiz was registered from, so a library cloned onto another machine, or a folder above it moved or renamed, reported every source gone (stats and `take` still work, only the `changed` flag is lost). Raised while discussing a dual-boot setup; the migration (6b) writes every source anyway. **Recommendation:** `source` is relative to the library folder when both are on the same drive, absolute only across Windows drives; an absolute one is still read, and `register --update` rewrites it relative.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output", "The library folder" and `quiz library import`. Built as 6b's first task; 6b's script writes the five quizzes' sources relative.

**G9. A lock left on another system or an earlier boot.** The lock held only a process id, so after a reboot mid-command, or on the other OS of a dual-boot disk, an unrelated process with the same id kept the lock "alive": every command waited 10 s and exited 2 until the lock was deleted by hand. **Recommendation:** the lock records `host` and `boot`; a lock from another host or an earlier boot (more than a minute apart) is stale and removed with a note; otherwise the process id decides, as before; a lock without them is judged by its process. Two machines at once on one shared folder is declared unsupported.

**Decided by the owner on 2026-11-20, as recommended** (the planner had first called it a stretch; the owner chose to build it, the cost being small). Written into TECHNICAL_DESIGN.md, foundation "Library and shelf writes take a lock". Built in 6b, after G8.

**G10. The page budget runs under load.** With G6, no project depends on the budget projects, so Playwright runs them beside the other 1,420 tests, and TECHNICAL_DESIGN.md's "the budget tests run first" is no longer true: the budget is measured on a busy machine (first tries in the review run: Chromium 1161 ms, Firefox 1662 ms; the retries 543 and 669 ms). **Recommendation:** `npm run test:e2e` runs the two budget projects in one `playwright test` call, then the rest in a second call that runs whatever the first gave, and the run fails if either failed. The budget is again measured alone, and a failure still skips nothing.

**Decided by the owner on 2026-11-20, as recommended.** Written into TECHNICAL_DESIGN.md, section 11 "Budgets". Built in 6b.

**G11. `info --json`'s `path` keeps `\` on Windows.** The quiz folder's `path` is the native path, while `source.path` and every printed path use `/`. **Recommendation:** `path` uses `/` too, as every path fullmark prints or writes (COMMANDS.md, "Paths in output"); the goldens, made on Linux, do not change.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output". Built in 6b.

**G12. A Windows path read on Linux.** G2's `storedPath` keeps a Linux path unchanged on Windows, but a stored `D:/studying/quiz.md` read on Linux goes through `shownPath` and prints as `<cwd>/D:/studying/quiz.md`. COMMANDS.md says an absolute path from another system is printed as stored, whichever the system. **Recommendation:** a stored path that starts with a drive letter (`X:/`) or `//` is absolute on every system and printed as stored; a unit test covers both directions. It goes with G8, which changes how `source` is read.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output". Built in 6b.

**G13. Both versions read the same config file.** 0.x and 1.0 both use `%APPDATA%\fullmark\config.toml` (and `FULLMARK_CONFIG`). 0.x's holds `[library] path = "D:/studying/fullmark-library"`; 1.0 writes `library = "..."` at the top level, and a TOML file cannot hold both, so 1.0's `library init` breaks 0.x's config or refuses it. fullmark-py is frozen apart from survey fixes and the kits use only `serve_survey`, which reads no config. **Recommendation:** the script moves 0.x's file to `%APPDATA%\fullmark\config-0x.toml` (nothing deleted) before 1.0's `library init` writes a fresh one; the six quizzes left in 0.x stay reachable with `FULLMARK_CONFIG` pointing at that file. No change to fullmark-py.

**Decided by the owner on 2026-11-20, as recommended.** A matter of the migration, not of the product: written here and in slice 6c's brief.

**G14. Where the new library lives.** **Recommendation:** `D:/studying/fullmark-library-1.0`, beside the old one, which stays untouched as the archive of all eleven quizzes. Beside it, G8's relative sources read `../lectures/2026.1/...`.

**Decided by the owner on 2026-11-20, as recommended.** A matter of the migration, not of the product: written here and in slice 6c's brief.

**G15. The source files.** The five sources in `D:/studying/lectures/...` are written in 0.x syntax and are in no git repository. Left as they are, 1.0's `list` shows every one `changed` and a later `register --update` fails `check` until rewritten by hand. **Recommendation:** the script converts each source in place to 1.0 syntax (the same text it registers, so `list` shows `unchanged`), after copying the original beside it as `quiz.0x.md` (or `NAME.0x.md`); the owner deletes the copies once satisfied.

**Decided by the owner on 2026-11-20, as recommended.** A matter of the migration, not of the product: written here and in slice 6c's brief.

**G16. What is not moved.** **Recommendation:** only results move (four attempts). The unfinished attempt (`nua2si`'s `progress.json`) is dropped: a 0.x page's saved state cannot resume in a 1.0 page, and it holds no answers worth a result. The 0.x reports (`4pmi5u`, `vukyql`) are not moved: in 1.0 a report is made from an attempt's grades by `library grade`, and none of these attempts has grades, so they are derived data that 1.0 can make again. All of it stays in the 0.x library.

**Decided by the owner on 2026-11-20, as recommended.** A matter of the migration, not of the product: written here and in slice 6c's brief.

**G17. Where the script lives, and what proves it.** "Kept outside the product" (TECHNICAL_DESIGN.md, section 12). **Recommendation:** a Node script in `D:/coding-projects/fullmark-0x-migration/`, its own small git repository, never in fullmark's; it writes a log of what it converted. It registers the converted quizzes through 1.0's own CLI (`node dist/cli.js library init` and `register`), so the library is made by the product, and writes only the results-v2 files itself, then commits them through git as `library take` would. Done when, for each of the five quizzes, `quiz library stats` matches `fullmark-py library stats` (attempts, scores, percent, per question) and `--missed` plans the same questions as 0.x's missed list; the comparison is a script too, its output kept in the log. Each question keeps its 0.x id, so results map one to one.

**Decided by the owner on 2026-11-20, as recommended.** A matter of the migration, not of the product: written here and in slice 6c's brief.
