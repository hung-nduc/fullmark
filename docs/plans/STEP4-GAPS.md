# Step 4: decided gaps

Every gap of step 4 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The open ones are in [STEP4.md](STEP4.md), "Gaps". Step 4 numbers its gaps from G1 (step 3's G1 to G148 are in [archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)).

**1.0 and 0.x's `config.toml` (raised in the plan, before gaps were numbered from G1).** **Decided by the owner on 2026-11-16:** 1.0 makes no provision for 0.x: it reads and writes its own `config.toml` and its own library (`library.toml` version 2), and a 0.x library is refused like any other foreign folder (TECHNICAL_DESIGN.md, section 1, "No compatibility with 0.x"). Nothing to build beyond that.

**G4. The attempt in progress.** `take` "autosaves, so closing the tab or the server resumes the attempt"; `serve --autosave` (3b) writes progress to a file. **Recommendation:** `take` serves with autosave to `quizzes/<id>/progress/<version>.json` (git-ignored); the next `take` of the same version without `--section` or `--missed` resumes it, as the page's Continue does; the file is removed when the attempt is filed. A `take` with `--section` or `--missed` starts its own attempt and leaves a saved one alone. `register --update` warns about a saved attempt, as designed. **Decided by the owner on 2026-11-18, as recommended.**

**G5. `--missed` across versions.** COMMANDS.md says which questions; not how a missed question of an old version is served. **Recommendation:** questions are matched by `id` across versions. A question missed on an old version and still in the current one is served **as it is now**; when its hash differs from the one missed, the page marks it "changed since you missed it" (one label in both catalogs, next to the question's number). A missed question no longer in the current version is left out and counted in the `--json` output (`"gone": N`). The plan's `source` is `"missed"`. **Decided by the owner on 2026-11-18, as recommended.**

**G6. "History-based tests".** **Recommendation:** as the Goal says: one helper, `test/helpers/library-history.ts`, that builds a library through the real commands (register, update, files results and grades as `take` and `grade` would, with a fixed clock), used by the unit tests and the samples; its goldens are the step's acceptance. **Decided by the owner on 2026-11-18, as recommended.**

**G8. The exit code for "no library".** COMMANDS.md disagrees with itself: `register`, `info`, `template add` and `import` exit `3`, `status` and `list` exit `2`. Exit `3` means "a human-only value is missing", which a library is not (it is set up once, by `init`). **Recommendation:** `2` for every library command, with the message "no library: run `quiz library init PATH`"; `import`'s "no library and no `--into`" becomes `2` too. **Decided by the owner on 2026-11-18, as recommended.**

**G9. `take` and the lock.** `take` serves with no time limit, and the lock is held "until done". Holding it while the page is open would make every other changing command (`grade`, `register`, a second `take`) wait 10 seconds and fail for as long as a quiz is open. **Recommendation:** `take` takes the lock only to file the result and commit, never while serving. Two `take`s of the same quiz are kept apart by the progress file instead: it holds the serving process's id and URL, and a second `take` of that quiz while the first's process is alive exits 2, printing the URL to open; a progress file whose process is gone is resumed (G4). **Decided by the owner on 2026-11-18, as recommended.**

**G10. `library rm --json` without `--yes`.** `--json` never prompts, and `rm` asks. **Recommendation:** as `template rm`: with `--json` and without `--yes`, exit 2, with the fix "add `--yes`". **Decided by the owner on 2026-11-18, as recommended.**

**G11. What `library status` counts as a problem.** It lists diagnostics and exits `1` on "problems", without saying which. **Recommendation:** **problems** (exit `1`): the configured folder missing or not a library, `library.toml` that does not parse or names a version folder that is missing, a version whose files no longer match its hash, a library `fullmark.toml` that does not parse or names unknown rules. **Notes** (exit `0`, printed): uncommitted changes, no remote, no git repository (`--no-git`), orphan files, a stale lock, `FULLMARK_LIBRARY` set. `--json`: `{"status": "healthy" | "problems", "library", "config", "git": {"repository", "uncommitted", "remote"}, "counts": {"quizzes", "versions", "attempts", "reports"}, "problems": [{"code", "path", "message", "fix"}], "notes": [{"code", "path", "message"}]}`. **Decided by the owner on 2026-11-18, as recommended.**

**G12. Quiz ids in the library.** G1 names folders by the quiz's `id`, and `new` warns that two quizzes sharing an id would mix their histories, but `register` does not say what happens when they do. **Recommendation:** a new quiz (no `--update`) whose `id` is already in the library is refused (exit `1`, rule `library.id-taken`) with two fixes: "if it is the same quiz, `--update NAME`; if not, give it a new `id:`"; two files in one batch with the same id are refused the same way. `--update NAME` with a file whose `id` is not that quiz's is refused (`library.id-mismatch`), since a version keeps its quiz's id. **Decided by the owner on 2026-11-18, as recommended.**

**G13. What a name is.** A quiz is named "by its name or its id", and the default name is the slugged title, but no rule says what a valid name is or what happens when one quiz's name is another's id. **Recommendation:** a name is a slug (`a`–`z`, `0`–`9`, `-`, 1 to 64 characters, as `new` makes ids), checked by `register -n`, `--update` and `rename`; it may equal the quiz's own id but not another quiz's name or id (exit `1`, "name taken", with a free name suggested). Lookup tries names first, then ids, so it is never ambiguous. **Decided by the owner on 2026-11-18, as recommended.**

**G14. `library stats` with one attempt.** `quiz stats` needs two files; `library stats` exits 2 on "no attempts" and says nothing of one. **Recommendation:** one attempt is shown (the same blocks, `Weakest` left out until a tag is seen twice, as its rule already says); only no attempts exits 2. **Decided by the owner on 2026-11-18, as recommended.**

**G18. Terminal styles, and where they are set.** Raised by the owner (2026-11-18) after the CLI boards: may the look of the terminal output be chosen, as the page's themes are, and set in the library? Two variants are drawn beside the boards for comparison: **LibraryStyleBordered** (A: box-drawn tables, scores by band, coloured tags and badges, a status panel) and **LibraryStyleMiddle** (B: no borders, a shaded header row, the same colours). **Recommendation:**
- **A setting with two styles, not a theme system:** `[terminal] style = "simple" | "boxed"` in `config.toml`. `simple` is B, the default; `boxed` is A. Colours are the terminal's 16 ANSI colours, never fixed RGB, so the user's own terminal theme (dark, light, any palette) decides the shades. That is the "themes" part, and it costs nothing.
- **In `config.toml`, not `library.toml`.** It is a person's and a machine's taste, and it applies to every command with a table or a block (`check`, `inspect`, `stats` as well as the library's), most of which run with no library at all. `library.toml` travels with the repository.
- **Layout is stable where it is read by programs:** `--plain`, `NO_COLOR`, and stdout that is not a terminal always give the `simple` layout without colour, whatever the setting, so scripts and pipes see one format; `--json` is untouched. `boxed` falls back to `simple` when the terminal is narrower than the table.
- **One table helper draws both** (`src/cli/table.ts`), no new dependency; each style has goldens for `list`, `status` and `stats`. Step 4 builds `simple`, and `boxed` in 4f with the other polish, or later if the owner prefers.

**Decided by the owner on 2026-11-18, as recommended.** The boards show `simple` with B's colours (LibraryStyleMiddle) and `boxed` as A (LibraryStyleBordered); the other CLI boards draw the layout without B's shading and tags, which the implementation adds.

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

**Decided by the owner on 2026-11-18, as recommended** (G1 with `review.json` added, from G16; G3 with the additions on the owner's questions). Written into COMMANDS.md ("The library folder", "Git", `quiz library review`, `take`, `register`, `list`, `info`), TECHNICAL_DESIGN.md and USER_DESIGN.md, 4.4.

**G2. What `library.toml` holds.** **Recommendation:** `format`, `version = 2`, `created`, and one table per quiz: `name`, `id`, `source` (the absolute path it was registered from, for the `changed` flag), `current` (a version hash), `versions = [{ hash, added }]` in order, `shelves = []` (step 5). No scores or counts: results files are the truth, and `list` reads them (0.x did, in milliseconds at this scale). Written atomically, sorted by name, so its diff reads well.

**Decided by the owner on 2026-11-18, as recommended** (G1 with `review.json` added, from G16; G3 with the additions on the owner's questions). Written into COMMANDS.md ("The library folder", "Git", `quiz library review`, `take`, `register`, `list`, `info`), TECHNICAL_DESIGN.md and USER_DESIGN.md, 4.4.

**G3. Git.** **Recommendation:** fullmark runs the `git` on the path through one small runner (`src/library/git.ts`), passing names after `--`; each changing command makes **one** commit, message `fullmark: <command> <name>` (e.g. `fullmark: take signals`), with the user's own git identity, falling back to `fullmark <fullmark@localhost>` when none is set. A failed commit is a **warning**, not a failure: the files are written, the exit code is the command's, and `status` lists the uncommitted changes. No `git` on the path: `init` makes the folder without a repository, as `--no-git` does, with a warning; `rm` then needs `--force`, as designed.

*Owner's questions (2026-11-18): where does git run from, and is that set per library (`library.toml`) or per machine (`config.toml`)? Is the git identity part of setup, a warning or `status`? Does fullmark run `git init`, or does the user do their own git?* **Recommendation, added:**
- **Which repository:** always the library's root (`git -C ROOT`), where ROOT comes from `FULLMARK_LIBRARY` or `library` in `config.toml`. The library is its own repository: `init` runs `git init` there (unless `--no-git`), writes `.gitignore` and makes the first commit, `fullmark: init`. An existing repository is adopted only when the folder is its root; a folder inside another repository gets its own, with a note that the outer one should ignore it.
- **Which `git`:** the one on the path, or `git = "PATH"` in `config.toml` when set (Git installed off the path, as GitHub Desktop does on Windows). Never in `library.toml`: that file travels with the repository to other machines, where the path differs.
- **Identity:** not asked for, never written into git's config. `init` and `status` say which identity commits use; when git has none for the library, `init` prints a note with the command to set one (`git -C ROOT config user.name "…"` and `user.email`), and commits pass `fullmark <fullmark@localhost>` for that commit only (`-c user.name=… -c user.email=…`). `status` shows it as a note, never a problem.
- **What fullmark does with git, and nothing more:** `init`, and one commit per changing command holding **only the paths it wrote** (`git commit -- PATHS`), so the user's own staged or unstaged changes in the library are never swept in. It never pushes, pulls, fetches, branches, rebases or rewrites history; remotes, sync between machines and conflicts are the user's own git. `status` reads the repository (uncommitted changes, remote) and changes nothing.

**Decided by the owner on 2026-11-18, as recommended** (G1 with `review.json` added, from G16; G3 with the additions on the owner's questions). Written into COMMANDS.md ("The library folder", "Git", `quiz library review`, `take`, `register`, `list`, `info`), TECHNICAL_DESIGN.md and USER_DESIGN.md, 4.4.

**G16. Reviews in the library.** The design has `quiz review` on a file and `register --review REVIEW`, but no review of a quiz already in the library, and no place for its verdicts. **Recommendation:**
- **`quiz library review NAME [--since] [--timeout SECONDS] [--port N] [--no-open] [--json]`**: `quiz review` with the lookup done, as `library replay` is `quiz replay`. It serves the review form on the current version; `--since` asks only what is new or changed since the stored review. Finish writes, under the lock, and commits (`fullmark: review NAME`).
- **Saved at `quizzes/<id>/review.json`**: one review per quiz, not per version. `review-v2` already keys each verdict by question id with the question's hash, and merges, so one file follows the quiz across versions; git keeps its history.
- **An edit is the same quiz, a new version.** The id stays (G12) and the question ids stay, so attempts, `--missed` and `stats` carry over: a fixed question has a new hash, and `--missed` marks it changed (G5); a dropped question is gone (counted in `gone`). The edit is made on the original source, or on a copy from `share --source`, and comes back with `register FILE --update NAME`. A new quiz (new id, no history) is only made on purpose, with `quiz new --from`.
- **`register --update` applies the stored review** as `check --review` does: `review.fix` and `review.drop` refuse the version until every flagged question has changed or gone (exit `1`), and `review.unconfirmed` warns until a `library review NAME --since` judges it again. `--review REVIEW` given explicitly replaces the stored one for that run.
- **`list` and `info`** gain a field `flagged`: the count of `fix` and `drop` verdicts still open on the current version (added, never renamed, as `list`'s fields promise).
- **In slice 4f**, with `share`.

**Decided by the owner on 2026-11-18, as recommended** (G1 with `review.json` added, from G16; G3 with the additions on the owner's questions). Written into COMMANDS.md ("The library folder", "Git", `quiz library review`, `take`, `register`, `list`, `info`), TECHNICAL_DESIGN.md and USER_DESIGN.md, 4.4.

**G17. Resuming an attempt after `register --update`.** COMMANDS.md says an attempt saved on the old version "stays tied to the version it started on", and G4 resumes only "the same version": so after an update, `take` builds the new current version and the saved attempt can never be resumed. **Recommendation:** a plain `take` (no `--section`, `--missed`) resumes a saved attempt on any version, oldest saved first, saying so ("resuming your attempt of 18 Nov 14:02 on version 41c0; the quiz has been updated since"); it is filed against that version; the next `take` uses the current one. `register --update`'s warning says this (drawn on LibrarySetup).

**Decided by the owner on 2026-11-18, as recommended** (G1 with `review.json` added, from G16; G3 with the additions on the owner's questions). Written into COMMANDS.md ("The library folder", "Git", `quiz library review`, `take`, `register`, `list`, `info`), TECHNICAL_DESIGN.md and USER_DESIGN.md, 4.4.

**G7. The output of the reading commands.** *Drawn on the canvas (2026-11-18), row "CLI: quiz library (G7, G15)": LibraryList, LibraryInfo, LibraryStatus. Done differently from the recommendation below: `list`'s marks are a last column, NOTES ("source changed", "1 ungraded", and "public" from step 5), not marks after the name, so the name column stays a plain name to copy; a score with grades pending carries an asterisk, as on the page.* `list`, `info` and `status` have `--plain` and `--json`; their terminal look is not drawn. **Recommendation:** the look of `stats` and `inspect` (step 3): a heading line, aligned columns, `--plain` with no colour; `list` one row per quiz, sorted by name, columns name, title, versions, attempts, last, best, taken, with `changed` and `ungraded` as marks after the name. No board: the goldens are the review.

**Decided by the owner on 2026-11-18: the CLI boards approved.** Their text is written into COMMANDS.md under each library command ("Output") and "How library commands print". Done differently from the boards: stamps carry seconds (`20261118-142212`), as the library folder names results; a run error prints `error: MESSAGE` in plain text where the board shows a red `error`; `list`'s NOTES also takes `N flagged` (G16); `quiz library review`, decided after the boards, has a sample in their style.

**G15. The output of every other library command.** *Drawn on the canvas (2026-11-18): LibrarySetup, LibraryTake, LibraryGrade, LibraryTidy, with the missing `--json` shapes. The common shape: a bold heading naming the quiz, attempt and version; one coloured verb per outcome (`registered`, `filed`, `report`, `written`, `deleted`); findings in `check`'s issue format with `fix:`; then, dim, `next:` and `committed <hash> <message>`. Once approved, the planner writes them into COMMANDS.md.* G7 covers `list`, `info` and `status`; the human output of `init`, `register`, `take`, `replay`, `grade`, `share`, `template add`, `rename`, `rm` and `path` is not drawn, and `init`, `share`, `rename`, `rm` and `path` have no `--json` shape (`library stats`'s is presumably `quiz stats`'s; `take`'s `status` values are not listed). **Recommendation:** before 4b, the planner writes a text sample and a `--json` shape for every library command into COMMANDS.md, in the style of `inspect` (G7), as one commit for the owner to read; the slices then build to them and the goldens check them.

**Decided by the owner on 2026-11-18: the CLI boards approved.** Their text is written into COMMANDS.md under each library command ("Output") and "How library commands print". Done differently from the boards: stamps carry seconds (`20261118-142212`), as the library folder names results; a run error prints `error: MESSAGE` in plain text where the board shows a red `error`; `list`'s NOTES also takes `N flagged` (G16); `quiz library review`, decided after the boards, has a sample in their style.

**G19. `content.names-control`'s level in `draft` and `exam`.** 4a's brief said "`warning` in every built-in profile"; the rule was built as every quality warning is, so the built-in profiles map it as they map the others: info under `draft`, error under `exam` (a question naming "press" fails `check` under `exam`). **Recommendation:** keep it so, as built: one mechanism for every quality rule, and an exam is the quiz most likely printed, where naming a button matters most. The catalogue row says "warning", which is the default level, and stays true.

**Decided by the owner on 2026-11-18, as recommended.** Written into TECHNICAL_DESIGN.md, section 5, the rule's row.

**G20. Which tests a slice runs** (raised by the owner during 4a's review: should a library slice test only the library?). **Recommendation:** every slice runs the build, the typecheck, Biome, knip and all of Vitest, whatever it touches: the library uses core, and the command-graph, startup and golden tests are what catch a library slice breaking `check`. Playwright, in Chromium and Firefox, runs only for a slice that touches the page, the server, a form or a built page (`src/page/`, `src/serve/`, `src/build/`, the form folders): in step 4, **4d** (`take`, `replay`), **4e** (`grade --web`) and **4f** (the samples, acceptance), and not 4b or 4c. The last slice runs everything before step 4 is accepted. While building, an agent runs the tests it works on; the review runs the set above.

**Decided by the owner on 2026-11-18, as recommended.** Written into STEP4.md, "Rules for every slice".

**G21. Two `init`s of the same new folder.** Raised in 4b's review, from the agent's report: `init` decides what the folder is (new, empty, a library, refused) before it takes the lock, and takes the lock only to write. Two `init`s of one new folder started together can both decide "new"; the second waits for the lock, then writes over the first's `library.toml` and makes a second commit. **Recommendation:** `init` takes the lock as soon as the folder exists (creating it first when missing) and decides what the folder is under the lock, so the second `init` finds a library and adopts it. A test runs two `init`s together and finds one `created`, one `adopted`, one commit. The first task of 4c's brief.

**Decided by the owner on 2026-11-18, as recommended.** Written into COMMANDS.md, `quiz library init`.

**G22. Each version's file name.** Raised in 4c's review: `library.toml` records one `source` per quiz, the latest; `status` looks for every version's source under that file's name, so after `register week2.md --update rust-basics` the versions stored as `quiz.md` are reported damaged (`library.hash`), with a `git checkout` fix that cannot help. `loadStored` works around it by trying every `.md` in the folder. **Recommendation:** record it: `versions = [{ hash, added, file }]`, `file` being the source's name in the version folder; `register` writes it, and `status`, `info`, `list` and every later command read the source by it, never by searching. `library.toml` stays version 2 (no library exists yet outside tests); the history fixture is regenerated by its helper. The first task of 4d's brief, with a test of exactly this case.

**Decided by the owner on 2026-11-18, as recommended.** Written into COMMANDS.md, "The library folder".


**G23. Where the serving process is recorded.** COMMANDS.md (`library take`, "The lock") says the progress file holds the serving process's id and URL; the brief, and the build, keep them in `progress/<version>.serving.json` beside it, so the progress file stays a `results-v2` document as `serve --autosave` writes it, and a submit waits in `progress/<version>.submitted.json` until it is filed. The resume line also reads differently: built, the heading names the version (`version 41c0 · resuming your attempt of 18 Nov 14:02 (7 of 18 answered); the quiz has been updated since (now 9f3a)`), where COMMANDS.md's prose has "on version 41c0". **Recommendation:** COMMANDS.md follows the build: the three files of `progress/` named in "The library folder" and in `take`, and the resume line as built.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, "The library folder" and `quiz library take` ("Autosave and resume", "The lock"). No code: the build already does it.

**G24. A `--section` or `--missed` take while an attempt of that version is saved.** Both use `progress/<version>.json`; the build serves the new attempt **without autosave**, says so ("this attempt is not saved: another attempt of this version is in progress and is left alone"), and a Ctrl+C loses it. **Recommendation:** accept as built: the saved attempt is never touched, the learner is told, and a second saved attempt per version would need a choice of which to resume that the design does not have.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library take` ("Autosave and resume"). No code: the build already does it.

**G25. A saved `--missed` attempt resumed by a plain `take`.** A `--missed` take interrupted is saved like any other; the next plain `take` resumes it with its plan (the missed questions), but without the "changed since you missed it" marks, since a plain page has no `changed`. **Recommendation:** when the attempt resumed has `plan.source` `missed`, `take` works the marks out again for those questions (`missedOf` against the version resumed) and serves them, so a resumed attempt looks as it did; a test resumes one.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library take` ("Autosave and resume"). Built first in 4e.

**G26. A take that files a leftover submit.** When `take` finds a `submitted.json` left by an earlier take (the lock was busy, or the process died), it files it and ends (exit 0) without serving. **Recommendation:** accept, with one more line after the commit, `next: quiz library take NAME` to start a new attempt, so the learner is not left wondering why no page opened.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library take` ("The lock" and the Output). Built first in 4e.

**G27. Where `library grade --json` writes the grades template.** COMMANDS.md says "with `--json`, also the grades template" and gives it a `template` field, but not where. It cannot go in `grades/`: every file there is kept and the newest counts, so an empty template would count as the newest grades. **Recommendation:** in the working directory, as `<name>-<stamp>-grades.json` (`ielts-writing-20261115-093012-grades.json`), never overwritten: an existing one is skipped with `quiz grade --json`'s warning. `--grades` then takes that file once it is filled, and keeps a copy in `grades/`.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library grade`.

**G28. Which attempt `library grade` grades without `--attempt`.** COMMANDS.md gives no default; `replay`'s is the newest. **Recommendation:** the newest attempt with an essay or code answer still waiting for a grade; when none is waiting, the newest attempt. So `take`'s `next: quiz library grade NAME --web` grades the attempt just filed, and with several ungraded, the plain command works back from the newest. The heading names the attempt, as COMMANDS.md's sample does.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library grade`.

**G29. `library grade --web` and the lock.** The form waits up to 1800 s. Holding the lock all that time would block every other command, as G9 found for `take`. **Recommendation:** as `take` (G9): no lock while the form is served; once **Save grades** is pressed and checked, the grades file, the report and the commit are made under the lock. When the lock cannot be had in 10 s, the grades are written to `progress/<stamp>.grades.json` (git-ignored), and the command exits 2 saying they are safe; the next `library grade` of the quiz keeps them first, as `take` files a leftover submit (G26).

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library grade` and "The library folder".

**G30. Output cut short by a pipe.** `quiz library stats NAME | head -1`, and now and then `library list | head -1`, ends with an unhandled `EPIPE` stack trace on stderr and exit 1 once `head` has closed the pipe. This is not 4e's: the CLI's `io.out` writes to stdout with no handler for a closed pipe, and which command hits it depends on timing. **Recommendation:** when stdout is closed by its reader (`EPIPE`), the CLI stops writing and exits `0` with nothing on stderr, as most command-line tools do; one handler in `main.ts`, and a subprocess test piping `rules --all` and `library list` into a reader that closes after one line.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, "Exit codes". Built first in 4f.

**G31. The `next:` line after a template is written.** `library grade NAME --json` writes the template and then still prints `next: quiz library grade NAME --web, or --json for a grades template`, offering what was just done. **Recommendation:** when the template is written, the line is `next: fill in FILE, then quiz library grade NAME --grades FILE (or --web)`; unchanged otherwise. COMMANDS.md's `library grade` gains it.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library grade` ("The template"). Built first in 4f.

**G32. The form when the lock is busy at Save.** With `--web`, the grades are kept in `progress/` and the command exits 2 as G29 says, but the form still shows `quiz grade --web`'s "Grades saved" card, naming a file in `grades/` and a report that were not written. **Recommendation:** the server answers Save only after the keep is tried; when the lock was busy, the card says "Your grades are saved, but not filed yet: the library was busy. Run `quiz library grade NAME` to file them." (vi: "Điểm đã lưu nhưng chưa được ghi vào thư viện vì thư viện đang bận. Chạy `quiz library grade NAME` để ghi."), two keys in `src/core/i18n/grade.ts`; the plain card otherwise.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library grade` ("The lock"). Built first in 4f.

**G33. Worktrees under `.claude/` and Biome.** A git worktree an agent leaves under `.claude/worktrees/` carries its own `biome.json`, and `npm run lint` (so `npm run check`) then fails on every file with "nested root configuration". **Recommendation:** `biome.json` leaves out `.claude/` (`files.includes` gains `!.claude`), so a check never reads another checkout's files.

**Decided by the owner on 2026-11-19, as recommended.** A change to the repository's tooling, not the design: `biome.json` leaves out `.claude/`. Built first in 4f.

**G34. `library review` and the lock.** COMMANDS.md says **Finish** writes `review.json` "under the lock", but the form waits up to 1800 s, as `take`'s page and `grade --web`'s form do. **Recommendation:** as G29 and G32: no lock while the form is served; on **Finish**, the checked review is written to `progress/review.json` (git-ignored), then, under the lock, moved to `review.json` and committed. When the lock cannot be had in 10 s, it stays in `progress/`, the command exits 2 saying it is safe, the form's done card says it is saved but not filed yet (the words of G32, for a review), and the next `library review` of the quiz files it first, says so, and ends, with `next: quiz library review NAME`.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library review` ("The lock") and "The library folder".

**G35. The `fullmark.toml` of `share --source`.** COMMANDS.md: "a `fullmark.toml` with the custom profile the quiz uses, if any". A version stores its resolved rules in `check.json`, not the config they came from. **Recommendation:** when `check.json`'s profile is a built-in one with no change, no `fullmark.toml` is written. Otherwise one is written with `profile = NAME` and `[profiles.NAME]`, `extends` the built-in profile its chain starts from, and each rule whose level or options differ from that built-in's, sorted by id. A test checks the shared folder with `quiz check` and gets the same issues as under `check.json`.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library share`.

**G36. `share` into a place that holds something.** COMMANDS.md does not say. **Recommendation:** the page (`NAME.html`) is replaced, as `build` replaces its output. The `--source` folder (`DIR/NAME/`) is refused (exit 2) when it exists and is not empty, with the fix "choose another -o, or remove DIR/NAME", so an edited copy is never overwritten.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library share`.

**G37. `rm` while the quiz is open.** `rm` could delete a quiz while a `take`, `grade --web` or `review` of it is serving, or while it holds an attempt in progress or a leftover submit. **Recommendation:** refused (exit 1) while a `take` of the quiz is serving (its `serving.json` names a live process), "NAME is open in a take (pid N)", fix "finish or stop it, or add --force". Otherwise the folder goes with its `progress/`, and the question counts what is not in git: "delete chem-bonds (Chemical bonding): 2 versions, 6 attempts, 4 reports, 1 attempt in progress?" (the last only when there is one).

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library rm`.

**G38. `share --source` of a quiz registered with `--profile`.** G35 writes no `fullmark.toml` when the version's profile is a built-in one with no change. But a quiz registered with `register --profile exam`, whose own front matter names no profile, then comes out as a folder that `quiz check` checks under `default`, not `exam`: G35's own aim, "`quiz check` on the folder finds what the library found", fails. Tried by hand with `examples/calculus` (clean under both, so the findings agree only by chance). **Recommendation:** no `fullmark.toml` only when the folder would get the same profile anyway (the quiz's own `profile:`, else `default`); otherwise one with `profile = NAME`, and `[profiles.NAME]` only when the rules differ from the built-in's. A test registers under `exam` a quiz with an `exam`-only finding and checks the shared folder.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library share`. Built first in step 5.
