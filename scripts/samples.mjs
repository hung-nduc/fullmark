// Builds every example and every page fixture into samples/, with an index, for trying the page by hand.
// Run with `npm run samples` (it builds dist first). samples/ is git-ignored: regenerate it, never commit it.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "samples";
const CLI = join("dist", "cli.js");

// what to try in each page; a page without a line here still builds and is listed
const TRY = {
  "example-calculus": "instant feedback (Check on each question), maths, a 30-minute limit",
  "example-exam": "a 20-minute timed exam, feedback at the end",
  "example-ielts": "two essays with a rubric, a 60-minute limit, the Light theme",
  "example-medical": "instant feedback, almost every type: ordering (drag), matching, blanks, fields, numeric, essay",
  "example-rust": "a code question, highlighting, short answers, a 25-minute limit",
  "example-survey": "a questionnaire with no score: scales, ordering, free text",
  mockup: "the boards' content: three parts, a 40-minute limit, a flag; the closest page to the mockup",
  map: "the question map: three parts, every result state after Submit",
  oneq: "the part list: a part of one question is a single row (double-click or Enter on a heading jumps); single and multi look different",
  materials:
    "materials: the stacked sidebar, sheet chips, the Materials tab after Submit, Materials on the start screen",
  parts: "the part picker: take the whole quiz or one part",
  timed: "a 90-second limit: let it run out to see the automatic submit",
  results: "the results card, the review filter, Retry missed",
  instant: "feedback: instant (Check locks each question)",
  types: "every simple type: multi, true/false, short, numeric, blanks, fields, scale",
  "types-vi": "the simple types with a Vietnamese interface (decimal comma)",
  chrome: "the top bar, status line and Focus mode",
  "chrome-vi": "the top bar and status line in Vietnamese",
  singles: "single-choice questions only",
  second: "a second, small quiz",
  replay:
    "quiz replay: the essay fixture's attempt, already submitted, with its grades file (criterion tables, the grader's line); try Retry missed, reload, and Continue your retry",
  "paper-exam":
    "quiz build --print --seed 101 --answer-sheet: the exam paper, every type, a part of long answers; print it or save as PDF (the footer and page breaks show there)",
  "paper-mockup": "quiz build --print, no seed: the board's header, the marker's table, no paper code",
  "paper-key":
    "quiz build --print --seed 101 --answer-sheet --answers key: the exam paper, then the answer key on a new page (the grid with its letters, a table with notes on partial credit, each rubric, the sample answers)",
  "paper-materials":
    "quiz build --print --answers key on a quiz with three sheets: the header's Materials line, the materials page (tables, maths) after the last question, then the key",
  "paper-inline":
    "quiz build --print --answers inline: a study sheet, each answer, explanation, rubric and sample answer under its question; no name boxes",
  ordered:
    "type_order: by-quiz with shuffle_questions: reload with New attempt a few times; the questions shuffle, but single choice, true/false, short answers and essays always keep their places",
  "paper-key-grouped":
    "quiz build --print --seed 101 --answers key on a quiz with its own type_order: the key's other answers in groups (Essays, Short answers and numeric answers, Single choice, Other)",
  "paper-exam-vi": "the paper with --ui-lang vi: Mã đề, Câu 1., Phiếu trả lời",
  "vi-fonts":
    "built with --fonts all: Vietnamese text with stacked diacritics; Appearance > Font offers all four fonts; the Licences button lists their notices",
};

