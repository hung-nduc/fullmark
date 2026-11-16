# Step 4: decided gaps

Every gap of step 4 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The open ones are in [STEP4.md](STEP4.md), "Gaps". Step 4 numbers its gaps from G1 (step 3's G1 to G148 are in [archive/STEP3-GAPS.md](archive/STEP3-GAPS.md)).

**1.0 and 0.x's `config.toml` (raised in the plan, before gaps were numbered from G1).** **Decided by the owner on 2026-11-16:** 1.0 makes no provision for 0.x: it reads and writes its own `config.toml` and its own library (`library.toml` version 2), and a 0.x library is refused like any other foreign folder (TECHNICAL_DESIGN.md, section 1, "No compatibility with 0.x"). Nothing to build beyond that.
