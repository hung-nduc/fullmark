import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStored } from "../src/cli/library-common";
import { runLibraryStatus } from "../src/cli/library-status";
import { loadQuiz } from "../src/cli/load";
import { localIso } from "../src/cli/time";
import { readCheck } from "../src/library/check-file";
import { readIndex } from "../src/library/index-file";
import { gitHeavy } from "./helpers/git-timeout";
import { cleanTemps, git, NOW } from "./helpers/library";
import { newLibrary, quizText } from "./helpers/library-register";

gitHeavy(); // a git call costs about 225 ms on Windows: see test/helpers/git-timeout.ts

afterEach(cleanTemps);

const index = (lib: string) => {
  const read = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  return read.index;
};
const log = async (lib: string, env: Record<string, string>) =>
  (await git(lib, env, "log", "--format=%s")).split("\n").filter(Boolean);
const files = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      join(e.parentPath, e.name)
        .slice(dir.length + 1)
        .replaceAll("\\", "/"),
    )
    .sort();

const A: [string, string][] = [
  ["q1", "First question"],
  ["q2", "Second question"],
  ["q3", "Third question"],
];

describe("library register: one file", () => {
  it("registers a new quiz: the files of the version, the index and one commit", async () => {
    const t = await newLibrary();
    t.write({
      "notes/rust.md": quizText("rust", "Rust basics", A, "materials:\n  - sheet.md\n"),
      "notes/sheet.md": "# Formulas\n\nNothing here.\n",
      "notes/brief.yaml": "purpose: practice\n",
    });
    const r = await t.register(["notes/rust.md"]);
    expect(r.exit).toBe(0);
    const hash = index(t.lib).quizzes[0]?.current as string;
    const head = (await git(t.lib, t.env, "rev-parse", "--short", "HEAD")).trim();
    expect(r.out.slice(-2)).toEqual([
      `registered rust-basics, a new quiz · version ${hash.slice(0, 4)} · 3 questions`,
      `committed ${head} fullmark: register rust-basics`,
    ]);
    expect(index(t.lib).quizzes).toEqual([
      {
        name: "rust-basics",
        id: "rust",
        title: "Rust basics",
        source: join(t.dir, "notes", "rust.md"),
        current: hash,
        versions: [{ hash, added: localIso(new Date(NOW)), file: "rust.md" }],
        shelves: [],
      },
    ]);
    const version = join(t.lib, "quizzes", "rust", "versions", hash);
    expect(files(version)).toEqual(["brief.yaml", "check.json", "rust.md", "sheet.md"]);
    expect(readFileSync(join(version, "rust.md"), "utf8")).toBe(readFileSync(join(t.dir, "notes/rust.md"), "utf8"));
    // what is stored is what was hashed: the stored folder loads to the same hash
    expect(loadQuiz(join(version, "rust.md")).hash).toBe(hash);
    expect(await log(t.lib, t.env)).toEqual(["fullmark: register rust-basics", "fullmark: init"]);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("commits only the paths it wrote, so the user's own staged change stays out", async () => {
    const t = await newLibrary();
    writeFileSync(join(t.lib, "mine.txt"), "mine\n");
    await git(t.lib, t.env, "add", "mine.txt");
    t.write({ "a.md": quizText("a", "Alpha", A) });
    await t.register(["a.md"]);
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).split("\n").filter(Boolean)).toEqual([
      "library.toml",
      expect.stringMatching(/^quizzes\/a\/versions\/[0-9a-f]{64}\/(a\.md|check\.json)$/),
      expect.stringMatching(/^quizzes\/a\/versions\/[0-9a-f]{64}\/(a\.md|check\.json)$/),
    ]);
    expect((await git(t.lib, t.env, "status", "--porcelain")).trim()).toBe("A  mine.txt");
  });

  it("names a new quiz by -n, else its slugged title, else its id", async () => {
    const t = await newLibrary();
    t.write({
      "a.md": quizText("alpha", "Alpha beta", A),
      "b.md": quizText("bravo", "Bravo", A),
      "c.md": quizText("charlie", '"!!!"', A),
    });
    await t.register(["a.md"]);
    await t.register(["b.md"], { name: "my-bravo" });
    await t.register(["c.md"]);
    expect(index(t.lib).quizzes.map((q) => q.name)).toEqual(["alpha-beta", "charlie", "my-bravo"]);
  });

  it("is unchanged when the file is the quiz's current version, by its source", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    await t.register(["a.md"]);
    const before = await log(t.lib, t.env);
    const r = await t.register(["a.md"]);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toMatch(/^unchanged alpha · version [0-9a-f]{4}$/);
    expect(await log(t.lib, t.env)).toEqual(before);
  });

  it("refuses a file registered before and edited since, naming the --update command", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    await t.register(["a.md"]);
    t.write({ "a.md": quizText("alpha", "Alpha", [...A, ["q4", "Fourth question"]]) });
    const r = await t.register(["a.md"]);
    expect(r.exit).toBe(1);
    expect(r.out).toEqual([
      "a.md: error library.edited: registered before as alpha and edited since",
      "    fix: quiz library register a.md --update alpha",
      "nothing registered 0 of 1 file ready, 1 refused",
    ]);
  });

  it("refuses an id that is already in the library, with both fixes", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A), "other/b.md": quizText("alpha", "Other", A) });
    await t.register(["a.md"]);
    const r = await t.register(["other/b.md"]);
    expect(r.exit).toBe(1);
    expect(r.out).toEqual([
      "other/b.md:3: error library.id-taken: the id alpha is already in the library, as alpha",
      "    fix: if it is the same quiz, quiz library register other/b.md --update alpha;",
      "         if not, give it a new `id:` in its front matter",
      "nothing registered 0 of 1 file ready, 1 refused",
    ]);
  });

  it("refuses a name that is taken (another quiz's name or id) and suggests a free one", async () => {
    const t = await newLibrary();
    t.write({
      "a.md": quizText("alpha", "Rust basics", A),
      "b.md": quizText("bravo", "Rust basics", A),
      "c.md": quizText("rust-basics-2", "Other", A),
      "d.md": quizText("delta", "Rust basics", A),
    });
    await t.register(["a.md"]);
    const one = await t.register(["b.md"]);
    expect(one.exit).toBe(1);
    expect(one.out[0]).toBe("b.md: error library.name-taken: the name rust-basics is taken");
    expect(one.out[1]).toBe("    fix: -n rust-basics-2");
    // -2 is taken as an id of another quiz: the next number
    await t.register(["c.md"]);
    const next = await t.register(["d.md"]);
    expect(next.out[1]).toBe("    fix: -n rust-basics-3");
    // a name may equal the quiz's own id
    const ok = await t.register(["b.md"], { name: "bravo" });
    expect(ok.exit).toBe(0);
  });

  it("refuses a name that is not a slug before doing anything (exit 2)", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    const r = await t.register(["a.md"], { name: "Not A Slug" });
    expect(r.exit).toBe(2);
    expect(r.err[0]).toBe("error: Not A Slug is not a valid name");
    expect(index(t.lib).quizzes).toEqual([]);
  });

  it("refuses a survey with library.survey, and a quiz with check errors with its findings", async () => {
    const t = await newLibrary();
    t.write({
      "s.md":
        "---\ntitle: Feedback\nkind: survey\nid: feedback\n---\n\n## How was it? {type=scale id=how}\n\n```answer\nlabels:\n  1: Bad\n  5: Good\n```\n",
      "bad.md": "---\ntitle: Bad\nid: bad\n---\n\n## No id here {type=single}\n\n- [x] a\n- [ ] b\n",
    });
    const s = await t.register(["s.md"]);
    expect(s.exit).toBe(1);
    expect(s.out[0]).toMatch(/^s\.md:3: error library\.survey: /);
    const bad = await t.register(["bad.md"]);
    expect(bad.exit).toBe(1);
    expect(bad.out.join("\n")).toMatch(/bad\.md:\d+: error question\.id-missing: /);
    expect(bad.out.at(-1)).toBe("nothing registered 0 of 1 file ready, 1 refused");
    expect(index(t.lib).quizzes).toEqual([]);
  });

  it("looks up the config from the file, then from the library root", async () => {
    const t = await newLibrary();
    writeFileSync(
      join(t.lib, "fullmark.toml"),
      '[profiles.strictish.rules]\n"explanation.short" = "error"\n[check]\nprofile = "strictish"\n',
    );
    t.write({
      "free/a.md": quizText("alpha", "Alpha", A).replace("The first choice is the right one here.", "Short one."),
    });
    // `free/` has no fullmark.toml above it before the temp folder's root: the library's applies
    const r = await t.register(["free/a.md"]);
    expect(r.exit).toBe(1);
    expect(r.out.join("\n")).toContain("explanation.short");
    // a config beside the file wins
    t.write({ "free/fullmark.toml": '[check]\nprofile = "default"\n' });
    const again = await t.register(["free/a.md"]);
    expect(again.exit).toBe(0);
    const stored = readCheck(
      readFileSync(
        join(t.lib, "quizzes", "alpha", "versions", index(t.lib).quizzes[0]?.current as string, "check.json"),
        "utf8",
      ),
    );
    expect(stored.ok && stored.profile.name).toBe("default");
  });
});

