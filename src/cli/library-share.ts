import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { FONT_CHOICES } from "../core/fonts";
import { libraryPaths, shortHash } from "../library/layout";
import { profileToml } from "../library/profile-toml";
import { type BuildIo, type BuildOptions, runBuild } from "./build";
import { EXIT, type ExitCode } from "./exit-codes";
import {
  findQuiz,
  type LibraryIo,
  libraryFail,
  loadStored,
  noSuchQuiz,
  openLibrary,
  painterFor,
  pickVersion,
  storedProfile,
} from "./library-common";
import { shownPath } from "./paths";
import { plural } from "./table";

export type LibraryShareOptions = {
  /** `-o`: the folder the page or the editable folder goes into; null: the working directory */
  output: string | null;
  /** `--version`: a hash or a prefix of at least 4 characters; null: the current version */
  version: string | null;
  /** `--source`: the editable folder, not the page */
  source: boolean;
  fonts: string | null;
  json: boolean;
  plain: boolean;
  /** the program's version, for the page's footer */
  program: string;
};

/** `LibraryIo` with what `build` needs: the page runtime and the clock, which tests control. */
export type ShareIo = LibraryIo & BuildIo;

/** Every file under a folder, as paths relative to it with `/`, sorted. */
function filesUnder(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * `quiz library share NAME [-o DIR] [--version HASH] [--source] [--json]` (COMMANDS.md; STEP4-GAPS.md, G35, G36): the
 * clean offline page `DIR/NAME.html`, or with `--source` the editable folder `DIR/NAME/`. It reads the library and
 * writes nothing in it: no lock, no commit.
 */
export async function runLibraryShare(name: string, opts: LibraryShareOptions, io: ShareIo): Promise<ExitCode> {
  const p = painterFor(io, opts);
  const out = opts.json ? io.err : io.out;
  if (opts.fonts !== null && !(FONT_CHOICES as readonly string[]).includes(opts.fonts))
    return libraryFail(io, opts.json, `--fonts ${opts.fonts} is not one of quiz, all, none`);
  if (opts.source && opts.fonts !== null)
    return libraryFail(io, opts.json, "--fonts goes with the page, not with --source");
  const opened = openLibrary(io, opts.json);
  if ("exit" in opened) return opened.exit;
  const { root } = opened.located;
  const quiz = findQuiz(opened.index, name);
  if (quiz === undefined) return noSuchQuiz(io, opts.json, opened.index, name);
  const picked = pickVersion(io, opts.json, quiz, opts.version);
  if ("exit" in picked) return picked.exit;
  const hash = picked.hash;
  const short = shortHash(
    hash,
    quiz.versions.map((v) => v.hash),
  );
  const loaded = loadStored(root, quiz, hash);
  if (loaded === null || loaded.quiz === null || loaded.hash === null)
    return libraryFail(io, opts.json, `version ${short} of ${quiz.name} cannot be read from the library`, {
      fix: "run `quiz library status` to see what is wrong",
    });
  const folder = libraryPaths(root).quiz(quiz.id).version(hash);
  const profile = storedProfile(root, quiz, hash);

  const dir = resolve(io.cwd, opts.output ?? ".");
  if (existsSync(dir) && !statSync(dir).isDirectory())
    return libraryFail(io, opts.json, `-o ${opts.output} is a file, and a folder is needed`);

  if (opts.source) {
    const target = join(dir, quiz.name);
    const shown = shownPath(target, io.cwd);
    // G36: an existing, non-empty folder is never overwritten, so an edited copy is safe
    if (existsSync(target)) {
      let held = true;
      try {
        held = (await readdir(target)).length > 0;
      } catch {
        held = true;
      }
      if (held)
        return libraryFail(io, opts.json, `${shown} already exists and is not empty`, {
          fix: `choose another -o, or remove ${shown}`,
        });
    }
    const files = filesUnder(folder).filter((f) => f !== "check.json");
    const toml = profile === null ? null : profileToml(profile);
    // written beside the target, then renamed into place: a killed run leaves no half-written folder under its name
    const temp = join(dir, `.${quiz.name}.${process.pid}.tmp`);
    try {
      await rm(temp, { recursive: true, force: true });
      for (const rel of files) {
        const at = join(temp, ...rel.split("/"));
        await mkdir(dirname(at), { recursive: true });
        await writeFile(at, readFileSync(join(folder, ...rel.split("/"))));
      }
      if (toml !== null) await writeFile(join(temp, "fullmark.toml"), toml);
      await mkdir(temp, { recursive: true });
      await rm(target, { recursive: true, force: true });
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { recursive: true, force: true }).catch(() => undefined);
      return libraryFail(io, opts.json, `cannot write ${shown}: ${(error as Error).message}`);
    }
    const version = quiz.versions.find((v) => v.hash === hash);
    const sourceName = version?.file ?? loaded.file;
    const assets = files.filter((f) => f !== sourceName && f !== "brief.yaml");
    const parts = [
      sourceName,
      ...(assets.length > 0 ? [plural(assets.length, "asset")] : []),
      ...(files.includes("brief.yaml") ? ["brief.yaml"] : []),
      ...(toml !== null ? ["fullmark.toml"] : []),
    ];
    if (opts.json) io.out(JSON.stringify({ status: "written", path: `${shown}/`, version: hash, source: true }));
    out(`${p.green("written")} ${shown}/ · ${parts.join(", ")} · version ${short}`);
    out(p.dim(`next: edit it, then quiz library register ${shown}/${sourceName} --update ${quiz.name}`));
    return EXIT.done;
  }

  // the page: `quiz build` of the stored source, under the profile it was registered with
  await mkdir(dir, { recursive: true });
  const page = join(dir, `${quiz.name}.html`);
  const build: BuildOptions = {
    profile: null,
    config: null,
    strict: false,
    output: page,
    builtAt: null,
    uiLang: null,
    fonts: opts.fonts,
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
    version: opts.program,
    ...(profile === null ? {} : { fixed: profile }),
  };
  const lines: string[] = [];
  const exit = await runBuild([loaded.file], build, { ...io, out: (t) => lines.push(t), err: (t) => io.err(t) });
  if (exit !== EXIT.done) {
    for (const l of lines) io.err(l);
    return exit;
  }
  // `build`'s own "wrote" line is replaced by this command's. The quiz's findings were told when it was registered, and
  // their paths are inside the library; only what the build itself found (a page over its size, a font not embedded) stays
  let keep = false;
  for (const l of lines.slice(0, -1)) {
    if (!l.startsWith("    ")) keep = /: (warning|error|info) build\./.test(l);
    if (keep) io.err(l);
  }
  const shown = shownPath(page, io.cwd);
  const bytes = statSync(page).size;
  if (opts.json) io.out(JSON.stringify({ status: "written", path: shown, version: hash, source: false }));
  out(`${p.green("written")} ${shown} · version ${short} · ${Math.round(bytes / 1000)} KB`);
  return EXIT.done;
}
