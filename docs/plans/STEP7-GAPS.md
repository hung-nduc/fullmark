# Step 7: decided gaps

Every gap of step 7 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The plan is [STEP7.md](STEP7.md). Step 7 numbers its gaps from G1.

**G1. The guides are missing from 1.0.0** (found after step 6's install). COMMANDS.md specifies `quiz guide` and `quiz agent-guide`, but no step's plan built them, so 1.0.0 shipped without an authoring reference or agent instructions, and the `/quiz` skill, a link to the 0.x checkout's `skill/`, no longer loads. **Recommendation:** build them as a slice of their own, in a first form that prints the Markdown as it is (the styled terminal rendering and the pager later), together with a 1.0 `skill/SKILL.md`; meanwhile the CLI guides and the tldr page are rewritten for 1.0 and point agents at QUIZ_SYNTAX.md.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md (`quiz guide, quiz agent-guide`, "First form"). The CLI guides and the tldr page were rewritten the same day, outside this repository.

**G2. A Vietnamese authoring guide in 7a?** COMMANDS.md gives `quiz guide --lang vi`. Writing the guide twice doubles the slice and the review, and the English text will change during 7a's review. **Recommendation:** 7a writes English only; `--lang vi` prints the English guide with one line on stderr saying the Vietnamese guide is not written yet, and exits 0; the Vietnamese guide is its own slice once the English one is settled.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md (`quiz guide, quiz agent-guide`, "First form").

**G3. The version after 7a.** Two new commands is more than a fix. **Recommendation:** `1.1.0`. As with `1.0.0`, every built page names the version, so about 29 goldens change only in the version string, the byte count and a commit hash that follows from them, and are counted in the review.

**Decided by the owner on 2026-11-20, as recommended.** A release matter: written in slice 7a's brief.

**G6. Tab completion's shells** (the owner, after step 6's proposals check suggested `proposals/cli-integration.md`). The proposal covers PowerShell, bash, zsh, fish and nushell, a Starship segment and a tldr page in the repository. **Recommendation:** the smaller option, completion only, for PowerShell and Git Bash.

**Decided by the owner on 2026-11-20:** completion for **PowerShell, bash (Git Bash), zsh and fish**, as the proposal designs it (`quiz __complete` holds the logic once; `quiz shell-init SHELL` prints a short shim per shell, zsh and fish with descriptions). Not nushell, and not the tldr page's move. The Starship segment is G9. Written into COMMANDS.md with slice 7b's brief.

**G7. Where zsh and fish get a real Tab test.** This laptop has PowerShell and Git Bash only. **Recommendation:** the agent tests the zsh and fish scripts' text and every `__complete` answer here; the real Tab test runs once on a lab workstation (`ibmelabc05` or `ibmelab-pc`) over SSH, if zsh and fish are there, with the owner's yes at the time. Not installing them on Windows (MSYS2) only for a test.

**Decided by the owner on 2026-11-20, as recommended.** Written in slice 7b's brief.

**G8. Which branch is fullmark.** Until now `main` held the Python prototype and was not touched, and 1.0 was built on `1.0`. `main` was an ancestor of `1.0` (nothing on `main` that `1.0` lacked), so moving it was a fast-forward; document-kit and presentation-kit depend on the separate `fullmark-py` repository, not on this `main`. **Recommendation:** fast-forward `main` to 1.0 and work on `main`; 0.x stays at the tag `v0.10.2`; delete `1.0` later.

**Decided by the owner on 2026-11-20, as recommended:** the owner fast-forwarded `main` and pushed `main` and `1.0` (GitHub now names the repository `hung-nduc/fullmark`; `origin` was pointed there). Written into CLAUDE.md, README.md and STEP7.md's Handoff.

**G9. The Starship segment.** The proposal (`proposals/cli-integration.md`, section 4) shows `📚 FOLDER` anywhere inside a library "so it is clear where `quiz library ...` will act", but library commands never look at the current folder: they act on the configured library, or on `FULLMARK_LIBRARY`. Inside another library's folder the segment would mislead. **Recommendation:** leave the walk-up hook out and correct the proposal; the case worth showing, `FULLMARK_LIBRARY` set in this shell, needs no fullmark code (Starship's `env_var` module).

**Decided by the owner on 2026-11-20, as recommended.** The proposal's status and section 4 corrected.

**G12. The start screen has no Appearance menu.** The `Start` board draws a header bar on the start screen ("Practice quiz · version a3f9" on the left, A− / A+ and **Appearance** on the right), but slice 2g's brief said to ignore them there (archive/STEP2.md, its "Read first"), and the slice that built the menu put it only in the top bar shown after Start. Nothing decided to leave it out: it slipped. It matters most for a timed quiz, where the clock starts at Start, so a learner who needs Readable or a bigger size spends exam time on it. **Recommendation:** the start screen gets the same Appearance menu and A− / A+ as the top bar, where the board draws them, under the same `look` rules (none of it under `locked`, A− / A+ always), sharing the stored choice, so a choice made before Start holds after it. A small slice (7c), with a test that a font picked on the start screen is the one used after Start; the screenshots go in `docs/screens/7c/`.

**Decided by the owner on 2026-11-20, as recommended.** Written into TECHNICAL_DESIGN.md, section 8, "The look" (**Where they are**); slice 7c builds it.

**G13. The version after 7c.** 7c fixes a slip (the board drew the bar; no slice built it) and adds no command or key. **Recommendation:** `1.1.1` if 7c ships before 7b, so 7b stays `1.2.0` (G10); every page golden changes anyway with the bundle, and the version string adds only to those already changing.

**Decided by the owner on 2026-11-20, as recommended:** 7c is `1.1.1`. Written in slice 7c's brief.

**G14. The start bar makes the start screen scroll at 390 × 844** (7c's review, below). `e2e/foot.spec.ts` fails in both browsers: a short quiz's start screen is 865 px tall at 390 × 844 (800 px before; the bar is 65 px). The design asks only that the ⓘ button be at the foot, never over content, which holds; fitting the window was the test's assumption, and making the bar fit is not enough (−12 px and −20 px still leave 1 px over). The bar also sits 12 px below the window's top, where the board draws it flush. **Recommendation:** a phone's start screen may scroll: the test keeps "fits the window" for desktop and checks the button at the page's end on the three phones; and the bar goes flush with the top (no `.fm-quiz` top padding before Start), one goldens round for it.

**Decided by the owner on 2026-11-21, as recommended.** Written into TECHNICAL_DESIGN.md, section 8, "The look" (**Where they are**); built in 7c's follow-up.
