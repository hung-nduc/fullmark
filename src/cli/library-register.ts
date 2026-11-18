import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseResults } from "../core/attempt";
import { summarise } from "../core/inspect";
import type { Quiz } from "../core/ir";
import type { ParseTex } from "../core/parse/tex";
import { shortDate } from "../core/review/counts";
import { ID_FORMAT, slug } from "../core/slug";
import { CHECK_FILE, renderCheck } from "../library/check-file";
import { type IndexQuiz, type LibraryIndex, writeIndex } from "../library/index-file";
import { libraryPaths, shortHash } from "../library/layout";
import { LockBusy, withLock } from "../library/lock";
import { diffVersions, questionHashes, removeVersionTemps, type VersionFile, writeVersion } from "../library/versions";
import { writeFileAtomic } from "./atomic";
import type { BuildOptions } from "./build";
import { planBuildFile } from "./build-file";
import { type CheckOptions, checkFile, clearProgress, humanIssue, showProgress } from "./check";
import { findProjectConfig } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import { expandInputs } from "./files";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  lockEnvOf,
  machineOf,
  noSuchQuiz,
  nowOf,
  openLibrary,
  painterFor,
} from "./library-common";
import { shownPath } from "./paths";
import { plural } from "./table";
import { localIso } from "./time";

export type LibraryRegisterOptions = {
  name: string | null;
  update: string | null;
  buildFile: string | null;
  profile: string | null;
  config: string | null;
  strict: boolean;
  review: string | null;
  json: boolean;
  plain: boolean;
};

type RegisterIo = LibraryIo & { parseTex?: ParseTex };

/** A finding in `check`'s issue format: `FILE:LINE: level rule: message`, then `fix:` lines. */
type Finding = { file: string; line: number | null; rule: string; message: string; fix: string[] };

type Checked = NonNullable<ReturnType<typeof okOutcome>>;
/** The quiz of a file whose check passed. */
const quizOf = (checked: Checked): Quiz => {
  if (checked.loaded.quiz === null) throw new Error("a quiz that passed its check has no parsed quiz");
  return checked.loaded.quiz;
};
const okOutcome = (r: ReturnType<typeof checkFile>) => (r.status === "error" ? null : r);

/** What becomes of one file. */
type Plan =
  | { what: "new"; file: string; abs: string; checked: Checked; name: string; hash: string }
  | { what: "version"; file: string; abs: string; checked: Checked; quiz: IndexQuiz; hash: string }
  | { what: "again"; file: string; abs: string; checked: Checked; quiz: IndexQuiz; hash: string }
  | { what: "unchanged"; file: string; quiz: IndexQuiz; hash: string };

const NAME_FIX = "a name is a slug: a to z, 0 to 9 and -, starting with a letter, 1 to 64 characters";

/** The name a quiz gets by default: its slugged title, else its id. */
function defaultName(title: string, id: string): string {
  const slugged = slug(title).slice(0, 64).replace(/-+$/, "");
  return ID_FORMAT.test(slugged) ? slugged : id;
}