describe("library register: --update", () => {
  const v1 = quizText("alpha", "Alpha", A);
  const v2 = quizText("alpha", "Alpha", [
    ["q1", "First question, edited"],
    ["q2", "Second question"],
    ["q4", "Fourth question"],
  ]);

  it("adds a version: what changed against the one before, and the new current", async () => {
    const t = await newLibrary();
    t.write({ "a.md": v1 });
    await t.register(["a.md"]);
    const first = index(t.lib).quizzes[0]?.current as string;
    t.write({ "a.md": v2 });
    const r = await t.register(["a.md"], { update: "alpha" });
    expect(r.exit).toBe(0);
    const q = index(t.lib).quizzes[0];
    expect(q?.versions.map((v) => v.hash)).toEqual([first, q?.current]);
    expect(r.out[0]).toBe(
      `registered alpha · version ${q?.current.slice(0, 4)} (was ${first.slice(0, 4)}) · 1 added, 1 removed, 1 changed`,
    );
    // the old version stays as it was
    expect(existsSync(join(t.lib, "quizzes", "alpha", "versions", first, "a.md"))).toBe(true);
    expect(await log(t.lib, t.env)).toEqual(["fullmark: register alpha", "fullmark: register alpha", "fullmark: init"]);
  });

  it("records each version's file name (G22): a quiz updated from another file name reads and stays healthy", async () => {
    const t = await newLibrary();
    t.write({ "quiz.md": v1 });
    await t.register(["quiz.md"]);
    t.write({ "week2.md": v2 });
    const r = await t.register(["week2.md"], { update: "alpha" });
    expect(r.exit).toBe(0);
    const q = index(t.lib).quizzes[0];
    expect(q?.versions.map((v) => v.file)).toEqual(["quiz.md", "week2.md"]);
    expect(readFileSync(join(t.lib, "library.toml"), "utf8")).toContain('file = "quiz.md" }, { hash');
    for (const v of q?.versions ?? []) expect(loadStored(t.lib, q as NonNullable<typeof q>, v.hash)?.hash).toBe(v.hash);
    const c = t.at();
    expect(await runLibraryStatus({ json: false, plain: true }, c.io)).toBe(0);
    expect(c.out.join("\n")).toContain("2 of 2 match");
  });

  it("is unchanged for the current version, and makes an earlier version current again without a new folder", async () => {
    const t = await newLibrary();
    t.write({ "a.md": v1 });
    await t.register(["a.md"]);
    const first = index(t.lib).quizzes[0]?.current as string;
    t.write({ "a.md": v2 });
    await t.register(["a.md"], { update: "alpha" });
    const same = await t.register(["a.md"], { update: "alpha" });
    expect(same.out[0]).toMatch(/^unchanged alpha · version /);
    t.write({ "a.md": v1 });
    const back = await t.register(["a.md"], { update: "alpha" });
    expect(back.exit).toBe(0);
    expect(back.out[0]).toMatch(/· an earlier version, now current again$/);
    const q = index(t.lib).quizzes[0];
    expect(q?.current).toBe(first);
    expect(q?.versions).toHaveLength(2);
    expect(readdirSync(join(t.lib, "quizzes", "alpha", "versions"))).toHaveLength(2);
  });

  it("refuses another quiz's file (library.id-mismatch) and an unknown name (exit 2)", async () => {
    const t = await newLibrary();
    t.write({ "a.md": v1, "b.md": quizText("bravo", "Bravo", A) });
    await t.register(["a.md"]);
    const bad = await t.register(["b.md"], { update: "alpha" });
    expect(bad.exit).toBe(1);
    expect(bad.out[0]).toMatch(/^b\.md:3: error library\.id-mismatch: /);
    const unknown = await t.register(["a.md"], { update: "alph" });
    expect(unknown.exit).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named alph", "    did you mean: alpha"]);
  });

  it("applies the quiz's stored review: a flagged question refuses the version until it changes (G16)", async () => {
    const t = await newLibrary();
    t.write({ "a.md": v1 });
    await t.register(["a.md"]);
    const loaded = loadQuiz(join(t.dir, "a.md"));
    const q2 = loaded.quiz?.sections[0]?.questions.find((q) => q.id === "q2");
    writeFileSync(
      join(t.lib, "quizzes", "alpha", "review.json"),
      JSON.stringify({
        format: "fullmark-review",
        version: 2,
        quizId: "alpha",
        quizHash: loaded.hash,
        reviewedAt: "2026-11-17T10:00:00+00:00",
        questions: { q2: { verdict: "fix", reasons: ["unclear"], note: "", hash: q2?.hash, source: "x" } },
      }),
    );
    // an edit that leaves q2 alone is refused
    t.write({ "a.md": v1.replace("First question", "First question, edited") });
    const refused = await t.register(["a.md"], { update: "alpha" });
    expect(refused.exit).toBe(1);
    expect(refused.out.join("\n")).toContain("review.fix");
    // changing q2 lets it through (with the unconfirmed warning)
    t.write({ "a.md": v1.replace("Second question", "Second question, clearer") });
    const ok = await t.register(["a.md"], { update: "alpha" });
    expect(ok.exit).toBe(0);
    expect(ok.out.join("\n")).toContain("review.unconfirmed");
  });

  it("warns of an attempt saved on the old version, and exits 0 (G17)", async () => {
    const t = await newLibrary();
    t.write({ "a.md": v1 });
    await t.register(["a.md"]);
    const first = index(t.lib).quizzes[0]?.current as string;
    mkdirSync(join(t.lib, "quizzes", "alpha", "progress"), { recursive: true });
    writeFileSync(
      join(t.lib, "quizzes", "alpha", "progress", `${first}.json`),
      JSON.stringify({
        format: "fullmark-results",
        version: 2,
        quizHash: first,
        plan: { source: "full", questions: ["q1", "q2", "q3"] },
        state: {
          answers: { q1: { choice: 0 }, q2: { choice: 1 } },
          startedAt: "2026-11-18T14:02:00",
          submittedAt: null,
          timeUsed: 60,
          sectionTime: {},
          flagged: [],
          checked: [],
          timedOut: false,
        },
        phase: "answering",
      }),
    );
    t.write({ "a.md": v2 });
    const r = await t.register(["a.md"], { update: "alpha" });
    expect(r.exit).toBe(0);
    expect(r.out.slice(1, 3)).toEqual([
      `warning an attempt in progress on ${first.slice(0, 4)} (2 of 3 answered, 18 Nov 14:02) stays on that version`,
      "    the next quiz library take alpha resumes it there (G17)",
    ]);
  });
});

