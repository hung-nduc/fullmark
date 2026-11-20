import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdir, readdir, rm, rmdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { buildShelfIndex, type ShelfEntry } from "../build/shelf-index";
import { FONT_CHOICES, type FontsChoice } from "../core/fonts";
import { summarise } from "../core/inspect";
import type { QuestionType, ShelfManifest } from "../core/ir";
import { SHELF_FORMAT, SHELF_VERSION } from "../core/ir";
import type { Git } from "../library/git";
import { type IndexQuiz, isPublished, PUBLIC_SHELF } from "../library/index-file";
import { LockBusy, staleNote, withLock } from "../library/lock";
import { profileToml } from "../library/profile-toml";
import {
  filesUnder,
  INDEX_PAGE,
  listQuizFolders,
  MANIFEST_FILE,
  planSync,
  readManifest,
  renderManifest,
  type SyncPlan,
} from "../library/shelf";
import { WriteError, writeFileAtomic } from "./atomic";
import { type BuildOptions, buildOne, runtimeReaders } from "./build";
import { loadUserConfig } from "./config";
import { recordShelf } from "./config-write";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  gitFor,
  type LibraryIo,
  libraryFail,
  libraryRefuse,
  loadStored,
  lockEnvOf,
  machineOf,
  openLibrary,
  painterFor,
  storedProfile,
} from "./library-common";
import type { LibraryPublishOptions, PublishIo } from "./library-publish";

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);

