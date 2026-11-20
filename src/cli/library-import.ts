import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ShelfManifest } from "../core/ir";
import { findFrontMatter, splitLines } from "../core/parse/lines";
import type { ParseTex } from "../core/parse/tex";
import { type IndexQuiz, isPublished, PUBLIC_SHELF, QUIZ_KIND } from "../library/index-file";
import { shortHash } from "../library/layout";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { MANIFEST_FILE, readManifest } from "../library/shelf";
import { type CheckOptions, checkFile, clearProgress, showProgress } from "./check";
import { loadUserConfig } from "./config";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  type Checked,
  defaultName,
  type Finding,
  freeName,
  judge,
  type VersionToWrite,
  versionFiles,
  writeBatch,
} from "./library-batch";
import {
  configFail,
  gitFor,
  type LibraryIo,
  libraryFail,
  lockEnvOf,
  machineOf,
  nowOf,
  openIndex,
  openLibrary,
  painterFor,
  refusal,
} from "./library-common";
import { shownPath } from "./paths";
import { sourceToStore } from "./source-path";
import { plural } from "./table";
import { localIso } from "./time";

export type LibraryImportOptions = { into: string | null; json: boolean; plain: boolean };
type ImportIo = LibraryIo & { parseTex?: ParseTex };

type Listed = ShelfManifest["quizzes"][number];
/** One quiz file of the folder, with the manifest's line for it when there is a manifest. */
type Candidate = { abs: string; folder: string; listed: Listed | null };

/** What becomes of one quiz. */
type Plan =
  | {
      what: "new";
      c: Candidate;
      checked: Checked;
      id: string;
      title: string;
      name: string;
      hash: string;
      added: string;
    }
  | { what: "version"; c: Candidate; checked: Checked; quiz: IndexQuiz; hash: string; added: string }
  | { what: "entry"; c: Candidate; quiz: IndexQuiz }
  | { what: "unchanged"; c: Candidate; quiz: IndexQuiz };

