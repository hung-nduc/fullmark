import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type GradeOptions, runGrade } from "../../src/cli/grade";
import { isEmptyTemplate } from "../../src/cli/grade-web";
import type { ServeIo } from "../../src/cli/serve";
import { localIso } from "../../src/cli/time";
import type { GradeData } from "../../src/grade-form/data";

/**
 * `quiz grade --web` with the clock, the timer, Ctrl+C and the opener injected, as test/review/command.test.ts has
 * `runReview`: the server binds port 0 and is driven with `fetch`; no test waits for a real timeout. The input is the
 * golden `rubrics-grades-all`: one essay of each mode and a code question, and a grades file for all five.
 */
const input = resolve(import.meta.dirname, "..", "golden", "grade", "rubrics-grades-all", "input");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "fm-grade-web-"));
  dirs.push(dir);
  mkdirSync(join(dir, ".git"));
  copyFileSync(join(input, "quiz.md"), join(dir, "quiz.md"));
  copyFileSync(join(input, "results.json"), join(dir, "results.json"));
  // the page runtime: stand-ins, since the unit test reads the served page's data block and never runs it
  const runtime = join(dir, "runtime");
  mkdirSync(runtime);
  for (const f of ["grade.js", "page.js", "page.css", "grade.css"]) writeFileSync(join(runtime, f), `/* ${f} */`);
  const out: string[] = [];
  const err: string[] = [];
  const opened: string[] = [];
  let interrupt: (() => void) | undefined;
  let fire: (() => void) | undefined;
  const at = { now: new Date(2026, 10, 7, 9, 5, 7) };
  const io: ServeIo = {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    errRaw: (t) => err.push(t),
    cwd: dir,
    tty: false,
    now: () => at.now,
    runtimeDir: runtime,
    open: (url) => {
      opened.push(url);
    },
    onInterrupt: (h) => {
      interrupt = h;
      return () => undefined;
    },
    setTimer: (f) => {
      fire = f;
      return () => undefined;
    },
    machine: { cwd: dir, env: {}, platform: "linux", home: dir },
  };
  const options = (extra: Partial<GradeOptions> = {}): GradeOptions => ({
    quiz: "quiz.md",
    output: null,
    grades: null,
    json: true,
    web: true,
    name: null,
    timeout: null,
    open: false,
    port: null,
    version: "1.0.0-test",
    plain: false,
    ...extra,
  });
  return { dir, io, out, err, opened, options, at, interrupt: () => interrupt?.(), timeout: () => fire?.() };
}

async function listening(out: string[]): Promise<string> {
  for (let i = 0; i < 300; i++) {
    if (out[0]) return (JSON.parse(out[0]) as { url: string }).url;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("never listened");
}

const post = (url: string, body: unknown) => {
  const port = new URL(url).port;
  return fetch(`${url}submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${port}` },
    body: JSON.stringify(body),
  });
};

async function dataOf(url: string): Promise<GradeData> {
  const html = await (await fetch(url)).text();
  const m = /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m?.[1] ?? "") as GradeData;
}

type Doc = { format: string; version: number; grader: unknown; grades: Record<string, Record<string, unknown>> };

