# fullmark 1.0: command reference

The spec sheet for every command of fullmark 1.0 ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)); how the commands fit together, and why, is in [USER_DESIGN.md](USER_DESIGN.md). Each entry says what the command does, what it accepts, what it writes and how it exits. 1.0 is not compatible with 0.x; the tags only say how a command relates to the prototype, as a guide to what is new work:

- **same**: behaves as in 0.x.
- **changed**: exists in 0.x but behaves differently here.
- **new**: not in 0.x.

The program is `quiz`. `fullmark` runs the same program, for systems where another program already owns `quiz`.

## Conventions

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Done. Warnings may have been printed |
| `1` | Problems found: check errors, a refused quiz, a mismatched attempt |
| `2` | Usage error, I/O error, timeout, or nothing to work on |
| `3` | Needs input: a human-only value is missing. The output says which value and how to provide it (a flag or a form) |

`quiz` with no command prints the help on stderr and exits 2.

When the reader of stdout closes it early (`quiz library list | head -1`), the command stops writing and exits `0`, with nothing on stderr.

### Common options

| Option | Meaning |
|---|---|
| `--json` | Print the outcome as one JSON object on stdout. Human text goes to stderr. With `--json`, a command never prompts. Commands that run the one-shot server (`serve`, `review`, `brief --web`, `grade --web`, `library take`) first print a `listening` line, so the outcome is the second line: see `serve`. Content found wrong (check errors, a hash mismatch, invalid grades, a duplicate id) keeps the command's own status, such as `failed` or `problems`. A failure to run is `{"status": "error", "message"}`, with `"file"` when it concerns one input and `"errors": [{"file", "line", "message", "fix"}]` for a malformed config; its human text also goes to stderr |
| `--plain` | Plain text with no colours, even in a terminal. `NO_COLOR` does the same |
| `--open` / `--no-open` | Open, or don't open, the page in the default browser |
| `--port N` | Port on 127.0.0.1 for the one-shot server. Default: a free port |
| `--timeout SECONDS` | How long a one-shot server waits for a submit. `0` waits forever. Default `1800`, except `library take` (`0`) |
| `-h`, `--help` | Help for the command |
| `--version` | Print `fullmark X.Y.Z` (top level only) |
| `--acknowledgements` | Print fullmark's MIT licence, then every third-party component shipped in the CLI or in its pages, with version, licence and the notice its licence requires (top level only). The text is `THIRD_PARTY_NOTICES.md`, each distinct licence text printed once; it loads nothing else. See [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 3, "Licences" |
| `--profile P` | The check profile, on every command that runs `check` (`check`, `build`, `serve`, `review`, `inspect`, `rules`, `library register`). Overrides the quiz's `profile:` |
| `--config TOML` | Use this config file instead of looking for the nearest `fullmark.toml`. Same commands as `--profile` |
| `--fonts quiz\|all\|none` | Which fonts the page embeds, on every command that writes a page (`build`, `replay`, `serve`, `library take`, `library replay`, `library share`, `library publish`). `quiz`: the quiz's own font; `all`: every font, about 0.5 MB, so a learner can switch freely; `none`: no embedded font, the smallest page. Default: `fonts` in `config.toml`, else `quiz`. `publish` remembers its value in the shelf manifest. See [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 8 |

