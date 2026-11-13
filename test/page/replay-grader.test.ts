import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { pageQuizOf } from "../../src/build/page";
import { type Attempt, resultsOf } from "../../src/core/attempt";
import { quizHash } from "../../src/core/hash";
import type { Quiz } from "../../src/core/ir";
import { parse } from "../../src/core/parse";
import { App } from "../../src/page/App";
import type { PageData } from "../../src/page/data";
import { createStore, type QuizState } from "../../src/page/store";
import { attemptFor } from "../helpers/grading";

/**
 * `PageReplay.grader` (STEP3.md, slice 3r; G100): the page `quiz grade --web` shows in a frame of its form opens on
 * the Missed filter, offers no Retry missed, and writes nothing to the browser. A replay without the flag is unchanged.
 */
const SOURCE = [
  "---",
  "title: Grader",
  "id: gr",
  "---",
  "",
  "## Pick the prime. {type=single id=prime}",
  "",
  "- [ ] 4",
  "- [x] 7",
  "",
  "## Pick the even. {type=single id=even}",
  "",
  "- [x] 2",
  "- [ ] 3",
  "",
].join("\n");

class Memory {
  items = new Map<string, string>();
  writes = 0;
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.items.set(k, v);
  }
  removeItem(k: string) {
    this.writes++;
    this.items.delete(k);
  }
}

function page(grader: boolean, memory = new Memory()) {
  const parsed = parse(SOURCE, "q.md");
  const quiz = parsed.quiz as Quiz;
  const hash = quizHash(SOURCE, []);
  const attempt: Attempt = {
    ...attemptFor({ prime: { choice: 0 }, even: { choice: 0 } }, ["prime", "even"]),
    quizHash: hash,
  };
  const results = `${JSON.stringify(resultsOf(attempt), null, 2)}\n`;
  const q = pageQuizOf({
    quiz,
    hash,
    assets: [],
    replay: { results, name: "r.json", attempt, applied: null, ...(grader ? { grader: true as const } : {}) },
  });
  const data: PageData = { version: 1, quizzes: [q] };
  const store = createStore(data, { storage: () => memory as unknown as Storage });
  store.restore();
  const state = store.quizzes.get("gr") as QuizState;
  return { store, state, memory, q, html: renderToString(h(App, { store })) };
}

describe("a replay page with grader: true", () => {
  it("is in the page's data only when built for the grader", () => {
    expect(page(true).q.replay?.grader).toBe(true);
    expect(page(false).q.replay).not.toHaveProperty("grader");
  });

  it("opens on the Missed filter", () => {
    expect(page(true).state.filter.value).toBe("missed");
    expect(page(false).state.filter.value).toBe("all");
    expect(page(true).html).toMatch(
      /data-filter="missed"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-filter="missed"/,
    );
  });

  it("offers no Retry missed, where a replay without the flag does", () => {
    expect(page(false).html).toContain('data-action="retry-missed"');
    const grader = page(true).html;
    expect(grader).not.toContain('data-action="retry-missed"');
    expect(grader).not.toContain('data-action="new-attempt"');
  });

  it("stores nothing in the browser, and offers no saved retry back", () => {
    const kept = new Memory();
    const l = page(true, kept);
    expect(kept.writes).toBe(0);
    l.store.sidebar("gr", true);
    l.store.look.pick("dark");
    l.store.look.step(1);
    expect(kept.writes).toBe(0);
    expect(l.state.resume.value).toBeNull();
    // the same calls on a replay without the flag are saved
    const other = new Memory();
    const o = page(false, other);
    o.store.sidebar("gr", true);
    expect(other.writes).toBeGreaterThan(0);
  });

  it("reads the look the form chose, and never keeps another", () => {
    const shared = new Memory();
    const look = `fullmark:v1:gr:${page(true).q.hash}:look`;
    shared.items.set(look, JSON.stringify({ theme: "dark" }));
    const l = page(true, shared);
    expect(l.store.look.shown.value).toBe("dark");
    expect([...shared.items.keys()]).toEqual([look]);
  });
});