describe("library register: several files, all or nothing", () => {
  it("registers every file with one commit naming them sorted", async () => {
    const t = await newLibrary();
    t.write({
      "n/b.md": quizText("bravo", "Bravo", A),
      "n/a.md": quizText("alpha", "Alpha", A),
      "n/c.md": quizText("charlie", "Charlie", A),
    });
    const r = await t.register(["n/b.md", "n/a.md", "n/c.md"]);
    expect(r.exit).toBe(0);
    expect(r.out[0]).toMatch(
      /^registered 3 bravo \(new, [0-9a-f]{4}\) · alpha \(new, [0-9a-f]{4}\) · charlie \(new, [0-9a-f]{4}\)$/,
    );
    expect(await log(t.lib, t.env)).toEqual(["fullmark: register alpha, bravo, charlie", "fullmark: init"]);
    // run again: all three are unchanged, nothing is committed
    const again = await t.register(["n/b.md", "n/a.md", "n/c.md"]);
    expect(again.out).toEqual(["unchanged 3  alpha, bravo, charlie"]);
    expect(await log(t.lib, t.env)).toHaveLength(2);
  });

  it("writes nothing when any file is refused, and lists every problem", async () => {
    const t = await newLibrary();
    t.write({
      "ok.md": quizText("fine", "Fine", A),
      "dup-id.md": quizText("fine", "Another", A),
      "dup-name.md": quizText("other", "Fine", A),
      "bad.md": "---\ntitle: Bad\nid: bad\n---\n\n## No id {type=single}\n\n- [x] a\n- [ ] b\n",
    });
    const before = await log(t.lib, t.env);
    const r = await t.register(["ok.md", "dup-id.md", "dup-name.md", "bad.md"]);
    expect(r.exit).toBe(1);
    expect(r.out.filter((l) => /error /.test(l)).map((l) => l.replace(/^[^ ]+ error /, ""))).toEqual([
      "library.id-taken: the id fine is already used by ok.md in this batch",
      "library.name-taken: the name fine is taken",
      expect.stringMatching(/^question\.id-missing: /),
    ]);
    expect(r.out.at(-1)).toBe("nothing registered 1 of 4 files ready, 3 refused");
    expect(index(t.lib).quizzes).toEqual([]);
    expect(existsSync(join(t.lib, "quizzes", "fine"))).toBe(false);
    expect(await log(t.lib, t.env)).toEqual(before);
  });

  it("-n, --update and --review with several files exit 2", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("a", "A", A), "b.md": quizText("b", "B", A) });
    expect((await t.register(["a.md", "b.md"], { name: "x" })).exit).toBe(2);
    expect((await t.register(["a.md", "b.md"], { update: "x" })).exit).toBe(2);
    expect((await t.register(["a.md", "b.md"], { review: "r.json" })).exit).toBe(2);
    expect(index(t.lib).quizzes).toEqual([]);
  });

  it("a missing file is an input error (exit 2) before anything is checked", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("a", "A", A) });
    const r = await t.register(["a.md", "missing.md"]);
    expect(r.exit).toBe(2);
    expect(index(t.lib).quizzes).toEqual([]);
  });
});

