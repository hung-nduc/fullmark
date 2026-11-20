import { posix, win32 } from "node:path";
import { slashed } from "./layout";

/** The pathname rules of a system, so that a test checks both on one machine. */
const rulesOf = (platform: NodeJS.Platform) => (platform === "win32" ? win32 : posix);

/**
 * Whether a stored path is absolute on some system (COMMANDS.md, "Paths in output"): after `slashed`, it starts with
 * `/` (also `//`) or a drive letter and `:/`.
 */
export const isStoredAbsolute = (stored: string): boolean => /^(\/|[A-Za-z]:\/)/.test(slashed(stored));

/**
 * Whether an absolute stored path names a place on `platform` at all: a drive path means nothing on Linux, and a
 * single-slash path (`/home/minh/...`) means nothing on Windows (it would be taken for the current drive's root).
 */
export function absoluteHere(stored: string, platform: NodeJS.Platform = process.platform): boolean {
  const text = slashed(stored);
  if (platform === "win32") return /^[A-Za-z]:\//.test(text) || text.startsWith("//");
  return text.startsWith("/");
}

/**
 * The `source` to write for the file `abs` in the library `root` (COMMANDS.md, `library.toml`): relative to the library
 * folder, with `/`, when both are on the same drive (always on Linux); absolute with `/` only across Windows drives.
 */
export function sourceToStore(abs: string, root: string, platform: NodeJS.Platform = process.platform): string {
  const rules = rulesOf(platform);
  const from = rules.resolve(root);
  const to = rules.resolve(abs);
  if (platform === "win32" && rules.parse(from).root.toLowerCase() !== rules.parse(to).root.toLowerCase())
    return slashed(to);
  return slashed(rules.relative(from, to));
}

/**
 * Where a stored `source` is: a relative one is resolved against the library folder, an absolute one is used as it is.
 * Null when it is absolute on another system, which is simply not found.
 */
export function resolveSource(
  stored: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  if (isStoredAbsolute(stored)) return absoluteHere(stored, platform) ? slashed(stored) : null;
  return rulesOf(platform).resolve(root, stored);
}

/** Whether two absolute paths name the same file by their text: Windows ignores case. */
export function sameFile(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  const rules = rulesOf(platform);
  const x = slashed(rules.resolve(a));
  const y = slashed(rules.resolve(b));
  return platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}
