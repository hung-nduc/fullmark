import { Command, Option } from "commander";
import type { BriefOptions } from "./brief";
import type { BuildOptions } from "./build";
import type { CheckOptions } from "./check";
import { EXIT, type ExitCode } from "./exit-codes";
import type { GradeOptions } from "./grade";
import type { GuideOptions } from "./guide";
import type { IdsOptions, Io } from "./ids";
import type { InspectOptions } from "./inspect";
import type { NewOptions } from "./new";
import type { ReplayCommandOptions } from "./replay-command";
import type { ReviewOptions } from "./review";
import type { RulesOptions } from "./rules";
import { seededIds } from "./seed";
import type { ServeOptions } from "./serve";

export const VERSION = "1.1.1";

/** The exit code a command asked for; an action sets it and `main` returns it. */
type Outcome = { exit: ExitCode };

function terminalIo(): Io {
  return {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    errRaw: (text) => process.stderr.write(text),
    cwd: process.cwd(),
    tty: Boolean(process.stderr.isTTY),
    ...(process.stdout.columns ? { columns: process.stdout.columns } : {}),
    // TEST-ONLY: a fixed seed makes `quiz ids` repeatable, for the golden files. Nothing else reads this variable.
    ...(process.env.FULLMARK_TEST_SEED ? { newId: seededIds(process.env.FULLMARK_TEST_SEED) } : {}),
    // TEST-ONLY: a fixed time (ISO, with its offset) is the clock of every library command, for the golden files.
    ...(process.env.FULLMARK_TEST_NOW ? { now: () => new Date(process.env.FULLMARK_TEST_NOW as string) } : {}),
  };
}