describe("library register: --build-file", () => {
  it("registers the files of the entries once each, and narrows to the FILEs given", async () => {
    const t = await newLibrary();
    t.write({
      "b/a.md": quizText("alpha", "Alpha", A),
      "b/b.md": quizText("bravo", "Bravo", A),
      "b/build.toml":
        '[[build]]\nfiles = ["a.md", "b.md"]\n\n[[build]]\nfiles = ["a.md"]\nprint = true\nout = "paper"\n',
    });
    const some = await t.register(["b/b.md"], { buildFile: "b/build.toml" });
    expect(some.exit).toBe(0);
    expect(index(t.lib).quizzes.map((q) => q.name)).toEqual(["bravo"]);
    const rest = await t.register([], { buildFile: "b/build.toml" });
    expect(rest.exit).toBe(0);
    expect(rest.out[0]).toMatch(/^registered 1 alpha \(new, /);
    expect(rest.out[1]).toBe("unchanged 1  bravo");
  });

  it("a file in several entries with different profile, config or strict exits 2", async () => {
    const t = await newLibrary();
    t.write({
      "b/a.md": quizText("alpha", "Alpha", A),
      "b/build.toml":
        '[[build]]\nfiles = ["a.md"]\nprofile = "exam"\n\n[[build]]\nfiles = ["a.md"]\nprint = true\nout = "paper"\n',
    });
    const r = await t.register([], { buildFile: "b/build.toml" });
    expect(r.exit).toBe(2);
    expect(r.err[0]).toContain("is in several entries");
    expect(index(t.lib).quizzes).toEqual([]);
  });
});

describe("library register: a writer killed mid-way", () => {
  it("leaves the library as it was when library.toml cannot be written, and removes what it made", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    const before = readFileSync(join(t.lib, "library.toml"), "utf8");
    const r = await t.register(["a.md"], {}, { atomic: () => Promise.reject(new Error("killed")) });
    expect(r.exit).toBe(2);
    expect(r.err[0]).toBe("error: cannot write the library: killed");
    expect(readFileSync(join(t.lib, "library.toml"), "utf8")).toBe(before);
    expect(existsSync(join(t.lib, "quizzes", "alpha", "versions", ""))).toBe(true);
    expect(readdirSync(join(t.lib, "quizzes", "alpha", "versions"))).toEqual([]);
    expect(await log(t.lib, t.env)).toEqual(["fullmark: init"]);
    // and the next run goes through
    expect((await t.register(["a.md"])).exit).toBe(0);
  });

  it("a folder or a *.tmp left by a run that was really killed is cleaned up by the next register", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    await t.register(["a.md"], {}, { atomic: () => Promise.reject(new Error("killed")) });
    const versions = join(t.lib, "quizzes", "alpha", "versions");
    const hash = "c".repeat(64);
    mkdirSync(join(versions, `.${hash}.deadbeef.tmp`, "half"), { recursive: true });
    writeFileSync(join(versions, `.${hash}.deadbeef.tmp`, "half", "x.md"), "half");
    // a version folder made but never named by the index: the library is still as it was
    expect(index(t.lib).quizzes).toEqual([]);
    expect((await t.register(["a.md"])).exit).toBe(0);
    expect(readdirSync(versions).filter((n) => n.endsWith(".tmp"))).toEqual([]);
    expect(readdirSync(versions)).toHaveLength(1);
    rmSync(join(t.dir, "a.md"));
  });

  it("replaces an orphan folder of the same hash that a killed run left under its own name", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    const hash = loadQuiz(join(t.dir, "a.md")).hash as string;
    mkdirSync(join(t.lib, "quizzes", "alpha", "versions", hash), { recursive: true });
    writeFileSync(join(t.lib, "quizzes", "alpha", "versions", hash, "stray.txt"), "left behind");
    expect((await t.register(["a.md"])).exit).toBe(0);
    expect(files(join(t.lib, "quizzes", "alpha", "versions", hash))).toEqual(["a.md", "check.json"]);
  });
});

