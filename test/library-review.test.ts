import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reviewEn, reviewVi } from "../src/core/i18n/review";
import { readReview } from "../src/core/review/read";
import { cleanTemps, git } from "./helpers/library";
import { quizOf, type T } from "./helpers/library-grade";
import { newLibrary, quizText } from "./helpers/library-register";
import { DROP, FIX, finish, KEEP, reviewDataOf, webReview } from "./helpers/library-review";

/**
 * `library review`, in-process: the server binds 127.0.0.1 on port 0 and is driven with `fetch`; the clock, the timer,
 * Ctrl+C, the opener and the lock's wait are injected. Git is real, in a temp folder. The form is `quiz review`'s
 * (test/review/command.test.ts); these cover where the review goes (STEP4.md, slice 4f, G16, G34).
 */
afterEach(cleanTemps);

const QUESTIONS: [string, string][] = [
  ["own", "Who owns the value?"],
  ["borrow", "What does a borrow do?"],
  ["trait", "What is a trait?"],
];

async function rustLibrary(): Promise<T> {
  const t = await newLibrary();
  t.write({ "notes/rust.md": quizText("rust", "Rust basics", QUESTIONS) });
  await t.register(["notes/rust.md"], { name: "rust-basics" });
  return t;
}

const dirs = (t: T) => {
  const q = join(t.lib, "quizzes", "rust");
  return { q, review: join(q, "review.json"), progress: join(q, "progress") };
};
const names = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const head = async (t: T) => (await git(t.lib, t.env, "rev-parse", "HEAD")).trim();
const subjects = async (t: T) => (await git(t.lib, t.env, "log", "--format=%s")).trim().split("\n");
const stored = (t: T) => {
  const r = readReview(readFileSync(dirs(t).review, "utf8"));
  if (!r.ok) throw new Error(r.problems.join("; "));
  return r.review;
};
const lockBy = (t: T) =>
  writeFileSync(
    join(t.lib, ".fullmark.lock"),
    `${JSON.stringify({ pid: process.pid, command: "quiz library register notes/*.md", started: "2026-11-19T03:00:00.000Z" })}\n`,
  );

