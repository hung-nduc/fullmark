# Working with fullmark: instructions for AI agents

fullmark turns one Markdown file into one offline, self-grading HTML quiz. Its program is `quiz` (also `fullmark`). This file, printed by `quiz agent-guide`, holds the rules an agent follows, the grading contract, the JSON formats and the exit codes. It does not repeat the quiz syntax: run `quiz guide` before you write a quiz, and do not write syntax from memory. Every flag is in `quiz --help` and `quiz COMMAND --help`, which are always current.

`quiz agent-guide > AGENTS.md` writes this file as it is.

## 1. The rules

The owner of the quiz decides some things, and the tool enforces it. Each rule below says what to do and, in one line, why.

| Rule | Why |
|---|---|
| Read every page of the material, as text and as an image | Slides and scans carry figures, tables and formulas that the text layer loses |
| Never run `quiz library init` unasked, and pass `--into` to `quiz library import` only when the user named the place | The library's location is the owner's choice |
| Run `quiz library rm` and `quiz library rename` only on request, one quiz at a time | Both change history the owner cares about |
| Never pass `--yes` or `--force` | They skip the confirmation and the safety checks that exist for the owner to see |
| Set `generated_by` in the front matter of a quiz you wrote, naming the agent and the exact model id. `check` warns when a quiz written from a brief lacks it (`brief.generated-by`) | The owner can tell which quizzes an AI wrote |
| Never change `profile:`, edit `fullmark.toml` or add a `check-ignore` to make `check` pass: fix the quiz | The check rules are the owner's |
| Write every part of a quiz (description, section intros, questions, hints, explanations, rubrics, materials) so it holds on the page and on the paper alike: never name a control of the page or say when the page shows something | The same text is printed with `quiz build --print`, where there is no button, and the page explains its own controls in the learner's language |
| When the user cannot reach your `127.0.0.1`, do not start a one-shot server (section 5). Ask in chat, or hand over the built page and wait for an exported results file | A server on a machine the user cannot reach only times out |
| After `quiz library register`, end your message with the command that starts the quiz, for example `quiz library take NAME` | The learner should not have to look it up |
| Match on rule ids, JSON keys and exit codes, never on message text | They do not change with the language |

More rules that follow from the same idea:

- **Purpose and scope of a quiz are the user's.** `quiz brief` exits 3 until both are given. Ask the user, or open the form with `quiz brief DIR --web`. Pass `--accept-defaults` only when the user handed those choices over, and say what it chose.
- **The learner judges the quiz.** Never write or edit `review.json`: it is the learner's verdict, written only by `quiz review` (or `quiz library review`). Fix what a review flags by changing the quiz source, then run `quiz check quiz.md --review review.json`.
- **Never push.** The library commits after every change and leaves pushing to the user. Never edit the files inside the library by hand.
- **Never describe a quiz as secure.** The answer key is inside the page, only obfuscated.
- **Never run a learner's code.** Code answers are judged by reading.
- **Do not run `quiz build --watch`** unless the user asks: it keeps running.

## 2. The grading contract

`quiz grade` and `quiz library grade` score what a machine can score. Essays and code are graded by a grader, an AI or a human, from a grades template. When you are the grader:

1. Get the template: `quiz grade results.json --quiz quiz.md --json` (or `quiz library grade NAME --json`). It writes the report and a `*-grades.json` template, and never overwrites a grades file that exists.
2. Read each answer against its rubric, in the template's `criteria` (or `bullets` for a holistic rubric). Fill only the `null` cells of the questions you were given, and leave every other question `null`. You cannot add criteria or change a maximum.
3. Give components, never totals: a score per criterion (`additive`), a band per criterion (`banded`), or one `score` and a verdict per bullet (`holistic`). The tool adds, weights and rounds; do not compute a total yourself.
4. Write a `note` for every criterion scored below its maximum (a band below `scale.max`): a lost mark must say what was missing. A holistic grade needs a `justification`. Add one concrete `improvement` where you can.
5. Set `grader` to who you are: `{"kind": "ai", "name": ..., "model": ..., "at": ...}`, with the exact model id as your environment states it. If the file already has a `grader` (another grader filled some questions), put yours on each question you fill, in that question's own `grader`. A human who grades over an AI's grades records `reviewed`; do not write it yourself.
6. Fold the grades in: `quiz grade results.json --quiz quiz.md --grades results-grades.json` (or `quiz library grade NAME --grades FILE`). It validates, exits 1 with every problem listed when something is wrong, and writes the final report. Fix the file and run it again.
7. Then tell the learner the weak tags first, what to revisit, and a correction for each wrong answer. Do not edit the learner's answers.

A question left entirely `null` stays pending; a question filled in part is an error.

## 3. The files and their formats

Every JSON file fullmark writes carries `format` and `version`, and ignores keys it does not know. Their JSON Schemas ship with the package, in its `dist/schemas/` folder (in the repository, `schemas/`):

| File | Format | Schema |
|---|---|---|
| `*-results-*.json`: an attempt, from the page, `quiz serve` or `quiz library take` | `results-v2` | `results-v2.schema.json` |
| `*-report.json`: the graded attempt, from `quiz grade --json` | `report-v2` | `report-v2.schema.json` |
| `*-grades.json`: the grader's identity and the grades, template from `quiz grade --json` | `grades-v2` | `grades-v2.schema.json` |
| `review.json`: keep, fix or drop per question, written only by `quiz review` | `review-v2` | `review-v2.schema.json` |
| `fullmark-shelf.json`: a published shelf's manifest | `fullmark-shelf-v2` | `fullmark-shelf-v2.schema.json` |

Other files: `quiz.md` and `assets/` (the author's, syntax in `quiz guide`); `brief.yaml` and `content/` (from `quiz brief`; read `brief.yaml` before asking the user anything it already says); `fullmark.toml`, `config.toml` and `build.toml` (the user's; never edit `fullmark.toml` to pass `check`). Three data formats only: TOML for configuration, YAML for content people write, JSON for what the tool or the page writes. 0.x files are not read.

With `--json` a command prints one JSON object (or one per file) and never prompts, with human text on stderr. A failure to run is `{"status": "error", "message"}`.

## 4. Exit codes

| Code | Meaning |
|---|---|
| `0` | Done. Warnings may have been printed |
| `1` | Problems found: check errors, a refused quiz, invalid grades, a results file taken on another version of the quiz |
| `2` | Usage or I/O error, a timeout, or nothing to work on (for a library command: no library) |
| `3` | **Needs input: a value only the user may give is missing.** The output says which value and how to provide it. Ask the user, or open the form the output names. Never fill the value in yourself |

Decide from the code first, then read the `--json` output.

## 5. Running a one-shot server in the background

`quiz serve`, `quiz review`, `quiz brief --web`, `quiz grade --web` and `quiz library take` serve a page on `127.0.0.1`, wait for one submit and exit. Run them with `--json` in your background runner, so your own session is not blocked:

1. The first line is `{"status": "listening", "url", "port", "pid"}`. Pass the URL on to the user at once.
2. The last line is `{"status": "submitted", ...}` or the command's own status object, or `{"status": "timeout"}`. The exit code matches: `0` done, `2` timeout.
3. Read the file the last line names.

`quiz serve` takes the quiz `.md`, never a built page. `serve`, `review`, `brief --web` and `grade --web` wait 1800 seconds; `library take` waits forever.

## 6. Where to look next

- The quiz syntax, with an example of every question type, and how `check` and profiles hold a quiz to rules: `quiz guide`.
- Every command and flag: `quiz --help`, `quiz COMMAND --help`.
- Why a rule fired, and where its threshold comes from: `quiz rules RULE`.