// Served commands cannot be a file, so the index lists how to start each one by hand (one line per command, run from
// the repository after `npm run samples`). Each later slice that adds a served command adds its line here.
const SERVED = [
  {
    command: "node dist/cli.js serve examples/calculus/quiz.md --open --out samples/calculus-results.json",
    try: "quiz serve: the quiz is served on 127.0.0.1 and opens in your browser; answer, press Submit and confirm: the page says the results were sent, the command prints the score and exits 0, and samples/calculus-results.json is written (quiz grade grades it to the same score). Close the server with Ctrl+C instead: it prints nothing written and exits 2. Press Submit and look at the dialog first: it says your answers will be sent to fullmark; afterwards the results card says Sent where a built page says Download results.",
  },
  {
    command:
      "node dist/cli.js serve examples/calculus/quiz.md --open --section derivative-rules --out samples/calculus-section.json",
    try: 'quiz serve --section: only the Derivative rules part is offered, with no part picker; Start, answer and Submit. samples/calculus-section.json records a section attempt (plan source section) and quiz grade grades it to the score the page showed. Try an unknown name (--section integrals): it exits 2 and lists the sections, slug and title, before serving anything. The title works too (--section "Derivative rules"), in any case.',
  },
  {
    command: "node dist/cli.js serve examples/calculus/quiz.md --open --focus --out samples/calculus-focus.json",
    try: "quiz serve --focus: the start screen opens with Focus mode already ticked, so pressing Start enters full screen with the sidebar closed (a page cannot go full screen without a click). Untick it to see it off.",
  },
  {
    command:
      "node dist/cli.js serve examples/calculus/quiz.md --open --autosave samples/calculus-progress.json --out samples/calculus-results.json",
    try: "quiz serve --autosave: Start, answer a few questions, then press Ctrl+C in the terminal (or close the terminal). samples/calculus-progress.json holds the attempt in progress. Run the same command again and open the page: it offers Continue with your answers and the clock; Continue, finish and Submit: the progress file is deleted once samples/calculus-results.json is written. The browser's own storage is not used. Edit the quiz between the two runs and the second one exits 1, naming the two versions, and leaves the file alone.",
  },
  {
    command: "node dist/cli.js review examples/rust/quiz.md --open --out samples/rust-review.json",
    try: "quiz review: the review form opens in your browser, in the quiz's look. Judge by keys: 1 Keep, 2 Fix, 3 Drop, N for the next question not judged, Q for the sidebar. A Fix or a Drop asks for a reason (Other also for a note); Finish says which ones are missing and writes nothing until they are there. Press Finish with questions not judged (or Keep the rest) and the dialog asks first. Finish writes samples/rust-review.json, the page says Review saved with the counts and the next command, and the command prints them and exits 0. Then run quiz check examples/rust/quiz.md --review samples/rust-review.json: it exits 1 with review.fix and review.drop until the fixed questions change and the dropped ones are gone. Run the review command again: the form opens with your verdicts, counted as judged; edit a question in a copy of the quiz and only that one starts not judged. Ctrl+C instead of Finish prints interrupted, exits 2 and leaves an existing file as it was. quiz review examples/survey/quiz.md exits 2 (a survey has no key to judge), and a built page is refused too.",
  },
  {
    command: "node dist/cli.js review samples/since/quiz.md --open",
    try: "quiz review on samples/since/quiz.md (a copy of the Rust example, made when the samples are built): judge a few questions, mark one a Fix with a reason and a note, press Keep the rest. It writes samples/since/review.json. Then edit that Fix question in samples/since/quiz.md and change another question that you marked Keep, and add a question at the end; run quiz check samples/since/quiz.md --review samples/since/review.json: it exits 0 with review.unconfirmed, whose fix line names the next command.",
  },
  {
    command: "node dist/cli.js review samples/since/quiz.md --since samples/since/review.json --open",
    try: "quiz review --since: the form opens with only the questions that are new or changed since your review: the status line starts 'Asked again: 3 questions new or changed since your review of ...', and Judged, the bar and the counts cover those three. The changed Fix shows 'Your verdict on ...' with its reason and your note, and 'What changed since': a line diff with - lines in red and + lines in green. The changed Keep shows its verdict and 'Changed since; a Keep does not store the earlier text'. The new question has neither. In the sidebar the other questions are muted with a dashed border and cannot be selected, and N skips them. Keep the rest and the Finish dialog count the three only. Finish merges into the same file: every other entry stays as it was, and quiz check no longer warns. Run it again with no change: it prints 'nothing new or changed since your review of ...' and exits 0. A missing review file, or --out naming another file, exits 2.",
  },
  {
    command: "node dist/cli.js grade samples/grade/results.json --quiz samples/grade/quiz.md --web --open",
    try: "quiz grade --web: the grading form opens in your browser (samples/grade holds the essay fixture's attempt, an essay of each rubric mode and a code answer, and no grades file). Grade the five questions: the slot [erase | - | value | +] / [max] takes a typed value, the buttons (from empty, + gives the full marks and - the step below; an empty band starts at the middle) and the full-mark box; the verdicts are a radio group. A mark below the maximum needs a note, a one-score grade needs its reason, and a half-graded question says so; Finish lists what is missing and writes nothing until it is fixed. Q opens the sidebar, N goes to the next question not graded. Finish asks your name, Save grades writes samples/grade/results-grades.json (kind: human) and results-report.md, and the command prints both and exits 0. Then quiz replay samples/grade/results.json --quiz samples/grade/quiz.md shows your grades in the rubric box. Run the command again: it exits 2, since the grades file now holds grades (G87). Ctrl+C instead of Save grades prints interrupted and exits 2, leaving the folder as it was.",
  },
  {
    command:
      "node dist/cli.js grade samples/grade-ai/results.json --quiz samples/grade-ai/quiz.md --web --grades samples/grade-ai/grades.json --open",
    try: "quiz grade --web --grades: the grading form opens with the grades file's grades already in (samples/grade-ai holds the essay fixture's attempt and a grades file by an AI grader). Every question it grades counts as graded: the status line ends with a pill, 'Pre-filled · 3 as given, 0 adjusted'. Each slot opens with a lit box showing the AI's value; press nothing and it stays lit, change a score or a note and the box turns plain, a press on it puts that row's score and its note back; the small AI's by Why this score and To improve puts the text back; Back to the AI's grade on the card's foot puts the whole question back. The box head names who graded and turns to 'adjusted by you'; the sidebar marks each question (the sparkle, the sparkle with a pencil once changed). Finish asks your name and Save grades writes samples/grade-ai/results-grades.json (kind: human, with reviewed on each pre-filled question) and the report. Run the command again: grades.json is not the file Save writes, so results-grades.json now holds grades and the run is refused (exit 2); name that file in --grades instead and the form opens pre-filled from it.",
  },
  {
    command: "node dist/cli.js brief samples/brief-tui --tui",
    try: "quiz brief --tui: asks every question in the terminal, in two steps (Quiz 1/2 style progress), with each question's help and each choice's hint. Purpose and scope start empty; a scope under four words is asked again with the example. The summary lists every answer and marks the defaults; pick Change on any line to go back (change the purpose and the defaults that follow it are refilled), then Write brief.yaml: samples/brief-tui/brief.yaml and an empty content/ are written. Ctrl+C at any step writes nothing and exits 2. Run it again: it exits 2 because brief.yaml exists. Pre-fill with flags (--scope \"...\" --language vi) and the form opens with them, in Vietnamese; the same answers through flags (quiz brief samples/brief-flags --purpose ... --scope ...) write the same bytes. With stdin from /dev/null it exits 2: --tui needs a terminal.",
  },
  {
    command: "node dist/cli.js brief samples/brief-web --web",
    try: "quiz brief --web: the form opens in your browser, in your system's light or dark (the half-moon button offers every theme and font). Purpose and scope start empty and are marked 'Needs your answer'; the other twelve questions are at their defaults, marked Default, and the defaults that depend on the purpose (the kinds of questions, the profile under More options) follow it until you change them. A scope under four words says 'Too short' with the example and holds Finish: it lists what is missing, each a link to its question. Finish with everything answered opens 'Write the brief?' with every answer and who chose it (Yours, Pre-filled, Default); a click on a row goes back to its question. Write the brief writes samples/brief-web/brief.yaml and an empty content/, the page says Brief written, and the command prints what the flags print and exits 0. Keys: N the next question to answer, Q the sidebar, Esc closes it. Cancel writes nothing, shows the command to start again and exits 2 (so does Ctrl+C, and the page then says the server has stopped). Run it again: it exits 2 because brief.yaml exists (delete samples/brief-web first). Pre-fill with flags as an agent would: node dist/cli.js brief samples/brief-web --web --purpose exam-prep --scope \"lectures 3 to 5, the Fourier transform\" --count 25 --language vi: the form opens in Vietnamese with the note 'Điền sẵn cho bạn' and those answers marked pre-filled; change one and its card offers 'Về lại câu điền sẵn', change two and the note offers 'Về lại tất cả câu điền sẵn'; keep them and the file is the one those flags write.",
  },
  {
    command: "node dist/cli.js build samples/watch/quiz.md --watch --serve --open",
    try: "quiz build --watch --serve: samples/watch/quiz.md (a copy of the Rust example, made when the samples are built) is built, served on 127.0.0.1 and opened in your browser. Edit and save it: the page reloads within a second and shows the change. Save an error (an unclosed ::: or a question with no id): the terminal prints the errors and 'kept the last good page', and the page does not reload; fix it and the page reloads. samples/watch/quiz.html on disk is what quiz build writes (no reload code). Ctrl+C in the terminal exits 0. Add --json to see one line per build, and give two files (samples/watch/quiz.md samples/watch/second.md) to see the index of pages, which notes a failed rebuild at its next load.",
  },
];

