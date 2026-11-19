import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type LibraryImportOptions, runLibraryImport } from "../../src/cli/library-import";
import { readIndex } from "../../src/library/index-file";
import { git } from "./library";
import { shelfLibrary } from "./library-publish";
import { newLibrary } from "./library-register";

/** The options of `library import` as a test gives them. */
export const importOptions = (o: Partial<LibraryImportOptions> = {}): LibraryImportOptions => ({
  into: null,
  json: false,
  plain: true,
  ...o,
});

/** A time later than every time of the test libraries, so a time kept from a manifest shows against one made now. */
export const LATER = "2027-01-01T08:00:00+00:00";

/** The index of a library, read back. */
export function indexOf(lib: string) {
  const r = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!r.ok) throw new Error("bad index");
  return r.index;
}

/**
 * A first library (`a`: rust-basics and limits, both on the public shelf) published to `a.dir/shelf`, and a second,
 * empty one (`b`) to import into, on its own machine config. `importing` runs `library import` in `b`'s world.
 */
export async function importWorld(options: Parameters<typeof shelfLibrary>[0] = {}) {
  const a = await shelfLibrary(options);
  const shelf = join(a.dir, "shelf");
  const first = await a.sync("shelf");
  if (first.exit !== 0) throw new Error(first.err.join(" | "));
  const b = await newLibrary();
  const importing = async (
    dir: string,
    o: Partial<LibraryImportOptions> = {},
    extra: Record<string, unknown> = {},
    cwd?: string,
  ) => {
    const c = b.at(cwd);
    const exit = await runLibraryImport(dir, importOptions(o), { ...c.io, now: () => new Date(LATER), ...extra });
    return { exit, out: c.out, err: c.err };
  };
  const commits = async (lib: string, env: Record<string, string>): Promise<number> =>
    Number((await git(lib, env, "rev-list", "--count", "HEAD")).trim());
  return { a, b, shelf, importing, commits };
}
