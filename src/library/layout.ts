import { join } from "node:path";

/** A path as fullmark writes it into a file: `/` on every system (COMMANDS.md, "Paths in output"). */
export const slashed = (path: string): string => path.replaceAll("\\", "/");

/** The library's top-level names (COMMANDS.md, "The library folder"). */
export const INDEX_FILE = "library.toml";
export const GITIGNORE_FILE = ".gitignore";
export const LOCK_FILE = ".fullmark.lock";
export const QUIZZES_DIR = "quizzes";

/** What `.gitignore` holds: the lock, an attempt in progress, and the temporary files of an atomic write. */
export const GITIGNORE_TEXT = `${LOCK_FILE}\n${QUIZZES_DIR}/*/progress/\n*.tmp\n`;

/** The files at the root a library may hold besides its own (`library status` counts the others as orphans). */
export const ROOT_FILES = [INDEX_FILE, GITIGNORE_FILE, LOCK_FILE, "fullmark.toml", "README.md"] as const;

/** Every path of one quiz's folder, `quizzes/<id>/`. Folders are named by the quiz's id, never its name. */
export type QuizPaths = {
  dir: string;
  versions: string;
  /** `versions/<hash>/`, the folder of one version, named by the whole hash */
  version(hash: string): string;
  results: string;
  /** `results/<stamp>.json` */
  result(stamp: string): string;
  grades: string;
  /** `grades/<stamp>-<YYYYMMDD-HHMMSS>-grades.json` */
  grade(attemptStamp: string, gradedStamp: string): string;
  reports: string;
  /** `reports/<stamp>-report.json` and `.md` */
  reportJson(stamp: string): string;
  reportMd(stamp: string): string;
  review: string;
  progress: string;
  /** `progress/<version>.json` */
  progressFile(hash: string): string;
  /** `progress/<version>.serving.json`: who is serving that version now (G9) */
  servingFile(hash: string): string;
  /** `progress/<version>.submitted.json`: a submit written by the server, not yet filed (G9) */
  submittedFile(hash: string): string;
};

/** Every path of a library, so that no command builds one by hand. */
export type LibraryPaths = {
  root: string;
  index: string;
  gitignore: string;
  lock: string;
  quizzes: string;
  quiz(id: string): QuizPaths;
};

export function libraryPaths(root: string): LibraryPaths {
  return {
    root,
    index: join(root, INDEX_FILE),
    gitignore: join(root, GITIGNORE_FILE),
    lock: join(root, LOCK_FILE),
    quizzes: join(root, QUIZZES_DIR),
    quiz(id) {
      const dir = join(root, QUIZZES_DIR, id);
      const results = join(dir, "results");
      const grades = join(dir, "grades");
      const reports = join(dir, "reports");
      const versions = join(dir, "versions");
      const progress = join(dir, "progress");
      return {
        dir,
        versions,
        version: (hash) => join(versions, hash),
        results,
        result: (stamp) => join(results, `${stamp}.json`),
        grades,
        grade: (attemptStamp, gradedStamp) => join(grades, `${attemptStamp}-${gradedStamp}-grades.json`),
        reports,
        reportJson: (stamp) => join(reports, `${stamp}-report.json`),
        reportMd: (stamp) => join(reports, `${stamp}-report.md`),
        review: join(dir, "review.json"),
        progress,
        progressFile: (hash) => join(progress, `${hash}.json`),
        servingFile: (hash) => join(progress, `${hash}.serving.json`),
        submittedFile: (hash) => join(progress, `${hash}.submitted.json`),
      };
    },
  };
}

/**
 * How a version is shown: its first 4 characters, more when another version of the same quiz begins with them too
 * (as `inspect` shows `short`). `all` is every version hash of the quiz.
 */
export function shortHash(hash: string, all: readonly string[]): string {
  for (let n = 4; n < hash.length; n++) {
    const prefix = hash.slice(0, n);
    if (all.filter((h) => h !== hash && h.startsWith(prefix)).length === 0) return prefix;
  }
  return hash;
}
