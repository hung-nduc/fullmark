import { readdirSync } from "node:fs";
import { join } from "node:path";
import { SHELF_FORMAT, SHELF_VERSION, type ShelfManifest, ShelfManifestSchema } from "../core/ir";

/**
 * A shelf's manifest and the plan of a sync (COMMANDS.md, `quiz library publish`; STEP5-GAPS.md, G1, G2, G6). Nothing
 * here knows how a page is built: the command builds every file in memory and hands this module the paths and bytes.
 */
export const MANIFEST_FILE = "fullmark-shelf.json";
export const INDEX_PAGE = "index.html";

export type ManifestProblem = "foreign" | "newer" | "malformed";
export type ManifestRead =
  | { ok: true; manifest: ShelfManifest }
  | { ok: false; kind: ManifestProblem; message: string };

/** A path a manifest may list: relative to the shelf, with `/`, nothing empty or dotted, so a sync never leaves its folder. */
export const safePath = (path: string): boolean =>
  path !== "" &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !/^[A-Za-z]:/.test(path) &&
  path.split("/").every((part) => part !== "" && part !== "." && part !== "..");

const describe = (v: unknown): string => (typeof v === "string" ? JSON.stringify(v) : String(v));

/**
 * Reads the text of a `fullmark-shelf.json`. A `format` that is not `fullmark-shelf` is foreign and a `version` above 2
 * is newer (both exit 2); anything else wrong with it is malformed, with the first problem named.
 */