/** `inside(a, b)`: whether `b` is `a` or somewhere under it, through symbolic links where the folders exist. */
function realish(path: string): string {
  const missing: string[] = [];
  let at = resolve(path);
  for (;;) {
    try {
      return join(realpathSync(at), ...missing);
    } catch {
      const up = dirname(at);
      if (up === at) return resolve(path);
      missing.unshift(basename(at));
      at = up;
    }
  }
}
const isInside = (folder: string, path: string): boolean => {
  const rel = relative(realish(folder), realish(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** What one quiz on the shelf is made of: its files by shelf path, and its line of the manifest. */
type Built = {
  quiz: ShelfManifest["quizzes"][number];
  files: Map<string, Uint8Array>;
  summary: Omit<ShelfEntry, "id" | "title" | "lang">;
};

/** `needs input` (exit 3): no folder was given and none is remembered. */
function needInput(io: LibraryIo, json: boolean, message: string, fix: string): ExitCode {
  if (json) io.out(JSON.stringify({ status: "error", message, fix }));
  io.err(`error: ${message}`);
  io.err(`    fix: ${fix}`);
  return EXIT.needsInput;
}

const FIRST_LINE = /^\S/;

const quizzes = (n: number): string => (n === 1 ? "1 quiz" : `${n} quizzes`);

/**
 * `quiz library publish [DIR] [--with-brief | --no-brief] [--ui-lang en|vi] [--fonts quiz|all|none] [--dry-run]
 * [--json]` (COMMANDS.md, `quiz library publish`; STEP5.md, slice 5a): puts the current Markdown, assets and built page
 * of every quiz on the `public` shelf into a folder, with an index page and `fullmark-shelf.json`.
 *
 * In this order: read the library (no lock); refuse what is refused before any build (exit 2, 3); build every page, the
 * index and the manifest in memory (exit 1 when a build fails, nothing written); take the shelf's lock; refuse what a
 * sync does not write over (exit 1); write the manifest listing every path old and new, then each changed file
 * atomically, then each removed path, then the final manifest; commit what it wrote when `DIR` is inside a work tree;
 * remember `DIR`. A sync killed anywhere leaves a manifest that lists what it may have written, so the next one
 * repairs the folder.
 */
export async function runLibrarySync(
  target: string | null,
  opts: LibraryPublishOptions,
  io: PublishIo,
): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  if (opts.fonts !== null && !(FONT_CHOICES as readonly string[]).includes(opts.fonts))
    return libraryFail(io, opts.json, `--fonts ${opts.fonts} is not one of quiz, all, none`);
  if (opts.uiLang !== null && opts.uiLang !== "en" && opts.uiLang !== "vi")
    return libraryFail(io, opts.json, `--ui-lang ${opts.uiLang} is not one of en, vi`);
  if (opts.withBrief && opts.noBrief)
    return libraryFail(io, opts.json, "--with-brief and --no-brief cannot be given together");

  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root, configPath, gitBin } = opened.located;
  const machine = machineOf(io);
  const config = loadUserConfig(machine);

  // -- where the shelf is (exit 3, 2)
  const remembered = config.data?.shelves[PUBLIC_SHELF];
  const rememberedDir = remembered === undefined ? null : resolve(dirname(configPath), remembered);
  const given = target !== null ? resolve(io.cwd, target) : null;
  const dir = given ?? rememberedDir;
  if (dir === null) return needInput(io, opts.json, "no DIR given and none remembered", "quiz library publish DIR");
  if (isInside(root, dir) || existsSync(join(dir, "library.toml")))
    return libraryFail(io, opts.json, `${dir} is the library or inside it, or holds a library.toml`, {
      fix: "a shelf is a folder of its own: choose another DIR",
    });
  if (existsSync(dir) && !statSync(dir).isDirectory())
    return libraryFail(io, opts.json, `${dir} is a file, and a folder is needed`);
  const readOld = (): { ok: true; old: ShelfManifest | null } | { ok: false; exit: ExitCode } => {
    const file = join(dir, MANIFEST_FILE);
    if (!existsSync(file)) return { ok: true, old: null };
    let read: ReturnType<typeof readManifest>;
    try {
      read = readManifest(readFileSync(file, "utf8"));
    } catch (error) {
      return {
        ok: false,
        exit: libraryFail(io, opts.json, `cannot read ${file}: ${(error as Error).message}`, { fix: "check the file" }),
      };
    }
    if (read.ok) return { ok: true, old: read.manifest };
    const fix =
      read.kind === "foreign"
        ? "publish into an empty folder, or one that fullmark published to"
        : read.kind === "newer"
          ? "use a fullmark that is as new as the one that published this folder"
          : `fix ${MANIFEST_FILE}, or remove it and publish again into an empty folder`;
    return { ok: false, exit: libraryFail(io, opts.json, read.message, { fix }) };
  };
  const first = readOld();
  if (!first.ok) return first.exit;
  const previous = first.old;

  // -- the settings: a flag, else what the manifest remembers, else the config, else the default
  const fonts = (opts.fonts ?? previous?.fonts ?? config.data?.fonts ?? "quiz") as FontsChoice;
  const uiLang = (opts.uiLang ?? previous?.ui_lang ?? "en") as "en" | "vi";
  const withBrief = opts.withBrief ? true : opts.noBrief ? false : (previous?.with_brief ?? false);

  // -- build every quiz in memory
  const shelved = opened.index.quizzes.filter(isPublished).sort((a, b) => compare(a.id, b.id));
  const readers = runtimeReaders(io);
  const built: Built[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  for (const quiz of shelved) {
    const result = await buildQuiz(quiz, withBrief, fonts, root, io, opts.program, readers, warnings, failures);
    if (result !== null) built.push(result);
  }
  if (failures.length > 0) {
    if (opts.json)
      io.out(
        JSON.stringify({
          status: "refused",
          message: "a build failed, so nothing was written",
          fix: "fix the quiz, or take it off the shelf with `quiz library publish NAME --off`",
        }),
      );
    for (const line of failures) io.err(line);
    io.err("error: a build failed, so nothing was written");
    io.err("    fix: fix the quiz, or take it off the shelf with `quiz library publish NAME --off`");
    return EXIT.problems;
  }

  const name = basename(dir);
  const files = new Map<string, Uint8Array>();
  for (const b of built) for (const [path, bytes] of b.files) files.set(path, bytes);
  files.set(
    INDEX_PAGE,
    bytesOf(
      buildShelfIndex(
        name,
        built.map((b) => ({
          id: b.quiz.id,
          title: b.quiz.title,
          lang: b.quiz.lang,
          ...b.summary,
        })),
        uiLang,
      ),
    ),
  );
  const manifest: ShelfManifest = {
    format: SHELF_FORMAT,
    version: SHELF_VERSION,
    ui_lang: uiLang,
    with_brief: withBrief,
    fonts,
    quizzes: built.map((b) => b.quiz),
    files: [INDEX_PAGE],
  };
  const manifestBytes = renderManifest(manifest);
  const current = (path: string): Uint8Array | null => {
    try {
      return readFileSync(join(dir, ...path.split("/")));
    } catch {
      return null;
    }
  };

  /** What the folder is now, against what would be written: the plan, or the reason to refuse (exit 1). */
  const assess = (old: ShelfManifest | null): { plan: SyncPlan } | { refuse: { message: string; fix: string } } => {
    const listedIds = new Set((old?.quizzes ?? []).map((q) => q.id));
    const folders = listQuizFolders(dir).filter((id) => !listedIds.has(id));
    if (old !== null && folders.length > 0)
      return {
        refuse: {
          message: `${folders.map((f) => `${f}/`).join(", ")} in ${dir} ${folders.length === 1 ? "is a quiz folder" : "are quiz folders"} that ${MANIFEST_FILE} does not list`,
          fix: `move ${folders.length === 1 ? "it" : "them"} out of ${dir}, or import ${folders.length === 1 ? "it" : "them"} into the library first`,
        },
      };
    if (old === null) {
      if (folders.length > 0)
        return {
          refuse: {
            message: `${folders.map((f) => `${f}/`).join(", ")} in ${dir} ${folders.length === 1 ? "is a quiz folder" : "are quiz folders"}, and the folder has no ${MANIFEST_FILE}`,
            fix: `move ${folders.length === 1 ? "it" : "them"} out of ${dir}, or import ${folders.length === 1 ? "it" : "them"} into the library first`,
          },
        };
      if (existsSync(join(dir, INDEX_PAGE)))
        return {
          refuse: {
            message: `${INDEX_PAGE} in ${dir} is not fullmark's: the folder has no ${MANIFEST_FILE}, and the sync would overwrite it`,
            fix: "move it, or publish into an empty folder",
          },
        };
    }
    const plan = planSync({ old, next: manifest, wanted: files, manifestBytes, current });
    if (plan.conflicts.length > 0)
      return {
        refuse: {
          message: `${plan.conflicts.join(", ")} in ${dir} ${plan.conflicts.length === 1 ? "is" : "are"} not listed in ${MANIFEST_FILE} and ${plan.conflicts.length === 1 ? "differs" : "differ"} from what would be written`,
          fix: "move it, or publish into an empty folder",
        },
      };
    return { plan };
  };

  const summary = (plan: SyncPlan): { added: string[]; updated: string[]; removed: string[] } => ({
    added: plan.quizzes.filter((c) => c.action === "add").map((c) => c.id),
    updated: plan.quizzes.filter((c) => c.action === "update").map((c) => c.id),
    removed: plan.quizzes.filter((c) => c.action === "remove").map((c) => c.id),
  });
  const unchangedLine = `unchanged: ${dir} already matches the library (${quizzes(built.length)})`;
  const reportUnchanged = (): ExitCode => {
    if (opts.json)
      io.out(
        JSON.stringify({
          status: "unchanged",
          dir,
          added: [],
          updated: [],
          removed: [],
          committed: null,
          warnings,
          ...(opts.dryRun ? { dry_run: true } : {}),
        }),
      );
    out(unchangedLine);
    return EXIT.done;
  };

  // -- --dry-run: the plan, before the lock, and nothing written
  if (opts.dryRun) {
    const assessed = assess(previous);
    if ("refuse" in assessed) return libraryRefuse(io, opts.json, assessed.refuse.message, assessed.refuse.fix);
    const { plan } = assessed;
    if (plan.unchanged) return reportUnchanged();
    const lines = describePlan(plan);
    const counts = summary(plan);
    if (opts.json)
      io.out(
        JSON.stringify({
          status: "published",
          dir,
          ...counts,
          committed: null,
          warnings,
          dry_run: true,
        }),
      );
    out(`would publish ${quizzes(built.length)} to ${dir}`);
    for (const l of lines) out(l);
    out(p.dim("nothing written (--dry-run)"));
    return EXIT.done;
  }

  // -- the real sync, under the shelf's lock
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    return libraryFail(io, opts.json, `cannot make ${dir}: ${(error as Error).message}`);
  }
  try {
    return await withLock(
      dir,
      `quiz library publish ${dir}`,
      lockEnvOf(io),
      {
        waiting: (h) => io.err(p.dim(`waiting for the shelf: ${h.command} (pid ${h.pid}) holds the lock`)),
        stale: (h, why) => out(`${p.cyan("note")} ${staleNote(h, why)}`),
      },
      async () => {
        const again = readOld();
        if (!again.ok) return again.exit;
        const old = again.old;
        const assessed = assess(old);
        if ("refuse" in assessed) return libraryRefuse(io, opts.json, assessed.refuse.message, assessed.refuse.fix);
        const { plan } = assessed;
        if (plan.unchanged) return reportUnchanged();

        const atomic = io.atomic ?? writeFileAtomic;
        const at = (path: string): string => join(dir, ...path.split("/"));
        try {
          // 1. the manifest listing every path old and new: a sync killed from here on is repaired by the next
          const interim = interimManifest(old, manifest);
          const interimBytes = renderManifest(interim);
          const final = Buffer.from(interimBytes).equals(Buffer.from(manifestBytes));
          if (
            current(MANIFEST_FILE) === null ||
            !Buffer.from(current(MANIFEST_FILE) as Uint8Array).equals(Buffer.from(interimBytes))
          )
            await atomic(at(MANIFEST_FILE), interimBytes);
          // 2. each changed file
          for (const w of plan.writes) await atomic(at(w.path), files.get(w.path) as Uint8Array);
          // 3. each removed path, and the folders it leaves empty
          for (const path of plan.removes) {
            await rm(at(path), { force: true });
            await pruneEmpty(dir, dirname(at(path)));
          }
          // 4. the final manifest
          if (!final) await atomic(at(MANIFEST_FILE), manifestBytes);
        } catch (error) {
          const shown = error instanceof WriteError ? `${error.file}: ${error.message}` : (error as Error).message;
          if (error instanceof WriteError || (error as NodeJS.ErrnoException).code !== undefined)
            return libraryFail(io, opts.json, `cannot write the shelf: ${shown}`, {
              fix: "run the command again: the next sync repairs the folder",
            });
          throw error;
        }

        // the commit: only what the sync wrote or removed, when DIR is anywhere inside a work tree
        const shelfGit: Git = gitFor(io, dir, gitBin);
        const paths = [...new Set([...plan.writes.map((w) => w.path), ...plan.removes, MANIFEST_FILE])].sort(compare);
        let committed: string | null = null;
        let inRepo = false;
        let commitWarning: string | null = null;
        if (await shelfGit.insideWorkTree()) {
          inRepo = true;
          const result = await shelfGit.commitPaths(paths, "fullmark: publish");
          if (result.status === "committed") committed = result.hash;
          else if (result.status === "failed")
            commitWarning = `the commit failed: ${result.message}; the files are written`;
        }
        if (commitWarning !== null) warnings.push(commitWarning);

        // remembered, and said so when it changes
        let rememberedNow = false;
        if (rememberedDir === null || realish(rememberedDir) !== realish(dir)) {
          await recordShelf(configPath, PUBLIC_SHELF, dir);
          rememberedNow = true;
        }

        const counts = summary(plan);
        if (opts.json) io.out(JSON.stringify({ status: "published", dir, ...counts, committed, warnings }));
        const parts = [
          counts.added.length > 0 ? `${counts.added.length} added` : null,
          counts.updated.length > 0 ? `${counts.updated.length} updated` : null,
          counts.removed.length > 0 ? `${counts.removed.length} removed` : null,
        ].filter((x): x is string => x !== null);
        const what =
          parts.length > 0 ? parts.join(", ") : plan.index !== null ? "the index page changed" : "the manifest changed";
        out(`${p.green("published")} ${quizzes(built.length)} to ${dir}: ${what}`);
        for (const w of warnings.filter((x) => x !== commitWarning)) out(`${p.yellow("warning")} ${w}`);
        if (rememberedNow) out(`remembered ${dir} as the ${PUBLIC_SHELF} shelf`);
        if (commitWarning !== null) out(`${p.yellow("warning")} ${commitWarning}`);
        if (committed !== null) out(p.dim(`committed ${committed} fullmark: publish (in ${dir})`));
        if (inRepo) out(p.dim(`next: git -C ${dir} push   (fullmark never pushes)`));
        else out(`${p.cyan("note")} ${dir} is not in a git repository, so nothing was committed`);
        return EXIT.done;
      },
    );
  } catch (error) {
    if (error instanceof LockBusy)
      return libraryFail(io, opts.json, error.message.replace("the library is busy", "the shelf is busy"), {
        fix: "run the command again when it finishes",
      });
    throw error;
  }
}

/** The lines of `--dry-run` under "would publish": a quiz and why, then the index page. */
function describePlan(plan: SyncPlan): string[] {
  const rows = plan.quizzes.map((c) => ({ action: c.action, path: `${c.id}/`, why: c.why }));
  const width = Math.max(0, ...rows.map((r) => r.path.length)) + 3;
  const lines = rows.map((r) => `  ${r.action.padEnd(8)}${r.path.padEnd(width)}${r.why}`);
  if (plan.index !== null) lines.push(`  ${plan.index.padEnd(8)}${INDEX_PAGE}`);
  if (lines.length === 0 && plan.manifest !== null) lines.push(`  ${plan.manifest.padEnd(8)}${MANIFEST_FILE}`);
  return lines;
}

/**
 * The manifest a sync writes first: the new one with every path the old one listed added to it, and the quizzes the sync
 * is about to remove still there, so that a sync killed half way leaves a manifest that lists everything it may have
 * written and the next sync removes only what that manifest lists.
 */
function interimManifest(old: ShelfManifest | null, next: ShelfManifest): ShelfManifest {
  if (old === null) return next;
  const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])].sort(compare);
  const before = new Map(old.quizzes.map((q) => [q.id, q]));
  const after = new Set(next.quizzes.map((q) => q.id));
  return {
    ...next,
    files: union(next.files, old.files),
    quizzes: [
      ...next.quizzes.map((q) => ({ ...q, files: union(q.files, before.get(q.id)?.files ?? []) })),
      ...old.quizzes.filter((q) => !after.has(q.id)),
    ],
  };
}