/** A free name beside `name`: `name-2`, `name-3`, … */
function freeName(name: string, taken: ReadonlySet<string>): string {
  const base = name.slice(0, 60).replace(/-+$/, "");
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The files of a version: the source under its own name, every asset and sheet at its path, the brief, `check.json`. */
function versionFiles(abs: string, checked: Checked): VersionFile[] {
  const enc = new TextEncoder();
  const files: VersionFile[] = [{ path: basename(abs), bytes: enc.encode(checked.loaded.text) }];
  for (const a of checked.loaded.assets) files.push({ path: a.path, bytes: a.bytes });
  for (const s of checked.loaded.sheets) files.push({ path: s.path, bytes: enc.encode(s.source) });
  const brief = join(dirname(abs), "brief.yaml");
  if (existsSync(brief)) files.push({ path: "brief.yaml", bytes: new Uint8Array(readFileSync(brief)) });
  files.push({ path: CHECK_FILE, bytes: enc.encode(renderCheck(checked.resolved)) });
  return files;
}

/** `2 added, 1 removed, 3 changed`, leaving out what is zero; `no question changed` when all are. */
function diffText(d: { added: string[]; removed: string[]; changed: string[] }): string {
  const parts = [
    d.added.length > 0 ? `${d.added.length} added` : null,
    d.removed.length > 0 ? `${d.removed.length} removed` : null,
    d.changed.length > 0 ? `${d.changed.length} changed` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(", ") : "no question changed";
}

/** The warnings of an attempt saved on an older version (G17): one per progress file not on the new current. */
function progressWarnings(root: string, quiz: IndexQuiz, current: string): { version: string; text: string }[] {
  const q = libraryPaths(root).quiz(quiz.id);
  let names: string[] = [];
  try {
    names = readdirSync(q.progress).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const out: { version: string; text: string }[] = [];
  const all = quiz.versions.map((v) => v.hash);
  for (const name of names.sort()) {
    const hash = name.slice(0, -".json".length);
    if (hash === current) continue;
    let detail = "";
    try {
      const read = parseResults(readFileSync(join(q.progress, name), "utf8"));
      if (read.ok) {
        const { plan, state } = read.results;
        const answered = plan.questions.filter((id) => state.answers[id] != null).length;
        const started = state.startedAt;
        const when = started === null ? "" : `, ${shortDate(started)} ${started.slice(11, 16)}`;
        detail = ` (${answered} of ${plan.questions.length} answered${when})`;
      }
    } catch {
      // unreadable: the warning still names the version
    }
    out.push({ version: hash, text: detail });
  }
  return out.map((w) => ({ version: shortHash(w.version, all), text: w.text }));
}

/**
 * `quiz library register FILE... [-n NAME | --update NAME] [--build-file BUILD]` (COMMANDS.md): checks every file,
 * resolves every name, and only then writes the versions, `library.toml` and one commit; all or nothing.
 */
export async function runLibraryRegister(
  patterns: readonly string[],
  opts: LibraryRegisterOptions,
  io: RegisterIo,
): Promise<ExitCode> {
  const machine = machineOf(io);
  const cwd = machine.cwd;
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;

  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, git } = opened.located;
  const paths = libraryPaths(root);

  // the inputs: FILE..., or the files of a build file's entries (narrowed by FILE...)
  const jobs: { file: string; abs: string; opts: CheckOptions }[] = [];
  const baseOpts = (o: Partial<CheckOptions> = {}): CheckOptions => ({
    profile: opts.profile,
    config: opts.config,
    strict: opts.strict,
    review: opts.review,
    json: opts.json,
    plain: opts.plain,
    ...o,
  });
  let several: boolean;
  if (opts.buildFile !== null) {
    const asBuild: BuildOptions = {
      profile: opts.profile,
      config: opts.config,
      strict: opts.strict,
      output: null,
      builtAt: null,
      uiLang: null,
      fonts: null,
      plain: true,
      json: false,
      buildFile: opts.buildFile,
      open: false,
      print: false,
      seed: null,
      answerSheet: false,
      answers: null,
      materials: null,
      watch: false,
      serve: false,
      port: null,
      version: "",
    };
    const plan = planBuildFile(opts.buildFile, patterns, asBuild, cwd);
    if (!plan.ok) {
      if (opts.json)
        io.out(
          JSON.stringify({
            status: "error",
            message: plan.message,
            ...(plan.file ? { file: plan.file } : {}),
            ...(plan.errors ? { errors: plan.errors } : {}),
          }),
        );
      io.err(plan.message);
      for (const d of plan.details) io.err(d);
      return EXIT.usage;
    }
    const seen = new Map<string, { profile: string | null; config: string | null; strict: boolean }>();
    for (const item of plan.items) {
      if ("error" in item) {
        const e = item.error;
        return libraryFail(io, opts.json, `${e.input}: ${e.message}`);
      }
      const { job } = item;
      const mine = { profile: job.opts.profile, config: job.opts.config, strict: job.opts.strict };
      const was = seen.get(job.abs);
      if (was !== undefined) {
        if (JSON.stringify(was) !== JSON.stringify(mine))
          return libraryFail(
            io,
            opts.json,
            `${job.file} is in several entries of ${shownPath(opts.buildFile, cwd)} with a different profile, config or strict`,
            { fix: "give the entries the same values, or list the file once" },
          );
        continue;
      }
      seen.set(job.abs, mine);
      jobs.push({ file: job.file, abs: job.abs, opts: baseOpts(mine) });
    }
    several = jobs.length > 1;
    if (jobs.length === 0) return libraryFail(io, opts.json, "nothing to work on: the build file lists no file");
  } else {
    const inputs = expandInputs(patterns, cwd);
    if (inputs.files.length === 0 && inputs.errors.length === 0)
      return libraryFail(io, opts.json, "nothing to work on: give at least one quiz file");
    if (inputs.errors.length > 0) {
      const first = inputs.errors[0];
      for (const e of inputs.errors.slice(1)) io.err(`${e.input}: ${e.message}`);
      return libraryFail(io, opts.json, `${first?.input}: ${first?.message}`);
    }
    several = inputs.files.length > 1;
    for (const file of inputs.files) jobs.push({ file, abs: resolve(cwd, file), opts: baseOpts() });
  }
  if (several && opts.name !== null) return libraryFail(io, opts.json, "-n names one quiz: give one file");
  if (several && opts.update !== null) return libraryFail(io, opts.json, "--update names one quiz: give one file");
  if (several && opts.review !== null) return libraryFail(io, opts.json, "--review takes one quiz");
  if (opts.name !== null && opts.update !== null)
    return libraryFail(io, opts.json, "-n names a new quiz and --update adds to an existing one: use one");
  if (opts.name !== null && !ID_FORMAT.test(opts.name))
    return libraryFail(io, opts.json, `${opts.name} is not a valid name`, { fix: NAME_FIX });

  const lockWords =
    `quiz library register ${opts.buildFile !== null ? `--build-file ${opts.buildFile} ` : ""}${patterns.join(" ")}`.trim();
  const notes: string[] = [];
  try {
    return await withLock(
      root,
      lockWords,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h) => notes.push(`${p.cyan("note")} removed a lock left by pid ${h.pid} (${h.command})`),
      },
      () => run(),
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }

  async function run(): Promise<ExitCode> {
    // the index as it is now that the lock is ours
    const fresh = openLibrary(io, opts.json);
    if ("exit" in fresh) return fresh.exit;
    const index: LibraryIndex = fresh.index;
    await removeVersionTemps(root);

    const target = opts.update !== null ? findQuiz(index, opts.update) : undefined;
    if (opts.update !== null && target === undefined) return noSuchQuiz(io, opts.json, index, opts.update);

    // the config: looked up from the file, then from the library root
    const libraryConfig = findProjectConfig(root);
    const optionsFor = (job: (typeof jobs)[number], review: string | null): CheckOptions => {
      const config =
        job.opts.config === null && findProjectConfig(dirname(job.abs)) === null && libraryConfig !== null
          ? libraryConfig
          : job.opts.config;
      return { ...job.opts, config, review: review ?? job.opts.review };
    };

    const plans: Plan[] = [];
    const refused: { file: string; findings: Finding[] }[] = [];
    const errored: string[][] = [];
    const warnings: { file: string; text: string[] }[] = [];
    const taken = new Set<string>(index.quizzes.flatMap((q) => [q.name, q.id]));
    const idsInBatch = new Map<string, string>();
    const namesInBatch = new Map<string, string>();
    const progress = !opts.json && !opts.plain && io.tty && jobs.length > 1;
    let n = 0;

    for (const job of jobs) {
      n++;
      if (progress) showProgress(io, n, jobs.length, job.file);
      let result = checkFile(job.file, optionsFor(job, null), io);
      if (
        result.status !== "error" &&
        target !== undefined &&
        opts.review === null &&
        result.loaded.frontMatter.id === target.id &&
        existsSync(paths.quiz(target.id).review)
      ) {
        // the quiz's stored review is applied as `check --review` applies one (G16)
        result = checkFile(job.file, optionsFor(job, shownPath(paths.quiz(target.id).review, cwd)), io);
      }
      if (progress) clearProgress(io);
      if (result.status === "error") {
        const lines = [`${result.file}: ${result.message}`];
        for (const p of result.problems ?? []) lines.push(`    ${p}`);
        for (const e of result.configErrors ?? []) {
          lines.push(`${e.file}:${e.line}: ${e.message}`);
          if (e.fix) lines.push(`    fix: ${e.fix}`);
        }
        errored.push(lines);
        continue;
      }
      const issueFindings = (): Finding[] =>
        result.issues
          .filter((i) => i.level === "error" || (opts.strict && i.level === "warning"))
          .map((i) => ({
            file: i.file,
            line: i.line,
            rule: i.rule,
            message: i.message,
            fix: i.fix ? [i.fix] : [],
          }));
      const refuse = (finding: Finding): void => {
        refused.push({ file: job.file, findings: [finding] });
      };
      // 1. check errors, or a survey
      if (result.status === "failed") {
        const found = issueFindings();
        refused.push({
          file: job.file,
          findings:
            found.length > 0
              ? found
              : [{ file: job.file, line: null, rule: "check.failed", message: "the quiz failed its check", fix: [] }],
        });
        warnings.push({ file: job.file, text: [] });
        continue;
      }
      const fm = result.loaded.frontMatter;
      const hash = result.loaded.hash;
      if (fm.kind === "survey") {
        refuse({
          file: job.file,
          line: fm.keyLines.kind ?? 1,
          rule: "library.survey",
          message: "a survey is not kept in the library: the library is one learner's history of their own attempts",
          fix: ["`quiz serve` and `quiz stats` handle a survey with no library"],
        });
        continue;
      }
      if (hash === null) {
        refuse({
          file: job.file,
          line: null,
          rule: "check.failed",
          message: "a file the quiz uses could not be read",
          fix: [],
        });
        continue;
      }
      const shownIssues = result.issues.map((i) => humanIssue(i, p.color).join("\n"));
      const idLine = fm.keyLines.id ?? 1;

      // 2 to 4: what the file is, against the library
      const bySource = opts.update === null ? index.quizzes.find((q) => q.source === job.abs) : undefined;
      if (bySource !== undefined) {
        if (bySource.current === hash) {
          plans.push({ what: "unchanged", file: job.file, quiz: bySource, hash });
          continue;
        }
        refuse({
          file: job.file,
          line: null,
          rule: "library.edited",
          message: `registered before as ${bySource.name} and edited since`,
          fix: [`quiz library register ${job.file} --update ${bySource.name}`],
        });
        continue;
      }
      const note = () => warnings.push({ file: job.file, text: shownIssues });
      if (target !== undefined) {
        if (fm.id !== target.id) {
          refuse({
            file: job.file,
            line: idLine,
            rule: "library.id-mismatch",
            message: `the id ${fm.id} is not ${target.name}'s id, ${target.id}`,
            fix: [`give the quiz the id ${target.id}, or register it as a new quiz without --update`],
          });
          continue;
        }
        if (target.current === hash) {
          plans.push({ what: "unchanged", file: job.file, quiz: target, hash });
          continue;
        }
        note();
        plans.push(
          target.versions.some((v) => v.hash === hash)
            ? { what: "again", file: job.file, abs: job.abs, checked: result, quiz: target, hash }
            : { what: "version", file: job.file, abs: job.abs, checked: result, quiz: target, hash },
        );
        continue;
      }
      // a new quiz
      const owner = index.quizzes.find((q) => q.id === fm.id);
      const peer = idsInBatch.get(fm.id);
      if (owner !== undefined || peer !== undefined) {
        refuse({
          file: job.file,
          line: idLine,
          rule: "library.id-taken",
          message:
            owner !== undefined
              ? `the id ${fm.id} is already in the library, as ${owner.name}`
              : `the id ${fm.id} is already used by ${peer} in this batch`,
          fix: [
            `if it is the same quiz, quiz library register ${job.file} --update ${owner?.name ?? "NAME"};`,
            "if not, give it a new `id:` in its front matter",
          ],
        });
        continue;
      }
      const wanted = opts.name ?? defaultName(fm.title, fm.id);
      const clash = taken.has(wanted) || namesInBatch.has(wanted) || idsInBatch.has(wanted);
      if (clash) {
        const free = freeName(wanted, new Set([...taken, ...namesInBatch.keys(), ...idsInBatch.keys()]));
        refuse({
          file: job.file,
          line: null,
          rule: "library.name-taken",
          message: `the name ${wanted} is taken`,
          fix: [`-n ${free}${several ? " (one file at a time)" : ""}`],
        });
        continue;
      }
      namesInBatch.set(wanted, job.file);
      idsInBatch.set(fm.id, job.file);
      note();
      plans.push({ what: "new", file: job.file, abs: job.abs, checked: result, name: wanted, hash });
    }

    // nothing is written when any file is refused or could not be used
    if (errored.length > 0 || refused.length > 0) {
      if (errored.length > 0) {
        for (const lines of errored) for (const l of lines) io.err(l);
        if (opts.json) io.out(JSON.stringify({ status: "error", message: errored[0]?.[0] ?? "" }));
        return EXIT.usage;
      }
      for (const w of warnings) for (const t of w.text) out(t);
      for (const r of refused) {
        for (const f of r.findings) {
          const at = f.line === null ? `${f.file}:` : `${f.file}:${f.line}:`;
          out(`${at} ${p.red("error")} ${f.rule}: ${f.message}`);
          f.fix.forEach((line, i) => out(i === 0 ? `    fix: ${line}` : `         ${line}`));
        }
      }
      const ready = jobs.length - refused.length;
      out(`${p.red("nothing registered")} ${ready} of ${plural(jobs.length, "file")} ready, ${refused.length} refused`);
      if (opts.json) {
        io.out(
          JSON.stringify({
            status: "problems",
            registered: [],
            unchanged: [],
            refused: refused.flatMap((r) =>
              r.findings.map((f) => ({
                file: r.file,
                reason: `${f.rule}: ${f.message}`,
                suggest: f.fix.length > 0 ? f.fix.join(" ") : null,
              })),
            ),
            committed: null,
          }),
        );
      }
      return EXIT.problems;
    }

    // write: each version into its folder, then library.toml last, then one commit
    const writes = plans.filter((x): x is Exclude<Plan, { what: "unchanged" }> => x.what !== "unchanged");
    const written: string[] = [];
    const now = localIso(nowOf(io));
    const quizzes = new Map(index.quizzes.map((q) => [q.name, q]));
    const lines: string[] = [];
    let committed: { hash: string; message: string } | null = null;
    let commitWarning: string | null = null;
    const previous = new Map<string, ReturnType<typeof loadStored>>();

    for (const w of writes) {
      if (w.what === "version" || w.what === "again")
        previous.set(w.quiz.name, loadStored(root, w.quiz, w.quiz.current));
    }
    try {
      const atomic = io.atomic ?? writeFileAtomic;
      for (const w of writes) {
        if (w.what === "new" || w.what === "version") {
          const id = w.what === "new" ? w.checked.loaded.frontMatter.id : w.quiz.id;
          await writeVersion(paths.quiz(id).versions, w.hash, versionFiles(w.abs, w.checked));
          written.push(`quizzes/${id}/versions/${w.hash}`);
        }
      }
      for (const w of writes) {
        const fm = w.checked.loaded.frontMatter;
        if (w.what === "new" && fm) {
          quizzes.set(w.name, {
            name: w.name,
            id: fm.id,
            title: fm.title,
            source: w.abs,
            current: w.hash,
            versions: [{ hash: w.hash, added: now, file: basename(w.abs) }],
            shelves: [],
          });
        } else if ((w.what === "version" || w.what === "again") && fm) {
          const old = w.quiz;
          quizzes.set(old.name, {
            ...old,
            title: fm.title,
            source: w.abs,
            current: w.hash,
            versions: w.what === "version" ? [...old.versions, { hash: w.hash, added: now, file: basename(w.abs) }] : old.versions,
          });
        }
      }
      await writeIndex(paths.index, { ...index, quizzes: [...quizzes.values()] }, atomic);
    } catch (error) {
      // the library goes back to what it was: the folders this run made are removed
      const { rm } = await import("node:fs/promises");
      for (const w of written)
        await rm(join(root, ...w.split("/")), { recursive: true, force: true }).catch(() => undefined);
      return libraryFail(io, opts.json, `cannot write the library: ${(error as Error).message}`, {
        fix: "nothing was registered; run the command again",
      });
    }

    const names = writes.map((w) => (w.what === "new" ? w.name : w.quiz.name)).sort();
    if (writes.length > 0) {
      const message = `fullmark: register ${names.join(", ")}`;
      const commitPaths = ["library.toml", ...written];
      const result = await git.commit(commitPaths, message);
      if (result.status === "committed") committed = { hash: result.hash, message };
      else if (result.status === "failed")
        commitWarning = `${p.yellow("warning")} the commit failed: ${result.message}; the files are written`;
    }

    // what to say
    const shortOf = (q: IndexQuiz, hash: string): string =>
      shortHash(hash, quizzes.get(q.name)?.versions.map((v) => v.hash) ?? [q.current]);
    const registered: { file: string; name: string; version: string }[] = [];
    const unchanged: { file: string; name: string; version: string }[] = [];
    for (const w of plans) {
      if (w.what === "unchanged") {
        unchanged.push({ file: w.file, name: w.quiz.name, version: w.hash });
        continue;
      }
      const name = w.what === "new" ? w.name : w.quiz.name;
      registered.push({ file: w.file, name, version: w.hash });
    }
    for (const w of warnings) for (const t of w.text) lines.push(t);
    for (const note of notes) lines.push(note);

    if (!several && plans.length === 1) {
      const w = plans[0] as Plan;
      if (w.what === "unchanged") {
        lines.push(`${p.green("unchanged")} ${w.quiz.name} · version ${shortOf(w.quiz, w.hash)}`);
      } else if (w.what === "new") {
        const n = summarise(quizOf(w.checked), w.hash).questions;
        lines.push(
          `${p.green("registered")} ${w.name}, a new quiz · version ${shortOf(quizzes.get(w.name) as IndexQuiz, w.hash)} · ${plural(n, "question")}`,
        );
      } else {
        const was = previous.get(w.quiz.name) ?? null;
        const q = quizzes.get(w.quiz.name) as IndexQuiz;
        const wasShort = shortHash(
          w.quiz.current,
          q.versions.map((v) => v.hash),
        );
        const head = `${p.green("registered")} ${w.quiz.name} · version ${shortOf(q, w.hash)} (was ${wasShort})`;
        if (w.what === "again") lines.push(`${head} · an earlier version, now current again`);
        else {
          const d = was?.quiz ? diffVersions(questionHashes(was.quiz), questionHashes(quizOf(w.checked))) : null;
          lines.push(`${head}${d === null ? "" : ` · ${diffText(d)}`}`);
        }
        for (const warning of progressWarnings(root, w.quiz, w.hash))
          lines.push(
            `${p.yellow("warning")} an attempt in progress on ${warning.version}${warning.text} stays on that version`,
            `    the next quiz library take ${w.quiz.name} resumes it there (G17)`,
          );
      }
    } else {
      const fresh = plans.filter((w) => w.what !== "unchanged");
      if (fresh.length > 0) {
        lines.push(
          `${p.green("registered")} ${fresh.length} ${fresh
            .map((w) => {
              const name = w.what === "new" ? w.name : (w as { quiz: IndexQuiz }).quiz.name;
              const q = quizzes.get(name) as IndexQuiz;
              return `${name} (${w.what === "new" ? "new" : "version"}, ${shortOf(q, w.hash)})`;
            })
            .join(" · ")}`,
        );
      }
      const same = plans.filter((w) => w.what === "unchanged");
      if (same.length > 0)
        lines.push(
          `${p.green("unchanged")} ${same.length}  ${same
            .map((w) => (w as { quiz: IndexQuiz }).quiz.name)
            .sort()
            .join(", ")}`,
        );
    }
    if (commitWarning !== null) lines.push(commitWarning);
    if (committed !== null) lines.push(p.dim(`committed ${committed.hash} ${committed.message}`));

    if (opts.json) {
      io.out(
        JSON.stringify({
          status: registered.length > 0 ? "registered" : "unchanged",
          registered,
          unchanged,
          refused: [],
          committed: committed?.hash ?? null,
        }),
      );
    }
    for (const line of lines) out(line);
    return EXIT.done;
  }
}
