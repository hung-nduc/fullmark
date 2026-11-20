---
name: quiz
description: Make a self-grading HTML quiz, practice test or exam from study material with the `quiz` CLI (fullmark 1.x), take it, grade a learner's results (essays and code too), or review progress and weak topics over attempts. Use when the user wants a quiz, practice test, flashcard-style check or mock exam from notes, slides, a PDF, a chapter or a topic, or asks to grade, review or retry quiz results. Also for a questionnaire, survey or intake form with no score, whose answers come straight back with `quiz serve`. The output is one offline HTML file that opens by double-click.
---

# quiz

`quiz` turns a Markdown file into one self-contained HTML quiz (offline, phone-friendly) that grades itself and exports the learner's answers as JSON. You write the Markdown; the tool checks, builds and grades it.

This file is the workflow and the judgment. The syntax, the rules and every flag are in the tool, which is always current:

- `quiz agent-guide`: the rules for agents, the grading contract, the JSON formats and the exit codes. **Run it once per session before you write or grade.**
- `quiz guide`: the authoring reference, with a checked example of every question type. **Run it before you write a quiz, and do not write syntax from memory.**
- `quiz --help`, and `--help` after any command (`quiz library take --help`): every command and flag.

## Start from a brief

For a new quiz, look for `brief.yaml` in the quiz folder and read it before asking anything. It records the purpose, scope, material in `content/`, count, mix, difficulty, mode, weak topics (`focus_tags`: stress these), language and `request`. If `request` is filled in, do not ask the brief questions again.

- Purpose and scope are the user's. If there is no brief, run `quiz brief DIR --web --json` in the background, so the user answers in the form, and wait for its last line. Ask in chat only when the message already gives the purpose and the scope, or the user says to skip the form, and then pass them as flags: `quiz brief DIR --purpose self-study --scope "lectures 3 to 5, the Fourier transform" --json`.
- **Exit 3 means a value only the user may give is missing: ask the user, or open the form. Never fill it in yourself, and never pass `--accept-defaults` unless the user handed those choices over** (then list what it chose).
- When the user cannot reach your `127.0.0.1` (a sandbox, a remote session), do not run a form or a server. Ask in chat and pass the answers as flags.
- The brief's `focus_tags` is empty here: if it asks for weak topics, pick them from the learner's reports.
- `quiz check` warns when the quiz drifts from the brief (`brief.count`, `brief.mix`, `brief.mode`): fix the quiz, not the brief. When you are done, tell the user the brief values you used and offer a review.

## Make a quiz

1. **Read the material**, every page as text and as an image: slides and scans carry figures, tables and formulas that the text layer loses. Ask only what you cannot infer: topic, length, difficulty, language, time limit. Defaults: 10 to 15 questions, mixed types, untimed unless an exam is asked for. List the defaults you chose in your final message.
2. **Start from a template.** `quiz template list` shows the built-in ones and the user's own; `quiz new TEMPLATE FOLDER` copies one. Pick by shape:
   - `calculus`: maths, numeric answers
   - `rust`: code, blanks in code, code answers
   - `ielts`: timed essays with band scores
   - `medical`: ordering, matching, calculations with units
   - `exam`: closed book, a time limit, a question bank
   - `survey`: a questionnaire with no score
   - `blank`: one example of every type

   To reuse an earlier quiz's structure with new content: `quiz new --from quiz.md --skeleton FOLDER`.
3. **Write the questions** from the material, following `quiz guide`. Put the page or section in `source=` where you can. For drills, write extra questions and use a bank (`pick` on a section) so each attempt differs. Set `generated_by` in the front matter to your exact model id as your environment states it; if you do not know it, leave it out.
4. **Give every question an id:** `quiz ids quiz.md`.
5. **Check:** `quiz check quiz.md --strict` and fix every error and warning, including the quality rules (a short explanation, a correct choice much longer than the rest, an answer in the question text, answer positions that lean one way). Match on the rule id. Never change `profile:`, edit `fullmark.toml` or add a `check-ignore` to make it pass: fix the quiz. Re-run until it is clean.
6. **Inspect coverage:** `quiz inspect quiz.md` shows types, points, sections, tags and answer positions. Compare the tags with the material's topics, fill the gaps and spread the correct answers.
7. **Hand it over.** If there is a library, register the quiz (below). Otherwise `quiz build quiz.md --strict` writes `quiz.html` beside it (nothing is written when `check` finds errors); tell the user the path. The learner opens it, presses Submit, then Download results, and gives you the `results.json`. To print a paper instead: `quiz build quiz.md --print`. Do not run `quiz build quiz.md --watch` unless the user asks: it keeps running.

While the user watches you iterate, they can run `quiz build quiz.md --watch --serve`; that is theirs to start.

## Review what you wrote

An agent-written quiz can have a wrong answer key, or a question that is not in the material. Only the learner can judge that.

1. After writing a quiz from material, offer `quiz review quiz.md`. If the user agrees, run `quiz review quiz.md --open --json` in the background and wait. The first line is the URL to give the user; the last line gives the counts, and its `review` is the `review.json` it wrote. For a quiz already in the library: `quiz library review NAME --json`.
2. Fix what is flagged by changing the quiz source, then run `quiz check quiz.md --review review.json`. It fails until every *fix* question has changed and every *drop* question is gone.
3. Offer `quiz review quiz.md --since review.json`, so the learner sees only what changed.