export function buildProgram(outcome: Outcome = { exit: EXIT.done }, io: Io = terminalIo()): Command {
  const program = new Command();
  program
    .name("quiz")
    .description("Markdown in, one offline HTML quiz out.")
    .version(`fullmark ${VERSION}`, "--version", "print the version")
    .option(
      "--acknowledgements",
      "print fullmark's licence and every third-party component shipped in the CLI or in its pages (top level only)",
    )
    .helpOption("-h, --help", "help for the command")
    .helpCommand("help [command]", "help for a command")
    // `--version` is the program's own option before a command; after `library info NAME` it is that command's
    .enablePositionalOptions()
    .exitOverride();

  const noColor = () => "NO_COLOR" in process.env;

  program
    .command("check")
    .description("check quizzes under a profile: syntax errors, quality warnings, the brief beside the quiz")
    .argument("<files...>", "quiz .md files (globs are expanded)")
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--strict", "warnings count as errors")
    .option(
      "--review <review.json>",
      "also fail until every question marked fix has changed and every one marked drop is gone (one quiz only)",
    )
    .option("--json", "print one JSON object per file on stdout")
    .option("--plain", "no colours and no progress line, even in a terminal")
    .action(
      async (
        files: string[],
        options: {
          profile?: string;
          config?: string;
          strict?: boolean;
          review?: string;
          json?: boolean;
          plain?: boolean;
        },
      ) => {
        const opts: CheckOptions = {
          profile: options.profile ?? null,
          config: options.config ?? null,
          strict: Boolean(options.strict),
          review: options.review ?? null,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        };
        outcome.exit = (await import("./check")).runCheck(files, opts, io);
      },
    );

  program
    .command("rules")
    .description("the rule catalogue: what a profile checks and why a quiz was held to a rule")
    .argument("[rule]", "a rule id, such as choice.correct-longest or custom.two-essays")
    .option("--profile <name>", "show the rules under this profile (default: default, or the quiz's with --for)")
    .option(
      "--for <file>",
      "resolve the config and the profile as check FILE would, and show where each value came from",
    )
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--json", "print the rules as one JSON object on stdout")
    .option("--plain", "no colours, even in a terminal")
    .action(
      async (
        rule: string | undefined,
        options: { profile?: string; for?: string; config?: string; json?: boolean; plain?: boolean },
      ) => {
        const opts: RulesOptions = {
          profile: options.profile ?? null,
          for: options.for ?? null,
          config: options.config ?? null,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        };
        outcome.exit = (await import("./rules")).runRules(rule ?? null, opts, io);
      },
    );

  program
    .command("ids")
    .description("give every question without an id a random one, and change nothing else")
    .argument("<files...>", "quiz .md files (globs are expanded)")
    .option("--dry-run", "list the ids it would add, and write nothing")
    .option("--json", "print one JSON object per file on stdout")
    .option("--plain", "no progress line, even in a terminal")
    .action(async (files: string[], options: { dryRun?: boolean; json?: boolean; plain?: boolean }) => {
      const opts: IdsOptions = {
        dryRun: Boolean(options.dryRun),
        json: Boolean(options.json),
        plain: Boolean(options.plain) || "NO_COLOR" in process.env,
      };
      outcome.exit = await (await import("./ids")).runIds(files, opts, io);
    });

  program
    .command("grade")
    .description("re-grade attempts and write a report: score, wrong answers, and the essays laid out for a grader")
    .argument("<results...>", "results files (globs are expanded)")
    .requiredOption("--quiz <file>", "the quiz the attempts were taken on: it holds the answer key and the rubrics")
    .option("-o, --output <out>", "the report file; with several results files, a folder")
    .option("--grades <file>", "fold a filled-in grades file into the report (one results file only)")
    .option("--json", "write *-report.json and a *-grades.json template instead of Markdown, and print JSON")
    .option("--web", "grade by hand in a form on 127.0.0.1, then write the grades file and the report")
    .option("--name <name>", "with --web: the human grader's name (default: the form asks)")
    .option("--open", "with --web: open the form in the browser")
    .option(
      "--timeout <seconds>",
      "with --web: give up after this long without Save grades (default 1800; 0 waits forever)",
    )
    .option("--port <n>", "with --web: the port on 127.0.0.1 (default: a free one)")
    .option("--plain", "no progress line, even in a terminal")
    .action(
      async (
        results: string[],
        options: {
          quiz: string;
          output?: string;
          grades?: string;
          json?: boolean;
          web?: boolean;
          name?: string;
          open?: boolean;
          timeout?: string;
          port?: string;
          plain?: boolean;
        },
      ) => {
        const opts: GradeOptions = {
          quiz: options.quiz,
          output: options.output ?? null,
          grades: options.grades ?? null,
          json: Boolean(options.json),
          web: Boolean(options.web),
          name: options.name ?? null,
          timeout: options.timeout ?? null,
          open: Boolean(options.open),
          port: options.port ?? null,
          version: VERSION,
          plain: Boolean(options.plain) || noColor(),
        };
        outcome.exit = await (await import("./grade")).runGrade(results, opts, io);
      },
    );

  program
    .command("build")
    .description("check a quiz, then write it as one offline HTML page")
    .argument("[files...]", "quiz .md files (globs are expanded); with --build-file, only those of its entries")
    .option(
      "-o, --output <out>",
      "the page to write (default: the quiz file with .html); with several files or a build file, a folder",
    )
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--strict", "warnings count as errors, and nothing is written")
    .option("--built-at <iso>", "pin the build time, so a build is byte-identical across runs (default: now)")
    .option("--build-file <build>", "build what a build file lists (TOML): its [[build]] entries, in order")
    .option("--json", "print one JSON object per file on stdout")
    .option("--open", "open the page after building (one file)")
    .option("--print", "write a printable exam paper (static HTML, black on white) instead of the page")
    .option("--seed <s>", "with --print: shuffle reproducibly; 1 to 8 letters or digits, printed as the paper code")
    .option("--answer-sheet", "with --print: a grid of boxes for the single-choice and true/false answers")
    .option(
      "--answers <mode>",
      "with --print: none (an exam paper), key (the answer key on a new page) or inline (a study sheet)",
    )
    .option("--materials <which>", "with --print: none leaves the materials page out")
    .option("--ui-lang <lang>", "the page's language for this build, en or vi (default: the quiz's ui_lang)")
    .option(
      "--fonts <which>",
      "which fonts the page embeds: quiz (the quiz's own), all or none (default: fonts in config.toml, else quiz)",
    )
    .option("--plain", "no colours and no progress line, even in a terminal")
    .option("--watch", "rebuild when the quiz, the files it uses or the build file change; Ctrl+C stops (exit 0)")
    .option("--serve", "with --watch: serve the last good page on 127.0.0.1 and reload it after each rebuild")
    .option("--port <n>", "with --serve: the port on 127.0.0.1 (default: a free one)")
    .action(async (files: string[], options: Record<string, unknown>) => {
      const opts: BuildOptions = {
        profile: (options.profile as string | undefined) ?? null,
        config: (options.config as string | undefined) ?? null,
        strict: Boolean(options.strict),
        output: (options.output as string | undefined) ?? null,
        builtAt: (options.builtAt as string | undefined) ?? null,
        plain: Boolean(options.plain) || noColor(),
        json: Boolean(options.json),
        buildFile: (options.buildFile as string | undefined) ?? null,
        open: Boolean(options.open),
        uiLang: (options.uiLang as string | undefined) ?? null,
        print: Boolean(options.print),
        seed: (options.seed as string | undefined) ?? null,
        answerSheet: Boolean(options.answerSheet),
        answers: (options.answers as string | undefined) ?? null,
        materials: (options.materials as string | undefined) ?? null,
        watch: Boolean(options.watch),
        serve: Boolean(options.serve),
        port: (options.port as string | undefined) ?? null,
        fonts: (options.fonts as string | undefined) ?? null,
        version: VERSION,
      };
      outcome.exit = await (await import("./build")).runBuild(files, opts, io);
    });

  program
    .command("replay")
    .description("write an attempt as a page already submitted: the answers, the explanations and the grades")
    .argument("<results...>", "results files (globs are expanded)")
    .requiredOption("--quiz <file>", "the quiz the attempts were taken on (read, not checked)")
    .option("--grades <file>", "show these grades for essays and code (default: RESULTS-grades.json beside it, if any)")
    .option(
      "-o, --output <out>",
      "the page to write (default: RESULTS with -replay.html); with several files, a folder",
    )
    .option("--built-at <iso>", "pin the build time, so a page is byte-identical across runs (default: now)")
    .option("--ui-lang <lang>", "the page's language, en or vi (default: the quiz's ui_lang)")
    .option("--fonts <which>", "which fonts the page embeds: quiz (the quiz's own), all or none")
    .option("--open", "open the page after writing it (the default for one file)")
    .option("--no-open", "do not open the page")
    .option("--json", "print one JSON object per file on stdout")
    .option("--plain", "no colours and no progress line, even in a terminal")
    .action(async (results: string[], options: Record<string, unknown>) => {
      const opts: ReplayCommandOptions = {
        quiz: (options.quiz as string | undefined) ?? null,
        grades: (options.grades as string | undefined) ?? null,
        output: (options.output as string | undefined) ?? null,
        builtAt: (options.builtAt as string | undefined) ?? null,
        uiLang: (options.uiLang as string | undefined) ?? null,
        fonts: (options.fonts as string | undefined) ?? null,
        plain: Boolean(options.plain) || noColor(),
        json: Boolean(options.json),
        open: options.open === true,
        noOpen: options.open === false,
        version: VERSION,
      };
      outcome.exit = await (await import("./replay-command")).runReplay(results, opts, io);
    });

  program
    .command("guide")
    .description("print the authoring guide: how a quiz is written in Markdown")
    .addOption(new Option("--lang <lang>", "the guide's language").choices(["en", "vi"]).default("en"))
    .option("--plain", "the Markdown source, even in a terminal")
    .option("--no-pager", "styled, but printed straight to the terminal")
    .action(async (options: Record<string, unknown>) => {
      const opts: GuideOptions = {
        lang: options.lang as string,
        plain: Boolean(options.plain) || noColor(),
        noPager: options.pager === false,
      };
      outcome.exit = (await import("./guide")).runGuide(opts, io);
    });

  program
    .command("agent-guide")
    .description("print the instructions for AI agents (AGENTS.md)")
    .option("--plain", "the Markdown source, even in a terminal")
    .option("--no-pager", "styled, but printed straight to the terminal")
    .action(async (options: Record<string, unknown>) => {
      const opts: GuideOptions = { plain: Boolean(options.plain) || noColor(), noPager: options.pager === false };
      outcome.exit = (await import("./guide")).runAgentGuide(opts, io);
    });

  program
    .command("inspect")
    .description("summarise a quiz: question types, points, sections, tags, banks and where the right answers sit")
    .argument("<file>", "a quiz .md")
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option(
      "--review <review.json>",
      "also count the questions judged keep, fix and drop, and check them as check --review does",
    )
    .option("--json", "print the summary as one JSON object on stdout")
    .option("--plain", "no colours, even in a terminal")
    .action(async (file: string, options: Record<string, unknown>) => {
      const opts: InspectOptions = {
        profile: (options.profile as string | undefined) ?? null,
        config: (options.config as string | undefined) ?? null,
        review: (options.review as string | undefined) ?? null,
        json: Boolean(options.json),
        plain: Boolean(options.plain) || noColor(),
      };
      outcome.exit = (await import("./inspect")).runInspect(file, opts, io);
    });

  program
    .command("brief")
    .description(
      "ask what a quiz is for and write brief.yaml (and an empty content/ folder) for an agent to write it from",
    )
    .argument("<dir>", "the folder for brief.yaml and content/ (created when missing)")
    .option("--web", "ask in a form in the browser, served once on 127.0.0.1; the other flags pre-fill it")
    .option(
      "--tui",
      "ask in the terminal, drawn on stderr (stdin and stderr must be terminals); the other flags pre-fill it",
    )
    .option("--no-open", "with --web: do not open the browser")
    .option("--timeout <seconds>", "with --web: how long to wait for the form (default 1800)")
    .option("--port <n>", "with --web: the port on 127.0.0.1")
    .option("--purpose <p>", "what the quiz is for (human-only)")
    .option("--scope <text>", "what the quiz covers (human-only)")
    .option("--kinds <list>", "the material in content/")
    .option("--kinds-other <text>", "what the other material is")
    .option("--elsewhere <text>", "material that is not in content/")
    .option("--count <n>", "the number of questions")
    .option("--minutes <n>", "the time limit in minutes; 0 for none")
    .option("--mix <list>", "the kinds of questions")
    .option("--difficulty <d>", "how hard")
    .option("--mode <m>", "how the quiz is taken")
    .option("--weak-topics <yes|no>", "stress the topics done badly on")
    .option("--commitment <n>", "the score the learner commits to, 1 to 100; 0 for none")
    .option("--language <lang>", "the quiz's language: en or vi")
    .option("--request <text>", "anything else for the agent")
    .option("--profile <name>", "the check profile (default: from the purpose)")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--accept-defaults", "also take the default of a human-only value, recorded as decided by the agent")
    .option("--json", "print the outcome as one JSON object on stdout")
    .action(async (dir: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      const opts: BriefOptions = {
        purpose: text("purpose"),
        scope: text("scope"),
        kinds: text("kinds"),
        kindsOther: text("kindsOther"),
        elsewhere: text("elsewhere"),
        count: text("count"),
        minutes: text("minutes"),
        mix: text("mix"),
        difficulty: text("difficulty"),
        mode: text("mode"),
        weakTopics: text("weakTopics"),
        commitment: text("commitment"),
        language: text("language"),
        request: text("request"),
        profile: text("profile"),
        config: text("config"),
        acceptDefaults: Boolean(options.acceptDefaults),
        web: Boolean(options.web),
        tui: Boolean(options.tui),
        json: Boolean(options.json),
        open: options.open !== false,
        timeout: text("timeout"),
        port: text("port"),
        version: VERSION,
      };
      outcome.exit = await (await import("./brief")).runBrief(dir, opts, io);
    });

  program
    .command("stats")
    .description("progress across attempts at one quiz: score by date, tags, weakest tags, questions missed, criteria")
    .argument("<files...>", "two or more reports (*-report.json) or results files (globs are expanded)")
    .option("--quiz <file>", "the current quiz: names questions and tags, and grades results files of its version")
    .option("--json", "print the summary as one JSON object")
    .action(async (files: string[], options: { quiz?: string; json?: boolean }) => {
      const opts = { quiz: options.quiz ?? null, json: Boolean(options.json) };
      outcome.exit = (await import("./stats")).runStats(files, opts, io);
    });

  program
    .command("new")
    .description("start a quiz from a template (quiz template list) or from an existing quiz")
    .argument("[args...]", "TEMPLATE [PATH], or with --from only the PATH (default: the current folder)")
    .option("--from <file>", "start from this quiz .md and its assets, in place of a template")
    .option("--skeleton", "with --from: keep the structure and empty the content")
    .option("--json", "print the outcome as one JSON object")
    .action(async (args: string[], options: { from?: string; skeleton?: boolean; json?: boolean }) => {
      const opts: NewOptions = {
        from: options.from ?? null,
        skeleton: Boolean(options.skeleton),
        json: Boolean(options.json),
      };
      outcome.exit = await (await import("./new")).runNew(args, opts, io);
    });

  const template = program
    .command("template")
    .description("the templates you start quizzes from: built-in and your own");
  template
    .command("list")
    .description("every template and where it comes from")
    .option("--json", "print the templates as a JSON array")
    .action(async (options: { json?: boolean }) => {
      outcome.exit = (await import("./template")).runTemplateList(Boolean(options.json), io);
    });
  template
    .command("add")
    .description("store a quiz and its assets as your own template")
    .argument("<file>", "a quiz .md")
    .option("--as <name>", "the template's name: a slug (default: the file name, slugged)")
    .option("--skeleton", "store the structure without the content, as new --from --skeleton makes it")
    .option("--replace", "overwrite one of your templates of that name")
    .option("--json", "print the outcome as one JSON object")
    .action(async (file: string, options: { as?: string; skeleton?: boolean; replace?: boolean; json?: boolean }) => {
      outcome.exit = await (await import("./template")).runTemplateAdd(
        file,
        {
          as: options.as ?? null,
          skeleton: Boolean(options.skeleton),
          replace: Boolean(options.replace),
          json: Boolean(options.json),
        },
        io,
      );
    });
  template
    .command("rm")
    .description("delete one of your templates")
    .argument("<name>", "the template's name")
    .option("--yes", "do not ask first")
    .option("--json", "print the outcome as one JSON object (never asks: needs --yes)")
    .action(async (name: string, options: { yes?: boolean; json?: boolean }) => {
      outcome.exit = await (await import("./template")).runTemplateRemove(
        name,
        { yes: Boolean(options.yes), json: Boolean(options.json) },
        io,
      );
    });

  program
    .command("serve")
    .description("serve a quiz on 127.0.0.1 and write the results when the learner presses Submit (one submit only)")
    .argument("<file>", "the quiz .md (a built page is refused: use its Export button)")
    .option("--out <results>", "the results file (default: <quiz-id>-results-<time>.json next to the quiz)")
    .option("--timeout <seconds>", "how long to wait for a submit; 0 waits forever (default 1800)")
    .option("--open", "open the page in the default browser")
    .option("--port <n>", "the port on 127.0.0.1 (default: a free one)")
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--fonts <which>", "which fonts the page embeds: quiz (the quiz's own), all or none")
    .option("--focus", "tick Focus mode on the start screen")
    .option("--section <s>", "serve only this section (its slug or title)")
    .option("--autosave <progress>", "keep the attempt in progress in this file, so it resumes after a restart")
    .option("--json", "print a listening line, then the outcome, as JSON on stdout")
    .action(async (file: string, options: Record<string, unknown>) => {
      const opts: ServeOptions = {
        out: (options.out as string | undefined) ?? null,
        timeout: (options.timeout as string | undefined) ?? null,
        open: Boolean(options.open),
        port: (options.port as string | undefined) ?? null,
        json: Boolean(options.json),
        profile: (options.profile as string | undefined) ?? null,
        config: (options.config as string | undefined) ?? null,
        fonts: (options.fonts as string | undefined) ?? null,
        focus: Boolean(options.focus),
        section: (options.section as string | undefined) ?? null,
        autosave: (options.autosave as string | undefined) ?? null,
        version: VERSION,
      };
      outcome.exit = await (await import("./serve")).runServe(file, opts, io);
    });

  program
    .command("review")
    .description("a form to judge every question (keep, fix or drop) and write review.json when you press Finish")
    .argument("<file>", "the quiz .md (a built page is refused)")
    .option("--out <review>", "the review file (default: review.json next to the quiz); an existing one is merged into")
    .option(
      "--since <review>",
      "ask only about questions new or changed since this review, and merge into it (--out may be left out)",
    )
    .option("--timeout <seconds>", "how long to wait for Finish; 0 waits forever (default 1800)")
    .option("--open", "open the form in the default browser")
    .option("--port <n>", "the port on 127.0.0.1 (default: a free one)")
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml")
    .option("--json", "print a listening line, then the outcome, as JSON on stdout")
    .action(async (file: string, options: Record<string, unknown>) => {
      const opts: ReviewOptions = {
        out: (options.out as string | undefined) ?? null,
        since: (options.since as string | undefined) ?? null,
        timeout: (options.timeout as string | undefined) ?? null,
        open: Boolean(options.open),
        port: (options.port as string | undefined) ?? null,
        json: Boolean(options.json),
        profile: (options.profile as string | undefined) ?? null,
        config: (options.config as string | undefined) ?? null,
        version: VERSION,
      };
      outcome.exit = await (await import("./review")).runReview(file, opts, io);
    });

  const library = program
    .command("library")
    .description("the library: one folder under git that keeps each quiz's versions, attempts and reports");
  library
    .command("init")
    .description("make PATH (default: here) this machine's library and record it in the config")
    .argument("[path]", "the folder: new, empty or already a library")
    .option("--force", "switch from another library already in the config")
    .option("--no-git", "do not make a git repository (rm then needs --force)")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (path: string | undefined, options: Record<string, unknown>) => {
      outcome.exit = await (await import("./library-init")).runLibraryInit(
        path ?? null,
        {
          force: Boolean(options.force),
          noGit: options.git === false,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        },
        io,
      );
    });
  library
    .command("status")
    .description("the library's config, git state, counts and problems")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (options: { json?: boolean; plain?: boolean }) => {
      outcome.exit = await (await import("./library-status")).runLibraryStatus(
        { json: Boolean(options.json), plain: Boolean(options.plain) || noColor() },
        io,
      );
    });
  library
    .command("path")
    .description("print the library's folder, or a quiz's")
    .argument("[name]", "a quiz's name or id")
    .action(async (name: string | undefined) => {
      outcome.exit = (await import("./library-path")).runLibraryPath(name ?? null, io);
    });
  library
    .command("register")
    .description("check quizzes and keep each as a version in the library, with the rules it was checked under")
    .argument("[files...]", "quiz .md files (globs are expanded); with --build-file, only those of its entries")
    .option("-n, --name <name>", "the name of a new quiz (default: the slugged title)")
    .option("--update <name>", "add a version to this existing quiz")
    .option("--build-file <build>", "register the files a build file lists (only files, profile, config and strict)")
    .option("--profile <name>", "the check profile; overrides the quiz's profile")
    .option("--config <toml>", "use this config file instead of the nearest fullmark.toml, or the library's")
    .option("--strict", "warnings count as errors")
    .option("--review <review.json>", "also fail until every question marked fix has changed and every drop is gone")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours and no progress line, even in a terminal")
    .action(async (files: string[], options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-register")).runLibraryRegister(
        files,
        {
          name: text("name"),
          update: text("update"),
          buildFile: text("buildFile"),
          profile: text("profile"),
          config: text("config"),
          strict: Boolean(options.strict),
          review: text("review"),
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        },
        io,
      );
    });
  library
    .command("list")
    .description("every quiz in the library: versions, attempts, last score, and a note when its source changed")
    .option("--json", "print the quizzes as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (options: { json?: boolean; plain?: boolean }) => {
      outcome.exit = (await import("./library-list")).runLibraryList(
        { json: Boolean(options.json), plain: Boolean(options.plain) || noColor() },
        io,
      );
    });
  library
    .command("info")
    .description("everything about one quiz: content, versions, attempts, review and where it lives")
    .argument("<name>", "a quiz's name or id")
    .option("--version <hash>", "show this version's content (a hash, or a prefix of at least 4 characters)")
    .option("--json", "print the quiz's row and more as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: { version?: string; json?: boolean; plain?: boolean }) => {
      outcome.exit = (await import("./library-info")).runLibraryInfo(
        name,
        { version: options.version ?? null, json: Boolean(options.json), plain: Boolean(options.plain) || noColor() },
        io,
      );
    });
  library
    .command("take")
    .description("serve a quiz from the library, file the result next to its version and commit")
    .argument("<name>", "a quiz's name or id")
    .option("--section <s>", "only this section (its slug or title)")
    .option("--missed", "only the questions you got wrong or partly right and have not answered right since")
    .option("--focus", "tick Focus mode on the start screen")
    .option("--dry-run", "print the plan the take would serve and serve nothing")
    .option("--fonts <which>", "which fonts the page embeds: quiz (the quiz's own), all or none")
    .option("--no-open", "do not open the page in the browser")
    .option("--timeout <seconds>", "how long to wait for a submit; 0 waits forever (default 0)")
    .option("--port <n>", "the port on 127.0.0.1 (default: a free one)")
    .option("--json", "print a listening line, then the outcome, as JSON on stdout")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-take")).runLibraryTake(
        name,
        {
          section: text("section"),
          missed: Boolean(options.missed),
          focus: Boolean(options.focus),
          dryRun: Boolean(options.dryRun),
          open: options.open !== false,
          timeout: text("timeout"),
          port: text("port"),
          fonts: text("fonts"),
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          version: VERSION,
        },
        io,
      );
    });
  library
    .command("grade")
    .description("grade an attempt against its version and write the report; keeps every grades file")
    .argument("<name>", "a quiz's name or id")
    .option(
      "--attempt <stamp>",
      "the attempt (a stamp or a prefix of 4 or more characters; default: the newest waiting for a grade)",
    )
    .option("--grades <file>", "keep this filled-in grades file and grade with it")
    .option("--json", "write a grades template for an attempt with essays or code, and print JSON")
    .option("--web", "grade by hand in a form on 127.0.0.1, pre-filled from the newest grades kept")
    .option("--name <name>", "with --web: the human grader's name (default: the form asks)")
    .option("--no-open", "with --web: do not open the form in the browser")
    .option(
      "--timeout <seconds>",
      "with --web: give up after this long without Save grades (default 1800; 0 waits forever)",
    )
    .option("--port <n>", "with --web: the port on 127.0.0.1 (default: a free one)")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-grade")).runLibraryGrade(
        name,
        {
          attempt: text("attempt"),
          grades: text("grades"),
          web: Boolean(options.web),
          name: text("name"),
          timeout: text("timeout"),
          port: text("port"),
          open: options.open !== false,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          version: VERSION,
        },
        io,
      );
    });
  library
    .command("stats")
    .description(
      "progress over every attempt at a quiz, across versions: score by date, tags, weakest, missed, criteria",
    )
    .argument("<name>", "a quiz's name or id")
    .option("--json", "print the summary as one JSON object")
    .action(async (name: string, options: { json?: boolean }) => {
      outcome.exit = (await import("./library-stats")).runLibraryStats(name, { json: Boolean(options.json) }, io);
    });
  library
    .command("review")
    .description(
      "judge every question of a quiz in the library (keep, fix or drop) in a form; Finish files review.json",
    )
    .argument("<name>", "a quiz's name or id")
    .option("--since", "ask only about the questions new or changed since the stored review")
    .option("--timeout <seconds>", "how long to wait for Finish; 0 waits forever (default 1800)")
    .option("--port <n>", "the port on 127.0.0.1 (default: a free one)")
    .option("--no-open", "do not open the form in the browser")
    .option("--json", "print a listening line, then the outcome, as JSON on stdout")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-review")).runLibraryReview(
        name,
        {
          since: Boolean(options.since),
          timeout: text("timeout"),
          port: text("port"),
          open: options.open !== false,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          version: VERSION,
        },
        io,
      );
    });
  library
    .command("share")
    .description("write a quiz's clean offline page, or with --source its editable folder")
    .argument("<name>", "a quiz's name or id")
    .option("-o, --output <dir>", "the folder to write into (default: here)")
    .option("--version <hash>", "this version (a hash, or a prefix of at least 4 characters); default: the current one")
    .option("--source", "write the editable folder NAME/ (the source, its assets and a fullmark.toml when needed)")
    .option("--fonts <which>", "which fonts the page embeds: quiz (the quiz's own), all or none")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-share")).runLibraryShare(
        name,
        {
          output: text("output"),
          version: text("version"),
          source: Boolean(options.source),
          fonts: text("fonts"),
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          program: VERSION,
        },
        io,
      );
    });
  library
    .command("publish")
    .description("mark a quiz for the public shelf (--on, --off), or sync the shelf folder with the library")
    .argument(
      "[target]",
      "a quiz's name or id with --on or --off; else the shelf's folder (default: the remembered one)",
    )
    .option("--on", "put the quiz on the public shelf")
    .option("--off", "take the quiz off the public shelf")
    .option("--with-brief", "copy each quiz's brief.yaml too")
    .option("--no-brief", "copy no brief.yaml (the default)")
    .option("--ui-lang <lang>", "the index page's interface language: en or vi (default: en)")
    .option("--fonts <which>", "which fonts the pages embed: quiz (the quiz's own), all or none")
    .option("--dry-run", "print what would be added, updated and removed, and write nothing")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (target: string | undefined, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-publish")).runLibraryPublish(
        target ?? null,
        {
          on: Boolean(options.on),
          off: Boolean(options.off),
          withBrief: Boolean(options.withBrief),
          noBrief: options.brief === false,
          uiLang: text("uiLang"),
          fonts: text("fonts"),
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          program: VERSION,
        },
        io,
      );
    });
  library
    .command("import")
    .description("register the quizzes of a published folder into a library, keeping ids and names")
    .argument("<dir>", "the folder `quiz library publish` wrote (or one with a quiz in each folder)")
    .option("--into <path>", "create a library at this path first (a new, missing or empty folder)")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (dir: string, options: Record<string, unknown>) => {
      outcome.exit = await (await import("./library-import")).runLibraryImport(
        dir,
        {
          into: (options.into as string | undefined) ?? null,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        },
        io,
      );
    });
  const libraryTemplate = library.command("template").description("templates from the library");
  libraryTemplate
    .command("add")
    .description("store a quiz of the library, at one version, as a user template")
    .argument("<name>", "a quiz's name or id")
    .option("--as <template>", "the template's name: a slug (default: the quiz's name)")
    .option("--version <hash>", "this version (a hash, or a prefix of at least 4 characters); default: the current one")
    .option("--skeleton", "store the structure without the content")
    .option("--replace", "overwrite one of your templates of that name")
    .option("--json", "print the outcome as one JSON object")
    .action(async (name: string, options: Record<string, unknown>) => {
      outcome.exit = await (await import("./library-template")).runLibraryTemplateAdd(
        name,
        {
          as: (options.as as string | undefined) ?? null,
          version: (options.version as string | undefined) ?? null,
          skeleton: Boolean(options.skeleton),
          replace: Boolean(options.replace),
          json: Boolean(options.json),
        },
        io,
      );
    });
  library
    .command("rename")
    .description("change a quiz's name; its id and folder stay")
    .argument("<old>", "a quiz's name or id")
    .argument("<new>", "the new name: a slug no other quiz has as a name or an id")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (oldName: string, newName: string, options: { json?: boolean; plain?: boolean }) => {
      outcome.exit = await (await import("./library-rename")).runLibraryRename(
        oldName,
        newName,
        { json: Boolean(options.json), plain: Boolean(options.plain) || noColor() },
        io,
      );
    });
  library
    .command("rm")
    .description("delete a quiz with its versions and results, and commit, so git revert brings it back")
    .argument("<name>", "a quiz's name or id")
    .option("--yes", "do not ask first")
    .option(
      "--force",
      "delete even when it could not be undone: no git repository, uncommitted changes, a take is open",
    )
    .option("--json", "print the outcome as one JSON object (never asks: needs --yes)")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      outcome.exit = await (await import("./library-rm")).runLibraryRm(
        name,
        {
          yes: Boolean(options.yes),
          force: Boolean(options.force),
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
        },
        io,
      );
    });
  library
    .command("replay")
    .description("open a past attempt as a page already submitted, with its grades; writes nothing in the library")
    .argument("<name>", "a quiz's name or id")
    .option("--attempt <stamp>", "the attempt (a stamp or a prefix of 4 or more characters; default: the newest)")
    .option("-o, --output <dir>", "write the page into this folder instead of the temp folder")
    .option("--fonts <which>", "which fonts the page embeds: quiz (the quiz's own), all or none")
    .option("--no-open", "do not open the page in the browser")
    .option("--json", "print the outcome as one JSON object")
    .option("--plain", "no colours, even in a terminal")
    .action(async (name: string, options: Record<string, unknown>) => {
      const text = (key: string): string | null => (options[key] as string | undefined) ?? null;
      outcome.exit = await (await import("./library-replay")).runLibraryReplay(
        name,
        {
          attempt: text("attempt"),
          output: text("output"),
          open: options.open !== false,
          json: Boolean(options.json),
          plain: Boolean(options.plain) || noColor(),
          fonts: text("fonts"),
          version: VERSION,
        },
        io,
      );
    });
  return program;
}

