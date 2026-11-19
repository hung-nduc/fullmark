import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LibraryPublishOptions, type PublishIo, runLibraryPublish } from "../../src/cli/library-publish";
import { newLibrary, quizText } from "./library-register";

/** The options of `library publish` as a test gives them: everything off, the fixed program version. */
export const publishOptions = (o: Partial<LibraryPublishOptions> = {}): LibraryPublishOptions => ({
  on: false,
  off: false,
  withBrief: false,
  noBrief: false,
  uiLang: null,
  fonts: null,
  dryRun: false,
  json: false,
  plain: true,
  program: "1.0.0-test",
  ...o,
});

/** What a test needs to put the library's quizzes on a shelf: a library with two quizzes, `publish` and a way to mark them. */
export async function shelfLibrary(options: { mark?: string[] } = {}) {
  const t = await newLibrary();
  t.write({
    "notes/rust.md": quizText("rust", "Rust basics", RUST, "materials:\n  - sheet.md\n"),
    "notes/sheet.md": "# Formulas\n\nNothing here.\n",
    "notes/brief.yaml": "purpose: self-study\n",
    "notes/limits.md": quizText("calculus-limits", "Limits", [["limit", "What is a limit?"]]),
  });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  await t.register(["notes/limits.md"], { name: "limits" });
  const publish = async (
    target: string | null,
    o: Partial<LibraryPublishOptions> = {},
    extra: Partial<PublishIo> = {},
  ) => {
    const c = t.at();
    const exit = await runLibraryPublish(target, publishOptions(o), { ...c.io, ...extra });
    return { exit, out: c.out, err: c.err };
  };
  for (const name of options.mark ?? ["rust-basics", "limits"]) await publish(name, { on: true });
  const sync = (dir: string | null, o: Partial<LibraryPublishOptions> = {}, extra: Partial<PublishIo> = {}) =>
    publish(dir, o, extra);
  return { ...t, publish, sync };
}

export const RUST: [string, string][] = [
  ["own", "Who owns the value?"],
  ["borrow", "What does a borrow do?"],
];

/** The files of a folder as `path` to bytes, sorted, `.git` and the lock left out: two shelves are the same when these are. */
export function folderBytes(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (at: string, prefix: string): void => {
    for (const e of readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === ".git" || e.name === ".fullmark.lock") continue;
      const rel = prefix === "" ? e.name : `${prefix}/${e.name}`;
      if (e.isDirectory()) walk(join(at, e.name), rel);
      else out.set(rel, readFileSync(join(at, e.name)).toString("base64"));
    }
  };
  walk(dir, "");
  return out;
}
