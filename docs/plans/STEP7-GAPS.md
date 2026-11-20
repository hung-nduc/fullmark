# Step 7: decided gaps

Every gap of step 7 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The plan is [STEP7.md](STEP7.md). Step 7 numbers its gaps from G1.

**G1. The guides are missing from 1.0.0** (found after step 6's install). COMMANDS.md specifies `quiz guide` and `quiz agent-guide`, but no step's plan built them, so 1.0.0 shipped without an authoring reference or agent instructions, and the `/quiz` skill, a link to the 0.x checkout's `skill/`, no longer loads. **Recommendation:** build them as a slice of their own, in a first form that prints the Markdown as it is (the styled terminal rendering and the pager later), together with a 1.0 `skill/SKILL.md`; meanwhile the CLI guides and the tldr page are rewritten for 1.0 and point agents at QUIZ_SYNTAX.md.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md (`quiz guide, quiz agent-guide`, "First form"). The CLI guides and the tldr page were rewritten the same day, outside this repository.

**G2. A Vietnamese authoring guide in 7a?** COMMANDS.md gives `quiz guide --lang vi`. Writing the guide twice doubles the slice and the review, and the English text will change during 7a's review. **Recommendation:** 7a writes English only; `--lang vi` prints the English guide with one line on stderr saying the Vietnamese guide is not written yet, and exits 0; the Vietnamese guide is its own slice once the English one is settled.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md (`quiz guide, quiz agent-guide`, "First form").

**G3. The version after 7a.** Two new commands is more than a fix. **Recommendation:** `1.1.0`. As with `1.0.0`, every built page names the version, so about 29 goldens change only in the version string, the byte count and a commit hash that follows from them, and are counted in the review.

**Decided by the owner on 2026-11-20, as recommended.** A release matter: written in slice 7a's brief.