/** Removes `folder` and its parents while they are empty, never `root` itself and never anything outside it. */
async function pruneEmpty(root: string, folder: string): Promise<void> {
  let at = folder;
  while (at !== root && isInside(root, at)) {
    const left = await readdir(at).catch(() => null);
    if (left === null || left.length > 0) return;
    await rmdir(at);
    at = dirname(at);
  }
}

/**
 * One quiz on the shelf, built in memory: its current version as `library share` loads it, checked under its stored
 * rules, the page by `quiz build`'s own code with `built_at` the version's `added` time, and the files of the version's
 * folder (without `check.json`, and without `brief.yaml` unless asked) under `ID/`, with the `fullmark.toml` that
 * `share --source` writes when there is one. Null when it failed: the lines are in `failures`.
 */
async function buildQuiz(
  quiz: IndexQuiz,
  withBrief: boolean,
  fonts: FontsChoice,
  root: string,
  io: PublishIo,
  program: string,
  readers: ReturnType<typeof runtimeReaders>,
  warnings: string[],
  failures: string[],
): Promise<Built | null> {
  const version = quiz.versions.find((v) => v.hash === quiz.current);
  const loaded = loadStored(root, quiz, quiz.current);
  if (version === undefined || loaded === null || loaded.quiz === null || loaded.hash === null) {
    failures.push(`${quiz.name}: the current version cannot be read from the library`);
    return null;
  }
  const profile = storedProfile(root, quiz, quiz.current);
  const options: BuildOptions = {
    profile: null,
    config: null,
    strict: false,
    output: null,
    builtAt: version.added,
    uiLang: null,
    fonts,
    plain: true,
    json: false,
    buildFile: null,
    open: false,
    print: false,
    seed: null,
    answerSheet: false,
    answers: null,
    materials: null,
    watch: false,
    serve: false,
    port: null,
    version: program,
    ...(profile === null ? {} : { fixed: profile }),
  };
  const result = await buildOne(
    { file: loaded.file, abs: loaded.file, opts: options, target: join(root, "in-memory.html") },
    { io, several: false, builtAt: version.added, ...readers, memory: true },
  );
  if (result.status !== "built" || result.page === undefined) {
    failures.push(`${quiz.name}:`, ...result.out, ...result.err);
    return null;
  }
  // what the build itself found (a font not embedded, a page over its size) is a warning; the quiz's own findings were told at register
  for (const l of result.out.slice(0, -1))
    if (FIRST_LINE.test(l) && /: (warning|error|info) build\./.test(l))
      warnings.push(`${quiz.name}: ${l.replace(/^.*?: (warning|error|info) /, "$1 ")}`);

  const folder = join(root, "quizzes", quiz.id, "versions", quiz.current);
  const wanted = new Map<string, Uint8Array>();
  const prefix = `${quiz.id}/`;
  for (const rel of filesUnder(folder)) {
    if (rel === "check.json" || (rel === "brief.yaml" && !withBrief)) continue;
    wanted.set(`${prefix}${rel}`, readFileSync(join(folder, ...rel.split("/"))));
  }
  const taken = [`${prefix}${INDEX_PAGE}`, `${prefix}fullmark.toml`].filter((path) => wanted.has(path));
  if (taken.length > 0) {
    failures.push(
      `${quiz.name}: its own file ${taken.map((t) => t.slice(prefix.length)).join(", ")} would be overwritten by the shelf's`,
    );
    return null;
  }
  wanted.set(`${prefix}${INDEX_PAGE}`, result.page);
  const toml = profile === null ? null : profileToml(profile, loaded.quiz.frontMatter.profile);
  if (toml !== null) wanted.set(`${prefix}fullmark.toml`, bytesOf(toml));
  const stats = summarise(loaded.quiz, loaded.hash);
  const sections = loaded.quiz.sections;
  return {
    quiz: {
      id: quiz.id,
      name: quiz.name,
      title: loaded.quiz.frontMatter.title,
      lang: loaded.quiz.frontMatter.lang,
      hash: quiz.current,
      added: version.added,
      file: version.file,
      files: [...wanted.keys()].sort(compare),
    },
    files: wanted,
    summary: {
      // as the start screen counts them: a bank counts the questions drawn, and its points are unknown when they differ
      questions: sections.reduce((n, sec) => n + (sec.pick ?? sec.questions.length), 0),
      points: sections.some(
        (sec) => sec.pick !== null && sec.questions.some((q) => q.points !== sec.questions[0]?.points),
      )
        ? null
        : stats.points,
      timeLimit: stats.timeLimit,
      passMark: loaded.quiz.frontMatter.passMark,
      exam: profile?.chain.some((c) => c.name === "exam") ?? false,
      instant: loaded.quiz.frontMatter.feedback === "instant",
      types: stats.types.map((x) => x.type as QuestionType),
    },
  };
}