describe("library register: the library's lock and git", () => {
  it("is busy while another command holds the library (exit 2, one waiting line)", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    writeFileSync(
      join(t.lib, ".fullmark.lock"),
      `${JSON.stringify({ pid: 48300, command: "quiz library register notes/*.md", started: "2026-11-18T14:21:50+00:00" })}\n`,
    );
    let clock = Date.parse("2026-11-18T14:22:00+00:00");
    const r = await t.register(
      ["a.md"],
      {},
      {
        lock: {
          now: () => new Date(clock),
          sleep: async (ms) => {
            clock += ms;
          },
          alive: () => true,
          pid: 1,
          waitMs: 10_000,
          pollMs: 100,
        },
      },
    );
    expect(r.exit).toBe(2);
    expect(r.err).toEqual([
      "waiting for the library: quiz library register notes/*.md (pid 48300) holds the lock",
      "error: the library is busy: quiz library register notes/*.md (pid 48300) has held it for 20 s",
      "    fix: run the command again when it finishes",
    ]);
    expect(index(t.lib).quizzes).toEqual([]);
  });

  it("a failed commit is a warning: the files stay written, exit 0", async () => {
    const t = await newLibrary();
    t.write({ "a.md": quizText("alpha", "Alpha", A) });
    const { realGitExec } = await import("../src/library/git");
    const r = await t.register(
      ["a.md"],
      {},
      {
        gitExec: (bin: string, args: string[], e: Record<string, string | undefined>) =>
          args.includes("commit")
            ? Promise.resolve({ code: 1, stdout: "", stderr: "error: gpg failed\n" })
            : realGitExec(bin, args, e),
      },
    );
    expect(r.exit).toBe(0);
    expect(r.out).toContain("warning the commit failed: error: gpg failed; the files are written");
    expect(index(t.lib).quizzes).toHaveLength(1);
  });
});