describe("library review", () => {
  it("serves the form on the current version; Finish files review.json and makes one commit holding only it", async () => {
    const t = await rustLibrary();
    const hash = quizOf(t, "rust-basics").current;
    const before = await subjects(t);
    const run = webReview(t, "rust-basics", { open: true });
    const url = await run.url();
    expect(run.opened).toEqual([url]);
    expect(run.err[0]).toBe(`rust-basics · Rust basics · version ${hash.slice(0, 4)} · 3 questions`);
    expect(run.err[1]).toBe(`serving ${url}  (opened in your browser)`);
    const data = await reviewDataOf(url);
    expect(data.out).toBe("review.json");
    expect(data.check).toBe("quiz library register FILE --update rust-basics");
    expect(data.page.quizzes[0].hash).toBe(hash);

    const reply = await finish(url, { own: KEEP, borrow: FIX, trait: DROP });
    expect(reply.status).toBe(200);
    // filed: the answer is the plain one
    expect(await reply.json()).toEqual({ status: "accepted" });
    expect(await run.done).toBe(0);

    expect(JSON.parse(run.out.at(-1) ?? "")).toEqual({
      status: "written",
      review: "review.json",
      keep: 1,
      fix: 1,
      drop: 1,
      committed: expect.stringMatching(/^[0-9a-f]+$/),
    });
    expect(run.err.slice(-3, -1)).toEqual([
      "written review.json: 1 keep, 1 fix, 1 drop",
      "next: edit the quiz, then quiz library register FILE --update rust-basics",
    ]);
    expect(run.err.at(-1)).toMatch(/^committed [0-9a-f]+ fullmark: review rust-basics$/);
    expect(stored(t).quizId).toBe("rust");
    expect(Object.keys(stored(t).questions).sort()).toEqual(["borrow", "own", "trait"]);
    // nothing waits in progress/, one commit holds review.json alone, and the library is clean
    expect(names(dirs(t).progress)).toEqual([]);
    const after = await subjects(t);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toBe("fullmark: review rust-basics");
    expect((await git(t.lib, t.env, "show", "--name-only", "--format=", "HEAD")).trim()).toBe(
      "quizzes/rust/review.json",
    );
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("prints the words as COMMANDS.md has them (no --json), by the quiz's id as well as its name", async () => {
    const t = await rustLibrary();
    const run = webReview(t, "rust", { json: false });
    const url = await run.url();
    expect((await finish(url, { own: KEEP, borrow: KEEP, trait: { ...KEEP, assumed: true } })).status).toBe(200);
    expect(await run.done).toBe(0);
    expect(run.out.slice(0, 2)).toEqual([
      expect.stringMatching(/^rust-basics · Rust basics · version [0-9a-f]{4} · 3 questions$/),
      `serving ${url}`,
    ]);
    expect(run.out[2]).toBe("written review.json: 3 keep (1 not looked at), 0 fix, 0 drop");
    expect(run.out[3]).toBe("next: edit the quiz, then quiz library register FILE --update rust-basics");
    expect(run.out[4]).toMatch(/^committed [0-9a-f]+ fullmark: review rust-basics$/);
  });

  it("opens with the stored review as the earlier one: the heading counts what was judged, and the verdicts are in place", async () => {
    const t = await rustLibrary();
    const first = webReview(t, "rust-basics");
    expect((await finish(await first.url(), { own: KEEP, borrow: FIX, trait: KEEP })).status).toBe(200);
    expect(await first.done).toBe(0);

    const run = webReview(t, "rust-basics");
    const url = await run.url();
    expect(run.err[0]).toMatch(/ · 3 questions, 3 judged before$/);
    const data = await reviewDataOf(url);
    expect(data.earlier.borrow?.verdict).toBe("fix");
    expect(data.since).toBeUndefined();
    // the second Finish merges into the first
    expect((await finish(url, { own: DROP, borrow: FIX, trait: KEEP })).status).toBe(200);
    expect(await run.done).toBe(0);
    expect(stored(t).questions.own?.verdict).toBe("drop");
    expect((await subjects(t))[0]).toBe("fullmark: review rust-basics");
  });

  it("--since asks only about the questions new or changed since the stored review", async () => {
    const t = await rustLibrary();
    const first = webReview(t, "rust-basics");
    expect((await finish(await first.url(), { own: KEEP, borrow: FIX, trait: KEEP })).status).toBe(200);
    expect(await first.done).toBe(0);
    // a new version: `borrow` reworded
    t.write({
      "notes/rust.md": quizText("rust", "Rust basics", [
        ["own", "Who owns the value?"],
        ["borrow", "What does a shared borrow allow?"],
        ["trait", "What is a trait?"],
      ]),
    });
    expect((await t.register(["notes/rust.md"], { update: "rust-basics" })).exit).toBe(0);

    const run = webReview(t, "rust-basics", { since: true });
    const url = await run.url();
    expect((await reviewDataOf(url)).since?.asked).toEqual(["borrow"]);
    expect((await finish(url, { own: KEEP, borrow: KEEP, trait: KEEP })).status).toBe(200);
    expect(await run.done).toBe(0);
    expect(stored(t).questions.borrow?.verdict).toBe("keep");

    // nothing is new or changed now: nothing is served, nothing is touched or committed
    const head1 = await head(t);
    const again = webReview(t, "rust-basics", { since: true });
    expect(await again.done).toBe(0);
    expect(again.out).toEqual([JSON.stringify({ status: "unchanged", review: "review.json" })]);
    expect(again.err).toEqual([expect.stringMatching(/^nothing new or changed since your review of 19 Nov$/)]);
    expect(await head(t)).toBe(head1);
  });

  it("--since with no stored review exits 2", async () => {
    const t = await rustLibrary();
    const run = webReview(t, "rust-basics", { since: true });
    expect(await run.done).toBe(2);
    expect(run.out).toEqual([
      JSON.stringify({
        status: "error",
        message: "--since needs an existing review; run quiz library review rust-basics first",
      }),
    ]);
  });

  it("an unknown quiz and a bad --timeout or --port exit 2 before anything is served (a survey cannot be registered, so none is here)", async () => {
    const t = await rustLibrary();
    const unknown = webReview(t, "rustbasics");
    expect(await unknown.done).toBe(2);
    expect(unknown.err).toEqual(["error: no quiz named rustbasics", "    did you mean: rust-basics"]);
    const slow = webReview(t, "rust-basics", { timeout: "soon" });
    expect(await slow.done).toBe(2);
    expect(slow.err.join("\n")).toContain("--timeout soon is not a number of seconds");
    const port = webReview(t, "rust-basics", { port: "99999" });
    expect(await port.done).toBe(2);
    expect(port.err.join("\n")).toContain("--port 99999 is not a port number");
  });

  it("keeps the review in progress/ when the lock is busy (exit 2), says so in the form's answer; the next library review files it first and ends with the next step (G34)", async () => {
    const t = await rustLibrary();
    const before = await head(t);
    const run = webReview(t, "rust-basics");
    const url = await run.url();
    lockBy(t);
    const reply = await finish(url, { own: KEEP, borrow: FIX, trait: KEEP });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({
      status: "accepted",
      filed: false,
      command: "quiz library review rust-basics",
    });
    expect(reviewEn.unfiled("quiz library review rust-basics")).toBe(
      "Your review is saved, but not filed yet: the library was busy. Run `quiz library review rust-basics` to file it.",
    );
    expect(reviewVi.unfiled("quiz library review rust-basics")).toBe(
      "Bản rà soát đã lưu nhưng chưa được ghi vào thư viện vì thư viện đang bận. Chạy `quiz library review rust-basics` để ghi.",
    );
    expect(await run.done).toBe(2);
    const errors = run.err.join("\n");
    expect(errors).toContain("your review is safe in progress/review.json");
    expect(errors).toContain("run `quiz library review rust-basics` again to file it");
    expect(names(dirs(t).progress)).toEqual(["review.json"]);
    expect(existsSync(dirs(t).review)).toBe(false);
    expect(await head(t)).toBe(before);
    expect(JSON.parse(run.out.at(-1) ?? "")).toMatchObject({ status: "error" });

    rmSync(join(t.lib, ".fullmark.lock"));
    // the leftover is filed first and nothing is served
    const next = webReview(t, "rust-basics", { json: false });
    expect(await next.done).toBe(0);
    expect(next.out).toEqual([
      expect.stringMatching(/^rust-basics · Rust basics · version [0-9a-f]{4}$/),
      "note filing the review an earlier form saved in progress/review.json",
      "written review.json: 3 keep, 0 fix, 0 drop"
        .replace("3 keep, 0 fix", "2 keep, 1 fix")
        .replace(", 0 drop", ", 0 drop"),
      expect.stringMatching(/^committed [0-9a-f]+ fullmark: review rust-basics$/),
      "next: quiz library review rust-basics",
    ]);
    expect(names(dirs(t).progress)).toEqual([]);
    expect(stored(t).questions.borrow?.verdict).toBe("fix");
    expect((await subjects(t))[0]).toBe("fullmark: review rust-basics");
    expect(await git(t.lib, t.env, "status", "--porcelain")).toBe("");
  });

  it("writes nothing and commits nothing on the timeout and on Ctrl+C (exit 2)", async () => {
    const t = await rustLibrary();
    const head0 = await head(t);
    const timed = webReview(t, "rust-basics");
    await timed.url();
    timed.timeout();
    expect(await timed.done).toBe(2);
    expect(JSON.parse(timed.out.at(-1) ?? "")).toEqual({ status: "timeout" });
    expect(timed.err.at(-1)).toBe("timed out after 1800 seconds without a Finish; nothing was written");

    const stopped = webReview(t, "rust-basics");
    await stopped.url();
    stopped.interrupt();
    expect(await stopped.done).toBe(2);
    expect(JSON.parse(stopped.out.at(-1) ?? "")).toEqual({ status: "interrupted" });
    expect(existsSync(dirs(t).review)).toBe(false);
    expect(names(dirs(t).progress)).toEqual([]);
    expect(await head(t)).toBe(head0);
  });

  it("a writer that dies mid-way leaves the library as it was: no review.json, no commit, the server ends with an error", async () => {
    const t = await rustLibrary();
    const head0 = await head(t);
    const run = webReview(
      t,
      "rust-basics",
      {},
      {
        atomic: async () => {
          throw new Error("killed");
        },
      },
    );
    const url = await run.url();
    expect((await finish(url, { own: KEEP, borrow: KEEP, trait: KEEP })).status).toBe(500);
    expect(await run.done).toBe(2);
    expect(existsSync(dirs(t).review)).toBe(false);
    expect(names(dirs(t).progress)).toEqual([]);
    expect(await head(t)).toBe(head0);
    expect(existsSync(join(t.lib, ".fullmark.lock"))).toBe(false);
  });

  it("a review that marks a question fix refuses an update that leaves it unchanged (register --update applies it, G16)", async () => {
    const t = await rustLibrary();
    const run = webReview(t, "rust-basics");
    expect((await finish(await run.url(), { own: KEEP, borrow: FIX, trait: KEEP })).status).toBe(200);
    expect(await run.done).toBe(0);
    t.write({ "notes/rust.md": quizText("rust", "Rust basics", QUESTIONS, "ui_lang: en\n") });
    const refused = await t.register(["notes/rust.md"], { update: "rust-basics" });
    expect(refused.exit).toBe(1);
    expect(refused.out.join("\n")).toContain("review.fix");
  });
});