/** `1 quiz`, `2 quizzes`. */
const quizzesOf = (n: number): string => (n === 1 ? "1 quiz" : `${n} quizzes`);

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Every `DIR/FOLDER/FILE.md` that starts with front matter (a materials sheet has none), sorted by path. */
function findQuizFiles(dir: string): Candidate[] {
  const out: Candidate[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const folder = join(dir, e.name);
    for (const f of readdirSync(folder, { withFileTypes: true })) {
      if (!f.isFile() || !f.name.toLowerCase().endsWith(".md")) continue;
      const abs = join(folder, f.name);
      let text: string;
      try {
        text = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      if (typeof findFrontMatter(splitLines(text)) === "string") continue; // no front matter, or never closed
      out.push({ abs, folder, listed: null });
    }
  }
  return out.sort((a, b) => compare(a.abs, b.abs));
}

/**
 * `quiz library import DIR [--into PATH] [--json]` (COMMANDS.md, `quiz library import`; STEP5-GAPS.md, G7, G8, G11):
 * registers the quizzes of a published folder into a library, keeping ids and names. Every quiz is checked under its
 * nearest `fullmark.toml` (never above `DIR`) before anything is written; one commit at the end.
 */
export async function runLibraryImport(dirArg: string, opts: LibraryImportOptions, io: ImportIo): Promise<ExitCode> {
  const machine = machineOf(io);
  const cwd = machine.cwd;
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  const dir = resolve(cwd, dirArg);
  const lines: string[] = [];
  const warnings: string[] = [];

  // -- the library: made first with --into, else the one the config names
  let root: string;
  let git: ReturnType<typeof gitFor>;
  if (opts.into !== null) {
    const config = loadUserConfig(machine);
    if (config.errors.length > 0) return configFail(io, opts.json, config.errors);
    const configured = config.data?.library ? resolve(dirname(config.path), config.data.library) : null;
    const said: string[] = [];
    const complained: string[] = [];
    const { runLibraryInit } = await import("./library-init");
    const exit = await runLibraryInit(
      opts.into,
      { force: true, noGit: false, json: false, plain: true, record: configured === null },
      { ...io, out: (l) => said.push(l), err: (l) => complained.push(l) },
    );
    if (exit !== EXIT.done) {
      const message = (complained.find((l) => l.startsWith("error: ")) ?? "error: cannot make the library").slice(7);
      const fix = complained.find((l) => l.startsWith("    fix: "))?.slice(9);
      return libraryFail(io, opts.json, message, fix === undefined ? {} : { fix });
    }
    root = resolve(cwd, opts.into);
    git = gitFor(io, root, config.data?.git ?? null);
    for (const l of said) {
      if (l.startsWith("library ready")) lines.push(`${p.green("library ready")}${l.slice("library ready".length)}`);
      else if (!/^(recorded in|next:|committed )/.test(l)) lines.push(l);
    }
    if (configured !== null && configured !== root)
      lines.push(
        `${p.cyan("note")} your library is still ${configured}; use this one with FULLMARK_LIBRARY=${root} or quiz library init ${root} --force`,
      );
  } else {
    const opened = openLibrary(io, opts.json);
    if ("exit" in opened) return opened.exit;
    root = opened.located.root;
    git = opened.located.git;
  }

  // -- the folder, and its manifest when it has one
  if (!existsSync(dir) || !statSync(dir).isDirectory())
    return libraryFail(io, opts.json, `${shownPath(dir, cwd)} is not a folder`, {
      fix: "name a folder that `quiz library publish` wrote, or one with a quiz in each folder",
    });
  let manifest: ShelfManifest | null = null;
  const manifestFile = join(dir, MANIFEST_FILE);
  if (existsSync(manifestFile)) {
    let read: ReturnType<typeof readManifest>;
    try {
      read = readManifest(readFileSync(manifestFile, "utf8"));
    } catch (error) {
      return libraryFail(io, opts.json, `cannot read ${manifestFile}: ${(error as Error).message}`, {
        fix: "check the file",
      });
    }
    if (!read.ok) {
      const fix =
        read.kind === "foreign"
          ? "name a folder that fullmark published"
          : read.kind === "newer"
            ? "use a fullmark that is as new as the one that published this folder"
            : `fix ${MANIFEST_FILE}, or remove it to import the folder's quizzes without it`;
      return libraryFail(io, opts.json, read.message, { fix });
    }
    manifest = read.manifest;
  }

  const notes: string[] = [];
  try {
    return await withLock(
      root,
      `quiz library import ${dirArg}`,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the library: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h, why) => notes.push(`${p.cyan("note")} ${staleNote(h, why)}`),
      },
      () => run(),
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message, { fix: "run the command again when it finishes" });
    throw error;
  }

  async function run(): Promise<ExitCode> {
    const opened = openIndex(root);
    const refused0 = refusal(root, opened, cwd);
    if (refused0) return libraryFail(io, opts.json, refused0.message, { fix: refused0.fix });
    if (opened.kind !== "read" || !opened.read.ok) return EXIT.usage;
    const index = opened.read.index;

    // the quiz files: the manifest's, else every DIR/*/*.md with front matter
    const refused: { file: string; name: string; findings: Finding[] }[] = [];
    const errored: string[][] = [];
    let candidates: Candidate[];
    if (manifest !== null) {
      candidates = [];
      for (const q of manifest.quizzes) {
        const abs = join(dir, q.id, ...q.file.split("/"));
        if (!existsSync(abs)) {
          refused.push({
            file: shownPath(abs, cwd),
            name: q.name,
            findings: [
              {
                file: shownPath(abs, cwd),
                line: null,
                rule: "import.missing",
                message: `${MANIFEST_FILE} lists ${q.id}/${q.file}, which is not there`,
                fix: ["publish again, or remove the quiz from the folder's manifest by publishing without it"],
              },
            ],
          });
          continue;
        }
        candidates.push({ abs, folder: join(dir, q.id), listed: q });
      }
    } else candidates = findQuizFiles(dir);
    if (candidates.length === 0 && refused.length === 0)
      return libraryFail(io, opts.json, `${shownPath(dir, cwd)} holds no quiz to import`, {
        fix: "a quiz is a Markdown file with front matter, in a folder of the folder",
      });

    const now = localIso(nowOf(io));
    const plans: Plan[] = [];
    const taken = new Set<string>(index.quizzes.flatMap((q) => [q.name, q.id]));
    const idsInBatch = new Map<string, string>();
    const namesInBatch = new Map<string, string>();
    const progress = !opts.json && !opts.plain && io.tty && candidates.length > 1;
    let n = 0;

    for (const c of candidates) {
      n++;
      const shown = shownPath(c.abs, cwd);
      if (progress) showProgress(io, n, candidates.length, shown);
      // the nearest fullmark.toml is found by `check` itself, no higher than the shelf's folder
      const checkOpts: CheckOptions = {
        profile: null,
        config: null,
        strict: false,
        review: null,
        json: opts.json,
        plain: opts.plain,
        stopAt: dir,
      };
      const result = checkFile(c.abs, checkOpts, io);
      if (progress) clearProgress(io);
      const judged = judge(shown, result, false, p.color);
      if (judged.kind === "error") {
        errored.push(judged.lines);
        continue;
      }
      if (judged.kind === "refused") {
        refused.push({
          file: shown,
          name: c.listed?.name ?? (result.status === "error" ? basename(c.abs) : result.loaded.frontMatter.id),
          findings: judged.findings,
        });
        continue;
      }
      const fm = judged.frontMatter;
      const hash = judged.hash;
      const refuse = (finding: Finding, name = c.listed?.name ?? fm.id): void => {
        refused.push({ file: shown, name, findings: [finding] });
      };
      if (c.listed !== null && fm.id !== c.listed.id) {
        refuse({
          file: shown,
          line: fm.keyLines.id ?? 1,
          rule: "import.id-mismatch",
          message: `${MANIFEST_FILE} lists this file as ${c.listed.id}, but its id is ${fm.id}`,
          fix: ["publish again, or give the quiz back its id"],
        });
        continue;
      }
      const idLine = fm.keyLines.id ?? 1;
      const peer = idsInBatch.get(fm.id);
      const owner = index.quizzes.find((q) => q.id === fm.id);
      const edited = c.listed !== null && c.listed.hash !== hash;
      const added = c.listed !== null && !edited ? c.listed.added : now;
      const editedWarning = (): void => {
        if (edited) warnings.push(`${shown} was edited after it was published, so it is added with the time of now`);
      };

      if (peer !== undefined) {
        refuse({
          file: shown,
          line: idLine,
          rule: "library.id-taken",
          message: `the id ${fm.id} is already used by ${peer} in this import`,
          fix: ["give one of them a new `id:` in its front matter"],
        });
        continue;
      }
      if (owner !== undefined && c.listed === null) {
        // without a manifest no shelf owns the folder: a taken id is refused (G8)
        refuse({
          file: shown,
          line: idLine,
          rule: "library.id-taken",
          message: `the id ${fm.id} is already in the library, as ${owner.name}`,
          fix: [
            `if it is the same quiz, quiz library register ${shown} --update ${owner.name};`,
            "if not, give it a new `id:` in its front matter",
          ],
        });
        continue;
      }
      if (owner !== undefined && c.listed !== null) {
        // an id the library has: its name is kept, and nothing goes backwards (G7)
        idsInBatch.set(fm.id, shown);
        if (c.listed.name !== owner.name)
          notes.push(`${p.cyan("note")} the shelf calls ${owner.id} ${c.listed.name}; the library keeps ${owner.name}`);
        const hasEntry = isPublished(owner);
        if (owner.current === hash || owner.versions.some((v) => v.hash === hash)) {
          if (owner.current !== hash)
            notes.push(
              `${p.cyan("note")} ${owner.name}: the shelf has an older version (${shortHash(
                hash,
                owner.versions.map((v) => v.hash),
              )})`,
            );
          plans.push(hasEntry ? { what: "unchanged", c, quiz: owner } : { what: "entry", c, quiz: owner });
          continue;
        }
        editedWarning();
        notes.push(...judged.shownIssues);
        plans.push({ what: "version", c, checked: judged.checked, quiz: owner, hash, added });
        continue;
      }
      // a new quiz
      const wanted = c.listed?.name ?? defaultName(fm.title, fm.id);
      const clash = taken.has(wanted) || namesInBatch.has(wanted) || idsInBatch.has(wanted);
      if (clash) {
        const free = freeName(wanted, new Set([...taken, ...namesInBatch.keys(), ...idsInBatch.keys()]));
        refuse(
          {
            file: shown,
            line: null,
            rule: "library.name-taken",
            message: `the name ${wanted} is taken by another quiz`,
            fix: [
              `${free} is free: rename the quiz that has ${wanted} (quiz library rename ${wanted} NEW), or this one`,
            ],
          },
          wanted,
        );
        continue;
      }
      namesInBatch.set(wanted, shown);
      idsInBatch.set(fm.id, shown);
      editedWarning();
      notes.push(...judged.shownIssues);
      plans.push({ what: "new", c, checked: judged.checked, id: fm.id, title: fm.title, name: wanted, hash, added });
    }

    // nothing is written when any file is refused or could not be used
    if (errored.length > 0 || refused.length > 0) {
      if (errored.length > 0) {
        for (const l of errored.flat()) io.err(l);
        if (opts.json) io.out(JSON.stringify({ status: "error", message: errored[0]?.[0] ?? "" }));
        return EXIT.usage;
      }
      for (const l of notes) out(l);
      for (const r of refused)
        for (const f of r.findings) {
          const at = f.line === null ? `${f.file}:` : `${f.file}:${f.line}:`;
          out(`${at} ${p.red("error")} ${f.rule}: ${f.message}`);
          f.fix.forEach((line, i) => out(i === 0 ? `    fix: ${line}` : `         ${line}`));
        }
      const total = candidates.length + refused.filter((r) => r.findings[0]?.rule === "import.missing").length;
      out(
        `${p.red("nothing imported")} ${total - refused.length} of ${plural(total, "file")} ready, ${refused.length} refused`,
      );
      if (opts.json)
        io.out(
          JSON.stringify({
            status: "problems",
            library: root,
            imported: [],
            unchanged: [],
            refused: refused.flatMap((r) =>
              r.findings.map((f) => ({
                name: r.name,
                reason: `${f.rule}: ${f.message}`,
                suggest: f.fix.length > 0 ? f.fix.join(" ") : null,
              })),
            ),
            warnings,
            committed: null,
          }),
        );
      return EXIT.problems;
    }

    // write: each new version into its folder, then library.toml, then one commit
    const quizzes = new Map(index.quizzes.map((q) => [q.name, q]));
    const versions: VersionToWrite[] = [];
    const onShelf = { shelf: PUBLIC_SHELF, kind: QUIZ_KIND };
    for (const w of plans) {
      if (w.what === "new") {
        versions.push({ id: w.id, hash: w.hash, files: versionFiles(w.c.abs, w.checked) });
        quizzes.set(w.name, {
          name: w.name,
          id: w.id,
          title: w.title,
          source: sourceToStore(w.c.abs, root),
          current: w.hash,
          versions: [{ hash: w.hash, added: w.added, file: basename(w.c.abs) }],
          shelves: w.c.listed !== null ? [onShelf] : [],
        });
      } else if (w.what === "version") {
        versions.push({ id: w.quiz.id, hash: w.hash, files: versionFiles(w.c.abs, w.checked) });
        const fm = w.checked.loaded.frontMatter;
        quizzes.set(w.quiz.name, {
          ...w.quiz,
          title: fm.title,
          source: sourceToStore(w.c.abs, root),
          current: w.hash,
          versions: [...w.quiz.versions, { hash: w.hash, added: w.added, file: basename(w.c.abs) }],
          shelves: isPublished(w.quiz) || w.c.listed === null ? w.quiz.shelves : [...w.quiz.shelves, onShelf],
        });
      } else if (w.what === "entry") {
        quizzes.set(w.quiz.name, { ...w.quiz, shelves: [...w.quiz.shelves, onShelf] });
      }
    }
    const changed = plans.filter((w) => w.what !== "unchanged");
    const nameOf = (w: Plan): string => (w.what === "new" ? w.name : w.quiz.name);
    const importedNames = changed.map(nameOf).sort(compare);
    const unchangedNames = plans
      .filter((w) => w.what === "unchanged")
      .map(nameOf)
      .sort(compare);
    const batch = await writeBatch({
      root,
      git,
      index,
      versions,
      quizzes: [...quizzes.values()],
      message: changed.length > 0 ? `fullmark: import ${importedNames.join(" ")}` : null,
      ...(io.atomic ? { atomic: io.atomic } : {}),
    });
    if (!batch.ok)
      return libraryFail(io, opts.json, `cannot write the library: ${batch.error.message}`, {
        fix: "nothing was imported; run the command again",
      });

    const shelfWords = manifest !== null ? ` (on the ${PUBLIC_SHELF} shelf)` : "";
    const report: string[] = [...lines, ...notes];
    for (const w of warnings) report.push(`${p.yellow("warning")} ${w}`);
    if (importedNames.length > 0)
      report.push(
        `${p.green("imported")} ${quizzesOf(importedNames.length)}: ${importedNames.join(", ")}${shelfWords}`,
      );
    if (unchangedNames.length > 0)
      report.push(`${p.green("unchanged")} ${quizzesOf(unchangedNames.length)}: ${unchangedNames.join(", ")}`);
    if (batch.commitWarning !== null)
      report.push(`${p.yellow("warning")} the commit failed: ${batch.commitWarning}; the files are written`);
    if (batch.committed !== null) report.push(p.dim(`committed ${batch.committed.hash} ${batch.committed.message}`));
    report.push(
      `${p.cyan("note")} a shelf holds no results, reports or older versions: import restores quizzes, not a backup`,
    );
    if (opts.json)
      io.out(
        JSON.stringify({
          status: changed.length > 0 ? "imported" : "unchanged",
          library: root,
          imported: importedNames,
          unchanged: unchangedNames,
          refused: [],
          warnings,
          committed: batch.committed?.hash ?? null,
        }),
      );
    for (const l of report) out(l);
    return EXIT.done;
  }
}
