import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BriefData } from "../../src/brief-form/data";
import { type BriefIo, type BriefOptions, runBrief } from "../../src/cli/brief";
import { loadQuestions } from "../../src/cli/brief-questions";
import { briefSubmitReader } from "../../src/cli/brief-web";

/**
 * `quiz brief --web` with the timer, Ctrl+C and the opener injected, as test/review/command.test.ts has `runReview`:
 * the server binds port 0 and is driven with `fetch`; no test waits for a real timeout or sends a signal. The answers
 * the form posts are the same `Given` that `--tui` returns, and the bytes written are the ones the flags write.
 */
const NONE: BriefOptions = {
  purpose: null,
  scope: null,
  kinds: null,
  kindsOther: null,
  elsewhere: null,
  count: null,
  minutes: null,
  mix: null,
  difficulty: null,
  mode: null,
  weakTopics: null,
  commitment: null,
  language: null,
  request: null,
  profile: null,
  config: null,
  acceptDefaults: false,
  web: true,
  tui: false,
  json: true,
  open: false,
};
const SCOPE = "lectures 3 to 5, the Fourier transform";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function setup(files: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "fm-brief-web-"));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  // the page runtime is a stand-in: these tests are about the command and its server, not about the form's code
  const runtimeDir = join(dir, "runtime");
  mkdirSync(runtimeDir);
  for (const name of ["brief.js", "page.css", "brief.css"]) writeFileSync(join(runtimeDir, name), `/* ${name} */`);
  const out: string[] = [];
  const err: string[] = [];
  const opened: string[] = [];
  let interrupt: (() => void) | undefined;
  let fire: (() => void) | undefined;
  const io: BriefIo = {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    errRaw: (t) => err.push(t),
    cwd: dir,
    tty: false,
    runtimeDir,
    now: () => new Date(2026, 10, 16, 9, 0, 0),
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
    machine: { cwd: dir, env: {}, platform: "linux", home: join(dir, "no-home") },
  };
  const run = (extra: Partial<BriefOptions> = {}) => runBrief("d", { ...NONE, ...extra }, io);
  return { dir, io, out, err, opened, run, interrupt: () => interrupt?.(), timeout: () => fire?.() };
}

async function listening(out: string[]): Promise<string> {
  for (let i = 0; i < 300; i++) {
    if (out[0]) return (JSON.parse(out[0]) as { url: string }).url;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("never listened");
}

const post = (url: string, body: unknown) =>
  fetch(`${url}submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${new URL(url).port}` },
    body: JSON.stringify(body),
  });

const answers = (given: Record<string, unknown>) => ({ quizId: "brief", given });

async function dataOf(url: string): Promise<BriefData> {
  const html = await (await fetch(url)).text();
  const m = /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m?.[1] ?? "") as BriefData;
}

/** The brief a flags run writes for the same answers: the bytes the form must match. */
async function viaFlags(flags: Partial<BriefOptions>): Promise<string> {
  const t = setup();
  // a flags run has no form to open: `open: false` (the form tests' default) would be `--no-open` without `--web` (G116)
  const code = await t.run({ ...flags, web: false, open: undefined });
  expect(code).toBe(0);
  return readFileSync(join(t.dir, "d/brief.yaml"), "utf8");
}

