import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseConfig } from "../core/config/parse";
import { FALLBACK_IDENTITY } from "../library/git";
import type { LibraryIndex } from "../library/index-file";
import { INDEX_FILE, libraryPaths, QUIZZES_DIR, ROOT_FILES, shortHash } from "../library/layout";
import { readHolder, realLockEnv, staleNote, staleReason } from "../library/lock";
import { EXIT, type ExitCode } from "./exit-codes";
import { type LibraryIo, locate, machineOf, openIndex, painterFor, refusal } from "./library-common";
import { loadQuiz } from "./load";
import { shownPath } from "./paths";
import { plural, renderFacts } from "./table";

export type LibraryStatusOptions = { json: boolean; plain: boolean };

type Finding = { code: string; path: string | null; message: string; fix?: string; extra?: string[] };

const slash = (p: string): string => p.replaceAll("\\", "/");

/** Every file under `dir`, relative to `base`, with `/`. */
function walk(dir: string, base: string, out: string[] = []): string[] {
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, base, out);
    else out.push(slash(path.slice(base.length + 1)));
  }
  return out;
}

const listJson = (dir: string): string[] => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
};

/** The common folder of some paths (relative, with `/`), or null when they share none. */
function commonFolder(paths: readonly string[]): string | null {
  const [first, ...rest] = paths.map((p) => p.split("/").slice(0, -1));
  if (first === undefined) return null;
  let common = first;
  for (const parts of rest) {
    let n = 0;
    while (n < common.length && n < parts.length && common[n] === parts[n]) n++;
    common = common.slice(0, n);
  }
  return common.length > 0 ? common.join("/") : null;
}

/**
 * Files outside the layout: under `quizzes/`, anything that is not in a known quiz's folder or a known version's
 * folder; at the root, anything but the library's own files (COMMANDS.md, `quiz library status`).
 */
function orphans(root: string, index: LibraryIndex): string[] {
  const found: string[] = [];
  const known = new Map(index.quizzes.map((q) => [q.id, q]));
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === QUIZZES_DIR) continue;
    if (entry.isDirectory()) found.push(...walk(join(root, entry.name), root));
    else if (!(ROOT_FILES as readonly string[]).includes(entry.name)) found.push(entry.name);
  }
  const quizzes = join(root, QUIZZES_DIR);
  for (const file of walk(quizzes, root)) {
    const [, id, area, hash] = file.split("/");
    const quiz = known.get(id ?? "");
    const rest = file.split("/").length;
    const ok =
      quiz !== undefined &&
      ((area === "versions" && rest > 4 && quiz.versions.some((v) => v.hash === hash)) ||
        ((area === "results" || area === "grades" || area === "reports" || area === "progress") && rest === 4) ||
        (area === "review.json" && rest === 3));
    if (!ok) found.push(file);
  }
  return found.sort();
}

/**
 * `quiz library status [--plain] [--json]` (COMMANDS.md, G11): the facts block, problems and notes in `check`'s issue
 * format, then the verdict. It reads and changes nothing, except that it removes a stale lock and says so.
 */
