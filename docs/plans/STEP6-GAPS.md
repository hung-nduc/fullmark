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

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md, "Paths in output", "The library folder" and `quiz library import`. Built as 6b's first task; 6b's script writes the five quizzes' sources relative. A lock that records its machine (G9 in discussion) was dropped by the owner as a stretch.