/** The grades of the golden, as a form would send them: every cell filled, no grader. */
const filled = (): Doc => {
  const doc = JSON.parse(readFileSync(join(input, "grades.json"), "utf8")) as Doc;
  return { format: doc.format, version: doc.version, grader: null, grades: doc.grades };
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

async function submit(url: string, grades: Doc, extra: Record<string, unknown> = {}) {
  const data = await dataOf(url);
  return post(url, { quizId: data.quizId, quizHash: data.quizHash, grades, ...extra });
}

const entryOf = (doc: Doc, id: string): Record<string, unknown> => doc.grades[id] as Record<string, unknown>;
const cellsOf = (doc: Doc, id: string): Record<string, Record<string, unknown>> =>
  entryOf(doc, id).criteria as Record<string, Record<string, unknown>>;

const named = (doc: Doc, name: string): Doc => ({ ...doc, grader: { kind: "human", name } });

describe("quiz grade --web", () => {
  it("serves the form's data, takes a submit, and writes the grades file and the report beside the results", async () => {
    const t = setup();
    const done = runGrade(["results.json"], t.options({ open: true }), t.io);
    const url = await listening(t.out);
    expect(t.opened).toEqual([url]);
    expect(t.err.join("\n")).toContain("waiting for Save grades (Ctrl+C to stop)");
    const data = await dataOf(url);
    expect(data.items.map((i) => i.id)).toEqual(["add", "ielts", "banded", "holistic", "code"]);
    expect(data.items.map((i) => i.mode)).toEqual(["additive", "banded", "banded", "holistic", "additive"]);
    expect(data.files).toEqual({ grades: "results-grades.json", report: "results-report.md" });
    const reply = await submit(url, named(filled(), "Lan"));
    expect(reply.status).toBe(200);
    expect(await done).toBe(0);
    expect(JSON.parse(t.out[1] ?? "")).toEqual({
      status: "written",
      grades: "results-grades.json",
      report: "results-report.md",
      graded: 5,
      pending: 0,
    });
    const file = JSON.parse(readFileSync(join(t.dir, "results-grades.json"), "utf8"));
    expect(file.grader).toEqual({ kind: "human", name: "Lan", at: localIso(t.at.now) });
    expect(file.grader.at).toMatch(/^2026-11-07T09:05:07[+-]\d\d:\d\d$/);
    // the same report as `quiz grade RESULTS --quiz FILE --grades GRADES` writes from that file
    const web = readFileSync(join(t.dir, "results-report.md"), "utf8");
    const again = setup();
    copyFileSync(join(t.dir, "results-grades.json"), join(again.dir, "g.json"));
    expect(
      await runGrade(["results.json"], again.options({ web: false, grades: "g.json", json: false }), again.io),
    ).toBe(0);
    expect(readFileSync(join(again.dir, "results-report.md"), "utf8")).toBe(web);
  });

  it("says it in words without --json, and --name is the grader even if the form sends another", async () => {
    const t = setup();
    const done = runGrade(["results.json"], t.options({ json: false, name: "Minh" }), t.io);
    for (let i = 0; i < 300 && !t.err.some((l) => l.startsWith("grading")); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const url = /at (http\S+)/.exec(t.err.join("\n"))?.[1] ?? "";
    expect((await dataOf(url)).name).toBe("Minh");
    const grades = filled();
    delete grades.grades.code;
    expect((await submit(url, named(grades, "Someone else"))).status).toBe(200);
    expect(await done).toBe(0);
    expect(t.out).toEqual([
      "grades written: 4 graded, 1 pending (results-grades.json)",
      "report written: results-report.md",
    ]);
    expect(JSON.parse(readFileSync(join(t.dir, "results-grades.json"), "utf8")).grader.name).toBe("Minh");
  });

  it("answers 400 and keeps waiting for each thing the validator refuses, then takes a good submit", async () => {
    const t = setup();
    const done = runGrade(["results.json"], t.options(), t.io);
    const url = await listening(t.out);
    const data = await dataOf(url);
    const reasons = async (grades: Doc, extra: Record<string, unknown> = {}) => {
      const reply = await submit(url, grades, extra);
      expect(reply.status).toBe(400);
      return reply.text();
    };
    // another version of the quiz
    expect(await reasons(named(filled(), "Lan"), { quizHash: "0".repeat(64) })).toContain("another version");
    // another quiz
    expect(await reasons(named(filled(), "Lan"), { quizId: "other" })).toContain('not "other"');
    // an empty name
    expect(await reasons(named(filled(), "  "))).toContain("name is empty");
    // a half-filled question
    const half = named(clone(filled()), "Lan");
    (cellsOf(half, "add").defs as Record<string, unknown>).score = null;
    expect(await reasons(half)).toContain("half-filled");
    // a lost mark with no note
    const lost = named(clone(filled()), "Lan");
    (cellsOf(lost, "add").derive as Record<string, unknown>).note = null;
    expect(await reasons(lost)).toContain("a note is needed");
    // a holistic score with no reason
    const bare = named(clone(filled()), "Lan");
    entryOf(bare, "holistic").justification = null;
    expect(await reasons(bare)).toContain("justification");
    // another version of the format
    expect(await reasons({ ...named(filled(), "Lan"), version: 1 })).toContain("version 2");
    // nothing graded at all
    const empty = named(clone(filled()), "Lan");
    for (const id of Object.keys(empty.grades))
      empty.grades[id] = clone(data.items.find((i) => i.id === id)?.entry ?? {});
    expect(await reasons(empty)).toContain("nothing is graded yet");
    expect(existsSync(join(t.dir, "results-grades.json"))).toBe(false);
    // still waiting: a good submit is taken
    expect((await submit(url, named(filled(), "Lan"))).status).toBe(200);
    expect(await done).toBe(0);
    expect(existsSync(join(t.dir, "results-grades.json"))).toBe(true);
  });

  it("replaces an empty template, and leaves grades alone (exit 2) before serving", async () => {
    const empty = setup();
    // the template `quiz grade --json` writes
    expect(await runGrade(["results.json"], empty.options({ web: false }), empty.io)).toBe(0);
    const template = readFileSync(join(empty.dir, "results-grades.json"), "utf8");
    expect(isEmptyTemplate(JSON.parse(template))).toBe(true);
    empty.out.length = 0;
    const done = runGrade(["results.json"], empty.options(), empty.io);
    const served = await listening(empty.out);
    expect((await submit(served, named(filled(), "Lan"))).status).toBe(200);
    await done;
    expect(isEmptyTemplate(JSON.parse(readFileSync(join(empty.dir, "results-grades.json"), "utf8")))).toBe(false);

    const held = setup();
    copyFileSync(join(input, "grades.json"), join(held.dir, "results-grades.json"));
    expect(await runGrade(["results.json"], held.options(), held.io)).toBe(2);
    expect(held.out.some((l) => l.includes("listening"))).toBe(false);
    expect(held.err.join("\n")).toContain("results-grades.json already holds grades");
    expect(readFileSync(join(held.dir, "results-grades.json"), "utf8")).toBe(
      readFileSync(join(input, "grades.json"), "utf8"),
    );
  });

  it("a timeout or Ctrl+C writes nothing and leaves an existing template byte for byte (exit 2)", async () => {
    for (const how of ["timeout", "interrupt"] as const) {
      const t = setup();
      expect(await runGrade(["results.json"], t.options({ web: false }), t.io)).toBe(0);
      const before = readFileSync(join(t.dir, "results-grades.json"), "utf8");
      const reportBefore = readFileSync(join(t.dir, "results-report.json"), "utf8");
      t.out.length = 0;
      const done = runGrade(["results.json"], t.options(), t.io);
      await listening(t.out);
      if (how === "timeout") t.timeout();
      else t.interrupt();
      expect(await done).toBe(2);
      expect(JSON.parse(t.out[1] ?? "")).toEqual({ status: how === "timeout" ? "timeout" : "interrupted" });
      expect(readFileSync(join(t.dir, "results-grades.json"), "utf8")).toBe(before);
      expect(readFileSync(join(t.dir, "results-report.json"), "utf8")).toBe(reportBefore);
      expect(existsSync(join(t.dir, "results-report.md"))).toBe(false);
    }
  });

  it("nothing is served for an attempt with no answered essay or code question (G91)", async () => {
    const t = setup();
    const results = JSON.parse(readFileSync(join(t.dir, "results.json"), "utf8"));
    for (const id of ["add", "ielts", "banded", "holistic", "code"]) results.state.answers[id] = null;
    writeFileSync(join(t.dir, "results.json"), JSON.stringify(results));
    expect(await runGrade(["results.json"], t.options(), t.io)).toBe(0);
    expect(t.out).toEqual([JSON.stringify({ status: "nothing-to-grade" })]);
    expect(existsSync(join(t.dir, "results-grades.json"))).toBe(false);
  });
});

const OPUS = { kind: "ai", name: "Claude Opus 5.5", model: "claude-opus-5-5", at: "2026-10-24T09:00:00" };
const IDS = ["add", "ielts", "banded", "holistic", "code"];

/** `grades.json` of the golden, as the file `--grades` names, written into `dir` under `name` after `edit`. */
function gradesFile(dir: string, name: string, edit: (doc: Doc & { results_hash: string }) => void = () => undefined) {
  const doc = JSON.parse(readFileSync(join(input, "grades.json"), "utf8")) as Doc & { results_hash: string };
  edit(doc);
  writeFileSync(join(dir, name), `${JSON.stringify(doc, null, 2)}\n`);
}

describe("quiz grade --web --grades", () => {
  it("opens the form with the file's grades and each question's grader, and Save writes `reviewed` on each (G75, G107)", async () => {
    const t = setup();
    gradesFile(t.dir, "agent.json");
    const done = runGrade(["results.json"], t.options({ grades: "agent.json" }), t.io);
    const url = await listening(t.out);
    const data = await dataOf(url);
    expect(data.items.map((i) => i.given?.grader)).toEqual(IDS.map(() => OPUS));
    const add = data.items[0]?.given;
    expect(add).toMatchObject({
      score: null,
      cells: { defs: { value: 0.5, note: null }, derive: { value: 1.25 }, interp: { value: 0.5 } },
      why: "Solid derivation; the interpretation is the weak part.",
    });
    expect(data.items[3]?.given).toMatchObject({
      score: 3,
      verdicts: { "names-the-nyquist-rate": "met", "gives-an-example": "partly" },
    });
    // saved as given, by a form that sends back the cells and a grader of its own that the server ignores
    const sent = named(filled(), "Lan");
    for (const entry of Object.values(sent.grades)) entry.grader = { kind: "human", name: "x" };
    expect((await submit(url, sent)).status).toBe(200);
    expect(await done).toBe(0);
    const file = JSON.parse(readFileSync(join(t.dir, "results-grades.json"), "utf8"));
    expect(file.grader).toMatchObject({ kind: "human", name: "Lan" });
    for (const id of IDS) {
      expect(file.grades[id].reviewed).toEqual(OPUS);
      expect(file.grades[id]).not.toHaveProperty("grader");
    }
    expect(Object.keys(file.grades.add).slice(-3)).toEqual(["justification", "improvement", "reviewed"]);
  });

  it("each question names its own grader, else the file's (G102); a question the file leaves null is not pre-filled", async () => {
    const t = setup();
    const sonnet = { kind: "ai", name: "Claude Sonnet 5.5", model: "claude-sonnet-5-5", at: "2026-10-23T15:40:00" };
    gradesFile(t.dir, "two.json", (doc) => {
      (doc.grades.holistic as Record<string, unknown>).grader = sonnet;
      (doc.grades.ielts as Record<string, unknown>).grader = sonnet;
      const code = doc.grades.code as Record<string, unknown>;
      for (const c of Object.values(code.criteria as Record<string, Record<string, unknown>>)) {
        c.score = null;
        c.note = null;
      }
      code.justification = null;
      code.improvement = null;
    });
    const done = runGrade(["results.json"], t.options({ grades: "two.json" }), t.io);
    const url = await listening(t.out);
    const data = await dataOf(url);
    expect(data.items.map((i) => i.given?.grader.name ?? null)).toEqual([
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
      null,
    ]);
    // the form grades the left-over question by hand, and saves: it has no `reviewed`
    const sent = named(filled(), "Lan");
    expect((await submit(url, sent)).status).toBe(200);
    expect(await done).toBe(0);
    const file = JSON.parse(readFileSync(join(t.dir, "results-grades.json"), "utf8"));
    expect(IDS.map((id) => file.grades[id].reviewed?.name ?? null)).toEqual([
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
      null,
    ]);
  });

  it("a pre-filled question cleared before Save is pending, and carries no `reviewed`", async () => {
    const t = setup();
    gradesFile(t.dir, "agent.json");
    const done = runGrade(["results.json"], t.options({ grades: "agent.json" }), t.io);
    const url = await listening(t.out);
    const sent = named(filled(), "Lan");
    for (const entry of Object.values(sent.grades).slice(1)) {
      entry.justification = null;
      entry.improvement = null;
      if ("score" in entry) entry.score = null;
      for (const cells of [entry.criteria, entry.bullets]) {
        for (const cell of Object.values((cells ?? {}) as Record<string, Record<string, unknown>>)) {
          for (const k of ["score", "band", "note", "verdict"]) if (k in cell) cell[k] = null;
        }
      }
    }
    expect((await submit(url, sent)).status).toBe(200);
    await done;
    const file = JSON.parse(readFileSync(join(t.dir, "results-grades.json"), "utf8"));
    expect(file.grades.add.reviewed).toEqual(OPUS);
    expect(file.grades.ielts).not.toHaveProperty("reviewed");
  });

  it("refuses the file as `quiz grade --grades` does: exit 1 for a bad one, 2 for one that cannot be read; nothing is served", async () => {
    const bad = setup();
    gradesFile(bad.dir, "bad.json", (doc) => {
      cellsOf(doc, "add").derive.score = 1.3;
    });
    expect(await runGrade(["results.json"], bad.options({ grades: "bad.json" }), bad.io)).toBe(1);
    expect(bad.out.some((l) => l.includes("listening"))).toBe(false);
    expect(`${bad.out.join("\n")}${bad.err.join("\n")}`).toContain("grades.add");
    expect(existsSync(join(bad.dir, "results-grades.json"))).toBe(false);
    const missing = setup();
    expect(await runGrade(["results.json"], missing.options({ grades: "nope.json" }), missing.io)).toBe(2);
    expect(missing.err.join("\n")).toContain("cannot read the grades file");
    const text = setup();
    writeFileSync(join(text.dir, "t.json"), "nonsense");
    expect(await runGrade(["results.json"], text.options({ grades: "t.json" }), text.io)).toBe(1);
    expect(text.out.some((l) => l.includes("listening"))).toBe(false);
  });

  it("`--grades` naming the file Save would write is not refused, and Save replaces it (G108); another file is refused", async () => {
    const same = setup();
    gradesFile(same.dir, "results-grades.json");
    const done = runGrade(["results.json"], same.options({ grades: "results-grades.json" }), same.io);
    const url = await listening(same.out);
    expect((await dataOf(url)).items[0]?.given?.grader).toEqual(OPUS);
    expect((await submit(url, named(filled(), "Lan"))).status).toBe(200);
    expect(await done).toBe(0);
    const file = JSON.parse(readFileSync(join(same.dir, "results-grades.json"), "utf8"));
    expect(file.grader.kind).toBe("human");
    expect(file.grades.add.reviewed).toEqual(OPUS);

    // a timeout leaves it byte for byte
    const kept = setup();
    gradesFile(kept.dir, "results-grades.json");
    const before = readFileSync(join(kept.dir, "results-grades.json"), "utf8");
    const waiting = runGrade(["results.json"], kept.options({ grades: "./results-grades.json" }), kept.io);
    await listening(kept.out);
    kept.timeout();
    expect(await waiting).toBe(2);
    expect(readFileSync(join(kept.dir, "results-grades.json"), "utf8")).toBe(before);

    // another file, while results-grades.json holds grades: the refusal stands
    const other = setup();
    gradesFile(other.dir, "results-grades.json");
    gradesFile(other.dir, "other.json");
    expect(await runGrade(["results.json"], other.options({ grades: "other.json" }), other.io)).toBe(2);
    expect(other.err.join("\n")).toContain(
      "results-grades.json already holds grades; move it away, or adjust it with --grades",
    );
    expect(other.out.some((l) => l.includes("listening"))).toBe(false);
  });
});

describe("isEmptyTemplate", () => {
  it("is true for the template, false for one holding a grade, a note or a grader", () => {
    const template = JSON.parse(readFileSync(join(input, "grades.json"), "utf8")) as Doc;
    const blank = clone(template);
    blank.grader = null;
    for (const entry of Object.values(blank.grades)) {
      entry.justification = null;
      entry.improvement = null;
      if ("score" in entry) entry.score = null;
      for (const cells of [entry.criteria, entry.bullets]) {
        for (const cell of Object.values((cells ?? {}) as Record<string, Record<string, unknown>>)) {
          for (const k of ["score", "band", "note", "verdict"]) if (k in cell) cell[k] = null;
        }
      }
    }
    expect(isEmptyTemplate(blank)).toBe(true);
    expect(isEmptyTemplate(template)).toBe(false);
    expect(isEmptyTemplate({ ...blank, grader: { kind: "human", name: "Lan" } })).toBe(false);
    const noted = clone(blank);
    (cellsOf(noted, "add").defs as Record<string, unknown>).note = "x";
    expect(isEmptyTemplate(noted)).toBe(false);
    expect(isEmptyTemplate("nope")).toBe(false);
  });
});
