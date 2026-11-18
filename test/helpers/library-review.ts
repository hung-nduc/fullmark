import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LibraryReviewIo, type LibraryReviewOptions, runLibraryReview } from "../../src/cli/library-review";
import type { Judged } from "../../src/core/review/reasons";
import { realLockEnv } from "../../src/library/lock";
import type { ReviewData } from "../../src/review/data";
import type { T } from "./library-grade";

/** The fixed clock of a review: local time, so that the review's date does not depend on the machine's zone. */
export const REVIEW_CLOCK = new Date(2026, 10, 19, 10, 30, 0);

export const reviewOptions = (extra: Partial<LibraryReviewOptions> = {}): LibraryReviewOptions => ({
  since: false,
  timeout: null,
  port: null,
  open: false,
  json: true,
  plain: true,
  version: "1.0.0-test",
  ...extra,
});

/** The page runtime: stand-ins, since a unit test reads the served form's data block and never runs it. */
export function reviewRuntimeIn(t: T): string {
  const runtime = join(t.dir, "runtime");
  mkdirSync(runtime, { recursive: true });
  for (const f of ["review.js", "page.css", "review.css"]) writeFileSync(join(runtime, f), `/* ${f} */`);
  return runtime;
}

/**
 * A form in progress: its output, the url once it listens, and the hands that end it. The server binds port 0, and the
 * clock, the timer, Ctrl+C, the opener and the lock's wait are injected, so nothing waits for a real one.
 */
export function webReview(
  t: T,
  name: string,
  extra: Partial<LibraryReviewOptions> = {},
  io: Partial<LibraryReviewIo> = {},
) {
  const c = t.at();
  let interrupt: (() => void) | undefined;
  let fire: (() => void) | undefined;
  const opened: string[] = [];
  const full: LibraryReviewIo = {
    ...c.io,
    now: () => REVIEW_CLOCK,
    runtimeDir: reviewRuntimeIn(t),
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
    lock: { ...realLockEnv(), waitMs: 0 },
    ...io,
  };
  const done = runLibraryReview(name, reviewOptions(extra), full);
  return {
    done,
    out: c.out,
    err: c.err,
    opened,
    interrupt: () => interrupt?.(),
    timeout: () => fire?.(),
    async url(): Promise<string> {
      for (let i = 0; i < 400; i++) {
        const line = c.out.find((l) => l.startsWith('{"status":"listening"'));
        if (line) return (JSON.parse(line) as { url: string }).url;
        const text = [...c.out, ...c.err].find((l) => l.startsWith("serving "));
        if (text) return text.slice("serving ".length).split(/\s/)[0] as string;
        await Promise.race([done, new Promise((r) => setTimeout(r, 10))]);
      }
      throw new Error(`never listened: ${c.err.join(" | ")}`);
    },
  };
}

export const post = (url: string, body: unknown) =>
  fetch(`${url}submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${new URL(url).port}` },
    body: JSON.stringify(body),
  });

/** The data block of the served form. */
export async function reviewDataOf(url: string): Promise<ReviewData> {
  const html = await (await fetch(url)).text();
  const m = /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m?.[1] ?? "") as ReviewData;
}

export const KEEP: Judged = { verdict: "keep", reasons: [], note: "" };
export const FIX: Judged = { verdict: "fix", reasons: ["unclear"], note: "" };
export const DROP: Judged = { verdict: "drop", reasons: ["duplicate"], note: "" };

/** What Finish sends: the quiz and version the form was built for, and a verdict for every question. */
export async function finish(url: string, judged: Record<string, Judged>): Promise<Response> {
  const data = await reviewDataOf(url);
  const page = data.page.quizzes[0];
  return post(url, { quizId: page.id, quizHash: page.hash, judged });
}