**Never write or edit `review.json`.** It is the learner's verdict, and the check cannot tell who wrote it.

## Keep it in the library

`quiz library` files the user's quizzes, their attempts and their reports in one folder under git. The agent's loop is `check`, then `review`, then `register`.

1. `quiz library status --json`. A library that works gives `"status": "healthy"`. Exit 2 with "no library" means there is none: **ask the user where it should go and give them `quiz library init PATH` to run. Never run `init` yourself.** Mention it once if they keep making quizzes. Then build the quiz as above instead.
2. `quiz library register quiz.md --json`. A name that is taken exits 1 and suggests a free one: use it with `-n NAME` and say so. A quiz that is already registered and was edited is registered again with `quiz library register quiz.md --update NAME`; to start from the registered copy, `quiz library share NAME --source -o DIR`, edit, check, register with `--update`. Surveys cannot be registered.
3. **End your message with the take line from the JSON, `quiz library take NAME`**, so the learner does not have to look it up.
4. Never edit files inside the library, never push, and never run `quiz library rm` or `quiz library rename` unless the user asked for that exact quiz. Never pass `--yes` or `--force`.

## Take it, and retry what was missed

- The learner takes a library quiz with `quiz library take NAME`: it serves the page, files the result next to that version and commits. Progress is saved, so a closed tab resumes.
- `quiz library take NAME --missed` offers only the questions that are wrong or partly right in an earlier attempt and not right since. `quiz library take NAME --section S` takes one section. To see what a take would serve without serving: `quiz library take NAME --missed --dry-run --json`. With nothing missed it says so and exits 0.
- For a quiz outside the library, `quiz serve quiz.md --open --json` serves it once and writes the results file named in its last line.
- If you are waiting for the answers, run the server with `--json` in the background and read the URL from its first line. It only works when the learner can reach your `127.0.0.1`; otherwise hand over the built page and wait for an exported results file.

## Make a questionnaire

Prefer a survey file over asking more than about five questions in chat, or when the user wants to keep the answers (an intake form, a project kickoff, a self-review, course feedback).

1. `quiz new survey FOLDER`. A survey has `kind: survey` in its front matter, as `quiz guide` says: every question is ungraded and the page shows no score.
2. Check it as a quiz (`quiz check survey.md --strict`; it runs under the `survey` profile).
3. Run `quiz serve survey.md --open --json` in the background. The respondent presses Finish, the answers are written next to the file, and the command exits 0 (2 on a timeout). Read the path from the last line.
4. Read the answers with `quiz grade results.json --quiz survey.md --json`: the report is titled "Answers", each question has its readable answer, and nothing is scored or sent for grading.

## Grade results

1. **Report:** `quiz grade results.json --quiz quiz.md --json`, or `quiz library grade NAME --json` for the newest attempt in the library. The shared grader re-scores the attempt and is the authority. `--quiz` must be the version the learner took; a mismatch exits 1. Mention any warning to the user.
2. **Grade the open answers.** The same command writes an empty `*-grades.json` template for the essays and code. Follow the grading contract in `quiz agent-guide`: fill only the `null` cells of the questions you were given, give components and never totals, write a note for every lost mark, and declare who you are as the grader. Be specific: quote the learner's text, name strengths and one concrete improvement. Judge code by reading it; never run the learner's code unless the user asks.
3. **Fold the grades in:** `quiz grade results.json --quiz quiz.md --grades results-grades.json`, or `quiz library grade NAME --grades FILE`. Fix every problem it lists (exit 1) and run it again.
4. **For a human to grade or adjust,** `quiz grade results.json --quiz quiz.md --web --grades results-grades.json` (or `quiz library grade NAME --web`) opens a form pre-filled with your grades.
5. **Summarise for the learner:** the result, the weakest tags first, what to revisit, and a correction for each wrong answer that shows a misunderstanding rather than a slip. Do not edit the learner's answers or the results file.
6. **Progress:** `quiz library stats NAME --json` shows score by date, weakest tags, the most-missed questions and the criteria that lose marks over every attempt. Without a library, `quiz stats a.json b.json --quiz quiz.md`.

## Rules for good questions

- Never put the answer, or a giveaway, in the question text. Never reuse the explanation's wording in the prompt.
- Distractors must be plausible: common misconceptions, off-by-one values, near-synonyms. No joke options.
- One concept per question. Numeric answers need units, a tolerance and a decimal point.
- Mix types to fit the content: `numeric` or `fields` for calculations, `blanks` for definitions and code gaps, `ordering` for sequences, `matching` for pairs, `essay` and `code` for open work.
- Figures: add one only when reading it is the skill being tested (a trace, a plot, a circuit, a micrograph) or the user's past exams use figures. Take figures from the material first, crop them into `assets/` and cite them, or plot them from an equation with a script kept beside the quiz. Never draw diagrams yourself. Use a web image only when the user allows it and the material has none, and name its source.
- Every auto-graded question gets an explanation that says why the answer is right and what the wrong choices get wrong.
- Essay and code questions need a rubric of three to five checkable criteria: they are what you grade against later.
- Match the requested length and difficulty. If the material is thin, make fewer questions; never invent facts.
- Content must be correct. For code, verify claims with the real compiler or interpreter before writing "this compiles" or "this prints".
- Write for the page and the paper alike: never name a button or say when the page shows something.
- The answer key is in the HTML, only obfuscated. Never describe a quiz as secure or cheat-proof.
