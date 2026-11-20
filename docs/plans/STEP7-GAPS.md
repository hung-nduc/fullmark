# Step 7: decided gaps

Every gap of step 7 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The plan is [STEP7.md](STEP7.md). Step 7 numbers its gaps from G1.

**G1. The guides are missing from 1.0.0** (found after step 6's install). COMMANDS.md specifies `quiz guide` and `quiz agent-guide`, but no step's plan built them, so 1.0.0 shipped without an authoring reference or agent instructions, and the `/quiz` skill, a link to the 0.x checkout's `skill/`, no longer loads. **Recommendation:** build them as a slice of their own, in a first form that prints the Markdown as it is (the styled terminal rendering and the pager later), together with a 1.0 `skill/SKILL.md`; meanwhile the CLI guides and the tldr page are rewritten for 1.0 and point agents at QUIZ_SYNTAX.md.

**Decided by the owner on 2026-11-20, as recommended.** Written into COMMANDS.md (`quiz guide, quiz agent-guide`, "First form"). The CLI guides and the tldr page were rewritten the same day, outside this repository.