export function readManifest(text: string): ManifestRead {
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    return { ok: false, kind: "malformed", message: `not valid JSON: ${(e as Error).message}` };
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc))
    return { ok: false, kind: "malformed", message: "it is not a JSON object" };
  const head = doc as { format?: unknown; version?: unknown };
  if (head.format !== SHELF_FORMAT) {
    const what = head.format === undefined ? "has no `format`" : `has format ${describe(head.format)}`;
    return { ok: false, kind: "foreign", message: `not a fullmark shelf: ${MANIFEST_FILE} ${what}` };
  }
  if (typeof head.version === "number" && head.version > SHELF_VERSION)
    return {
      ok: false,
      kind: "newer",
      message: `${MANIFEST_FILE} has version ${head.version}, which this fullmark does not know (it writes version ${SHELF_VERSION})`,
    };
  if (head.version !== SHELF_VERSION)
    return {
      ok: false,
      kind: "foreign",
      message: `not a fullmark 1.0 shelf: ${MANIFEST_FILE} has version ${describe(head.version)}`,
    };
  const parsed = ShelfManifestSchema.safeParse(doc);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const at = (issue?.path ?? []).map(String).join(".");
    return {
      ok: false,
      kind: "malformed",
      message: `${MANIFEST_FILE}: ${at === "" ? "" : `\`${at}\`: `}${issue?.message ?? "does not match the format"}`,
    };
  }
  const manifest = parsed.data;
  const listed = [...manifest.files, ...manifest.quizzes.flatMap((q) => [q.id, ...q.files])];
  const unsafe = listed.find((p) => !safePath(p));
  if (unsafe !== undefined)
    return {
      ok: false,
      kind: "malformed",
      message: `${MANIFEST_FILE} lists ${describe(unsafe)}, which is not a path inside the shelf`,
    };
  return { ok: true, manifest };
}

const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  return v;
};

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The bytes of a manifest: quizzes sorted by id, paths sorted, keys sorted, two-space indent, a final newline. */
export function renderManifest(manifest: ShelfManifest): Uint8Array {
  const sorted: ShelfManifest = {
    ...manifest,
    quizzes: [...manifest.quizzes]
      .sort((a, b) => compare(a.id, b.id))
      .map((q) => ({ ...q, files: [...q.files].sort(compare) })),
    files: [...manifest.files].sort(compare),
  };
  return new TextEncoder().encode(`${JSON.stringify(sortKeys(sorted), null, 2)}\n`);
}

/** Every path a manifest lists, relative to the shelf: the root's and each quiz's. */
export const manifestPaths = (manifest: ShelfManifest | null): string[] =>
  manifest === null ? [] : [...manifest.files, ...manifest.quizzes.flatMap((q) => q.files)];

/**
 * The top-level folders of `dir` that hold an `.md` file and an `index.html` at their top level: a quiz folder (G6),
 * sorted. A folder that cannot be read is not one.
 */
export function listQuizFolders(dir: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const inside = readdirSync(join(dir, entry.name), { withFileTypes: true }).filter((e) => e.isFile());
      if (inside.some((e) => e.name === INDEX_PAGE) && inside.some((e) => e.name.toLowerCase().endsWith(".md")))
        out.push(entry.name);
    } catch {
      // not readable: not a quiz folder
    }
  }
  return out.sort(compare);
}

/** One change of a quiz on the shelf, as `--dry-run` and the sync's summary tell it. */
export type QuizChange =
  | { action: "add"; id: string; why: string }
  | { action: "update"; id: string; why: string }
  | { action: "remove"; id: string; why: string };

export type SyncPlan = {
  /** the files to write, new or changed, sorted by path */
  writes: { path: string; kind: "add" | "update" }[];
  /** the paths the old manifest lists, no longer wanted, that are on disk; sorted */
  removes: string[];
  /** the paths the old manifest does not list that are on disk with other bytes than the sync would write */
  conflicts: string[];
  /** the old manifest's paths and the new one's, together: what the interim manifest lists (a killed sync is repaired) */
  union: string[];
  /** adds, then updates, then removes, each by id */
  quizzes: QuizChange[];
  /** the index page: `add` or `update`, or null when it stays */
  index: "add" | "update" | null;
  /** the manifest on its own: `add` or `update`, or null when it stays */
  manifest: "add" | "update" | null;
  /** nothing to write, remove or record */
  unchanged: boolean;
};

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && Buffer.compare(a, b) === 0;

/** The first 4 characters of a hash, as `list` shows a version. */
const short = (hash: string): string => hash.slice(0, 4);

/**
 * What a sync would do (a pure function): `wanted` is every file of the new shelf but the manifest, by path with its
 * bytes; `current` reads what is on disk now (null when there is nothing); `old` and `next` are the manifests. A path is
 * removed only when the old manifest lists it; a path the old manifest does not list is never changed (a conflict).
 */
export function planSync(input: {
  old: ShelfManifest | null;
  next: ShelfManifest;
  wanted: ReadonlyMap<string, Uint8Array>;
  manifestBytes: Uint8Array;
  current: (path: string) => Uint8Array | null;
}): SyncPlan {
  const { old, next, wanted, current } = input;
  const listed = new Set(manifestPaths(old));
  const writes: SyncPlan["writes"] = [];
  const conflicts: string[] = [];
  for (const path of [...wanted.keys()].sort(compare)) {
    const have = current(path);
    const bytes = wanted.get(path) as Uint8Array;
    if (have === null) writes.push({ path, kind: "add" });
    else if (!same(have, bytes)) {
      if (listed.has(path)) writes.push({ path, kind: "update" });
      else conflicts.push(path);
    }
  }
  const removes = [...listed].filter((p) => !wanted.has(p) && current(p) !== null).sort(compare);
  const union = [...new Set([...listed, ...wanted.keys()])].sort(compare);

  const before = new Map((old?.quizzes ?? []).map((q) => [q.id, q]));
  const after = new Map(next.quizzes.map((q) => [q.id, q]));
  const touched = (id: string): boolean =>
    writes.some((w) => w.path.startsWith(`${id}/`)) || removes.some((p) => p.startsWith(`${id}/`));
  const quizzes: QuizChange[] = [];
  for (const id of [...after.keys()].sort(compare))
    if (!before.has(id)) quizzes.push({ action: "add", id, why: "new on the shelf" });
  for (const id of [...after.keys()].sort(compare)) {
    const was = before.get(id);
    const now = after.get(id);
    if (was === undefined || now === undefined) continue;
    if (was.hash !== now.hash)
      quizzes.push({ action: "update", id, why: `version ${short(was.hash)} → ${short(now.hash)}` });
    else if (touched(id)) quizzes.push({ action: "update", id, why: "files changed" });
  }
  for (const id of [...before.keys()].sort(compare))
    if (!after.has(id)) quizzes.push({ action: "remove", id, why: "off the shelf" });

  const indexWrite = writes.find((w) => w.path === INDEX_PAGE);
  const index = indexWrite?.kind ?? null;
  const have = current(MANIFEST_FILE);
  const manifest = have === null ? "add" : same(have, input.manifestBytes) ? null : "update";
  const unchanged = writes.length === 0 && removes.length === 0 && manifest === null;
  return { writes, removes, conflicts, union, quizzes, index, manifest, unchanged };
}

/** Every file under a folder, as paths relative to it with `/`, sorted. */
export function filesUnder(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}
