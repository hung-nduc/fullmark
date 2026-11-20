# Step 7: the guides

## Handoff (2026-11-20): start here

A new session picks up from this section alone; it needs no earlier chat.

### How the work runs

As in step 6 ([archive/STEP6.md](archive/STEP6.md), Handoff): the planner writes a slice's full brief here, commits it, and hands it to **one implementing agent** (on Sonnet) once the owner approves it; the agent implements and commits (never pushes) and reports; the planner reviews and brings every gap to the owner with a recommendation; the owner decides; decisions go into `docs/design/` as plain statements. Commit after every round. Gaps are numbered from **G1**; decided ones move to [STEP7-GAPS.md](STEP7-GAPS.md).

**Nothing is pushed:** this machine has no GitHub credentials; the owner pushes `1.0`.

### Where it stands

| Slice | State | Commits |
|---|---|---|
| plan | written (2026-11-20); G1 to G3 decided as recommended (2026-11-20), G1 and G2 written into COMMANDS.md | this file |
| 7a | approved by the owner (2026-11-20); handed to one agent | |

### Next

1. **Approved (2026-11-20):** 7a is with its agent; next, the planner reviews it.
2. After 7a's review: fast-forward `1.0`, pack and reinstall from the tarball as in step 6, and check that the `/quiz` skill loads again.

## Goal

fullmark 1.0.0 was installed (step 6) without `quiz guide` and `quiz agent-guide`, which COMMANDS.md specifies but no step's plan built. An agent using `quiz` therefore has no authoring reference from the tool, and the owner's Claude Code skill `/quiz` (a link to `D:\coding-projects\fullmark\skill`, which existed only on `main`, 0.x) no longer loads. Meanwhile the CLI guides and the tldr page point agents at `docs/design/QUIZ_SYNTAX.md`. **Done when** both commands print their guides from the installed package, every syntax example in the authoring guide passes `check`, and the `/quiz` skill loads from branch `1.0` and works with the 1.0 commands.

## Rules for every slice

Step 6's rules hold ([archive/STEP6.md](archive/STEP6.md), "Rules for every slice", extending step 5's and earlier). Windows counts; never run a second Vitest beside a running one.

## Gaps

G1 to G3 are decided ([STEP7-GAPS.md](STEP7-GAPS.md)). New ones are added here from G4.

## Slices

| Slice | Content | Needs |
|---|---|---|
| **7a** | `quiz guide`, `quiz agent-guide`, the authoring guide, `AGENTS.md`, `skill/SKILL.md` | G1 to G3 |

## Slice 7a: the guides and the skill

**Briefed on 2026-11-20 from G1 to G3, decided by the owner as recommended.** What the commands do is written in COMMANDS.md (`quiz guide`, `quiz agent-guide`, and its "First form" paragraph); what the agent rules say is in USER_DESIGN.md ("Rules in `AGENTS.md`") and TECHNICAL_DESIGN.md (section 5, "Rules for agents"; section 6, grader identity; section 7, "Seams for later features", the `quiz-example` blocks).

### Read first

- This plan; COMMANDS.md: `quiz guide, quiz agent-guide`, `quiz brief`, `check`, `serve`, `review`, `grade`, the library commands (for the skill's workflow); USER_DESIGN.md, sections on roles and "Rules in `AGENTS.md`"; QUIZ_SYNTAX.md, all of it.
- 0.x's versions, for shape only (they describe 0.x commands and syntax; never copy a command or a syntax rule from them without checking it against 1.0): `git show main:skill/SKILL.md`, `git show main:AGENTS.md`, `git show main:docs/GUIDE.md`.
- `test/cli-graph.test.ts` and the startup tests: what a command may load.

### Tasks

1. **The authoring guide** (`guide/GUIDE.md`, English only: G2). Written for an author, not a designer: from QUIZ_SYNTAX.md, every question type with a minimal example, the front matter, sections, banks, materials, assets, maths and code, and how `check` and profiles hold a quiz to rules. Every syntax example is a fenced `quiz-example` block holding a valid quiz or quiz fragment, as TECHNICAL_DESIGN.md section 7 says. Where QUIZ_SYNTAX.md and the parser disagree, the parser is not changed: report it as a gap.
2. **`AGENTS.md`** (English): the rules of USER_DESIGN.md's table, each with its one-line why; the grading contract (fill only the questions you were given, leave the rest `null`, `grader` and `reviewed` as TECHNICAL_DESIGN.md section 6 says); the JSON formats by name with their schema files; exit codes (3 means ask the user). It refers to `quiz guide` for the syntax and never repeats it.
3. **The commands.** `quiz guide [--lang en|vi] [--plain] [--no-pager]` and `quiz agent-guide [--plain] [--no-pager]` print their file as it is (COMMANDS.md, "First form"), read from the installed package (both files added to `package.json`'s `files`; resolved from `dist/`, so they work from any folder after `npm install -g` of the tarball). Each is its own chunk and loads nothing of the page builder, the server or the library: extend `test/cli-graph.test.ts`. Goldens for both, with `--plain`, `--no-pager`, and `--lang vi` (the English guide, a note on stderr, exit 0: COMMANDS.md, G2).
4. **The guide's examples pass.** A test extracts every `quiz-example` block from `guide/GUIDE.md` and runs it through the same `check` as the CLI; any failure names the block's line. A fragment that is not a whole quiz is wrapped the same way for every block (say how).
5. **The skill** (`skill/SKILL.md`): the 0.x skill's workflow redone for 1.0. Front matter `name: quiz` and a description of when to use it. It sends the agent to `quiz agent-guide` and `quiz guide` before writing or grading, and covers: the brief (`quiz brief`, exit 3 means ask, `--web` for the form), make (template or `new --from`, write, `check --strict`, `inspect`), review (`quiz review`, then `check --review`), the library (`library status --json`, `register --json`, never `init` unasked, end with the `quiz library take NAME` line), take and retry (`library take`, `--missed`, `--dry-run`), and grading (`grade` / `library grade` with `--json`, then `--grades`). Every command and flag in it is one that `quiz --help` lists: a test checks the skill's commands against the CLI's own help, so the skill cannot drift from the tool.
6. **The version becomes `1.1.0`** (G3), then `npm run golden:update`: list every changed golden and show that each differs only in the version, the byte count and the commit hash that follows from them.

### Done when

- On Windows, nothing else running: `npm run build`, then `npm run check` passes. Report each part's counts and times.
- `npm pack` lists `guide/GUIDE.md`, `AGENTS.md` and nothing else new; installed from the tarball into a temporary prefix (`npm install -g --prefix TMP`, not over the owner's install), `quiz guide` and `quiz agent-guide` print from any folder.
- The new goldens are listed; the changed ones are explained (task 6); no other golden changes.
- One commit per task or a few; explicit paths; the model's `Co-Authored-By` line; no push.

### Report

What was done per task, anything done differently and why, every place QUIZ_SYNTAX.md and the parser disagreed, the changed goldens, the counts and times, and any new gap (from G4) with a recommendation.