How the profile and the config are chosen is in [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 5. A malformed config file exits 2 with the config's `file:line`; an unknown profile given with `--profile` exits 2 with a plain message naming the known profiles.

### Terminal style

Human output with a table or a block (`check`, `inspect`, `stats` and the library's commands) has two styles, set by `style` under `[terminal]` in `config.toml`:

- **`simple`** (the default): no borders, columns separated by spaces, a shaded header row, scores by band (80% and up green, under 65% yellow), marks as coloured tags, `problem` and `note` as badges.
- **`boxed`**: the same, with tables drawn in box characters and blocks such as `library status`'s facts in a panel.

Colours are the terminal's 16 ANSI colours, never fixed RGB, so the terminal's own theme decides the shades; fullmark has no colour themes of its own. Output read by programs never changes with the setting: `--plain`, `NO_COLOR` and stdout that is not a terminal always give the `simple` layout with no colour, and `--json` is untouched. `boxed` falls back to `simple` when the terminal is narrower than the table. The setting is per machine, in `config.toml`, never in a library: it applies to commands that need no library, and `library.toml` travels with the repository.

### Several files

Commands that handle each input on its own take `FILE...`: `check`, `build`, `ids`, `grade`, `replay` and `library register`. The rules are the same for all of them:

- **Inputs.** Globs (`signals/*.md`) are expanded by fullmark, since PowerShell does not expand them. They are sorted and repeated names are dropped. A folder is refused, so a `README.md` is never processed by accident.
- **Order and exit.** One after another, in the order given. Every input is attempted, and the exit code is the worst one (`2` over `1` over `0`). `library register` is the exception: it is all or nothing, because it changes the library.
- **Options that name one thing** (`--review`, `--grades`, `--web`, `--serve`, `-n`, `--update`) exit 2 with several inputs. `--quiz` is one quiz for all the results of `grade`; a results file taken on another version fails on its own and the others go on.
- **Output.** `-o` names a folder (created if missing) and each output keeps its input's name. If `-o` names an existing file, the command exits 2 before handling any input. An `-o` ending in `.html` or `.htm` (any letter case) looks like a page, not a folder: the command exits 2 before handling any input. Inputs count as several when more than one is given, usable or not, so `good.md missing.md -o out` makes the folder `out`. If two inputs have the same name in different folders, their outputs would collide: the command exits 2 before handling any input, naming both. Without `-o`, each output goes beside its input as for a single file.
- **Progress.** On a terminal, stderr shows one updating line, `[3/12] signals.md`, and each failure in full. The line is not shown with `--json`, `--plain` or when stderr is not a terminal. After the last input, stdout shows a summary (`10 done, 2 failed`), on a terminal or not; not with `--json`. There is no progress-bar dependency: one file takes milliseconds.
- **`--json`.** One line per input, the command's usual object with `"file"` added, then `{"status": "done", "ok", "failed"}`.

### Paths in output

A path is printed relative to the working directory when it lies under it, else absolute, and always with `/`, on Windows too. A file that cannot be read or written is reported in plain words ("no such file", "is a folder", "permission denied"), not with the operating system's message.

### Names, ids and stamps

- A quiz in the library is named by its **name** or its **id**. A name is a slug (`a` to `z`, `0` to `9` and `-`, 1 to 64 characters, as `new` makes ids), checked by `register -n`, `register --update` and `rename`. It may equal the quiz's own id but not another quiz's name or id (exit `1`, "name taken", with a free name suggested). A lookup tries names first, then ids, so it is never ambiguous.
- An attempt is named by its **stamp** (the results file name) or a prefix of at least 4 characters. Default: the newest.
- A version is named by its **hash** or a prefix of at least 4 characters. Default: the current one.
- A section is named by its **slug** or its title, ignoring case. An unknown section exits 2 and lists the valid ones.

### Environment

| Variable | Meaning |
|---|---|
| `FULLMARK_CONFIG` | Path of `config.toml`, in place of `%APPDATA%\fullmark\config.toml` on Windows or `~/.config/fullmark/config.toml` on Linux |
| `FULLMARK_LIBRARY` | Library folder for this shell, overriding the config. `library status` warns when it is set |
| `NO_COLOR` | Same as `--plain` |

### Files

| File | Format | Written by |
|---|---|---|
| `quiz.md` plus `assets/` | fullmark Markdown (`quiz guide`) | the author or an agent |
| `quiz.html` | one self-contained offline page | `build`, `library share` |
| `*-results-*.json` | `results-v2` (serialised Attempt); the page names it `<quiz id>-results-YYYYMMDD-HHMMSS.json`, local time | the page (**Download results**), `serve`, `library take` |
| `*-report.md`, `*-report.json` | `report-v2` (the JSON; TECHNICAL_DESIGN.md, section 6) | `grade`, `library grade` |
| `*-grades.json` | `grades-v2`: the grader's identity, and per question the rubric mode with scores or bands per criterion and notes | template from `grade --json`, filled in by an agent or through `grade --web` |
| `review.json` | `review-v2` (`format: "fullmark-review"`): keep, fix or drop per question | `review` |
| `brief.yaml` plus `content/` | brief | `brief` |
| build file (`build.toml`) | what `build --build-file` builds: files, and per entry the `build` options | the user |
| `fullmark.toml` | check config: default profile, custom profiles, rule levels and options, custom checks | the user (agents never edit it to make `check` pass) |
| `config.toml` | machine config: library path, shelf folders (by shelf name; `public` in v1), personal profiles, default `fonts`, the terminal style (`[terminal] style`), the `git` to run when it is not on the path, each brief purpose's defaults (`[brief.purpose.<purpose>]`) | `library init`, `library publish`, the user |
| `check.json` | the resolved rules a library version was registered with | `library register` |
| `library.toml` | the library's index of quizzes | `library` commands |
| `fullmark-shelf.json` | shelf manifest | `library publish` |

## Core commands

Core commands work on files. They need no setup and no config, and never touch a library.

### quiz check

**changed**: every finding has a rule id, and there are profiles and config.

```text
quiz check FILE... [--profile P] [--config TOML] [--strict] [--review REVIEW] [--json] [--plain]
```

Validates a quiz under one profile. Reports every issue with a level, a rule id, `file:line` and a fix hint. If a `brief.yaml` sits next to the quiz, `check` also warns when the quiz does not match the brief (count, mix, mode). The first line of human output names the profile and the config files used, for example `profile exam (fullmark.toml:4)`.

| Argument or option | Meaning |
|---|---|
| `FILE...` | The quiz `.md` files. Several: see [Several files](#several-files) |
| `--profile P` | Check under this profile. Default: the quiz's `profile:` (`survey` for a `kind: survey` quiz that names none), then the brief's, then `[check] profile`, then `default` |
| `--config TOML` | This config file instead of the nearest `fullmark.toml` |
| `--strict` | Warnings count as errors (sets `fail-on = "warning"` for this run) |
| `--review REVIEW` | Also fail until every question flagged *fix* has changed or gone and every question flagged *drop* is gone (`review.fix`, `review.drop`); a changed *fix* warns `review.unconfirmed` until the learner judges it again with `review --since`. One quiz only (several files exit 2, "--review takes one quiz"). A review that cannot be read, that is not valid (every problem is listed, in `problems` with `--json`), that is a 0.x file, or that is the review of another quiz exits 2. A review of another *version* of the same quiz is the normal case. Findings are among `issues`. See [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 4, "`review-v2`" |
| `--json` | `{"status", "profile", "config": [paths], "errors", "warnings", "issues": [{"rule", "level", "file", "line", "message", "fix"}], "ignored": [{"rule", "line", "because"}]}` |

Exit: `0` no errors, `1` errors (or warnings with `--strict` or `fail-on = "warning"`), or an unknown profile named in the quiz (`profile.unknown`); `2` file not found, malformed config (with `file:line`), or unknown `--profile` (a plain message naming the known profiles), or a `--review` that cannot be used (above).

### quiz rules

**new**.

```text
quiz rules [RULE] [--profile P] [--for FILE] [--config TOML] [--json] [--plain]
```

The rule catalogue. Use it to see what a profile checks and why a quiz was held to a rule.

- With no arguments: every rule (built-in and custom) with its kind (fixed or quality), its level and options under the profile, and a one-line description.
- With `RULE`: that rule in full, with what it catches, why it matters, its options, an example that triggers it and how to fix it.
- With `--for FILE`: the effective rules for that quiz, with where each value came from (built-in, the `exam` profile, `fullmark.toml:12`, the user config) and the profile chain (`signals-exam` extends `exam` extends `default`).

| Argument or option | Meaning |
|---|---|
| `RULE` | A rule id, such as `choice.correct-longest` or `custom.two-essays` |
| `--profile P` | Show the rules under this profile. Default: `default`, or the quiz's with `--for` |
| `--for FILE` | Resolve config and profile as `check FILE` would |
| `--json` | `{"profile", "chain", "config", "rules": [{"id", "kind", "level", "options", "origin", "description"}]}`. `kind` is `fixed`, `quality` or `custom` |

Exit: `0`, `2` unknown rule or profile, or malformed config.

### quiz build

**changed**: absorbs `watch`, adds several files, `--build-file`, `--built-at`, `--ui-lang` and `--print`.

```text
quiz build FILE... [-o OUT] [--profile P] [--config TOML] [--strict] [--open]
                [--print [--answers none|key|inline] [--answer-sheet] [--seed S] [--materials none]]
                [--built-at ISO] [--ui-lang en|vi]
                [--watch [--serve] [--port N]]
                [--json] [--plain]
quiz build --build-file BUILD [FILE...] [-o DIR] [--json]
```

Checks the quiz (under the profile, as `check` does), then writes one self-contained HTML page. Nothing is written if `check` finds errors. With several files, each is checked and built on its own, one page per quiz; a page holding several quizzes is a bundle, not in v1 ([proposals/multi-quiz-bundle.md](proposals/multi-quiz-bundle.md)).

| Argument or option | Meaning |
|---|---|
| `FILE...` | One or more quiz `.md` files. Globs (`signals/*.md`) are expanded by fullmark too, since PowerShell does not expand them. A folder is refused, so a `README.md` is never built by accident |
| `-o`, `--output OUT` | Output path. Default: `FILE` with `.html`. With several files, `OUT` is a folder (created if missing) and each page keeps its source's name; a file path exits 2 |
| `--build-file BUILD` | Build what a build file lists (below). `FILE`s given as well build only those of its entries |
| `--strict` | Fail on warnings and write nothing |
| `--open` | Open the page after building, with the system's opener, without waiting. A failed build opens nothing. If the opener cannot start, `warning: cannot open the page: REASON` goes to stderr and the exit stays `0`: the page was built |
| `--print` | Write a static printable paper instead of the interactive page (TECHNICAL_DESIGN.md, section 8). Default output: `FILE` with `-print.html`. Print it, or save it as PDF from the browser |
| `--answers` | With `--print`: `none` (default, an exam paper), `key` (an answer key on a new page after the paper) or `inline` (answers and explanations under each question). Without `--print`, or any other value, exit 2 |
| `--answer-sheet` | With `--print`: after the header, a grid of boxes, one per single-choice and true/false question, where the student writes the letter; the key then lists those answers in the same grid. Other question types are answered in place |
| `--seed S` | With `--print` (without it, exit 2: "`--seed` needs `--print`"; the same for `--answer-sheet`): shuffle questions and options reproducibly, so different seeds give different versions of the same exam, each with a matching key. `S` is 1 to 8 letters or digits (else exit 2) and is printed as the paper's code, "Mã đề" or "Paper code" (TECHNICAL_DESIGN.md, Printable paper) |
| `--materials none` | With `--print`: leave out the materials page that otherwise follows the last question when the quiz has `materials` (TECHNICAL_DESIGN.md, Printable paper). `none` is the only value; another, or no `--print`, exits 2. On a quiz without materials it does nothing |
| `--built-at ISO` | Pin the build time, so a build is byte-identical across runs. Default: now |
| `--ui-lang en\|vi` | Language of the interface for this build, overriding the quiz's `ui_lang`. The questions are not translated, and grading still follows the quiz's `lang`: the key and the quiz's version are unchanged, so a results file from the page grades as before |
| `--watch` | Rebuild whenever `FILE` changes, or any file its version covers (assets, `materials` sheets and their assets), or the build file; changes are gathered for 100 ms. A save with errors prints them and keeps the last good page, on disk and in the server. Works with `--print` too. The config (`fullmark.toml`, the machine config, `--config`) is read once: a change to it needs a restart. Runs until Ctrl+C, which exits `0` |
| `--serve` | With `--watch`: serve the last good page on 127.0.0.1 at a token URL, and reload the browser after each rebuild through Server-Sent Events (`GET /<token>/events`: one `reload` event per good rebuild, none for a failed one, a comment line every 15 s). This server is not one-shot: it takes no submit and has no autosave, only the reload code (`dist/reload.js`), which only the served copy carries, and it runs until Ctrl+C. Its paths follow `serve`'s rules: the page at `/<token>/`, with several files an index there (each quiz's title as a link to `/<token>/<name>.html`, its file name, and "last build failed: see the terminal" after a failed rebuild, shown when the index is next loaded, since a failed rebuild sends no event; both themes, `--ui-lang` or `en`) and every other path refused |
| `--port N` | With `--serve`: the port, else a free one. Without `--serve`, exit 2 |
| `--json` | `{"status", "output", "bytes", "errors", "warnings"}`: `status` is `"built"` or `"failed"`, `output` the page's path or null, `errors` and `warnings` the issues in `check --json`'s shape. A failed build has `output` and `bytes` null; a file that cannot be read or written gives `{"status": "error", "file", "message"}`, as `check --json` does. With `--watch`, one JSON line per build, the first included; with `--serve` they follow a first line `{"status": "listening", "url", "port", "pid"}`, as `serve`'s; Ctrl+C prints `{"status": "stopped"}`. The human output is one line per rebuild on stderr (`rebuilt quiz.html · 412 KB · 0.3 s`, or the errors and "kept the last good page"). `--open` with `--watch` opens the page once, after the first build: the served URL with `--serve`, else the file. With several files, one such line per file (with `"file"`), then `{"status": "done", "ok", "failed"}` |
| `--plain` | As everywhere: no colours, no progress line |

Exit: `0` built, `1` check errors, `2` I/O error. With several files: every file is still checked and built, and the exit is the worst one.

**Size.** The finished page is checked against `build.size` before it is written: over `warn-mb` (20 MB, 1 MB being 1,000,000 bytes) is a warning at the profile's level (an error with `--strict`), over `max-mb` (100 MB) an error whatever the profile, and nothing is written. Without `--built-at`, the pages of one run share one build time.

**Several files.** As in [Several files](#several-files), with these for `build`:

- Builds run one after another. Parallel builds wait for a measured need.
- `--watch` watches them all. `--open` opens nothing and says so: `--open opens one page; built N` on stderr, exit unaffected; with `--watch --serve` it opens the served index. `--strict` applies to each file.

**Build file.** A TOML file listing what to build and how, so a set of pages (a course folder, a printed exam with its key) rebuilds with one command. It is named on the command line; fullmark never looks for one. Paths are relative to the build file.

```toml
# build.toml
out = "site"                          # default folder for every entry
built-at = "2026-10-24T09:00:00+07:00" # pins the build time: byte-identical rebuilds
ui-lang = "vi"

[[build]]
files = ["signals/*.md", "systems/intro.md"]

[[build]]
files = ["exam/final.md"]
print = true
answers = "key"
seed = 7
ui-lang = "en"                        # overrides the top level
```

- **Keys are `build` flag names**, top level as defaults, each `[[build]]` entry overriding them: `out`, `profile`, `config`, `strict`, `fonts`, `ui-lang`, `built-at`, `print`, `answers`, `answer-sheet`, `seed`, `materials`. `files` is required in each entry. A flag on the command line beats both.
- **Not allowed:** `attempt`, `grades`, `watch`, `serve`, `open`, `port`: they are about one run, not about what to build. These and unknown keys exit 2 with `file:line`, as a malformed config does.
- **`out` is always a folder**, even for one file, so adding a file to an entry never changes where pages go. `-o DIR` replaces it for every entry; without either, a page goes beside its source. `out` and `-o` are refused as in [Several files](#several-files): a name ending in `.html` or `.htm`, or an existing file, exits 2.
- **Clashes are found first.** Before anything is built, every page any entry would write is worked out. Two that would write the same path (the same file in two entries, or files of the same name into one folder) exit 2, naming both entries' lines, with the fix "give each entry its own `out`".
- **`FILE`s given with `--build-file`** build only the entries' files that match them (by resolved path), each with its own entry's options. A `FILE` in no entry exits 2 naming it, before anything is built.
- **`built-at` is quoted text**, as the flag takes it. An unquoted TOML date is refused with `` `built-at` must be in quotes ``: TOML rewrites dates when it reads them, and the page keeps the text as written.
- **The printed paper's keys.** `print` and `answer-sheet` are true or false; `answers` is `"none"`, `"key"` or `"inline"` and `materials` `"none"`, refused as the flags are; `seed` is text or a non-negative whole number read as its decimal digits (a leading zero needs quotes: `"007"`). `seed`, `answer-sheet`, `answers` and `materials` need `print = true` in the same entry (a command-line `--print` also counts), else exit 2 with `BUILD:line`; `answer-sheet` with `answers = "inline"` is refused as the flags are.
- **Errors.** Every problem is listed, each with `BUILD:line`: unknown keys, keys about one run, wrong types and values (the flag's own message), an empty or missing `files`, a file with no `[[build]]`. Nothing is built. With `--json` the result is one line, `{"status": "error", "file", "message", "errors": [...]}`.
- **An example.** [examples/build.toml](../../examples/build.toml) builds every example, each into its own folder.
- **`library register --build-file`** reads the same file and registers its `files`.
- `--watch` with a build file also watches the build file.

### quiz serve

**changed**: adds `--section`, takes only the quiz source (0.x also took a built page), and drops `--once`: it always exits after one submit.

```text
quiz serve FILE [--out RESULTS] [--timeout SECONDS] [--open]
                [--focus] [--section S] [--autosave PROGRESS] [--port N]
                [--profile P] [--config TOML] [--fonts quiz|all|none] [--json]
```

Serves the page on 127.0.0.1. When the learner presses **Submit** (or **Finish** in a survey), the page sends the results back, the server writes them and exits. It accepts exactly one submit; there is no mode that keeps serving. For questionnaires and quizzes that a tool or an agent is waiting on.

| Argument or option | Meaning |
|---|---|
| `FILE` | The quiz `.md`. Given a `.html`, `serve` exits 2 with "serve takes the quiz source; to collect results from a built page, use its **Download results** button" |
| `--out RESULTS` | Results file. Default: `<quiz-id>-results-<time>.json` next to the source |
| `--timeout SECONDS` | Default `1800`. `0` waits forever. Exits 2 on timeout |
| `--open` | Open the page in the browser |
| `--focus` | Tick **Focus mode** on the start screen, so pressing Start enters fullscreen with the sidebar closed (TECHNICAL_DESIGN.md, section 8). A page cannot go fullscreen without a click |
| `--section S` | Serve only this section. Results record `plan.source: "section"` |
| `--autosave PROGRESS` | Keep the attempt in progress in this file, so it resumes after the server or the browser closes. The file is a `results-v2` document whose attempt is still in progress, written atomically at most once a second. Started again with the same file, the page offers to resume it. The file is matched by its `quizHash`, which names one quiz and one version; its attempt's phase is `answering`. A file for another version, one that is not a results file, one already submitted, or one for another section exits 1, saying why, and is left alone. The same file as `--out` exits 2, since this one is deleted once the results are written. The browser's storage is not used, so the file is the only copy. Temp files a killed run left beside the file (`.NAME.<8 hex>.tmp`, in its folder, nothing else) are removed when the server starts and when the results are written |
| `--json` | Two JSON lines. As soon as the server is up: `{"status": "listening", "url", "port", "pid"}`. At the end: `{"status": "submitted", "results", "score"}`, or `{"status": "timeout"}` or `{"status": "interrupted"}` (Ctrl+C), with nothing written. Check errors give one line instead, before any server starts: `{"status": "failed", "errors", "warnings"}`, the issues in `check --json`'s shape, as `build` gives them. A results file that cannot be written gives `{"status": "error", "message"}` as the second line. A caller running `serve` in the background reads the URL from the first line |

Exit: `0` submitted, `1` check errors in `FILE`, `2` timeout, interrupted (Ctrl+C), a `.html` given, or usage error.

**One submit, and only a valid one**. A submit the server cannot accept (another quiz id, a body that is not a valid attempt at this quiz's version) gets HTTP 400; the page says it could not save and to use **Download results**, and the server keeps waiting. Once a submit is accepted the server is closing and takes no other. If the results file cannot be written, the page is told (HTTP 500) and says it could not save and to use **Download results**, and the command exits 2 with the file named. The same holds for every one-shot server command.

**Why only the source.** Shared pages carry no server code ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 7, foundation 9): a built page has no submit code, no `connect-src` and a CSP hash fixed at build, so serving it would mean injecting code into finished HTML. `serve` builds the page in memory from the source, which is also what `--section` and the check errors of exit 1 need. `library take` builds from the stored source and `bundle serve` takes `BUNDLE.yaml`, so neither needs a built page.

### quiz review

**changed**: drops `--once`, as `serve` does.

```text
quiz review FILE [--out REVIEW] [--since REVIEW] [--open]
                 [--timeout SECONDS] [--port N] [--json]
```

A form where the learner judges every question: keep, fix or drop, with a reason (such as "the answer key is wrong"; for essays and code also "rubric too loose", "points misallocated" or "criterion unclear"). Rubrics are shown with their points. **Finish** writes `review.json` ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 4, "`review-v2`"). Then `quiz check FILE --review review.json` fails until every *fix* question has changed and every *drop* question is gone.

**The form** (the Review boards on the Design canvas: Review, ReviewSince, ReviewFinish, ReviewPhone, ReviewVi):

- **Verdict first.** Each question is rendered with the page's own question components in their after-Submit state, from the same page data and key blob, with no answer (so the key's marks only: never "your answer", never a right or wrong colour). Questions come in source order, every question of a bank's pool, choices unshuffled: the learner judges the source, not an attempt. Each shows: the correct choices marked **Correct answer**, a typed question's **Accepted answer** with its tolerance, a `short` question's patterns as written in the source (the learner judges the key, so here they are shown), the explanation open, and for essays and code the rubric with each criterion's points and the sample answer; a matching question lists its right pairs and, under them, its distractors (the right-hand items that match nothing, in source order), each marked "Matches nothing" (`vi`: "Không ghép với mục nào"), since a distractor that is in fact a right answer is a wrong key. Under it, three buttons: **Keep**, **Fix**, **Drop**. Keep needs nothing more. A click on the chosen verdict clears it; choosing another verdict clears the reasons and keeps the note.
- **Reasons only after Fix or Drop**, as chips for that verdict, under "What needs fixing?" or "Why drop it?": Fix shows *Answer key wrong*, *Unclear*, *Other*, and on essays and code also *Rubric too loose*, *Points misallocated*, *Criterion unclear*; Drop shows *Duplicate*, *Off scope*, *Too easy*, *Other*. At least one is required ("Pick at least one reason." shows while none is); a note box opens with them, required with *Other* (an empty one takes the error colour and says so). Finish lists such questions first and writes nothing until they are complete.
- **The bar.** A small "Review" label before the quiz title, then the sidebar button, the text size, **Appearance**, **Keep the rest** and **Finish** (the accent button). The text size and Appearance are the page's own: the joined A− · 1× · A+ control (five sizes; the middle shows the factor and resets it), under `look: free` and `look: locked` alike, and the Appearance menu (Theme with Auto, Font as System, Sans, Serif, Readable, and Default look once something changed) only under `look: free`, the quiz's look as built by default. The status line: "Judged 14 of 32" with a thin progress bar and the percentage, "10 keep · 3 fix · 1 drop" in the verdict colours, and the current question.
- **The sidebar** is the page's sidebar while answering (TECHNICAL_DESIGN.md section 8, "Sidebar" and "Question map"), with verdicts in place of answers. With materials, one stacked block, 40% of the width, named **Questions & materials**: the verdict map on top (the parts as a vertical tab list, each with a ring for the share judged, beside the chosen part's heading, "6 of 12 judged · 3 fix · 1 drop" and its grid), the legend and the keys, then a **Materials** heading over the sheet chips and the open sheet, read-only. Without materials, the 320 px **Questions** sidebar with the parts as collapsible headings ("2 · Fourier transform", "6/12", a chevron) over their grids. Cells are 40 × 40 px: ✓ Keep (`--ok` on `--ok-wash`), ✎ Fix (`--warn` on `--surface`), ✕ Drop (`--bad` on `--bad-wash`), a plain cell for not judged, a 2 px `--text` border on the current question.
- **Keys.** `1`, `2`, `3` give Keep, Fix, Drop to the current question (the one last focused or scrolled to, outlined in the accent); `N` moves to the next question not judged; `Q` opens and closes the sidebar, `Esc` closes it. With materials, `M` does what it does on the page: it opens the sidebar and moves the focus to the sheets' chips (on a phone it opens the Materials tab, and again closes it), the button's title names both keys ("Questions & materials (Q, M)"), and the keys list in the sidebar adds "M materials" (`vi`: "M tài liệu"); without materials `M` does nothing. No key acts while typing in a note. Each verdict button carries `aria-keyshortcuts`.
- **The verdict label on a phone.** Under 520 px a card's verdict label ("Not judged", "Keep", "Fix", "Drop") sits on its own line directly under the question's head line ("Question 1 · 1 point" and its type tag), aligned left; above 520 px it stays where it is.
- **Earlier verdicts.** When `--out` already holds a review, the form opens with each earlier verdict, its reasons and its note in place when the question's hash is still the one judged; it counts as judged, and the learner may change it. A question that is new or changed since starts not judged. So Keep the rest and the Finish dialog touch only questions with no verdict for their current version ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 4, "What the form opens with").
- **Keep the rest.** The button marks every question not yet judged as Keep (recorded with `assumed`) and finishes, after a dialog "N questions not judged" with **Cancel** and **Mark them Keep and finish**.
- **Finish** with every question judged writes at once. With questions not judged it asks first: "N questions not judged", with **Go back to question K** (the first one) and **Mark them Keep and finish**. Both dialogs say the questions are written as Keep, marked as not looked at, and that a later `quiz review` can still judge them.
- **After writing**, the form shows "Review saved" with the counts written ("26 keep (14 not looked at), 3 fix, 1 drop"), that fullmark has closed the form and the tab can be closed, and the next command, `quiz check FILE --review review.json`.
- **With `--since`**, only the questions new or changed since the review are shown, and the status line starts "Asked again: N questions new or changed since your review of DATE", every count covering those N. A changed question shows, above its text, the learner's earlier verdict, reasons and note, and "What changed since": a line diff of the question's source against the version judged, with − and + at the line start (removed lines on `--bad-wash`, added on `--ok-wash`). A long line wraps, never cut and never scrolling sideways: the sign stays at the start of its first row and its wash covers every row, and the continuation rows are indented under the text, not under the sign. A new question has none of this. A changed question that was kept has the box with "Keep" (and "not looked at" when it was assumed) and, in place of the diff, "Changed since; a Keep does not store the earlier text", since a Keep stores no source. In the map the questions not asked are muted with a dashed border, cannot be chosen, and `N` skips them; the legend adds "not asked again". In the stacked map a part's ring and counts cover its asked questions ("0 of 4 judged"); a part none of whose questions is asked again (G67) has an empty ring and no count, its accessible name says "Part 1, Signals: nothing asked again" (`vi`: "Phần 1, Signals: không hỏi lại câu nào"), and choosing it shows its grid, all muted, under the heading's line "nothing asked again"; it stays choosable, so the learner can see where the asked questions are not. Keep the rest and the Finish dialog count and touch the questions asked only, and the form still sends one verdict for every question, those not asked as they were.
- **On a phone** (below 760 px), the page's compact bar ("Review: TITLE" over "Judged 15 of 32 · Question 20", and with `--since` "Judged 0 of 3 · Question 5"; the status line is not shown); Keep, Fix and Drop share the card's width in three columns, the reasons wrap and the note takes the width; **Keep the rest** and **Finish** leave the top bar for a bar at the foot of the screen, side by side, each half the width and 44 px tall at least, and the cards' column keeps room for it. The sidebar follows the page (G65): it starts closed; the top bar holds the sidebar icon and the Appearance icon (under `look: locked` too, as on the page, with the text size inside the Appearance menu); the sidebar takes the whole screen with a back link, and with materials its two parts become two tabs, **Questions** and **Materials** (`vi`: "Câu hỏi", "Tài liệu"), Questions first; without materials, the Questions map alone. Cells are 44 × 44 px with a 6 px gap; a tapped cell closes the sidebar and goes to its card.

| Argument or option | Meaning |
|---|---|
| `FILE` | The quiz `.md` only, as for `serve`: a built page is refused with exit 2 |
| `--out REVIEW` | Default: `review.json` next to the quiz. An existing file is merged into |
| `--since REVIEW` | Ask only about questions that are new or changed since this review, and merge into it. It is read and written, so `--out` may be left out; an `--out` naming another file exits 2, "--since merges into its own review: leave out --out" |
| `--timeout`, `--open`, `--port` | As for `serve`, so the timeout is `1800` seconds. The server exits after the first **Finish** |
| `--json` | `{"status", "review", "keep", "fix", "drop"}` |

A review file whose `fix` or `drop` entry lacks its `source` is refused (exit 2 for `quiz review`, also with `--since`; `check --review` and `inspect --review` give the reader's usual message), naming the entry. `--profile` and `--config` are as for `check`. A survey (`kind: survey`) has no key to judge: `quiz review` on one exits 2 before serving, "a survey has no answer key to review". A `scale` question in a graded quiz is judged like any other. With `--since`, when no question is new or changed since the review, nothing is served: it prints "nothing new or changed since your review of 28 Oct" (the date as `inspect --review` writes it) and exits 0, with `{"status":"unchanged","review":PATH}` under `--json`, and the file is not touched.

**Before it serves**, in this order: a built page, `--since` with an `--out` naming another file, or a survey: exit 2. Check errors in `FILE`: exit 1, printed as `check` prints them; when the only errors are questions without an id, exit 1 with them all named and "run `quiz ids FILE` first: a verdict follows its question by id" (nothing is served). An `--out` file (or, with `--since`, the `--since` file) that `check --review` would refuse (unreadable, invalid, a 0.x review, the review of another quiz): exit 2, with the same messages; a `--since` file that does not exist exits 2, "--since needs an existing review; run quiz review FILE first".

**The submit** is `{quizId, quizHash, judged}` with one verdict for every question; the server answers 400, and keeps waiting, for another version of the quiz, a missing or unknown id or an incomplete verdict (a fix or drop with no reason, `other` with no note, a rubric reason on a question that is neither essay nor code). It then merges into the review file as it is at that moment and writes it atomically, and ends.

**A refused submit**, in the `review` form and the `grade --web` form, shows the server's message after the form's own words ("Chưa lưu được bản rà soát:", "Chưa lưu được điểm:" in Vietnamese), in English, as the terminal prints it.

**Output.** Human: `review.json written: 26 keep (14 not looked at), 3 fix, 1 drop` (the parenthesis only when some were kept without being looked at) and the next command, `next: quiz check FILE --review review.json`. `--json`: first the `listening` line (as `serve`), then `{"status":"written","review":PATH,"keep","fix","drop"}`, counted over the quiz's current questions as `inspect --review` counts them (`keep` includes the assumed ones); `{"status":"timeout"}` (exit 2) and `{"status":"interrupted"}` (Ctrl+C, exit 2) leave an existing `--out` file byte for byte.

Exit: `0` written, `1` check errors in `FILE`, or a question without an id (nothing is served; the message says to run `quiz ids FILE` first, since a verdict follows its question by id), `2` timeout, Ctrl+C or usage error (a built page, `--since` beside another `--out`, a survey, a refused or missing review file).

### quiz brief

**changed**: `--tui` is a real terminal form, and both forms check that answers are detailed enough.

```text
quiz brief DIR [--web [--no-open] [--timeout SECONDS] [--port N] | --tui]
               [--purpose P] [--scope TEXT] [--kinds LIST] [--kinds-other TEXT]
               [--elsewhere TEXT] [--count N] [--minutes N] [--mix LIST]
               [--difficulty D] [--mode M] [--weak-topics yes|no] [--commitment N]
               [--language en|vi] [--request TEXT] [--profile P]
               [--accept-defaults] [--json]
```

Writes `DIR/brief.yaml` and an empty `DIR/content/` for a quiz an agent will write. One question file drives the flags, the `--web` form and the `--tui` form, so all three ask the same questions in the same words.

**The question file** is `src/brief/questions.yaml`, shipped with fullmark and checked against a zod schema by a test. One entry per brief key: `key`, `kind` (`choice`, `multi`, `text` or `number`), `label` and `help`, `choices` each with a `label` and `hint`, `min-words` with an `example`, `follow-up` (the text box for *other*, itself an entry: `kinds_other` is the follow-up of `content.kinds`), `human-only`, `default`, and `section` (the steps of `--tui`). Also: `flag`, the option that answers it; `optional`, a human-only value that may be left empty, its default then used and nothing asked again (`commitment`, unlike `purpose`); `min` and `max` for a number; `default-by-purpose`, a default that depends on the purpose (`profile`); and on a choice of a `multi`, `default-for`, the purposes whose default includes it (`mix`). A top-level `sections` list gives each section's `id` and its title. Every text is given in `en` and `vi`. The flags take their allowed values, defaults, detail rules and `--help` text from it; the forms take everything, in the language of `--language`.

**Detail rules.** The question file can give a text answer a minimum (`min-words`, plus an example of a good answer). The scope needs at least 4 words, for example "lectures 3 to 5, the Fourier transform" rather than "signals". Both forms show the example and ask again when an answer is too short. Through flags, a short answer is accepted with a `brief.vague` warning, which `--json` lists, so the agent can go back to the user.

| Option | Values | Default | Human-only |
|---|---|---|---|
| `--purpose` | `self-study`, `exam-prep`, `classmates`, `survey` | `self-study` | yes |
| `--scope` | text: chapters, lectures, topics | none | yes |
| `--kinds` | comma list: `lecture-slides`, `textbook`, `notes`, `past-exams`, `lab-manual`, `other` | empty | no |
| `--kinds-other` | text, needs `other` in `--kinds` | | no |
| `--elsewhere` | text: material not in `content/` | empty | no |
| `--count` | number of questions | `20` | no |
| `--minutes` | time limit, `0` for none | `0` | no |
| `--mix` | comma list: `recall`, `understanding`, `calculation`, `code`, `essay` | per purpose: `self-study` recall, understanding, calculation; `exam-prep` understanding, calculation, essay; `classmates` recall, understanding; `survey` none | no |
| `--difficulty` | `warm-up`, `like-the-exam`, `harder` | `like-the-exam` | no |
| `--mode` | `each-question`, `at-the-end`, `timed-exam` | `at-the-end` | no |
| `--weak-topics` | `yes`, `no` | `no` | no |
| `--commitment` | the score the learner commits to, a percent from 1 to 100; `0` for none. The form asks "What score are you committing to?" and may be left empty. The agent writes it into the quiz as `pass_mark`, and the results card shows it as the goal | `0` | yes |
| `--language` | `en`, `vi`: the quiz's language, written as `lang` and copied into the quiz's front matter | `en` | no |
| `--request` | free text for the agent | empty | no |
| `--profile` | a built-in or configured profile | from purpose: `exam-prep` gives `exam`, `survey` gives `survey`, others `default` | no |

| Other option | Meaning |
|---|---|
| `--web` | Ask in a form in the browser, served once on 127.0.0.1. Waits `1800` seconds by default, as for `serve`. `--timeout`, `--port` and `--no-open` belong to it: without `--web` each exits 2 ("--port needs --web") |
| `--tui` | Ask in the terminal, for SSH sessions and machines without a browser. It shows the same detail as the web form: every question's label and help, a hint beside each choice, the follow-up text box when *other* is picked, and the sections as steps with progress (*Step 1/2: About the material*, the section's title from the question file). Human-only questions (purpose, scope) cannot be skipped and nothing is pre-chosen for them: the cursor starts on the first choice, and the summary shows the answer before anything is written. A summary screen lists every answer, marks which are defaults, and lets you go back to any question before anything is written. Ctrl+C writes nothing and exits 2 (`{"status": "cancelled"}` with `--json`). It reads stdin and draws on stderr, so stdout holds only the result line; both must be terminals, or it exits 2 with "`--tui` needs an interactive terminal: use `--web`, or give the answers as flags". A scope under its `min-words` is asked again, never written with `brief.vague`. A terminal that reports no width (0 columns) is drawn at 80 |
| `--accept-defaults` | Also fill the human-only values that need an answer and have a default (today `purpose`), recorded as `decided_by: agent`. Only when the user has handed those choices over. An `optional` one (`commitment`) keeps its default as `decided_by: default`, since `0` is no goal and nothing is chosen for the learner |
| `--json` | `{"status", "brief", "defaults_applied", "warnings"}`, or `{"status": "needs_input", "missing": [...], "how"}` |

**Defaults per purpose**. The defaults of `count`, `minutes`, `mix`, `difficulty` and `mode` can be changed for each purpose in the machine config, for every subject:

```toml
# config.toml
[brief.purpose.exam-prep]
mix = ["calculation", "essay"]
count = 30
minutes = 90
```

Values are checked as the flags are; an unknown purpose, key or value exits 2 with `config.toml:line`. A value taken from here is a default (`decided_by: default`). Briefs fitted to a subject or a template: [proposals/brief-purposes.md](proposals/brief-purposes.md).

**The forms** (`--web`, `--tui`). Every question with a default starts at it; an answer left at its default is recorded `decided_by: default`, one the user changed or typed is `user`, and the summary screen marks the defaults the same way, so a form and a flags run that gives flags for exactly the changed answers write the same bytes. An answer flag given with a form pre-fills its question (recorded `user` when kept) and every question is still shown, so an agent can prepare the form and the human confirms it. In `--web`, a pre-filled answer is marked **Pre-filled for you** (vi *Điền sẵn cho bạn*; **Pre-filled**, vi *Điền sẵn*, in the summary and the status line) while it is kept, and once changed its question offers a way back to it (**Back to the pre-filled answer**, vi *Về lại câu điền sẵn*); while any is changed, the note at the form's top offers **Back to every pre-filled answer**, with the count changed (vi *Về lại tất cả câu điền sẵn*), which leaves the answers to the other questions as they are. In Vietnamese, the forms and the question file call the agent **AI**, never *trợ lý*. `--language` also sets the form's language (default `en`). A bad value exits 2 before the form opens. `--accept-defaults` with a form, and `--web` with `--tui`, exit 2. In `--web`:

- **Cancel**, in the bar, ends the run at once, with no dialog, as Ctrl+C ends `--tui`: nothing is written and no `DIR` is created, the command prints "cancelled: nothing was written" on stderr (`{"status": "cancelled"}` with `--json`) and exits 2, and the page shows the command to start again, with the flags it was given. Ctrl+C in the terminal does the same, and the page says the server has stopped on its next action.
- The sidebar's foot shows the minutes left before the form closes, counted from when the page loaded ("The form closes in 29 min if left open. Cancel writes nothing."; "in less than a minute" at the end); with `--timeout 0` it says only "Cancel writes nothing."
- The form starts in light or dark as the system is, in the system font; Appearance always offers every theme and font. A choice lasts while the page is open and is not stored.
- The profile is asked under **More options** as choices: the built-in profiles, then every profile `--profile` would accept for this `DIR` (the machine config and a `fullmark.toml` found from `DIR`). It starts at the purpose's profile and follows the purpose until changed. A box under it says what each built-in profile checks; a profile of the user's own is given by its name and the file it comes from. The question file keeps `profile` as text, so the flags and `--tui` ask for a name.
- **On a phone** (below 760 px), as Review's and Grade's: the compact top bar ("Brief: DIR" over "Answered 12 of 14 · 2 to answer"), the sidebar icon and Appearance; one column of choices, every control at least 44 px; **Cancel** and **Finish** in a bar at the foot, side by side, each half the width; the sidebar takes the whole screen, and a tapped row closes it and goes to its question; the summary puts each answer under its question and who chose it.

**Also**: `commitment` is never required: without `--commitment`, or left empty in a form, it is `0`, no goal, and the agent writes no `pass_mark`. `focus_tags` is always `[]` here, since `quiz brief` reads no history; with `--weak-topics yes` the warning `brief.no-history` says to pick the weak topics from the learner's reports (the library's brief fills them, step 4). A `DIR` that already holds `brief.yaml` exits 2 before asking anything: edit it, or delete it to start again; an existing `content/` is kept, a missing `DIR` is created.

Exit: `0` written, `2` usage error, timeout, form cancelled, `--tui` without a terminal, or `DIR/brief.yaml` exists; `3` purpose or scope missing and no form asked for (nothing written). When several apply, the first wins, in this order: the flags (a bad value, or options that do not go together), then an existing `DIR/brief.yaml`, then the terminal for `--tui`, so an agent preparing a form learns of its own mistake whatever terminal it has.

**The file.** `brief.yaml` holds every key below, always. `quiz brief` fills the defaults when it writes, so a reader never fills any: `check` treats a missing key like an unknown one, as `brief.invalid` (a warning), and then does not hold the quiz against the brief.

| Key | From | Value |
|---|---|---|
| `purpose`, `scope` | `--purpose`, `--scope` | as the options |
| `content` | `--kinds`, `--kinds-other`, `--elsewhere` | a mapping with exactly `kinds` (a list), `kinds_other` and `elsewhere` (text, empty when not given) |
| `count`, `minutes`, `mix`, `difficulty`, `mode`, `language`, `request` | the option of the same name | as the options; `mix` is a list |
| `weak_topics` | `--weak-topics` | `true` or `false` |
| `commitment` | `--commitment` | a number, `0` for none |
| `focus_tags` | earlier results, when `weak_topics` is true | a list of tags, empty otherwise |
| `profile` | `--profile` | the profile name, resolved from the purpose when not given |
| `decided_by` | | for each key above, who chose it: `user`, `default` or `agent` |

### quiz grade

**changed**: `grades-v2` with rubric modes and a grader, and `--web`.

```text
quiz grade RESULTS... --quiz FILE [-o OUT] [--grades GRADES] [--json] [--plain]
quiz grade RESULTS --quiz FILE --web [--grades GRADES] [--name NAME] [--open]
                   [--timeout SECONDS] [--port N] [--json]
```

Re-grades an attempt with the shared grader and writes a report: score, per-section and per-tag results, every wrong answer with its explanation, and the essays and code laid out for a grader (each question's text, the answer, word count, rubric with criterion ids and maximums, and the sample answer). The rubric modes and the grades format are in [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 6.

**The form** of `--web` (the Grade boards on the Design canvas: Grade, GradeBanded, GradeCode, GradePhone, GradeFinish, GradeBlocked, GradeDone, GradeVi; the rubric itself is drawn on RubricC, which supersedes the rubric on the others):

- **The layout.** One question at a time, since essays are long: its prompt across the card, then the learner's answer across the card, then the rubric box across the card under it, **Previous** and **Next** at the card's foot. The card is as wide as the boards draw it (about 862 px at 1280 px with the sidebar open); `build`'s page keeps its own width. The top bar: "GRADE", the quiz title, the attempt's date; **Questions** (`Q`), Appearance, **Finish**.
- **The sidebar**, 300 px, in three groups, each folding under its head (a chevron, the name, a count): **To grade** ("2 of 4 graded"), the answered essay and code questions with a state icon (graded, half graded, needs a note, not graded), their mode and score, a graded row tinted green and a half-graded or needs-a-note row red; **Not answered** (each 0 of its points, read-only); and **Scored by fullmark**, one graded row, chosen like a question row ("26 questions, marked on submit", 34 / 40). Under them, a legend of the icons and the keys.
- **The answer.** It keeps its line breaks, in a box that scrolls on its own past 420 px, with its word count (essays) or line count (code). A code answer is a `pre` in the monospace font, not highlighted. Maths in an answer is shown as typed. The sample answer starts hidden, so the grader reads the learner's answer first: a **Show the sample answer** button over the answer opens it beside the answer, the two side by side (answer left, sample right, each half the card), and **Hide the sample answer** closes it. A question with no sample answer has no button.
- **The rubric** is the rubric box the replay shows ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 6, "The rubric box"), editable. There is one layout, with no switch and no rule by number of criteria. Every mode uses one control, the slot [erase | − | value | +] / [max]: a rounded group drawn like the filter's segmented buttons, its edge in `accent` once set and `bad` for a value off the steps; the value centred, with no "/ max", and it can be typed. From empty, + gives the maximum and − the first step below it; an empty band starts at the scale's middle (4.5 for 0 to 9), so the form suggests nothing. A muted "/" then a separate 56 px box shows the maximum: pressing it gives full marks, and it lights `ok` while the value is full marks. The step is not on the buttons, which have "−0.25" and "+0.25" tooltips and names such as "Take 0.25 off Accuracy"; it is written in the box's head. A `holistic` score moves by the rubric's `step`, or 0.5 when it has none; each bullet has an optional verdict, [erase | Met | Partly | Missed], not scored, the chosen one in its colour's wash.
- **Erasing.** The eraser is the first segment of each control and clears only that score or verdict; the note is typed work and stays. With nothing to clear it fades to the line colour and does nothing. A note left without a score counts as not given. **Clear this question**, one labelled button with the trash icon at the card's foot under the box, clears every score, verdict, note and text of the question.
- **Notes and reasons**, as the validator asks (TECHNICAL_DESIGN.md, section 6). A criterion's note is optional at full marks. Once a mark below the maximum (a band below `scale.max`) is chosen it is required: the sunken field gets a red 2 px edge and "Required: a mark was lost, say why" while it is empty. **Why this score** is required on a `holistic` grade once its score is set, optional elsewhere; **To improve** is always optional.
- **The card's state** is its badge: **Waiting for a grade**, **Half graded**, **Needs a note**, then the result badge the replay shows. The box's total shows "–" until every component is given.
- **The running total.** The status line under the top bar: "Graded 2 of 4", "8.75 of 12 points given" (over the graded questions) and "Score so far 42.75 / 56 (76%)", by section 6's rule for pending grades (the questions fullmark marks, the graded essays and code, each unanswered one at 0; the pending ones left out). The box's total is computed: the sum for `additive`; for `banded` the line "mean 6.25, IELTS rounding: band 6.5, so 6.5 of 9 points"; the score given for `holistic`.
- **An unanswered question** opens read-only from its "Not answered" row: the prompt, "No answer · 0 / 4", the rubric's criteria as text with no controls, and the sample answer when there is one. `N` skips it, it never blocks Finish, and nothing about it is written.
- **fullmark's own marking.** The "Scored by fullmark" row is chosen like a question row (the current-row edge, `aria-current`) and shows the attempt's replay inside the form, with nothing changeable: a wrong key is fixed in the quiz (`quiz review`, then rebuild) and the attempt graded again.
  - **The second page.** The server holds, beside the form at `/<token>/marked`, the attempt's replay as `quiz replay RESULTS --quiz FILE` builds it, with no grades (the grades are being made), so the essays and code show as pending. It is a shared-style page with no server code (TECHNICAL_DESIGN.md, section 7, foundation 9), under the same token and refused without it. It opens on the **Missed** filter (All · Missed · Flagged is the replay's own), offers no **Retry missed** (the attempt is not the grader's) and stores nothing in the browser (`PageReplay.grader`, set for this page only). It has no top bar: it starts at the Replay banner ("Replay · Attempt of 23 Oct 2026 · grades pending"), then the filter, the results card and the question cards, so the form's own bar and sidebar are the only ones. Its results card keeps the score, points, time, goal and the pending note, and has no **Download results** (the learner's action).
  - **The frame.** The form's main column shows that page in a frame filling the column, under the form's top bar and beside its sidebar, with the title "Marked by fullmark: N questions" for assistive technology, the frame's only name. While the frame shows, the form's `main` is named "Scored by fullmark" (the sidebar group's head; vi "Fullmark chấm"), so it and the `main` of the page in the frame are two landmarks told apart; at other times it has no name. The page in the frame keeps its own `main`. Its look follows the form's: the form sets its theme and text size on the frame's document (same origin) when the frame is made and whenever they change. The frame is made the first time the row is chosen and kept: choosing a question row brings the card back, choosing the row again finds the replay as it was (its scroll and filter), and the form never unloads, so nothing typed is lost. The form's CSP gains `frame-src 'self'`; the second page's CSP is the page's own. On a phone the row works the same and the sidebar closes as it does for a question. The keys stay as they are: `N` skips the row.
- **Finish** opens a dialog. With a problem (a half-graded question, a missing note or reason) it is **Some grades are not finished**, listing each as a link to its question, with only **Go back**: nothing can be saved, since the validator would refuse it. Otherwise it is **Save your grades?**: "2 of 4 questions graded, 8.75 of 12 points given", the questions left "stay pending: the report leaves them out of the score until someone grades them", and **Go back** or **Save grades**. With nothing graded, **Save grades** is disabled, with "Nothing is graded yet". Closing the tab or Ctrl+C writes nothing and exits 2, as for `serve`.
- **The grader's name** is asked in the Finish dialog, not at the start: a required "Your name, as the grader" field, **Save grades** disabled while it is empty, and the help line "Written into the grades file as who graded. Required." With `--name` the dialog says "Graded as NAME (from --name)" instead. The form keeps no name between runs.
- **Pre-filled grades** (`--grades`; the GradeAI board). Every value, note and text of the file is in place, and a question it grades counts as graded. Each question names its own grader: its own `grader`, else the file's.
  - **The status line** ends with a pill in the `info` colours, with the sparkle: "Pre-filled · 3 as given, 1 adjusted", counted live; its tooltip lists the graders, "Pre-filled from Claude Opus 5.5 (2) and Claude Sonnet 5.5 (2)".
  - **The box head's right side** names the question's grader: "Graded by Claude Sonnet 5.5 (AI)" over "5 Nov 2026 · unchanged" while the question is as given, then "Claude Sonnet 5.5 (AI), adjusted by you" over "saved at Finish". A grader that is a person is named without "(AI)".
  - **The card's badge** is the result, as for any graded question.
  - **The pre-filled box.** Each slot opens with a box holding the sparkle and the pre-filled value, at the value's size (76 px, 1.1em bold; 88 px at 0.92em for a verdict): [✦ 1.5] [erase | − | 1.25 | +] / [1.5]. While the row's score and note are as given, the box is lit (the `info` wash, a 2 px border in a gradient of the theme's blues, `info` to `accent` to `hint`) and pressed, and does nothing; once either changes it is plain, still showing the pre-filled value, and a press puts that row's score and note back. A verdict's group and the one score's control open with the same box. A computed total shows the pre-filled total in it, display only, its border dashed once the total differs. **Why this score** and **To improve** have a small "✦ AI's" button by their label that puts the pre-filled text back. The sparkle marks a pre-filled value everywhere; its name says what a press does ("Back to the AI's score and note for Accuracy: 1.5").
  - **The card's foot.** While the question is as given, only **Clear this question**, on the right. Once anything changes, **✦ Back to the AI's grade** on the left puts the whole question back.
  - **The sidebar's mark** answers two questions: where the grade came from, the sparkle (`info`) for an AI and ✓ for a person; and whether it was changed in this sitting, a pencil (`accent`). The AI's adjusted mark is one drawing, the sparkle's main star with the pencil in its small star's place, haloed in the row's wash; a person's adjusted grade is the pencil alone. Under the question's name, "Claude Sonnet 5.5's grade" ("Điểm của Claude Sonnet 5.5"), the grader's full name, cut with an ellipsis when the row is too narrow and whole in the row's accessible name (nothing shortens a name), or "adjusted by you". The row keeps the graded colours; "needs a note" and "half graded" keep their marks. The legend: "✦ AI's · ✦✎ AI's, adjusted · ✓ A person's · ✎ A person's, adjusted · ! Needs a note · current".
  - A question the file leaves `null` is graded as without `--grades`.
  - **On a phone** (below 760 px): each pre-filled box is on a line of its own above its control (a slot, the one score, a verdict group, the total), left-aligned at its own size, the control row under it as without `--grades`. Once anything changed, the card's foot stacks **✦ Back to the AI's grade** over **Clear this question**, each the card's full width. The status pill is at the top of the sidebar's sheet, under its title, since the compact bar has no room; "✦ AI's" stays by its label.
  - **Pre-filled by a person.** The words name what was given, not an AI: "✦ Given" by the texts and "✦ Back to the given grade" on the foot ("✦ Đã cho", "✦ Về điểm đã cho"), the pre-filled box's name "Back to the given score and note for Accuracy: 1.5", and the box head names the person with no "(AI)".
- **After saving**, a card replaces the form, as Review's does: "Grades saved", the score as the report gives it, "2 questions graded by NAME; Question 27, Question 30 still pending" (with `--grades`, then "Reviewing the grades of Claude Opus 5.5 and Claude Sonnet 5.5"), the two files written (`*-grades.json`, "your grades (kind: human)", and the report), and "The server has stopped. You can close this tab."
- **Keys.** `Q` opens and closes the sidebar, `Esc` closes it or a dialog, as in Review; nothing else, and no key while typing in a note. A verdict group is a radio group, so the arrow keys move within it.
- **On a phone** (below 760 px), as Review's: the compact top bar ("Grade: TITLE" over "Graded 1 of 4 · Question 21"), the sidebar icon and Appearance; the card stacks the answer (open, in a `details`) over the sample (closed) and the rubric box; the controls 44 px tall; a foot bar with ← Previous, **Finish** and Next → (the arrows 44 px icons with names). The sidebar takes the whole screen with a back link, as in Review.
- **Words.** Every word of the form is in its own catalog, en and vi (`src/core/i18n/grade.ts`, as Review's is in `review.ts`), the box's words shared with the page's catalogs; the answer and the sample answer are named as the page names them ("Câu trả lời", "Bài mẫu"; the button "Hiện bài mẫu" and "Ẩn bài mẫu"), so a grader and a learner see the same words (the vi words from the GradeVi board: **Chấm**, **Cần chấm**, **Hoàn tất**, **Lưu điểm**, **Đã chấm**, **Chấm dở**, a word count in "chữ"); the questions and answers stay in the quiz's language, and the quiz's `ui_lang` chooses.

| Argument or option | Meaning |
|---|---|
| `RESULTS...` | Results files. Several: see [Several files](#several-files). Each gets a report and, with `--json`, a grades template. `--grades`, `--web` and `--name` take one results file |
| `--quiz FILE` | Required. The quiz source, for the answer key and rubrics. Must match the results' `quizHash` (exit 1 otherwise) |
| `-o`, `--output OUT` | Default: `RESULTS` with `-report.md` (or `-report.json`). With several files, a folder |
| `--grades GRADES` | Validate a filled-in grades file, compute totals and bands from its components, and fold it into the report. Questions left entirely empty stay pending. Only an explicit `--grades` is read: unlike `replay`, `grade` never picks up `<RESULTS>-grades.json` by itself, since that is also the name of the empty template |
| `--json` | Write `*-report.json` instead of Markdown, plus a `*-grades.json` template holding each rubric's structure with empty cells. An existing `*-grades.json` is never overwritten: the template is skipped with a warning that says to delete the file for a fresh one |
| `--web` | Grade by hand in a form: the answer next to the rubric, inputs limited to valid steps or bands, a running total. With `--grades`, that file's grades are pre-filled to accept or adjust ("Pre-filled grades", below). Writes a new grades file with `kind: human`, each pre-filled question carrying `reviewed`, the grader it was pre-filled from, then the report. Waits `1800` seconds by default, as for `serve` |
| `--name NAME` | With `--web`: the human grader's name. Without it, the form asks. Without `--web`: exit 2, "--name names the grader of --web" |
| `--timeout`, `--open`, `--port` | With `--web`, as for `serve`: the timeout is `1800` seconds |

**Before it serves**, `--web` refuses, in this order: several results files, `--name` without `--web` (exit 2); then a `--grades` file as `quiz grade --grades` refuses it (exit 1, nothing served); then the results file and the quiz as `quiz grade` refuses them, with the same exits and messages (a hash mismatch exits 1); then an attempt with nothing to grade: it serves nothing, writes nothing, prints "nothing to grade: no essay or code question was answered; quiz grade RESULTS --quiz FILE writes the report" and exits 0 (`{"status":"nothing-to-grade"}` under `--json`); then an existing grades file: exit 2, "RESULTS-grades.json already holds grades; move it away, or adjust it with --grades". An existing file that is an empty template (`grader: null` and every component, note and text `null`) is replaced. An existing file that `--grades` itself names is not refused either: it is the usual way to review an agent's grades (`--grades RESULTS-grades.json`), and **Save grades** replaces it atomically; a timeout or Ctrl+C leaves it byte for byte.

**The submit** is `{quizId, quizHash, grades}`, the filled `grades-v2` document. The server sets the grader to `{kind: "human", name, at}` (the name from `--name`, else the form's; `at` from its own clock, in local time with its offset), checks the document with the validator `--grades` uses against this attempt, and answers 400, still waiting, with the problems for another version of the quiz, an empty name, a half-filled question, a lost mark with no note, a holistic score with no reason, or nothing graded at all. It then writes `<RESULTS without .json>-grades.json` beside the results file, so `quiz replay` shows it with no option, and the report as `quiz grade RESULTS --quiz FILE --grades GRADES` writes it (`<RESULTS>-report.md`; `-o` is not part of `--web`), both atomically, and ends. Nothing is written unless **Save grades** is accepted: a timeout or Ctrl+C leaves an existing template byte for byte.

**Output.** Human: `grades written: 2 graded, 2 pending (results-grades.json)` and `report written: results-report.md`. `--json`: first the `listening` line (as `serve`), then `{"status":"written","grades":PATH,"report":PATH,"graded":N,"pending":M}`, or `{"status":"timeout"}` and `{"status":"interrupted"}` (exit 2, nothing written). The report stays Markdown under `--web`; `quiz grade RESULTS --quiz FILE --grades GRADES --json` gives the JSON one afterwards.

Exit:

- `0`: written.
- `1`: hash mismatch, or invalid grades. Nothing is written. Every problem is listed, with one exception: a question whose fixed values (mode, points, maximums, weights, scale) differ from the template has its scores checked only once those match. Problems include a missing grader, a score off its step or above its maximum, an unknown criterion, a lost mark with no note, or a half-filled question.
- `2`: I/O error, timeout, or the form was cancelled.

### quiz replay

**new**. A page already submitted, from a results file, with no library.

```text
quiz replay RESULTS... --quiz FILE [--grades GRADES] [-o OUT] [--open | --no-open]
                    [--fonts quiz|all|none] [--built-at ISO] [--ui-lang en|vi] [--json]
```

Writes the quiz page **already submitted** with the learner's attempt: their answers, right and wrong, the explanations, the agent or human grades for essays and code, and **Retry missed** working. It is the same page the learner saw after pressing Submit, as the Attempt reducer rebuilds it ([TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), section 4).

| Argument or option | Meaning |
|---|---|
| `RESULTS...` | The `*-results-*.json` files the page exported. Several: see [Several files](#several-files), one page per attempt (a page holding many attempts is a bundle, which is not in v1) |
| `--quiz FILE` | The quiz `.md` the attempt was taken on. Parsed, but `check` is not run: the attempt already happened on this text |
| `--grades GRADES` | Show these grades for essays and code. Default: `<RESULTS without .json>-grades.json` beside the results file, if it exists (the name `grade --json` writes); otherwise they show as pending. A grades file is checked against the quiz as `quiz grade` does, so one for another version of the rubric exits 1. One results file only |
| `-o`, `--output OUT` | Output path. Default: `RESULTS` with `-replay.html`, so a replay never overwrites a page built from the source. With several files, a folder |
| `--open` / `--no-open` | Open the page after writing it. Default: open for one file; with several, nothing is opened |
| `--built-at`, `--ui-lang`, `--fonts` | As for `build` |
| `--json` | `{"status", "output", "bytes", "attempt", "graded"}` |

Exit: `0` written, `1` the attempt's `quizHash` does not match `FILE` (the output names the version it was taken on), `FILE` does not parse, or `GRADES` is invalid; `2` I/O or usage error.

### quiz stats

**changed**: scores per question and per tag, so partial attempts (section, missed) count correctly; reads reports, so any version counts.

```text
quiz stats FILE... [--quiz QUIZ] [--json]
```

Progress across several attempts at one quiz: score by date, percent per tag, the weakest tags, the questions missed most often, and for graded essays and code the percent (or average band) per rubric criterion. For surveys, an "Answers over time" table instead.

| Argument or option | Meaning |
|---|---|
| `FILE...` | Two or more attempts at the same quiz: JSON reports (`*-report.json`, from `grade --json`) of any version, each graded against the version it was taken on; or results files whose version is `--quiz`'s, graded on the spot as `grade` would. A results file of another version exits 1 naming it, with the fix "grade it with that version first: `quiz grade FILE --quiz OLD.md --json`". Questions are matched across versions by id (a quiz with a question without one fails `check`, so it never reaches a report; a report that still holds a question with an empty `id`, from an older `grade`, exits 1 with the fix "run `quiz ids FILE`, then make it again with `quiz grade --json`", since such questions would merge under one key) |
| `--quiz QUIZ` | The current source: the questions it holds take its titles and tags, and results files are graded with it. Without it, names come from the newest report, and a results file exits 1 with the fix "give `--quiz`, or grade it first" |
| `--json` | `{"status": "done", "quiz": {"id", "title"}, "attempts": [{"file", "submitted", "version", "plan", "earned", "points", "percent", "pending"}], "tags": [{"tag", "earned", "points", "percent", "attempts"}], "weakest": [tag], "questions": [{"id", "hash", "title", "seen", "missed", "earned", "points", "changed"}], "criteria": [{"question", "criterion", "attempts", "earned", "max", "percent", "band"}], "answers": [{"question", "hash", "title", "answers": [{"file", "submitted", "answer"}]}]}`. `answers` is a survey's "Answers over time", empty for a quiz; a survey's `tags`, `questions` and `criteria` are empty. An attempt's `plan` is `{"source", "section"}` |

```text
rust-basics · Rust basics · 5 attempts, 2 versions
Attempts   3 Oct 62% · 10 Oct 71% (section ownership) · 17 Oct 80%
Tags       borrowing 54% (13 of 24 points) · traits 70% · ownership 88% · no tag 75%
Weakest    borrowing, traits
Missed     q-k7m2qx "Which borrow…" wrong in 4 of 5 · q-a1b2c3 3 of 5
Criteria   interp 60% over 4 attempts · LR band 5.5 average
```

- **Each attempt counts only the questions it had** (`plan.questions`), so a section or retry attempt is never a low score on the whole quiz. Pending grades count as not yet scored.
- **Weakest:** up to three tags with the lowest percent, among those seen in at least two attempts.
- **Missed:** wrong or partly right, most often first, then by id; at most ten in the human output, all in JSON. An unanswered question counts as seen, not missed: the meaning of *missed* in TECHNICAL_DESIGN.md section 10, which `--missed` shares.
- **Criteria:** additive criteria as the percent of their marks, banded ones as the average band to one decimal (`5.9`); holistic ones (met, partly met, missed) are left out, having no percent.

Exit: `0` done, `1` a results file of another version than `--quiz`'s, a report with a question without an id, or a file that is neither a report nor results; `2` the files belong to different quizzes (by the reports' quiz id), fewer than two files, or an I/O error.

### quiz inspect

**same**.

```text
quiz inspect FILE [--review REVIEW] [--json]
```

Summarises a quiz: question types, points, sections, tags, banks and the spread of answer positions. With `--review`, counts of the questions judged keep, fix and drop.

**Output**. The quiz is checked first; whenever it parses, the summary is printed, then the issues as `check` prints them.

```text
rust-basics · Rust basics · version 9f3a
18 questions · 25 points · 3 sections · time limit 25m
Types      single 8 (10 points) · multi 3 (5) · code 2 (6) · essay 1 (4)
Sections   ownership 6 questions, 8 points · collections 6, 10, pick 4 · traits 6, 7
Tags       rust 18 · borrowing 5 · no tag 2
Positions  A 5 · B 6 · C 3 · D 2
Review     keep 14 (6 not looked at) · fix 2 (1 changed since) · drop 1 · not judged 1 · 28 Oct
```

Points count a bank's `pick`, not its pool: each question in a bank carries `pick` over the pool's size of its points, so types, tags and sections add up to the total (a share may show as a decimal). Question counts are the pool's. Untagged questions are the last row of Tags, "no tag" (`{"tag": null}` in JSON). The Positions row is left out when no question has a right answer (a survey); the JSON keeps the zeros. A quiz that does not parse prints only its issues, with `"quiz": null`. `errors` and `warnings` are the issue objects of `check --json`. **Positions** counts the correct choices of `single` and `multi` questions by letter, in source order, as `answers.position-skew` does. `--json`: `{"status": "done" | "failed", "quiz": {"id", "title", "hash", "short"}, "questions", "points", "timeLimit", "types": [{"type", "count", "points"}], "sections": [{"id", "title", "questions", "points", "pick", "time"}], "tags": [{"tag", "count", "points"}], "positions": {"A": 5, …}, "review", "errors", "warnings"}`; `review` is, with `--review`, `{"reviewedAt", "keep", "assumed", "fix", "fixChanged", "drop", "unjudged"}`, else null.

**`--review`** is read as `check --review` reads it, with the same exits for a review that cannot be used, and its findings (`review.fix`, `review.drop`, `review.unconfirmed`) are among the issues. The counts are over the quiz's current questions; entries for questions no longer in the quiz are left out. The Review row comes after Positions: `keep` counts every Keep, `(N not looked at)` those kept by Keep the rest or the Finish dialog (`assumed`), `fix N (M changed since)` the fix verdicts and those whose question changed (waiting for `review --since`), `not judged` the questions with no verdict, and the date is that of the last Finish. The parentheses are left out when they count nothing.

Exit: `0` done, `1` check errors, `2` I/O error, or a `--review` that cannot be used.

### quiz new

**changed**: starts from a user template or an existing quiz as well as a built-in template. `templates` is now `quiz template list`.

```text
quiz new TEMPLATE [PATH] [--json]
quiz new --from FILE [--skeleton] [PATH] [--json]
```

Copies a template and its assets to `PATH` (default: the current folder). `PATH` is a folder, where the quiz is written as `quiz.md`, or a file ending in `.md`, written under that name. Never overwrites: an existing file exits 2. **A new quiz gets its own identity**: the copy drops every question's `id` and writes a fresh quiz `id` into the front matter, the target's name slugged: the folder's name when the file is `quiz.md` (`quiz new rust demo/` gives `id: demo`), else the file's name (`quiz new rust signals/week3.md` gives `id: week3`). A name starting with a digit gets `quiz-` in front (`2024-midterm/` gives `quiz-2024-midterm`); one over 64 characters is cut at the last hyphen before the limit; one that slugs to nothing (`日本語/`) exits 2 before writing, with the fix "name the file, as in `日本語/kanji.md`". `new` ends by saying to run `quiz ids FILE`. Otherwise two quizzes would share ids, and their histories would mix in a library. The built-in templates are built from `examples/` and `templates/blank/` into the package, so each has one source. A template folder is copied whole; `--from FILE` copies only the assets and `materials` sheets the quiz references, so unrelated files never travel. `--json`: `{"status": "written", "file", "template"}` (`template` is null with `--from`), or `{"status": "error", "message"}`.

| Option | Meaning |
|---|---|
| `TEMPLATE` | A built-in or user template (`quiz template list`) |
| `--from FILE` | Start from an existing quiz `.md` and its assets, in place of a named template |
| `--skeleton` | With `--from`: keep the structure and drop the content (below) |

**`--from` and `--skeleton`.** Without `--skeleton`, `--from` is a copy of the quiz and its assets. With it, the copy keeps every field [QUIZ_SYNTAX.md](QUIZ_SYNTAX.md) marks as structure and empties every field it marks as content (its section 9): front matter, section titles, instructions, times and picks, each question's type, points and tags, the shape of each answer, and rubrics are kept; prompts, choices' text, keys, hints, explanations, passages, sample answers and question ids are emptied. A skeleton fails `check` until it is filled in; that is intended. `quiz ids` then gives the new questions fresh ids, so no review or attempt history is carried over.

`--from` takes a file, since `new` is a core command and never touches a library. To start from a library quiz, run `quiz library share NAME --source` first and pass its folder's `.md` here, or store it as a template with `quiz library template add`.

Exit: `0` copied, `1` the `--from` file does not parse, `2` unknown template or target exists.

### quiz ids

**new**.

```text
quiz ids FILE... [--dry-run] [--json] [--plain]
```

Gives every question without an `id` a random one and writes it into the file ([QUIZ_SYNTAX.md](QUIZ_SYNTAX.md), ids). An id is `q-` and six characters from `a-z0-9`, unique within the file. It is added at the end of the heading's `{…}` block, or as a new block when there is none. Nothing else in the file changes, byte for byte, and an existing id is never changed, so running it again is safe. It does not run `check`.

- **Duplicates are reported, not fixed:** which copy keeps the id is the author's choice. Delete the id from the copy and run it again.
- A file with a duplicate id or a heading whose `{…}` block does not parse is left untouched, and the problems are listed.

| Option | Meaning |
|---|---|
| `--dry-run` | List the ids it would add, and write nothing. The status is `unchanged`, with `added` listing what a real run would add, and the JSON has `"dryRun": true` |
| `--json` | `{"status": "written" \| "unchanged" \| "problems", "file", "added": [{"line", "id"}], "problems": [{"rule", "line", "message"}]}` |

Exit: `0` written or nothing to add, `1` a duplicate id or a heading that does not parse (that file untouched), `2` I/O error.

### quiz template

**new**. Replaces `quiz templates` and keeps the templates you start quizzes from.

```text
quiz template list [--json]
quiz template add FILE [--as NAME] [--skeleton] [--replace] [--json]
quiz template rm NAME [--yes] [--json]
```

**User templates.** A `templates/` folder next to `config.toml` holds your own. Each is a folder with one quiz `.md` (the only `.md` at its top level) and its `assets/` and `materials/`, named by the folder, so `templates/signals-week/` is used as `quiz new signals-week`. `quiz template add` writes these folders; you can also make one by hand. No other location is searched, not even a project folder. Built-in templates: `calculus`, `rust`, `ielts`, `medical`, `exam`, `survey`, `blank`. **Built-in names are reserved**: a user template cannot take one, so a name means one template. Core commands need no library, so templates do not either.

**`template list`.** Every template with its source: `built-in`, or `user` and its path. A user folder whose name is, or later becomes, a built-in one (a release added that template after you made yours) is listed as `ignored`, with a note to rename the folder; `quiz new` uses the built-in one and says that it ignored a user template. A user folder that does not hold exactly one `.md` at its top level is listed as `invalid`, with the reason, and cannot be used. `--json`: `[{"name", "source", "path", "ignored", "invalid"}]`, `invalid` the reason or null.

**`template add FILE`.** Stores a quiz and its assets as a user template. The name is `--as NAME`, else the file name slugged.

| Option | Meaning |
|---|---|
| `--as NAME` | Template name: a slug |
| `--skeleton` | Store the structure without the content, as for `new --from --skeleton` |
| `--replace` | Overwrite one of your templates of that name |

- **Checks.** A full quiz must pass `check` under its own profile, so a broken template does not hand its errors to every quiz started from it. A skeleton fails `check` by design, so it gets a structural check instead: the front matter parses, sections and questions are well formed, the profile exists, the assets are there. Either must hold at least one question.
- **Name collisions.** A name taken by a built-in template is refused (exit 1) and `--replace` does not change that. A name taken by one of your templates exits 1 and suggests a free name; `--replace` overwrites it. Adding content identical to what is stored under that name is `unchanged` (exit 0).

**`template rm NAME`.** Deletes a user template's folder, after asking unless `--yes`. One template per command. A built-in template is refused (exit 1). With `--json` and without `--yes` it exits 2, since `--json` never prompts.

**`--json`**: `add` gives `{"status": "added" | "replaced" | "unchanged" | "failed" | "error", "name", "path"}`, with the issues on `failed`; `rm` gives `{"status": "removed" | "error", "name", "path"}`.

Exit: `0` listed, added, unchanged or removed, `1` check errors, name taken or a built-in refused, `2` unknown template or I/O error.

### quiz guide, quiz agent-guide

**changed**: styled output in a terminal.

```text
quiz guide [--lang en|vi] [--plain] [--no-pager]
quiz agent-guide [--plain] [--no-pager]
```

`guide` prints the authoring reference (the Markdown format), in English or, with `--lang vi`, Vietnamese. `agent-guide` prints the instructions for AI agents (`AGENTS.md`), in English only.

In a terminal, the Markdown is rendered: headings, lists, tables, wrapping to the terminal width, and code blocks highlighted with the same highlighter the pages use. Output taller than the screen goes through `$PAGER`, or `less` if found. When stdout is not a terminal (piped, redirected, or run by an agent), or with `--plain` or `NO_COLOR`, the output is the Markdown source byte for byte, so `quiz agent-guide > AGENTS.md` writes the real file.

| Option | Meaning |
|---|---|
| `--lang en\|vi` | `guide` only. Default: `en` |
| `--plain` | The Markdown source, even in a terminal |
| `--no-pager` | Styled, but printed straight to the terminal |

## Library commands

All under `quiz library`. A library is one folder under git that holds each quiz's versions (sources, `materials` sheets and assets, never HTML), results and reports. fullmark commits after every command that changes it and **never pushes**. Every library command exits `2` when no library is set (neither `FULLMARK_LIBRARY` nor `library` in `config.toml`), with "no library: run `quiz library init PATH`".

### How library commands print

The CLI boards on the Design canvas (row "CLI: quiz library") draw every command; the text under each command below is theirs, as `--plain` prints it, and the goldens check it. Colour and the style are [Terminal style](#terminal-style)'s.

- **A heading** names the quiz, and the attempt and version when there is one: `rust-basics · Rust basics · version 9f3a`.
- **One word per outcome**, coloured: `registered`, `filed`, `report`, `grades kept`, `written`, `renamed`, `deleted`.
- **Findings** in `check`'s issue format, `PATH:LINE: level rule: message` with `fix:` under it; `library status` uses it for its problems and notes.
- **Then, dim:** `next:` with the command to run next, and `committed HASH MESSAGE` for the commit the command made.
- **Paths** inside the library are printed relative to the quiz's folder (`results/20261118-142210.json`) after the heading has named the quiz; others follow [Paths in output](#paths-in-output).
- **Waiting for the lock** prints one dim line naming the holder, and after 10 seconds the error: "the library is busy: quiz library register notes/*.md (pid 48300) has held it for 10 s", with the fix "run the command again when it finishes" (exit 2).

### The library folder

```text
library.toml                        the index (below)
.gitignore                          .fullmark.lock, progress/, *.tmp
quizzes/<id>/
  versions/<hash>/                  one per version, never changed once written
    <file>.md                       the source, under its original file name
    assets/, materials/, …          every file the quiz uses, at its relative path
    brief.yaml                      when one sat next to the source
    check.json                      the resolved rules it was registered with
  results/<YYYYMMDD-HHMMSS>.json    one per attempt (results-v2; the attempt names its version)
  grades/<stamp>-<YYYYMMDD-HHMMSS>-grades.json   every grades file kept; the newest per attempt counts
  reports/<stamp>-report.json, .md  the report of the newest grades for that attempt
  review.json                       the learner's review (review-v2), one per quiz across its versions
  progress/<version>.json           an attempt in progress (autosave), git-ignored
  progress/<version>.serving.json   the take serving it: process id, URL, start
  progress/<version>.submitted.json a submit waiting to be filed
  progress/<stamp>.grades.json      grades from the form waiting to be kept
  progress/review.json              a review from the form waiting to be filed
```

- **Folders are named by the quiz's `id`**, never its name, so `rename` moves nothing. Assets are stored per version, not shared across versions: git stores a file that did not change once, so the repository does not grow, and a version folder is complete on its own (`share --source` copies it).
- **`library.toml`** holds `format`, `version = 2`, `created`, and one table per quiz: `name`, `id`, `source` (the absolute path it was registered from, for the `changed` flag), `current` (a version hash), `versions = [{ hash, added, file }]` in order (`file`: the source's name in that version's folder, which may differ between versions; every command reads a version's source by it), and `shelves = [{ shelf, kind }]`, the quiz's shelf entries (`quiz library publish`; empty until a quiz is put on a shelf). No scores or counts: the results files are the truth, and `list` reads them. It is written atomically and sorted by name, so its diff reads well. A 0.x library is refused like any other foreign folder.

### Git

- **The repository is the library's root**, always (`git -C ROOT`), ROOT coming from `FULLMARK_LIBRARY` or `library` in `config.toml`. The library is its own repository: `init` runs `git init` there (unless `--no-git`), writes `.gitignore` and makes the first commit, `fullmark: init`. An existing repository is adopted only when the folder is its root; a folder inside another repository gets its own, with a note that the outer one should ignore it.
- **Which `git`:** the one on the path, or `git = "PATH"` in `config.toml` when set (Git installed off the path, as GitHub Desktop does on Windows). Never in `library.toml`, which travels with the repository to machines where the path differs. fullmark runs it through one small runner (`src/library/git.ts`), passing names after `--`. With no `git` found, `init` makes the folder without a repository, as `--no-git` does, with a warning; `rm` then needs `--force`.
- **One commit per changing command**, message `fullmark: <command> <name>` (`fullmark: take signals`; several names for a batch), holding **only the paths it wrote** (`git commit -- PATHS`), so the user's own staged or unstaged changes in the library are never swept in. A failed commit is a **warning**, not a failure: the files are written, the exit code is the command's, and `status` lists the uncommitted changes.
- **Identity:** the user's own git identity. fullmark never asks for one and never writes git's config. When git has none for the library, `init` prints a note with the commands to set one (`git -C ROOT config user.name "…"` and `user.email`), each commit passes `fullmark <fullmark@localhost>` for that commit only (`-c user.name=… -c user.email=…`), and `status` shows which identity commits use, as a note.
- **Nothing more:** fullmark never pushes, pulls, fetches, branches, rebases or rewrites history. Remotes, sync between machines and their conflicts are the user's own git. `status` reads the repository and changes nothing.

### quiz library init

**same**.

```text
quiz library init [PATH] [--force] [--no-git] [--json]
```

Makes `PATH` (default: here) this machine's library and records it in the config. A new, missing or empty folder is set up. An existing library is adopted. A folder with other files is refused. `init` takes the library's lock as soon as the folder exists (creating it first when missing) and decides what the folder is under the lock, so of two `init`s of one new folder started together, one sets it up and the other adopts it.

| Option | Meaning |
|---|---|
| `--force` | Switch from another library already in the config |
| `--no-git` | Don't make a git repository. `rm` then needs `--force` |

**Output.**

```text
$ quiz library init /home/minh/quiz-library
library ready /home/minh/quiz-library (new folder, git repository)
recorded in /home/minh/.config/fullmark/config.toml
note git has no identity here: commits are made as fullmark <fullmark@localhost>
    set one: git -C /home/minh/quiz-library config user.name "Your Name"
             git -C /home/minh/quiz-library config user.email you@example.com
committed 3c1e0a2 fullmark: init
next: quiz library register FILE

$ quiz library init /home/minh/Documents
error: /home/minh/Documents is not empty and is not a library (12 files)
    fix: choose an empty or new folder
```

With `--json`: `{"status": "created" | "adopted", "library", "config", "git", "identity", "committed"}`; `git` is false with `--no-git` or no `git` found, `identity` is `"Name <email>"`, or null when the fallback is used; `committed` is the commit hash, or null.

Exit: `0` done, `2` folder refused or another library is set without `--force`.

### quiz library status

**changed**: also checks the library's config.

```text
quiz library status [--plain] [--json]
```

Diagnostics: config, library path, git (repository, uncommitted changes, remote), counts, snapshots whose content no longer matches their hash, orphan files, and a library `fullmark.toml` that does not parse or names unknown rules.

**Problems** (exit `1`): the configured folder is missing or is not a library; `library.toml` does not parse or names a version folder that is missing; a version whose files no longer match its hash; a library `fullmark.toml` that does not parse or names unknown rules. **Notes** (printed, exit `0`): uncommitted changes, no remote, no git repository (`--no-git`), orphan files, a stale lock, `FULLMARK_LIBRARY` set.

`--json`: `{"status": "healthy" | "problems", "library", "config", "git": {"repository", "uncommitted", "remote"}, "counts": {"quizzes", "versions", "attempts", "reports"}, "problems": [{"code", "path", "message", "fix"}], "notes": [{"code", "path", "message"}]}`.

**Output.**

```text
$ quiz library status
Library    /home/minh/quiz-library
Config     /home/minh/.config/fullmark/config.toml
Git        repository · 2 uncommitted changes · no remote
Commits as Minh Tran <minh@example.com> (git’s own identity)
Counts     5 quizzes · 9 versions · 38 attempts · 21 reports
Checks     fullmark.toml: none · hashes: 9 of 9 match

quizzes/signals/results: note git.uncommitted: 2 files not committed
    see: git -C /home/minh/quiz-library status
note git.no-remote: the library is only on this machine

healthy (2 notes)

$ quiz library status
Library    /home/minh/tmp/lib (from FULLMARK_LIBRARY)
Config     /home/minh/.config/fullmark/config.toml
Git        repository · clean · remote origin
Commits as fullmark <fullmark@localhost> (git has no identity here)
Counts     5 quizzes · 9 versions · 38 attempts · 21 reports

quizzes/chem-bonds/versions/b81e: problem library.hash: the files no longer match the version’s hash
    fix: git -C /home/minh/tmp/lib checkout -- quizzes/chem-bonds/versions/b81e
fullmark.toml:4: problem config.unknown-rule: no rule named answers.posiiton-skew
    fix: the rules are listed by quiz rules --all
note env.library: FULLMARK_LIBRARY is set; the config’s library is /home/minh/quiz-library
note git.identity: commits are made as fullmark <fullmark@localhost>
    set one: git -C /home/minh/tmp/lib config user.name "Your Name"
note lock.stale: removed a lock left by pid 48211 (quiz library take signals)

2 problems (3 notes)
```

Exit: `0` healthy (notes may be printed), `1` problems, `2` no library.

### quiz library register

**changed**: records the resolved rules with the version, and takes several files.

```text
quiz library register FILE... [-n NAME | --update NAME] [--profile P] [--config TOML]
                           [--strict] [--review REVIEW] [--json]
quiz library register --build-file BUILD [FILE...] [--json]
```

Checks the quiz, then copies its source, assets and brief into the library as a version, together with the resolved rules (`check.json`), and commits. Re-checking that version later uses the stored rules, even if the config changed. The original file can be deleted afterwards.

| Option | Meaning |
|---|---|
| `-n`, `--name NAME` | Name for a new quiz. Default: the slugged title |
| `--update NAME` | Add a version to this existing quiz. Warns when an attempt is in progress on the old version (an autosave from `take`); the attempt stays tied to the version it started on, the next `take` resumes it there, and the exit is still `0` |
| `--build-file BUILD` | Register the files a build file lists (`quiz build`), so a folder of quizzes registers without a long command. Only `files`, `profile`, `config` and `strict` are read, top level and per entry; the delivery keys (`out`, `lang`, `print` and the rest) are for `build` and are ignored here. A file listed in several entries (a quiz built both as a page and as a printed paper) is registered once; entries that give it different `profile`, `config` or `strict` exit 2. `FILE`s given as well register only those of its entries |
| `--profile`, `--config`, `--strict`, `--review` | As for `check`. The config is looked up from `FILE`, then from the library root. With `--update`, the quiz's stored `review.json` is applied as `check --review` applies one: `review.fix` and `review.drop` refuse the version (exit `1`) until every flagged question has changed or gone, and `review.unconfirmed` warns until `library review NAME --since` judges it again. `--review REVIEW` replaces the stored review for that run |
| `--json` | `{"status": "registered" \| "unchanged" \| "problems", "registered": [{"file", "name", "version"}], "unchanged": [{"file", "name", "version"}], "refused": [{"file", "reason", "suggest"}], "committed"}`. One file gives the same object as several, with one entry |

**Output.**

```text
$ quiz library register rust/quiz.md
rust/quiz.md:41: warning answers.position-skew: 5 of 8 single-choice keys are B
    fix: move some correct choices to other positions
registered rust-basics, a new quiz · version e7d2 · 18 questions
committed 5f20b4c fullmark: register rust-basics

$ quiz library register notes/*.md
registered 3 calculus-limits (new, 5a1f) · ielts-writing (new, 77b2) · signals (new, 0c9d)
unchanged 2  chem-bonds, rust-basics
committed 9a0b1c2 fullmark: register calculus-limits, ielts-writing, signals

$ quiz library register notes/*.md
notes/chem.md:2: error library.id-taken: the id chem-bonds is already in the library, as chem-bonds
    fix: if it is the same quiz, quiz library register notes/chem.md --update chem-bonds;
         if not, give it a new `id:` in its front matter
notes/rust2.md: error library.name-taken: the name rust-basics is taken
    fix: -n rust-basics-2 (one file at a time)
notes/limits.md:12: error question.id-missing: a question without an id
    fix: quiz ids notes/limits.md
nothing registered 2 of 5 files ready, 3 refused

$ quiz library register rust/quiz.md --update rust-basics
registered rust-basics · version 9f3a (was 41c0) · 2 added, 1 removed, 3 changed
warning an attempt in progress on 41c0 (7 of 17 answered, 18 Nov 14:02) stays on that version
    the next quiz library take rust-basics resumes it there (G17)
committed 4b77e01 fullmark: register rust-basics
```

On a terminal, `[3/5] notes/signals.md` updates in place while the files are checked.

Exit: `0` registered or unchanged, `1` check errors, name taken (the output suggests a free name), id taken or mismatched, or a survey refused, `2` no library.

**Surveys are refused.** A quiz whose kind is `survey` (following `extends`) is refused with the rule `library.survey`, and exits `1` like any other refusal. The library is one learner's history of their own attempts, and surveys are mostly sent to other people; `serve` and `stats` handle them without a library. `library import` applies the same refusal. Allowing surveys in a shared library later is additive: `take` works, `grade` exits 2 with no score, `--missed` refuses. There is no separate survey-library kind.

**Quiz ids.** A quiz's folder is named by its `id`, so two quizzes never share one. A new quiz (no `--update`) whose `id` is already in the library is refused with the rule `library.id-taken` and two fixes: "if it is the same quiz, `--update NAME`; if not, give it a new `id:`". Two files in one batch with the same id are refused the same way. `--update NAME` with a file whose `id` is not that quiz's is refused with `library.id-mismatch`, since a version keeps its quiz's id. Both exit `1`, like any refusal.

**One file** behaves as a batch of one: content that is already the current version is skipped as `unchanged` (exit `0`), and `--json` has the same shape as for several files.

**Several files**, for moving a folder of quizzes in at once. Globs and the batch rules are as in [Several files](#several-files), except that this is all or nothing.

- **All or nothing, like `import`.** Every file is checked and every name resolved first; if any file has check errors or a taken name (including two files in the batch slugging to the same name), nothing is registered, every problem is listed, and the exit is 1. Otherwise one commit holds them all.
- Each quiz gets its slugged title as its name. `-n` and `--update` name one quiz, so with several files they exit 2.
- A file whose content is already the current version of the quiz registered from it is skipped as `unchanged`, so re-running the same command after adding one quiz registers only the new one. A file registered before and since edited is refused with the `--update NAME` command to run.
- Progress on a terminal as for `build`: `[3/12] signals.md`.
- Updating several quizzes in one go (matching each file to the quiz registered from it) is left out until a need shows; `list` already flags changed sources.

### quiz library list

**changed**: says whether a quiz is public, with the mark `public` in `NOTES` (a quiz with an entry on the shelf named `public`).

```text
quiz library list [--plain] [--json]
```

Every quiz with its versions, attempts, last score, whether it is public, and a note when its original source still exists and has changed.

With `--json`: `{"quizzes": [ROW, ...]}`, sorted by name with the fixed comparison (TECHNICAL_DESIGN.md, section 7, foundation 6). The row has every field below, always present, so a script or `jq` can filter on any of them. These names are fixed: filters on `list` may come later ([proposals/library-query.md](proposals/library-query.md)) and will be a function over these rows, so a field is never renamed and new ones are only added.

| Field | Type | Value |
|---|---|---|
| `name`, `id`, `title` | string | |
| `kind`, `lang`, `profile` | string | of the current version |
| `tags`, `types` | string[] | every question tag and question type in the current version, sorted |
| `shelves` | string[] | the names of the shelves the quiz has an entry on |
| `questions`, `points` | number | in the current version |
| `versions`, `attempts` | number | attempts across all versions |
| `score`, `best` | number \| null | percent of the last and best attempt; `null` if never taken |
| `weak` | string[] | the three weakest tags over all attempts, weakest first; empty if never taken |
| `added`, `updated` | string | ISO date of the first and current version |
| `taken` | string \| null | ISO date of the last attempt; `null` if never taken |
| `changed` | boolean | the original source still exists and differs from the current version |
| `ungraded` | boolean | an attempt has essays or code not yet graded |
| `flagged` | number | `fix` and `drop` verdicts in the quiz's `review.json` still open on the current version (`review.fix` and `review.drop` findings); `0` without a review |

**Output.**

```text
$ quiz library list --plain
5 quizzes · 38 attempts · /home/minh/quiz-library

NAME             TITLE                  VERSIONS  ATTEMPTS  LAST  BEST  TAKEN   NOTES
calculus-limits  Limits and continuity         1         0     –     –  never
chem-bonds       Chemical bonding              2         6   74%   81%  12 Nov
ielts-writing    IELTS Writing Task 2          1         4  61%*   68%  15 Nov  1 ungraded
rust-basics      Rust basics                   3        17   80%   86%  17 Nov  source changed
signals          Signals and systems           2        11   71%   77%  16 Nov

$ quiz library list
0 quizzes · /home/minh/quiz-library
next: quiz library register FILE
```

The columns are fixed; `NOTES` holds the marks: `source changed` (`changed`), `N ungraded`, `N flagged` (open review flags), and `public`. A score with grades pending carries `*`, as on the page. Dates are `17 Nov`, with the year when it is not this year.

Exit: `0`, `2` no library.

### quiz library info

**new**.

```text
quiz library info NAME [--version HASH] [--plain] [--json]
```

Everything about one quiz in one place, so you need not run `inspect`, `list` and `stats` and read the library folder. It reads only what those commands already compute, and writes nothing. `inspect` stays the command for a quiz file outside the library.

| Block | What it shows |
|---|---|
| Identity | name, id, title, kind, language, profile, `generated_by` |
| Source | the original file, and whether it still exists and has changed |
| Content | sections with question counts and points, question types, tags, banks |
| Versions | hash, date added, and questions added, removed or changed against the one before |
| Shelves | the quiz's shelf entries |
| Attempts | count, first and last date, last and best score, the three weakest tags, attempts with essays or code still ungraded |
| Review | the date of the last review, the counts of keep, fix and drop, and the flags still open (`flagged`) |
| Path | the quiz's folder in the library |

| Option | Meaning |
|---|---|
| `--version HASH` | Show the content of this version. Default: the current one |
| `--json` | The quiz's `library list` row, with the same field names and meanings, plus `{"generated_by", "source": {"path", "exists"}, "sections": [{"slug", "title", "questions", "points"}], "banks", "history": [{"hash", "added", "added_questions", "removed_questions", "changed_questions"}], "first_taken", "path"}`. With `--version HASH`, the fields that describe content (`kind`, `lang`, `profile`, `tags`, `types`, `questions`, `points`, `sections`, `banks`) are that version's |

**Output.**

```text
$ quiz library info rust-basics
rust-basics · Rust basics · version 9f3a
Identity   id rust-basics · quiz · en · profile practice · generated by Claude Opus 5.5
Source     /home/minh/notes/rust/quiz.md · changed since 9f3a
Content    18 questions · 25 points · 3 sections · time limit 25m
Sections   ownership 6 questions, 8 points · collections 6, 10, pick 4 · traits 6, 7
Types      single 8 (10 points) · multi 3 (5) · code 2 (6) · essay 1 (4)
Tags       rust 18 · borrowing 5 · traits 4 · no tag 2
Banks      collections: pick 4 of 6
Versions   9f3a  17 Nov  current · 2 added, 1 removed, 3 changed
           41c0   2 Nov  1 changed
           e7d2  20 Oct  first version
Shelves    none
Attempts   17 · 20 Oct to 17 Nov · last 80% · best 86% · weakest borrowing, traits
           ungraded: 20261117-201412 (1 essay)
Path       /home/minh/quiz-library/quizzes/rust-basics

$ quiz library info rust
error: no quiz named rust
    did you mean: rust-basics
```

Versions are listed newest first, the current one marked, each counted against the version before. With `--version HASH`, the heading says `(not current: HASH is)` and the content blocks are that version's. An unknown name exits 2 with the nearest names.

Exit: `0`, `2` unknown quiz or version, or no library.

### quiz library take

**changed**: adds `--section` and `--missed`.

```text
quiz library take NAME [--section S] [--missed] [--focus] [--no-open]
                       [--timeout SECONDS] [--port N] [--json]
```

Builds the current version with the installed fullmark, serves it, files the result next to that version and commits. Progress is autosaved, so closing the tab or the server resumes the attempt.

- **Autosave and resume.** `take` serves with autosave (as `serve --autosave`) to `quizzes/<id>/progress/<version>.json`, which git ignores. The next `take` without `--section` or `--missed` resumes a saved attempt, as the page's **Continue** does, on whatever version it was started, even one that is no longer current (the oldest first, when there are several), and says so in its heading: "version 41c0 · resuming your attempt of 18 Nov 14:02 (7 of 18 answered); the quiz has been updated since (now 9f3a)". It is filed against that version, and the next `take` uses the current one. The file is removed when the attempt is filed. A `take` with `--section` or `--missed` starts its own attempt and leaves a saved one alone: when an attempt of that version is saved, the new one is served without autosave, and `take` says so ("this attempt is not saved: another attempt of this version is in progress and is left alone"). A saved attempt of missed questions resumes as one: its questions keep the "changed since you missed it" mark, worked out again against the version it is on.
- **The lock.** `take` takes the library's lock only to file the result and commit, never while serving, so other commands work while a quiz is open. While serving, `progress/<version>.serving.json` holds the serving process's id and URL, beside the progress file, which stays a `results-v2` document: a second `take` of that quiz while that process is alive exits `2` and prints the URL to open; a serving file whose process is gone is removed, and the progress file is resumed. A submit is written to `progress/<version>.submitted.json`, then filed under the lock. When the lock cannot be had in 10 seconds, the submitted file stays and `take` exits `2`, saying the answers are safe; the next `take` of the quiz files it first, says so, and ends without serving, with `next: quiz library take NAME` after the commit.
- **`--missed` across versions.** Questions are matched by `id` across versions. A question missed on an old version and still in the current one is served as it is now; when its hash differs from the one missed, the page marks it "changed since you missed it" (one label in both catalogs, next to the question's number). A missed question no longer in the current version is left out and counted (`"gone"` in `--json`). The plan's `source` is `"missed"`.

| Option | Meaning |
|---|---|
| `--section S` | Only this section |
| `--missed` | Only questions that are wrong or partly right in an earlier attempt and not answered fully right since, across all attempts and versions. Questions changed since they were missed are included and marked. Ungraded essays and code are skipped. With `--section`, the missed questions in that section |
| `--focus` | Tick **Focus mode** on the start screen, as for `serve` |
| `--timeout SECONDS` | Default `0` (no limit) |
| `--json` | `{"status", "results", "score", "plan": {"source", "questions"}, "gone"}` (`gone`: with `--missed`, the missed questions no longer in the current version, else `0`), or `{"status": "nothing_missed"}` |

**Output.**

```text
$ quiz library take rust-basics
rust-basics · Rust basics · version 9f3a · 18 questions · no time limit
serving http://127.0.0.1:52811/?t=8f3a…  (opened in your browser)
progress is saved: close the tab or press Ctrl+C, and take resumes it

filed results/20261118-142212.json · 80%* (20 of 21 points, 4 waiting for a grade)
next: quiz library grade rust-basics --web
committed 4d2e9f1 fullmark: take rust-basics

$ quiz library take rust-basics
rust-basics · Rust basics · version 9f3a · resuming your attempt of 18 Nov 14:02 (7 of 18 answered)
serving http://127.0.0.1:52811/?t=8f3a…  (opened in your browser)

$ quiz library take rust-basics
note filing the answers an earlier take left in progress/9f3a….submitted.json
filed results/20261118-142212.json · 80%* (20 of 21 points, 4 waiting for a grade)
next: quiz library grade rust-basics --web
committed 4d2e9f1 fullmark: take rust-basics
next: quiz library take rust-basics

$ quiz library take rust-basics --missed
rust-basics · missed questions · 6 from 17 attempts · 2 changed since you missed them · 1 no longer in the quiz
serving http://127.0.0.1:52811/?t=8f3a…  (opened in your browser)

filed results/20261118-151012.json · 4 of 6 right · 67%
committed 0e6c3b8 fullmark: take rust-basics

$ quiz library take signals --missed
nothing missed: every question you got wrong has been answered right since

$ quiz library take rust-basics
error: rust-basics is already open in another take (pid 48211)
    open: http://127.0.0.1:52811/?t=8f3a…
```

The URL is printed even when the browser opens, for a closed tab.

Exit: `0` filed, or nothing missed (with a message); `2` unknown quiz or section, or timeout.

### quiz library replay

**new**.

```text
quiz library replay NAME [--attempt STAMP] [-o DIR] [--no-open] [--json]
```

Opens a past attempt as a page that is already submitted, showing your answers, right and wrong, explanations, and **Retry missed** working. It finds the version the attempt was taken on, embeds the grades from the newest report for that attempt if there is one, builds into a temp folder (or `DIR`) and opens it. This is `quiz replay` with the lookup done for you. Writes nothing in the library.

| Option | Meaning |
|---|---|
| `--attempt STAMP` | Default: the newest attempt |
| `-o`, `--output DIR` | Write the page here instead of a temp folder |
| `--json` | `{"status", "page", "attempt", "version", "graded"}` |

**Output.**

```text
$ quiz library replay rust-basics
rust-basics · attempt 20261117-201412 · version 41c0 (not current: 9f3a is) · graded 17 Nov
page: /tmp/fullmark/rust-basics-20261117-201412.html  (opened in your browser)
```

Exit: `0` built, `2` unknown quiz or attempt.

### quiz library review

**new**.

```text
quiz library review NAME [--since] [--timeout SECONDS] [--port N] [--no-open] [--json]
```

`quiz review` with the lookup done, as `library replay` is `quiz replay`: the review form on the quiz's current version. **Finish** writes `quizzes/<id>/review.json`, under the lock, and commits (`fullmark: review NAME`). There is one review per quiz, not per version: `review-v2` keys each verdict by question id with the question's hash, and merges, so one file follows the quiz across versions, and git keeps its history. `--since` asks only about the questions new or changed since the stored review, as `quiz review --since` does; with no stored review it exits 2, as there.

**The lock**, as for `grade --web`: none while the form is served. On **Finish**, the review is written to `progress/review.json`, then, under the lock, moved to `review.json` and committed. When the lock cannot be had in 10 seconds, it stays in `progress/`, the command exits `2` saying it is safe, and the form's done card says it is saved but not filed yet; the next `library review` of the quiz files it first, says so, and ends, with `next: quiz library review NAME` after the commit.

**An edit is the same quiz, a new version.** The quiz id and the question ids stay, so attempts, `--missed` and `stats` carry over: a fixed question has a new hash and `--missed` marks it changed; a dropped question is gone (`gone` in `take --json`). Edit the original source, or a copy from `share --source`, then `register FILE --update NAME`, which applies the stored review (`register`, `--review`). A new quiz, with a new id and no history, is only made on purpose, with `quiz new --from`.

| Option | Meaning |
|---|---|
| `--since` | Only questions new or changed since the stored review |
| `--timeout`, `--port`, `--no-open` | As for `quiz review` (timeout `1800`) |
| `--json` | The `listening` line, then `{"status": "written", "review", "keep", "fix", "drop", "committed"}`, or `{"status": "unchanged", "review"}` with `--since` and nothing to ask |

**Output.**

```text
$ quiz library review rust-basics
rust-basics · Rust basics · version 9f3a · 18 questions, 15 judged before
serving http://127.0.0.1:52811/?t=8f3a…  (opened in your browser)

written review.json: 14 keep (6 not looked at), 3 fix, 1 drop
next: edit the quiz, then quiz library register FILE --update rust-basics
committed 5d1e9a0 fullmark: review rust-basics
```

Exit: `0` written or nothing to ask, `2` unknown quiz, no library, timeout, Ctrl+C, a survey, or `--since` with no stored review.

### quiz library share

**same**.

```text
quiz library share NAME [-o DIR] [--version HASH] [--source] [--json]
```

Writes the clean offline page to share, or with `--source` the editable folder (the original file name, assets, brief, and a `fullmark.toml` with the custom profile the quiz uses, if any). Default `DIR`: here.

- **The page** is `DIR/NAME.html`, byte-identical to `quiz build` of the same source under the same profile; an existing one is replaced, as `build` replaces its output.
- **The folder** is `DIR/NAME/`. It is refused (exit 2) when it exists and is not empty, with the fix "choose another -o, or remove DIR/NAME", so an edited copy is never overwritten.
- **Its `fullmark.toml`.** None when the folder would be checked under the same rules anyway: the version's profile (`check.json`) is the one the quiz gets by itself (its own `profile:`, else `default`) and is a built-in one with no change. Otherwise `profile = NAME`, and `[profiles.NAME]` only when the rules differ from the built-in's: `extends` the built-in profile its chain starts from and each rule whose level or options differ from that built-in's, sorted by id. So `quiz check` on the folder finds what the library found, for a quiz registered with `--profile` too.

**Output.**

```text
$ quiz library share rust-basics
written rust-basics.html · version 9f3a · 412 KB

$ quiz library share rust-basics --source -o edit
written edit/rust-basics/ · quiz.md, 4 assets, brief.yaml · version 9f3a
next: edit it, then quiz library register edit/rust-basics/quiz.md --update rust-basics
```

With `--json`: `{"status": "written", "path", "version", "source"}`.

Exit: `0` written, `2` unknown quiz or version.

### quiz library template add

**new**.

```text
quiz library template add NAME [--as TEMPLATE] [--version HASH] [--skeleton] [--replace] [--json]
```

Stores a quiz from the library as a user template (`quiz template add`, for a library quiz): its source and assets at the current version, or at `--version HASH` as for `share`. The version is checked under the rules it was registered with (`check.json`), so a version that registered can be stored; the other options and the name rules are those of `quiz template add`. It reads the library and does not change it, so nothing is committed. This is the only `library template` command: templates live in your config folder, not in the library, so you list and remove them with `quiz template list` and `quiz template rm`.

**Output.**

```text
$ quiz library template add rust-basics --as rust-week
template added rust-week, from rust-basics version 9f3a
next: quiz new rust-week PATH
```

Exit: `0` added or unchanged, `1` check errors or name taken, `2` unknown quiz or no library.

### quiz library grade

**changed**: adds `--web`, and keeps every grades file.

```text
quiz library grade NAME [--attempt STAMP] [--grades FILE] [--json]
quiz library grade NAME --web [--attempt STAMP] [--name NAME] [--timeout SECONDS] [--port N] [--json]
```

Grades an attempt against the version it was taken on and writes the report into `quizzes/<id>/reports/` (never `results/`). With `--json`, also the grades template. `--web` opens the grading form as for `quiz grade`, pre-filled with the newest grades for that attempt. Every grades file is kept, and the newest counts. Commits.

- **Which attempt.** `--attempt` takes a stamp or a prefix of 4 or more characters. Without it: the newest attempt with an essay or code answer still waiting for a grade, else the newest attempt.
- **The template.** With `--json`, for an attempt with an essay or code question answered, the empty grades template is written to the working directory as `<name>-<stamp>-grades.json` (`ielts-writing-20261115-093012-grades.json`), never into `grades/`, where every file counts. An existing one is never overwritten: it is skipped with `quiz grade --json`'s warning. Once filled, `--grades` takes it and keeps a copy in `grades/`. When a template is written, the `next:` line is `next: fill in FILE, then quiz library grade NAME --grades FILE (or --web)`.
- **The lock.** As for `take`: `--web` holds no lock while the form is served. On **Save grades**, the checked grades are written to `progress/<stamp>.grades.json`, then, under the lock, kept in `grades/`, the report written and the commit made. When the lock cannot be had in 10 seconds, the grades stay in `progress/` and the command exits `2`, saying they are safe; the next `library grade` of the quiz keeps them first, says so, and ends, with `next: quiz library grade NAME` after the commit. The form answers **Save grades** once the keeping was tried: when the lock was busy, its card says "Your grades are saved, but not filed yet: the library was busy. Run `quiz library grade NAME` to file them." (vi: "Điểm đã lưu nhưng chưa được ghi vào thư viện vì thư viện đang bận. Chạy `quiz library grade NAME` để ghi.") in place of the files written.

**Output.**

```text
$ quiz library grade ielts-writing
ielts-writing · attempt 20261115-093012 · version 77b2
report reports/20261115-093012-report.md · 61%* · 1 essay waiting for a grade
next: quiz library grade ielts-writing --web, or --json for a grades template
committed 2b9d0f4 fullmark: grade ielts-writing

$ quiz library grade ielts-writing --grades ~/Downloads/grades.json
ielts-writing · attempt 20261115-093012 · version 77b2
grades kept grades/20261115-093012-20261118-150212-grades.json · ai, Claude Opus 5.5
report reports/20261115-093012-report.md · 68% · nothing pending
committed 6a01c55 fullmark: grade ielts-writing

$ quiz library grade ielts-writing --web
ielts-writing · attempt 20261115-093012 · version 77b2 · pre-filled from Claude Opus 5.5’s grades
serving http://127.0.0.1:52990/?t=c41e…  (opened in your browser)

grades kept grades/20261115-093012-20261118-154012-grades.json · human, Minh Tran
report reports/20261115-093012-report.md · 70% · nothing pending
committed 81f4e2a fullmark: grade ielts-writing
```

With `--json`: `{"status": "written", "attempt", "version", "report", "grades", "template", "graded", "pending", "committed"}`; `grades` is the grades file kept (null without `--grades` or `--web`), `template` the grades template written for an attempt with essays or code (null when there is nothing to grade). With `--web`, the `listening` line comes first.

Exit: `0` written, `1` invalid grades, `2` unknown quiz or attempt, timeout, or the form was cancelled.

### quiz library stats

**changed**: per question and per tag, as for `quiz stats`.

```text
quiz library stats NAME [--json]
```

Progress over every attempt at a quiz, across versions, using the grades each attempt was made with. Writes nothing. One attempt is shown like several (Weakest stays empty until a tag is seen in two attempts, as its rule says).

**Output.**

```text
$ quiz library stats rust-basics
rust-basics · Rust basics · 17 attempts, 3 versions
Attempts   20 Oct 62% · … · 10 Nov 71% (section ownership) · 17 Nov 80% · 18 Nov 67% (missed)
Tags       borrowing 54% (13 of 24 points) · traits 70% · ownership 88% · no tag 75%
Weakest    borrowing, traits
Missed     q-k7m2qx "Which borrow…" wrong in 4 of 5 · q-a1b2c3 3 of 5
Criteria   design 60% over 4 attempts
```

`--json` is `quiz stats`'s object, over every attempt at the quiz.

Exit: `0`, `2` unknown quiz or no attempts.

### quiz library rename

**same**.

```text
quiz library rename OLD NEW [--json]
```

Changes a quiz's name. Its id and folder stay, and so do its shelf entries. Commits. One quiz per command: a batch rename is a pattern language for a rare job.

**Output.**

```text
$ quiz library rename rust-basics rust
renamed rust-basics to rust · id and folder unchanged (quizzes/rust-basics)
committed 1c9a7d3 fullmark: rename rust-basics rust
```

With `--json`: `{"status": "renamed", "old", "new", "id", "committed"}`.

Exit: `0`, `1` name taken, `2` unknown quiz.

### quiz library rm

**same**.

```text
quiz library rm NAME [--yes] [--force] [--json]
```

**Deletes** a quiz with its versions and results, and commits, so `git -C LIBRARY revert HEAD` brings it back. Asks for confirmation unless `--yes`; with `--json` and without `--yes` it exits 2, with the fix "add `--yes`", since `--json` never prompts (as `template rm`). Refused when the library is not its own git repository, the quiz folder has uncommitted changes, or a `take` of the quiz is serving ("NAME is open in a take (pid N)", fix "finish or stop it, or add --force"); `--force` skips all three. An attempt in progress goes with the folder, and the question counts it ("…, 4 reports, 1 attempt in progress?"). A quiz on the `public` shelf is removed from it at the next `publish`. One quiz per command, on purpose: a glob or a list makes a mass deletion one typo away, and each deletion is its own commit to revert.

**Output.**

```text
$ quiz library rm chem-bonds
delete chem-bonds (Chemical bonding): 2 versions, 6 attempts, 4 reports? [y/N] y
deleted chem-bonds
undo: git -C /home/minh/quiz-library revert 7e1f3a0

$ quiz library rm chem-bonds
error: quizzes/chem-bonds has uncommitted changes, so deleting it could not be undone
    fix: commit or discard them, or add --force
```

With `--json` (and `--yes`): `{"status": "deleted", "name", "id", "committed"}`.

Exit: `0` deleted, `1` refused, `2` unknown quiz.

### quiz library path

**same**.

```text
quiz library path [NAME]
```

Prints the library folder, or a quiz's folder.

**Output.**

```text
$ quiz library path rust-basics
/home/minh/quiz-library/quizzes/rust-basics
```

The path alone and nothing else, never coloured, so it can be used as `$(quiz library path NAME)`. A path under the working directory is still printed absolute here.

### quiz library publish

**new**. Two forms: mark a quiz, or sync the shelf.

```text
quiz library publish NAME --on | --off [--json]
quiz library publish [DIR] [--with-brief | --no-brief] [--ui-lang en|vi] [--fonts quiz|all|none] [--dry-run] [--json]
```

Keeps a separate folder (a public repository, GitHub Pages) holding the current Markdown, assets and built page of every quiz on the `public` shelf, plus an index page and a `fullmark-shelf.json` manifest. Results, grades, reports, reviews, progress and older versions are never copied. Briefs are copied only with `--with-brief`.

- **`NAME --on | --off`** adds or removes the quiz's entry on the shelf named `public` and commits in the library (`fullmark: publish NAME --on`). It writes nothing to any shelf. `--on` for a quiz already on the shelf, or `--off` for one that is not, says so, commits nothing and exits 0.
- **Shelf entries.** A quiz's record in `library.toml` holds `shelves = [{ shelf = "public", kind = "quiz" }]`; `version` is reserved (optional, unused in v1). v1 commands touch only the shelf named `public` and only `kind = "quiz"` entries. Entries they do not know (another shelf name, `kind = "bundle"`) are kept as they are, never rejected, and never published. The `shelf ...` commands and several shelves are a proposal ([proposals/shelves.md](proposals/shelves.md)).
- **The shelf folder.** One folder per quiz at the top level, **named by the quiz's id** (as in the library, so `rename` moves nothing and a saved link keeps working). It holds the current version's source under its own file name, every asset and `materials` sheet at its relative path, the built page as `index.html` (served at `…/ID/`), `brief.yaml` only with `--with-brief`, and the `fullmark.toml` that `share --source` writes for that version, when it writes one (`quiz check` on the folder then finds what the library found). Never `check.json`. The top level holds the index page as `index.html` and the manifest; nothing else there is fullmark's, and the owner's own files (README, LICENSE, `.github/`) are left alone.
- **The manifest**, `fullmark-shelf.json` (schema `fullmark-shelf-v2`): `{"format": "fullmark-shelf", "version": 2, "ui_lang", "with_brief", "fonts", "quizzes": [{"id", "name", "title", "lang", "hash", "added", "file", "files"}], "files"}`. Quizzes are sorted by id; `hash` and `added` are the published version's; `file` is the source's name; a quiz's `files` are every path the sync wrote for it, and the top-level `files` the paths it wrote at the root. It holds no time of publishing, and is written with sorted keys and a trailing newline.
- **The index page** lists every quiz on the shelf, whatever its language, sorted by title: the title as a link to `ID/`, its `lang` (`EN`, `VI`), its number of questions and its time limit when it has one, under a heading with the shelf folder's name. One learner's courses can be taught in several languages, such as an English-taught programme at a Vietnamese university. It is a static page with no script, the page's theme tokens with light and dark from `prefers-color-scheme`, system fonts and a CSP with only its own style sheet's hash. Each quiz's page keeps its own `ui_lang`; `--ui-lang` sets only the index page's own chrome.
- **The sync** builds every quiz on the `public` shelf into memory first, with `built_at` pinned to the version's `added` time, so the same library state always gives the same bytes. If any build fails, nothing is written. It takes the shelf's lock (`.fullmark.lock` in `DIR`), writes only the files that changed, each atomically, and removes only paths listed in the old manifest. A missing `DIR` is created, with its parents.
- **What a sync refuses.** A *quiz folder* is a top-level folder holding an `.md` file and an `index.html` at its top level. With a manifest, a quiz folder the manifest does not list exits 1, naming it, with the fix "move it out of DIR, or import it into the library first". With no manifest (the first sync into a folder), the folder may hold anything except a quiz folder (the same exit) or an `index.html` at its top level (exit 1, fix "move it, or publish into an empty folder"). A sync never removes or changes a path its manifest does not list.
- **Git.** When `DIR` is anywhere inside a git work tree (its own repository, or a repository's `docs/` folder served by GitHub Pages), the sync commits only the paths it wrote or removed (`git -C DIR commit -- PATHS`, message `fullmark: publish`), so the owner's own changes are never swept in. A failed commit is a warning, as in the library. fullmark never runs `git init` in `DIR` and never pushes.
- **Remembered.** Each successful sync records `DIR` in `config.toml` as `public` under `[shelves]` (`[shelves]` then `public = "/abs/path"`), replacing the one before, and says so in a line when it changes.

| Argument or option | Meaning |
|---|---|
| `DIR` | The shelf folder. Default: the one remembered in the config |
| `--with-brief`, `--no-brief` | Copy briefs or not. Default: not. Remembered in the manifest |
| `--ui-lang en\|vi` | The index page's interface language. Default: `en`. Remembered in the manifest |
| `--fonts quiz\|all\|none` | As for `build`. Remembered in the manifest |
| `--dry-run` | Print what would be added, updated and removed, and write nothing |
| `--json` | `{"status": "published" \| "unchanged", "dir", "added", "updated", "removed", "committed", "warnings"}` |

**Output.**

```text
$ quiz library publish signals --on
signals is on the public shelf
committed 1a2b3c4 fullmark: publish signals --on
next: quiz library publish

$ quiz library publish ~/sites/quizzes --dry-run
would publish 3 quizzes to /home/minh/sites/quizzes
  add     signals/    new on the shelf
  update  calculus/   version 7c1e → 2b9d
  remove  old-quiz/   off the shelf
  update  index.html
nothing written (--dry-run)

$ quiz library publish ~/sites/quizzes
published 3 quizzes to /home/minh/sites/quizzes: 1 added, 1 updated, 1 removed
remembered /home/minh/sites/quizzes as the public shelf
committed 5d6e7f8 fullmark: publish (in /home/minh/sites/quizzes)
next: git -C /home/minh/sites/quizzes push   (fullmark never pushes)

$ quiz library publish
unchanged: /home/minh/sites/quizzes already matches the library (3 quizzes)
```

Exit:

- `0`: published or unchanged, and `NAME --on | --off`.
- `1`: a build failed, a quiz folder in `DIR` is not in the manifest, or an `index.html` sits in a folder with no manifest (nothing written); an unknown `NAME`.
- `2`: `DIR` is inside the library or contains a `library.toml`, or the manifest is foreign (its `format` is not `fullmark-shelf`) or newer (its `version` is above 2).
- `3`: no `DIR` given and none remembered.

### quiz library import

**new**.

```text
quiz library import DIR [--into PATH] [--json]
```

Registers the quizzes of a published folder into a library, keeping ids and names, so a shelf restores into a new library. Each quiz is checked under its nearest `fullmark.toml`, as `register` checks it: the quiz folder's own, as `publish` writes it, or one at the folder's top level, as in a folder made by hand. All or nothing, as batch `library register` is: every quiz must pass `check` under its profile, and none may be a survey (`library.survey`, as for `register`), before anything is written. Commits once at the end. Each quiz's `source` is its file's absolute path in `DIR`, so `list` shows `changed` when the shelf's file is edited later.

- **With a manifest:** quizzes are matched **by id**.
  - **A new id** is registered under the shelf's name, with an entry on the `public` shelf and the manifest's `added` time. A name already taken by another quiz refuses the import, with a free name suggested as `register` does.
  - **An id the library has** keeps the library's name (a rename there is the owner's), with a note when the shelf calls it otherwise, and gets the `public` shelf entry. When the shelf's file is the quiz's current version, it is unchanged. When it is an older version of the quiz, it is unchanged too, with a note "the shelf has an older version (HASH)": nothing goes backwards. A new hash adds a version and makes it current, as `register --update` does.
  - **A file edited after publishing** (its hash is not the manifest's) is registered with `added` now, and a warning names it; otherwise `added` is the manifest's time.
- **Without a manifest:** every `DIR/*/*.md` whose front matter parses is registered as `register` would: under its front matter's `id`, named by its slugged title (else its id), with `added` now and no shelf entry. A taken id or name refuses the import, with its suggestion. Two `.md` files in one folder are two quizzes, each with the folder's assets.
- **`--into PATH`** creates the library first, with `library init`'s rules for the folder (new, missing or empty; another folder exits 2). It records the new library in `config.toml` only when the config names no library yet; otherwise the config is left alone and the output says how to use the new one.
- The output ends by noting that a published folder holds no results, reports or older versions, so import is not a backup.

| Option | Meaning |
|---|---|
| `--into PATH` | Create a library at `PATH` first, as above. The location is the user's choice, so agents pass it only when the user named it |
| `--json` | `{"status": "imported" \| "unchanged" \| "problems", "library", "imported", "unchanged", "refused": [{"name", "reason", "suggest"}], "warnings", "committed"}` |

**Output.**

```text
$ quiz library import ~/sites/quizzes --into ~/quiz-library-2
library ready /home/minh/quiz-library-2 (new folder, git repository)
imported 3 quizzes: calculus, rust-basics, signals (on the public shelf)
committed 9a8b7c6 fullmark: import calculus rust-basics signals
note a shelf holds no results, reports or older versions: import restores quizzes, not a backup

$ quiz library import ~/sites/quizzes --into ~/quiz-library-3
library ready /home/minh/quiz-library-3 (new folder, git repository)
note your library is still /home/minh/quiz-library; use this one with FULLMARK_LIBRARY=/home/minh/quiz-library-3 or quiz library init /home/minh/quiz-library-3 --force
imported 3 quizzes: calculus, rust-basics, signals (on the public shelf)
committed 2f1e0d9 fullmark: import calculus rust-basics signals
note a shelf holds no results, reports or older versions: import restores quizzes, not a backup
```

Exit: `0` imported or unchanged, `1` a quiz refused or check errors (nothing imported), `2` `--into` folder refused, or no library and no `--into`.

## Removed or merged

| 0.x | 1.0 |
|---|---|
| `quiz watch FILE [--serve]` | `quiz build FILE --watch [--serve]` |
| `quiz templates` | `quiz template list` |
| `quiz review --tui` | Dropped. Reviewing a question needs it rendered (math, code, images), which a terminal does badly; `review` stays web-only |
| `quiz brief --tui` | Built for real (it only exited 2 in 0.x) |
| `quiz serve --once`, `quiz review --once` | Dropped. Both always exit after one submit, so the flag has nothing to switch |
| `quiz serve PAGE.html` | Dropped. `serve` takes only the quiz source, so shared pages carry no server code. To collect results from a built page, use its **Download results** button |
