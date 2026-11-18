import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryIo } from "../src/cli/library-common";
import { readHistory } from "../src/cli/library-history";
import { runLibraryInfo } from "../src/cli/library-info";
import { runLibraryList } from "../src/cli/library-list";
import { readIndex } from "../src/library/index-file";
import { capture } from "./helpers/cli";
import { cleanTemps, NOW } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

afterEach(cleanTemps);

const quizOf = (lib: string, name: string) => {
  const read = readIndex(readFileSync(join(lib, "library.toml"), "utf8"));
  if (!read.ok) throw new Error("bad index");
  const q = read.index.quizzes.find((x) => x.name === name);
  if (!q) throw new Error(`no quiz ${name}`);
  return q;
};

async function setup() {
  const h = await buildHistory();
  const run = async <T>(fn: (io: LibraryIo) => T | Promise<T>, tty = false, colour = false) => {
    const { NO_COLOR: _off, ...withColour } = h.env;
    const c = capture(h.dir, colour ? withColour : h.env);
    const io: LibraryIo = { ...c.io, tty, now: () => new Date(NOW) };
    const exit = await fn(io);
    return { exit, out: c.out, err: c.err };
  };
  return { ...h, run };
}

describe("the attempts of a quiz (library-history)", () => {
  it("takes a score from the newest report when there is one, else grades the attempt on the spot", async () => {
    const t = await setup();
    const history = readHistory(t.lib, quizOf(t.lib, "study-fixture"));
    expect(history.attempts.map((a) => a.stamp)).toEqual([
      "20261003-100000",
      "20261010-100000",
      "20261017-100000",
      "20261024-100000",
      "20261031-100000",
      "20261105-190300",
      "20261116-201412",
    ]);
    // a report was filed for the first and the fourth: its score, not a re-grade (the fixtures' own numbers)
    expect(history.attempts[0]?.percent).toBe(50);
    expect(history.attempts[3]?.percent).toBe(72.06);
    // the retry of four single-choice and true/false questions, all right, graded on the spot
    expect(history.attempts[4]?.percent).toBe(100);
    expect(history.attempts[4]?.report).not.toBeNull();
    expect(history.best).toBe(100);
    // the last attempt is the one on the third version, with an essay nobody has graded
    expect(history.last?.stamp).toBe("20261116-201412");
    expect(history.last?.pending).toEqual({ essay: 1, code: 0 });
    expect(history.score).toBe(history.last?.percent);
    expect(history.taken).toBe("2026-11-16T20:14:12");
    expect(history.firstTaken).toBe("2026-10-03T10:00:00");
    // the attempts waiting for a grader: the ones with an essay and no report of grades
    expect(history.ungraded.map((a) => a.stamp)).toEqual(["20261010-100000", "20261017-100000", "20261116-201412"]);
    expect(history.weak.length).toBeLessThanOrEqual(3);
  });

  it("a quiz nobody has taken has no history", async () => {
    const t = await setup();
    const history = readHistory(t.lib, quizOf(t.lib, "limits-and-continuity"));
    expect(history).toEqual({
      attempts: [],
      last: null,
      score: null,
      best: null,
      taken: null,
      firstTaken: null,
      weak: [],
      ungraded: [],
    });
  });
});

describe("library list", () => {
  it("--json has every field of the row, sorted by name", async () => {
    const t = await setup();
    const r = await t.run((io) => runLibraryList({ json: true, plain: true }, io));
    expect(r.exit).toBe(0);
    const body = JSON.parse(r.out[0] as string);
    expect(body.quizzes.map((q: { name: string }) => q.name)).toEqual(["limits-and-continuity", "study-fixture"]);
    const fields = [
      "name",
      "id",
      "title",
      "kind",
      "lang",
      "profile",
      "tags",
      "types",
      "shelves",
      "questions",
      "points",
      "versions",
      "attempts",
      "score",
      "best",
      "weak",
      "added",
      "updated",
      "taken",
      "changed",
      "ungraded",
      "flagged",
    ];
    for (const q of body.quizzes) expect(Object.keys(q)).toEqual(fields);
    expect(body.quizzes[0]).toMatchObject({
      attempts: 0,
      score: null,
      best: null,
      weak: [],
      taken: null,
      ungraded: false,
      versions: 1,
    });
    expect(body.quizzes[1]).toMatchObject({
      id: "study",
      kind: "quiz",
      lang: "en",
      profile: "default",
      tags: ["logic", "numbers", "writing"],
      types: ["essay", "single", "truefalse"],
      questions: 7,
      points: 17,
      versions: 3,
      attempts: 7,
      best: 100,
      added: "2026-10-01",
      updated: "2026-11-10",
      taken: "2026-11-16",
      changed: false,
      ungraded: true,
      flagged: 0,
    });
  });

  it("marks a source that changed since the current version, and the open review flags, in NOTES", async () => {
    const t = await setup();
    const text = readFileSync(join(t.dir, t.quizPath), "utf8");
    writeFileSync(join(t.dir, t.quizPath), `${text}\n## Added later {type=single id=later}\n\n- [x] a\n- [ ] b\n`);
    const r = await t.run((io) => runLibraryList({ json: false, plain: true }, io));
    const row = r.out.find((l) => l.startsWith("study-fixture")) as string;
    // the notes come in the order: source changed, N ungraded, N flagged
    expect(row.endsWith("source changed · 3 ungraded")).toBe(true);
    const json = JSON.parse((await t.run((io) => runLibraryList({ json: true, plain: true }, io))).out[0] as string);
    expect(json.quizzes[1].changed).toBe(true);
  });

  it("draws scores in bands and badges in colour on a terminal, and no escape code without it", async () => {
    const t = await setup();
    const plain = await t.run((io) => runLibraryList({ json: false, plain: false }, io), false);
    expect(plain.out.join("\n")).not.toContain("\u001b[");
    const coloured = await t.run((io) => runLibraryList({ json: false, plain: false }, io), true, true);
    const text = coloured.out.join("\n");
    expect(text).toContain("\u001b[");
    // best 100% is in the green band, the last 15% under 65% is yellow
    expect(text).toContain("\u001b[32m100%\u001b[39m");
    expect(text).toContain("\u001b[33m15%*\u001b[39m");
    const noColour = await t.run((io) => runLibraryList({ json: false, plain: true }, io), true, true);
    expect(noColour.out.join("\n")).not.toContain("\u001b[");
    const env = await t.run((io) => runLibraryList({ json: false, plain: false }, io), true, false);
    expect(env.out.join("\n")).not.toContain("\u001b[");
    expect(noColour.out.join("\n")).not.toContain("\u001b[");
  });

  it("an empty library says so and what to do next", async () => {
    const t = await setup();
    writeFileSync(join(t.lib, "library.toml"), `format = "fullmark-library"\nversion = 2\ncreated = "${NOW}"\n`);
    const r = await t.run((io) => runLibraryList({ json: false, plain: true }, io));
    expect(r.out).toEqual(["0 quizzes · lib", "next: quiz library register FILE"]);
  });
});

