import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Quiz } from "../core/ir";
import { QUIZZES_DIR } from "./layout";

/** One file of a version, by its path relative to the version's folder (`/` separators). */
export type VersionFile = { path: string; bytes: Uint8Array };

/** `.<hash>.<8 hex>.tmp`: a version folder while it is being written. */
const TEMP = /^\.[0-9a-f]{64}\.[0-9a-f]{8}\.tmp$/;

/**
 * Writes a version's folder (COMMANDS.md, "The library folder"): every file into `versions/.<hash>.<8 hex>.tmp/`, then
 * one rename to `versions/<hash>/`, so a crash leaves no half-written version under its own name. A folder already
 * there is one a killed run left (the index does not name it) and is replaced.
 */
export async function writeVersion(
  versionsDir: string,
  hash: string,
  files: readonly VersionFile[],
  suffix: string = randomBytes(4).toString("hex"),
): Promise<void> {
  const temp = join(versionsDir, `.${hash}.${suffix}.tmp`);
  const final = join(versionsDir, hash);
  try {
    await rm(temp, { recursive: true, force: true });
    for (const file of files) {
      const target = join(temp, ...file.path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.bytes);
    }
    await rm(final, { recursive: true, force: true });
    await rename(temp, final);
  } catch (error) {
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

/** Removes the `*.tmp` folders a killed `register` left under any quiz's `versions/`. */
export async function removeVersionTemps(root: string): Promise<void> {
  const quizzes = join(root, QUIZZES_DIR);
  const ids = await readdir(quizzes).catch(() => [] as string[]);
  for (const id of ids) {
    const versions = join(quizzes, id, "versions");
    for (const name of await readdir(versions).catch(() => [] as string[])) {
      if (TEMP.test(name)) await rm(join(versions, name), { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** How one version differs from the one before it, by question id and question hash. */
export type VersionDiff = { added: string[]; removed: string[]; changed: string[] };

/** `id` to question hash, in the order of the quiz. */
export type QuestionHashes = ReadonlyMap<string, string>;

export function diffVersions(before: QuestionHashes, after: QuestionHashes): VersionDiff {
  const out: VersionDiff = { added: [], removed: [], changed: [] };
  for (const [id, hash] of after) {
    const was = before.get(id);
    if (was === undefined) out.added.push(id);
    else if (was !== hash) out.changed.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) out.removed.push(id);
  return out;
}

/** The hash of every question of a quiz, by id. */
export function questionHashes(quiz: Quiz): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of quiz.sections) for (const q of s.questions) map.set(q.id, q.hash);
  return map;
}
