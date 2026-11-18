import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type LibraryReplayOptions, type ReplayIo, runLibraryReplay } from "../src/cli/library-replay";
import { cleanTemps, git, NOW, tempDir } from "./helpers/library";
import { buildHistory } from "./helpers/library-history";

afterEach(cleanTemps);

const options = (extra: Partial<LibraryReplayOptions> = {}): LibraryReplayOptions => ({
  attempt: null,
  output: null,
  open: false,
  json: false,
  plain: true,
  fonts: null,
  version: "1.0.0-test",
  ...extra,
});

async function replay(extra: Partial<LibraryReplayOptions> = {}, name = "study-fixture") {
  const h = await buildHistory();
  const tmp = tempDir("fm-tmp-");
  const opened: string[] = [];
  const run = async (o: Partial<LibraryReplayOptions>, before?: () => void) => {
    before?.();
    const c = h.at();
    const io: ReplayIo = { ...c.io, now: () => new Date(NOW), tmpDir: tmp, open: (p) => void opened.push(p) };
    const exit = await runLibraryReplay(name, options({ ...extra, ...o }), io);
    return { exit, out: c.out, err: c.err };
  };
  return { ...h, tmp, opened, run };
}

describe("library replay", () => {
  it("builds the newest attempt into the temp folder's fullmark/, opens it, and writes nothing in the library", async () => {
    const t = await replay({ open: true });
    const before = await git(t.lib, t.env, "status", "--porcelain");
    const r = await t.run({});
    expect(r.exit).toBe(0);
    const page = join(t.tmp, "fullmark", "study-fixture-20261116-201412.html");
    expect(existsSync(page)).toBe(true);
    expect(t.opened).toEqual([page]);
    expect(r.out[1]).toMatch(/^page: .*study-fixture-20261116-201412\.html {2}\(opened in your browser\)$/);
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe(before);
    expect(readdirSync(join(t.lib, "quizzes", "study", "results"))).toHaveLength(7);
  });

  it("clears the pages older than a day from the temp folder first, and only those", async () => {
    const t = await replay();
    const dir = join(t.tmp, "fullmark");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "old.html"), "x");
    writeFileSync(join(dir, "new.html"), "x");
    writeFileSync(join(dir, "notes.txt"), "x");
    const old = new Date(Date.parse(NOW) - 2 * 24 * 3600 * 1000);
    utimesSync(join(dir, "old.html"), old, old);
    utimesSync(join(dir, "notes.txt"), old, old);
    utimesSync(join(dir, "new.html"), new Date(NOW), new Date(NOW));
    await t.run({});
    expect(existsSync(join(dir, "old.html"))).toBe(false);
    expect(existsSync(join(dir, "new.html"))).toBe(true);
    expect(existsSync(join(dir, "notes.txt"))).toBe(true);
  });

  it("takes a prefix of 4 or more characters, and the page is the version the attempt was taken on", async () => {
    const t = await replay({ attempt: "2026100" });
    const r = await t.run({ output: join(t.dir, "out"), json: true });
    expect(r.exit).toBe(0);
    const line = JSON.parse(r.out[0] ?? "");
    expect(line).toMatchObject({ status: "built", attempt: "20261003-100000", graded: false });
    expect(line.version).toBe(t.hashes[0]);
    const html = readFileSync(join(t.dir, "out", "study-fixture-20261003-100000.html"), "utf8");
    expect(html).toContain(`"hash":"${t.hashes[0]}"`);
    expect(html).toContain(`data-phase="submitted"`);
    expect(r.err.join("\n")).toContain("(not current:");
  });

  it("exits 2 for an unknown quiz, an unknown attempt, a prefix that is too short or matches several", async () => {
    const t = await replay();
    const several = await t.run({ attempt: "2026" });
    expect(several.exit).toBe(2);
    expect(several.err.join("\n")).toContain("2026 matches 7 attempts");
    expect((await t.run({ attempt: "202" })).exit).toBe(2);
    expect((await t.run({ attempt: "20250101" })).exit).toBe(2);
    const other = await replay({}, "nope");
    const missing = await other.run({});
    expect(missing.exit).toBe(2);
    expect(missing.err.join("\n")).toContain("no quiz named nope");
    const none = await replay({}, "limits-and-continuity");
    const empty = await none.run({});
    expect(empty.exit).toBe(2);
    expect(empty.err.join("\n")).toContain("has no attempt yet");
  });
});
