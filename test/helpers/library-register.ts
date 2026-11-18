import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LibraryIo } from "../../src/cli/library-common";
import { runLibraryInit } from "../../src/cli/library-init";
import { type LibraryRegisterOptions, runLibraryRegister } from "../../src/cli/library-register";
import { capture } from "./cli";
import { libraryEnv, NOW, tempDir } from "./library";

/** A quiz file: `questions` are `[id, prompt]` pairs of single-choice questions with explanations. */
export function quizText(id: string, title: string, questions: readonly [string, string][], extra = ""): string {
  const body = questions
    .map(
      ([qid, prompt]) =>
        `## ${prompt} {type=single id=${qid}}\n\n- [x] The right one\n- [ ] A wrong one\n- [ ] Another wrong one\n\n::: explanation\nThe first choice is the right one here.\n:::\n`,
    )
    .join("\n");
  return `---\ntitle: ${title}\nid: ${id}\n${extra}---\n\n${body}`;
}

export const registerOptions = (o: Partial<LibraryRegisterOptions> = {}): LibraryRegisterOptions => ({
  name: null,
  update: null,
  buildFile: null,
  profile: null,
  config: null,
  strict: false,
  review: null,
  json: false,
  plain: true,
  ...o,
});

/** A temporary folder with a library in `lib/`, made by `library init` with real git and the fixed clock. */
export async function newLibrary(options: { identity?: boolean } = {}) {
  const dir = tempDir();
  const env = libraryEnv(dir, options);
  const lib = join(dir, "lib");
  const at = (cwd: string = dir) => {
    const c = capture(cwd, env);
    const io: LibraryIo = { ...c.io, now: () => new Date(NOW) };
    return { io, out: c.out, err: c.err };
  };
  const init = at();
  await runLibraryInit("lib", { force: false, noGit: false, json: false, plain: true }, init.io);
  const write = (files: Record<string, string>): void => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  };
  const register = async (files: string[], o: Partial<LibraryRegisterOptions> = {}, extra: Partial<LibraryIo> = {}) => {
    const c = at();
    const exit = await runLibraryRegister(files, registerOptions(o), { ...c.io, ...extra });
    return { exit, out: c.out, err: c.err };
  };
  return { dir, env, lib, write, register, at };
}