// extra `build` flags for a page
const FLAGS = { "vi-fonts": ["--fonts", "all"] };

// empty the folder rather than remove it: on Windows another program (Explorer, a browser) may hold the folder itself
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) rmSync(join(OUT, name), { recursive: true, force: true });

const sources = [
  ...readdirSync("examples", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join("examples", d.name, "quiz.md")))
    .map((d) => ({ name: `example-${d.name}`, file: join("examples", d.name, "quiz.md") })),
  ...readdirSync(join("test", "fixtures", "page"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f.slice(0, -3), file: join("test", "fixtures", "page", f) })),
];

// the folder `build --watch --serve` is tried in: copies, so editing them never touches examples/
mkdirSync(join(OUT, "watch"), { recursive: true });
copyFileSync(join("examples", "rust", "quiz.md"), join(OUT, "watch", "quiz.md"));
copyFileSync(join("examples", "survey", "quiz.md"), join(OUT, "watch", "second.md"));

// the folder the `review --since` samples are tried in: a copy, so editing it never touches examples/
mkdirSync(join(OUT, "since"), { recursive: true });
copyFileSync(join("examples", "rust", "quiz.md"), join(OUT, "since", "quiz.md"));

// the folder `grade --web` is tried in: the essay fixture's quiz and results, without the grades file beside them
mkdirSync(join(OUT, "grade"), { recursive: true });
copyFileSync(join("test", "fixtures", "replay", "essay.md"), join(OUT, "grade", "quiz.md"));
copyFileSync(join("test", "fixtures", "replay", "essay-results.json"), join(OUT, "grade", "results.json"));