describe("quiz brief --web", () => {
  it("prints listening, serves the form and writes the bytes the flags write, then prints what the flags print", async () => {
    const t = setup();
    const done = t.run({ purpose: "exam-prep", open: true });
    const url = await listening(t.out);
    expect(t.opened).toEqual([url]);
    expect(t.err.join("\n")).toContain("waiting for Finish (Ctrl+C to stop)");
    // nothing is written, and no DIR is made, until the form is accepted
    expect(existsSync(join(t.dir, "d"))).toBe(false);
    const reply = await post(url, answers({ purpose: "exam-prep", scope: SCOPE }));
    expect(reply.status).toBe(200);
    expect(await done).toBe(0);
    expect(readFileSync(join(t.dir, "d/brief.yaml"), "utf8")).toBe(
      await viaFlags({ purpose: "exam-prep", scope: SCOPE }),
    );
    expect(existsSync(join(t.dir, "d/content"))).toBe(true);
    const line = JSON.parse(t.out[1] ?? "");
    expect(line).toMatchObject({ status: "written", brief: "d/brief.yaml", warnings: [] });
    expect(line.defaults_applied).toContain("count");
    expect(line.defaults_applied).not.toContain("scope");
  });

  it("does not open the browser with --no-open, and says it in words without --json", async () => {
    const t = setup();
    const done = t.run({ json: false });
    for (let i = 0; i < 300 && !t.err.some((l) => l.startsWith("waiting")); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const url = /at (http\S+)/.exec(t.err.join("\n"))?.[1] ?? "";
    expect(t.opened).toEqual([]);
    await post(url, answers({ purpose: "survey", scope: SCOPE }));
    expect(await done).toBe(0);
    expect(t.out[0]).toBe("wrote d/brief.yaml and d/content/");
  });

  it("opens the browser by default", async () => {
    const t = setup();
    const done = t.run({ open: undefined });
    const url = await listening(t.out);
    expect(t.opened).toEqual([url]);
    t.interrupt();
    await done;
  });

  it("serves the form with the flags as pre-fills, the defaults of each purpose, the profiles and the timeout", async () => {
    const t = setup({
      "fullmark.toml": "[profiles.signals]\nextends = 'exam'\n",
    });
    const done = t.run({ scope: SCOPE, count: "25", timeout: "600", language: "vi" });
    const url = await listening(t.out);
    const data = await dataOf(url);
    expect(data.prefill).toEqual({ scope: SCOPE, count: 25, language: "vi" });
    expect(data.lang).toBe("vi");
    expect(data.timeout).toBe(600);
    expect(data.dir).toBe("d");
    expect(data.target).toBe("d/brief.yaml");
    expect(data.profiles.map((p) => p.name)).toEqual(["default", "draft", "exam", "survey", "signals"]);
    expect(data.profiles.at(-1)).toEqual({ name: "signals", file: "fullmark.toml" });
    expect(data.command).toBe(`quiz brief d --web --scope "${SCOPE}" --count 25 --language vi`);
    t.interrupt();
    await done;
  });

  it("serves the machine config's defaults of a purpose, as --tui is given them", async () => {
    const t = setup();
    const cfg = join(t.dir, "config.toml");
    writeFileSync(cfg, '[brief.purpose.exam-prep]\ncount = 30\nmix = ["calculation", "essay"]\n');
    t.io.machine = { cwd: t.dir, env: { FULLMARK_CONFIG: cfg }, platform: "linux", home: t.dir };
    const done = t.run();
    const url = await listening(t.out);
    expect((await dataOf(url)).overrides).toEqual({ "exam-prep": { count: 30, mix: ["calculation", "essay"] } });
    t.interrupt();
    await done;
  });

  it("writes a pre-filled answer kept as user, and one changed or restored as the flags would", async () => {
    const flags = { scope: SCOPE, count: "25" };
    const t = setup();
    const done = t.run({ purpose: "self-study", ...flags });
    const url = await listening(t.out);
    // what the form posts: the pre-filled answers kept, and the purpose picked
    await post(url, answers({ purpose: "self-study", scope: SCOPE, count: 25 }));
    expect(await done).toBe(0);
    expect(readFileSync(join(t.dir, "d/brief.yaml"), "utf8")).toBe(await viaFlags({ purpose: "self-study", ...flags }));
  });

  it("answers 400 for each wrong answer and goes on, and writes nothing", async () => {
    const t = setup();
    const done = t.run();
    const url = await listening(t.out);
    const refused = async (given: unknown, words: string | RegExp, body: Record<string, unknown> = {}) => {
      const r = await post(url, { quizId: "brief", given, ...body });
      expect(r.status).toBe(400);
      expect(await r.text()).toMatch(words);
    };
    const ok = { purpose: "exam-prep", scope: SCOPE };
    await refused({ ...ok, purpose: "fun" }, /--purpose must be one of/);
    await refused({ ...ok, count: 0 }, /--count must be a whole number, 1 or more/);
    await refused({ ...ok, count: 2.5 }, /--count/);
    await refused({ ...ok, count: "3" }, /"count" of the wrong kind/);
    await refused({ ...ok, minutes: -1 }, /--minutes/);
    await refused({ ...ok, mix: ["poetry"] }, /--mix takes a comma list/);
    await refused({ ...ok, kinds: ["notes"], kindsOther: "x" }, /--kinds-other needs `other`/);
    await refused({ ...ok, difficulty: "hard" }, /--difficulty must be one of/);
    await refused({ ...ok, mode: "exam" }, /--mode must be one of/);
    await refused({ ...ok, weakTopics: "yes" }, /"weakTopics" of the wrong kind/);
    await refused({ ...ok, commitment: 101 }, /--commitment/);
    await refused({ ...ok, language: "fr" }, /--language must be one of/);
    await refused({ ...ok, profile: "nope" }, /unknown profile `nope`/);
    await refused({ ...ok, colour: "red" }, /unknown key "colour"/);
    await refused({ purpose: "exam-prep" }, /no scope/);
    await refused({ scope: SCOPE }, /no purpose/);
    await refused({}, /no purpose and no scope/);
    // a scope under its min-words is never written, with or without brief.vague
    await refused({ ...ok, scope: "signals" }, /the scope has 1 words; 4 or more/);
    await refused(undefined, /no answers/);
    await refused(ok, /does not take|not "other"/, { quizId: "other" });
    expect((await post(url, "nonsense")).status).toBe(400);
    expect(existsSync(join(t.dir, "d"))).toBe(false);
    // the server went on: a good answer is still taken
    expect((await post(url, answers(ok))).status).toBe(200);
    expect(await done).toBe(0);
  });

  it("takes a second submit as refused, and a wrong token or origin as 403", async () => {
    const t = setup();
    const done = t.run();
    const url = await listening(t.out);
    const ok = answers({ purpose: "exam-prep", scope: SCOPE });
    const wrong = await fetch(`${url.replace(/\/[^/]+\/$/, "/nope/")}submit`, {
      method: "POST",
      headers: { Origin: `http://127.0.0.1:${new URL(url).port}` },
      body: JSON.stringify(ok),
    });
    expect(wrong.status).toBe(403);
    const foreign = await fetch(`${url}submit`, {
      method: "POST",
      headers: { Origin: "http://evil.test" },
      body: JSON.stringify(ok),
    });
    expect(foreign.status).toBe(403);
    expect((await post(url, ok)).status).toBe(200);
    await done;
  });

  it("Cancel writes nothing, creates no DIR, prints cancelled and exits 2", async () => {
    const t = setup();
    const done = t.run();
    const url = await listening(t.out);
    expect((await post(url, { quizId: "brief", cancel: true })).status).toBe(200);
    expect(await done).toBe(2);
    expect(JSON.parse(t.out[1] ?? "")).toEqual({ status: "cancelled" });
    expect(t.err.join("\n")).toContain("cancelled: nothing was written");
    expect(existsSync(join(t.dir, "d"))).toBe(false);
  });

  it("the timeout prints timeout and exits 2, with nothing written", async () => {
    const t = setup();
    const done = t.run({ timeout: "90" });
    await listening(t.out);
    t.timeout();
    expect(await done).toBe(2);
    expect(JSON.parse(t.out[1] ?? "")).toEqual({ status: "timeout" });
    expect(t.err.join("\n")).toContain("timed out after 90 seconds without a Finish; nothing was written");
    expect(existsSync(join(t.dir, "d"))).toBe(false);
  });

  it("--timeout 0 sets no timer", async () => {
    const t = setup();
    let set = false;
    t.io.setTimer = () => {
      set = true;
      return () => undefined;
    };
    const done = t.run({ timeout: "0" });
    await listening(t.out);
    expect(set).toBe(false);
    t.interrupt();
    await done;
  });

  it("Ctrl+C writes nothing, creates no DIR, prints interrupted and exits 2", async () => {
    const t = setup();
    const done = t.run();
    await listening(t.out);
    t.interrupt();
    expect(await done).toBe(2);
    expect(JSON.parse(t.out[1] ?? "")).toEqual({ status: "interrupted" });
    expect(existsSync(join(t.dir, "d"))).toBe(false);
  });

  it("refuses an existing brief before serving anything, and --accept-defaults, --web with --tui, a bad value", async () => {
    const exists = setup({ "d/brief.yaml": "mine\n" });
    expect(await exists.run()).toBe(2);
    expect(exists.out.map((l) => JSON.parse(l).message)).toEqual([
      "d/brief.yaml already exists: edit it, or delete it to start again",
    ]);
    for (const [opts, message] of [
      [{ acceptDefaults: true }, "--accept-defaults cannot be used with --web"],
      [{ tui: true }, "--web and --tui cannot be used together"],
      [{ count: "0" }, "--count must be a whole number"],
      [{ timeout: "soon" }, "--timeout soon is not a number of seconds"],
      [{ port: "0" }, "--port 0 is not a port number"],
      [{ port: "70000" }, "--port 70000 is not a port number"],
    ] as const) {
      const t = setup();
      expect(await t.run(opts), JSON.stringify(opts)).toBe(2);
      expect(JSON.parse(t.out[0] ?? "").message).toContain(message);
      expect(t.out).toHaveLength(1);
    }
  });

  it("does not overwrite a brief that appeared while the form was open", async () => {
    const t = setup();
    const done = t.run();
    const url = await listening(t.out);
    mkdirSync(join(t.dir, "d"));
    writeFileSync(join(t.dir, "d/brief.yaml"), "mine\n");
    const r = await post(url, answers({ purpose: "exam-prep", scope: SCOPE }));
    expect(r.status).toBe(400);
    expect(await r.text()).toContain("already exists");
    expect(readFileSync(join(t.dir, "d/brief.yaml"), "utf8")).toBe("mine\n");
    t.interrupt();
    await done;
  });

  it("ends with the reason when the file cannot be written", async () => {
    const t = setup({ d: "a file in the way" });
    const done = t.run();
    const url = await listening(t.out);
    const r = await post(url, answers({ purpose: "exam-prep", scope: SCOPE }));
    expect(r.status).toBe(500);
    expect(await done).toBe(2);
    expect(JSON.parse(t.out[1] ?? "")).toMatchObject({ status: "error" });
    expect(t.out[1]).toContain("cannot write");
  });

  it("says so when the page runtime is missing", async () => {
    const t = setup();
    t.io.runtimeDir = join(t.dir, "nowhere");
    expect(await t.run()).toBe(2);
    expect(JSON.parse(t.out[0] ?? "").message).toContain("the page runtime is missing");
  });

  it("warns brief.no-history for weak topics, as the flags do", async () => {
    const t = setup();
    const done = t.run();
    const url = await listening(t.out);
    await post(url, answers({ purpose: "exam-prep", scope: SCOPE, weakTopics: true }));
    await done;
    expect(JSON.parse(t.out[1] ?? "").warnings.map((w: { rule: string }) => w.rule)).toEqual(["brief.no-history"]);
  });
});

describe("the submit reader", () => {
  const questions = loadQuestions();
  const reader = briefSubmitReader(questions, (flags) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) if (v !== null) out[k] = v;
    if (flags.purpose === "bad") throw new Error("--purpose must be one of: ...");
    return out as never;
  });

  it("turns each answer into the flag's text, so one parser checks the flags, --tui and the form", () => {
    const got = reader(
      answers({ purpose: "p", scope: SCOPE, kinds: ["a", "b"], count: 25, weakTopics: false, mix: [] }),
    );
    expect(got).toEqual({
      quizId: "brief",
      value: { given: { purpose: "p", scope: SCOPE, kinds: "a,b", count: "25", weakTopics: "no", mix: "" } },
    });
  });

  it("refuses what is not an answer set in plain words", () => {
    expect(reader(null)).toBe("the body is not an answer set");
    expect(reader({ quizId: "x" })).toContain('not "x"');
    expect(reader({ quizId: "brief" })).toBe("the body has no answers");
    expect(reader(answers({ purpose: "bad", scope: SCOPE }))).toBe("--purpose must be one of: ...");
    expect(reader({ quizId: "brief", cancel: true })).toEqual({ quizId: "brief", value: { cancel: true } });
  });
});