describe("library info", () => {
  it("names the versions newest first, each against the one before", async () => {
    const t = await setup();
    const r = await t.run((io) => runLibraryInfo("study", { version: null, json: true, plain: true }, io));
    const body = JSON.parse(r.out[0] as string);
    expect(body.history.map((h: { hash: string }) => h.hash)).toEqual([...t.hashes].reverse());
    expect(body.history.map((h: { added_questions: string[] }) => h.added_questions)).toEqual([
      ["ratio"],
      ["late"],
      [],
    ]);
    expect(body.history.map((h: { removed_questions: string[] }) => h.removed_questions)).toEqual([["odd"], [], []]);
    expect(body.history.map((h: { changed_questions: string[] }) => h.changed_questions)).toEqual([
      ["even"],
      ["prime"],
      [],
    ]);
    expect(body.first_taken).toBe("2026-10-03");
    expect(body.source).toEqual({ path: join(t.dir, "notes", "study.md"), exists: true });
    expect(body.path).toBe(join(t.lib, "quizzes", "study"));
  });

  it("--version describes that version's content, and takes a prefix of 4 or more characters", async () => {
    const t = await setup();
    const second = t.hashes[1] as string;
    const r = await t.run((io) =>
      runLibraryInfo("study", { version: second.slice(0, 6), json: true, plain: true }, io),
    );
    const body = JSON.parse(r.out[0] as string);
    expect(body.questions).toBe(7);
    expect(body.sections).toEqual([
      { slug: "part-one", title: "Part one", questions: 5, points: 5 },
      { slug: "part-two", title: "Part two", questions: 2, points: 12 },
    ]);
    const text = await t.run((io) =>
      runLibraryInfo("study", { version: second.slice(0, 4), json: false, plain: true }, io),
    );
    expect(text.out[0]).toBe(
      `study-fixture · Study fixture · version ${second.slice(0, 4)} (not current: ${t.hashes[2]?.slice(0, 4)} is)`,
    );
    const short = await t.run((io) =>
      runLibraryInfo("study", { version: second.slice(0, 3), json: false, plain: true }, io),
    );
    expect(short.exit).toBe(2);
  });

  it("an ambiguous prefix exits 2 and lists the matches", async () => {
    const t = await setup();
    const a = `abcd${"1".repeat(60)}`;
    const b = `abcd${"2".repeat(60)}`;
    const hash = (h: string) => `{ hash = "${h}", added = "2026-10-01T09:00:00+00:00", file = "twin.md" }`;
    writeFileSync(
      join(t.lib, "library.toml"),
      `format = "fullmark-library"\nversion = 2\ncreated = "${NOW}"\n\n[quizzes.twin]\nid = "twin"\ntitle = "Twin"\nsource = "/nowhere/twin.md"\ncurrent = "${b}"\nversions = [${hash(a)}, ${hash(b)}]\nshelves = []\n`,
    );
    mkdirSync(join(t.lib, "quizzes", "twin"), { recursive: true });
    const r = await t.run((io) => runLibraryInfo("twin", { version: "abcd", json: false, plain: true }, io));
    expect(r.exit).toBe(2);
    expect(r.err[0]).toBe("error: abcd matches 2 versions of twin: abcd1, abcd2");
  });

  it("an unknown quiz exits 2 with the nearest names", async () => {
    const t = await setup();
    const r = await t.run((io) => runLibraryInfo("stud", { version: null, json: false, plain: true }, io));
    expect(r.exit).toBe(2);
    expect(r.err).toEqual(["error: no quiz named stud", "    did you mean: study"]);
  });
});