// the folder `grade --web --grades` is tried in: the same attempt, with the grades file named apart from the one Save writes
mkdirSync(join(OUT, "grade-ai"), { recursive: true });
copyFileSync(join("test", "fixtures", "replay", "essay.md"), join(OUT, "grade-ai", "quiz.md"));
copyFileSync(join("test", "fixtures", "replay", "essay-results.json"), join(OUT, "grade-ai", "results.json"));
copyFileSync(join("test", "fixtures", "replay", "essay-results-grades.json"), join(OUT, "grade-ai", "grades.json"));

const built = [];
for (const s of sources) {
  try {
    execFileSync(
      process.execPath,
      [CLI, "build", s.file, "-o", join(OUT, `${s.name}.html`), ...(FLAGS[s.name] ?? [])],
      { stdio: "pipe" },
    );
    built.push(s);
  } catch (e) {
    console.error(`${s.file}: build failed\n${e.stderr?.toString() ?? e}`);
    process.exitCode = 1;
  }
}

// printed papers (`quiz build --print`): the file, the flags and the name
const papers = [
  {
    name: "paper-exam",
    file: join("test", "fixtures", "paper", "exam.md"),
    flags: ["--seed", "101", "--answer-sheet"],
  },
  {
    name: "paper-key",
    file: join("test", "fixtures", "paper", "exam.md"),
    flags: ["--seed", "101", "--answer-sheet", "--answers", "key"],
  },
  {
    name: "paper-key-grouped",
    file: join("test", "fixtures", "paper", "grouped-custom.md"),
    flags: ["--seed", "101", "--answers", "key"],
  },
  {
    name: "paper-inline",
    file: join("test", "fixtures", "paper", "exam.md"),
    flags: ["--seed", "101", "--answers", "inline"],
  },
  {
    name: "paper-materials",
    file: join("test", "fixtures", "paper", "materials-quiz.md"),
    flags: ["--answers", "key"],
  },
  { name: "paper-mockup", file: join("test", "fixtures", "page", "mockup.md"), flags: [] },
  {
    name: "paper-exam-vi",
    file: join("test", "fixtures", "paper", "exam.md"),
    flags: ["--seed", "102", "--ui-lang", "vi"],
  },
];
for (const p of papers) {
  try {
    execFileSync(process.execPath, [CLI, "build", p.file, "--print", ...p.flags, "-o", join(OUT, `${p.name}.html`)], {
      stdio: "pipe",
    });
    built.push(p);
  } catch (e) {
    console.error(`${p.file}: paper failed\n${e.stderr?.toString() ?? e}`);
    process.exitCode = 1;
  }
}