async function main(argv: string[]): Promise<number> {
  const outcome: Outcome = { exit: EXIT.done };
  try {
    const program = buildProgram(outcome);
    // no command: the help goes to stderr and the exit code is 2 (COMMANDS.md, Exit codes)
    // the notices sit in their own chunk, so no other command pays for them (test/cli-graph.test.ts)
    if (argv[2] === "--acknowledgements") {
      process.stdout.write((await import("./acknowledgements")).acknowledgements());
      return EXIT.done;
    }
    // the question file words the options of `brief`; only its help reads the file
    if (argv.includes("brief") && (argv.includes("--help") || argv.includes("-h") || argv[2] === "help"))
      (await import("./brief-help")).describeBriefOptions(program);
    if (argv.length <= 2) {
      program.outputHelp({ error: true });
      return EXIT.usage;
    }
    await program.parseAsync(argv);
    return outcome.exit;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    // --version and --help end the parse through exitOverride; they are not failures.
    if (code === "commander.version" || code === "commander.helpDisplayed" || code === "commander.help") {
      return EXIT.done;
    }
    if (code.startsWith("commander.")) return EXIT.usage;
    // Anything else is a bug: say so, with the command line, and the stack only on request.
    process.stderr.write(`this is a bug in fullmark: ${(error as Error).message}\n`);
    process.stderr.write(`command line: ${argv.slice(2).join(" ")}\n`);
    if (argv.includes("--debug")) process.stderr.write(`${(error as Error).stack ?? ""}\n`);
    return EXIT.usage;
  }
}

// The reader of stdout closed it early (`quiz library list | head -1`): stop writing and end quietly, as most command-line
// tools do (COMMANDS.md, "Exit codes"; STEP4-GAPS.md, G30). Any other error on stdout is left to fail as before.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(EXIT.done);
  throw error;
});

process.exitCode = await main(process.argv);