export async function runLibraryStatus(opts: LibraryStatusOptions, io: LibraryIo): Promise<ExitCode> {
  const found = locate(io, opts.json);
  if ("exit" in found) return found.exit;
  const { root, from, configPath, configLibrary, git } = found.located;
  const machine = machineOf(io);
  const shown = (p: string) => shownPath(p, machine.cwd);
  const problems: Finding[] = [];
  const notes: Finding[] = [];
  const paths = libraryPaths(root);

  const opened = openIndex(root);
  let index: LibraryIndex | null = null;
  if (opened.kind === "read" && opened.read.ok) index = opened.read.index;
  else if (opened.kind === "no-folder") {
    problems.push({
      code: "library.missing",
      path: shown(root),
      message: "the library's folder does not exist",
      fix: `quiz library init ${shown(root)}`,
    });
  } else if (opened.kind === "read" && !opened.read.ok) {
    for (const p of opened.read.problems)
      problems.push({
        code: "library.index",
        path: `${INDEX_FILE}:${p.line}`,
        message: p.message,
        ...(p.fix ? { fix: p.fix } : {}),
      });
  } else {
    const r = refusal(root, opened, machine.cwd);
    problems.push({
      code: "library.index",
      path: shown(root),
      message: r?.message ?? "not a library",
      ...(r ? { fix: r.fix } : {}),
    });
  }

  const gitAvailable = existsSync(join(root, ".git")) && (await git.available());
  const repository = existsSync(join(root, ".git"));

  // counts, and the snapshots' hashes
  const counts = { quizzes: 0, versions: 0, attempts: 0, reports: 0 };
  let hashesOk = 0;
  if (index !== null) {
    counts.quizzes = index.quizzes.length;
    for (const quiz of index.quizzes) {
      const q = paths.quiz(quiz.id);
      counts.attempts += listJson(q.results).length;
      counts.reports += listJson(q.reports).filter((f) => f.endsWith("-report.json")).length;
      const all = quiz.versions.map((v) => v.hash);
      for (const version of quiz.versions) {
        counts.versions++;
        const dir = q.version(version.hash);
        const where = slash(`${QUIZZES_DIR}/${quiz.id}/versions/${shortHash(version.hash, all)}`);
        if (!existsSync(dir) || !statSync(dir).isDirectory()) {
          problems.push({
            code: "library.version-missing",
            path: where,
            message: "the version's folder is missing",
            fix: gitAvailable
              ? `git -C ${shown(root)} checkout -- ${slash(`${QUIZZES_DIR}/${quiz.id}/versions/${version.hash}`)}`
              : "restore the folder from a copy",
          });
          continue;
        }
        let actual: string | null = null;
        let why = "the files no longer match the version's hash";
        try {
          const loaded = loadQuiz(join(dir, version.file));
          actual = loaded.hash;
          if (actual === null) why = "a file the quiz uses is missing, so the files no longer match the version's hash";
        } catch {
          why = `the source file ${version.file} is missing, so the files no longer match the version's hash`;
        }
        if (actual === version.hash) hashesOk++;
        else
          problems.push({
            code: "library.hash",
            path: where,
            message: why,
            fix: gitAvailable
              ? `git -C ${shown(root)} checkout -- ${slash(`${QUIZZES_DIR}/${quiz.id}/versions/${version.hash}`)}`
              : "restore the folder from a copy",
          });
      }
    }
  }

  // the library's own fullmark.toml
  let checkConfig = "none";
  const projectConfig = join(root, "fullmark.toml");
  if (existsSync(projectConfig) && statSync(projectConfig).isFile()) {
    const text = readFileSync(projectConfig, "utf8").replace(/^﻿/, "");
    const parsed = parseConfig(text, "fullmark.toml", "project");
    checkConfig = parsed.errors.length === 0 ? "ok" : plural(parsed.errors.length, "problem");
    for (const e of parsed.errors) {
      problems.push({
        code: e.message.startsWith("unknown rule") ? "config.unknown-rule" : "config.invalid",
        path: `fullmark.toml:${e.line}`,
        message: e.message,
        ...(e.fix ? { fix: e.fix } : {}),
      });
    }
  }

  // notes, in the order they print
  const envLibrary = machine.env.FULLMARK_LIBRARY;
  if (envLibrary) {
    notes.push({
      code: "env.library",
      path: null,
      message: `FULLMARK_LIBRARY is set; ${configLibrary ? `the config’s library is ${shown(configLibrary)}` : "the config sets no library"}`,
    });
  }
  let uncommitted: string[] = [];
  let remote: string | null = null;
  let identity: { name: string; email: string } | null = null;
  if (opened.kind === "no-folder") {
    // nothing to say about git for a folder that is not there
  } else if (!repository) {
    notes.push({
      code: "git.no-repository",
      path: null,
      message: "the library is not a git repository: its changes are not kept in history",
    });
  } else if (!gitAvailable) {
    notes.push({
      code: "git.unavailable",
      path: null,
      message: "git was not found: nothing about the repository is shown",
    });
  } else {
    identity = await git.identity();
    uncommitted = await git.uncommitted();
    remote = await git.remote();
    if (identity === null) {
      notes.push({
        code: "git.identity",
        path: null,
        message: `commits are made as ${FALLBACK_IDENTITY.name} <${FALLBACK_IDENTITY.email}>`,
        extra: [`    set one: git -C ${shown(root)} config user.name "Your Name"`],
      });
    }
    if (uncommitted.length > 0) {
      notes.push({
        code: "git.uncommitted",
        path: commonFolder(uncommitted),
        message: `${plural(uncommitted.length, "file")} not committed`,
        extra: [`    see: git -C ${shown(root)} status`],
      });
    }
    if (remote === null)
      notes.push({ code: "git.no-remote", path: null, message: "the library is only on this machine" });
  }
  if (index !== null) {
    const loose = orphans(root, index);
    if (loose.length > 0) {
      notes.push({
        code: "library.orphan",
        path: null,
        message: `${plural(loose.length, "file")} outside the library's layout, such as ${loose[0]}`,
      });
    }
  }
  // a stale lock (another machine, an earlier boot, or a process that is gone): removed, and said
  if (existsSync(paths.lock)) {
    const { holder } = await readHolder(paths.lock);
    const why = holder === null ? null : staleReason(holder, io.lock ?? realLockEnv());
    if (holder !== null && why !== null) {
      rmSync(paths.lock, { force: true });
      notes.push({ code: "lock.stale", path: null, message: staleNote(holder, why) });
    }
  }

  const healthy = problems.length === 0;
  if (opts.json) {
    io.out(
      JSON.stringify({
        status: healthy ? "healthy" : "problems",
        library: root,
        config: configPath,
        git: { repository: repository && gitAvailable, uncommitted: uncommitted.length, remote },
        counts,
        problems: problems.map((p) => ({ code: p.code, path: p.path, message: p.message, fix: p.fix ?? null })),
        notes: notes.map((n) => ({ code: n.code, path: n.path, message: n.message })),
      }),
    );
    return healthy ? EXIT.done : EXIT.problems;
  }

  const p = painterFor(io, opts);
  const out: string[] = [];
  const facts: [string, string][] = [
    ["Library", `${shown(root)}${from === "FULLMARK_LIBRARY" ? " (from FULLMARK_LIBRARY)" : ""}`],
    ["Config", shown(configPath)],
  ];
  if (index !== null || opened.kind === "read") {
    const parts = [!repository ? "no repository" : !gitAvailable ? "git not found" : "repository"];
    if (repository && gitAvailable) {
      parts.push(uncommitted.length === 0 ? "clean" : `${plural(uncommitted.length, "uncommitted change")}`);
      parts.push(remote === null ? "no remote" : `remote ${remote}`);
    }
    facts.push(["Git", parts.join(" · ")]);
    if (repository && gitAvailable) {
      facts.push([
        "Commits as",
        identity
          ? `${identity.name} <${identity.email}> (git’s own identity)`
          : `${FALLBACK_IDENTITY.name} <${FALLBACK_IDENTITY.email}> (git has no identity here)`,
      ]);
    }
  }
  if (index !== null) {
    facts.push([
      "Counts",
      [
        plural(counts.quizzes, "quiz").replace("quizs", "quizzes"),
        plural(counts.versions, "version"),
        plural(counts.attempts, "attempt"),
        plural(counts.reports, "report"),
      ].join(" · "),
    ]);
    if (healthy)
      facts.push(["Checks", `fullmark.toml: ${checkConfig} · hashes: ${hashesOk} of ${counts.versions} match`]);
  }
  out.push(...renderFacts(p, facts));
  const finding = (f: Finding, kind: "problem" | "note"): string[] => [
    `${f.path !== null ? `${f.path}: ` : ""}${p.badge(kind)} ${f.code}: ${f.message}`,
    ...(f.fix ? [`    fix: ${f.fix}`] : []),
    ...(f.extra ?? []),
  ];
  if (problems.length + notes.length > 0) {
    out.push("");
    for (const f of problems) out.push(...finding(f, "problem"));
    for (const f of notes) out.push(...finding(f, "note"));
  }
  const noteCount = notes.length > 0 ? ` (${plural(notes.length, "note")})` : "";
  out.push(
    "",
    healthy ? `${p.green("healthy")}${noteCount}` : `${p.red(plural(problems.length, "problem"))}${noteCount}`,
  );
  for (const line of out) io.out(line);
  return healthy ? EXIT.done : EXIT.problems;
}