// pages made by `quiz replay`: the quiz, the results file (a grades file beside it is read too) and the page's name
const replays = [
  {
    name: "replay",
    quiz: join("test", "fixtures", "replay", "essay.md"),
    results: join("test", "fixtures", "replay", "essay-results.json"),
  },
];
for (const r of replays) {
  try {
    execFileSync(
      process.execPath,
      [CLI, "replay", r.results, "--quiz", r.quiz, "--no-open", "-o", join(OUT, `${r.name}.html`)],
      { stdio: "pipe" },
    );
    built.push({ name: r.name, file: r.results });
  } catch (e) {
    console.error(`${r.results}: replay failed\n${e.stderr?.toString() ?? e}`);
    process.exitCode = 1;
  }
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rows = built
  .map(
    (s) =>
      `<li><a href="${s.name}.html">${s.name}</a> <span>${esc(TRY[s.name] ?? "")}</span> <code>${esc(s.file)}</code></li>`,
  )
  .join("\n");
writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>fullmark samples</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem}li{margin:.4rem 0}span{color:#555}code{color:#888;font-size:.85em}</style>
<h1>fullmark samples</h1>
<p>Built from the current branch by <code>npm run samples</code>. Each page is offline: open it, answer, submit, export. Answers are autosaved per page in this browser; use Start over or New attempt to reset.</p>
<ul>
${rows}
</ul>
<h2>Served commands</h2>
<p>These start a small server on this machine and wait for you, so they are run from a terminal in the repository, not opened as files.</p>
<ul>
${SERVED.map((s) => `<li><code>${esc(s.command)}</code> <span>${esc(s.try)}</span></li>`).join("\n")}
</ul>
`,
);
console.log(
  `samples: ${built.length} of ${sources.length + papers.length + replays.length} pages in ${OUT}/ (open ${join(OUT, "index.html")})`,
);
