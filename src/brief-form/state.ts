import { type Signal, signal } from "@preact/signals";
import { FORM_ID } from "../core/brief/form";
import type { Question, QuestionValue } from "../core/brief/questions";
import type { BriefData, BriefSubmit } from "./data";
import {
  blocking,
  type Counts,
  changedKeys,
  countsOf,
  currentOf,
  givenOf,
  inChoiceOrder,
  type Kept,
  type Model,
  modelOf,
  questionsOf,
  record,
  revert,
  revertKeys,
} from "./logic";

export type Dialog = "none" | "summary" | "blocked";

/** The card that ends the run: written (with the counts it was written with), or cancelled. */
export type Ended = { kind: "written"; counts: Counts } | { kind: "cancelled" } | null;

/** What the form holds while it is open. Nothing is stored: `brief.yaml` is the only record, written by the command. */
export type FormState = {
  data: BriefData;
  model: Model;
  kept: Signal<Kept>;
  /** the question the keys act on: the last one focused, jumped to, or answered */
  current: Signal<string | null>;
  sidebar: Signal<boolean>;
  /** below 760 px (the page's `PHONE_QUERY`): the compact bar, the foot bar, the full-screen sidebar */
  phone: Signal<boolean>;
  dialog: Signal<Dialog>;
  /** Finish was pressed once: what is missing is shown as needed */
  tried: Signal<boolean>;
  /** the sidebar's folded groups, by section id */
  folded: Signal<Record<string, boolean>>;
  /** the profile card under More options is open */
  more: Signal<boolean>;
  ended: Signal<Ended>;
  /** why the server did not take it, in its own words, or that it has stopped */
  problem: Signal<string | null>;
  sending: Signal<boolean>;
  /** minutes until the form closes, counted from when the page loaded; null: it does not close */
  minutesLeft: Signal<number | null>;
  counts(): Counts;
  /**
   * the question the `N` key goes to: the current one when it still has to be answered and the focus is not in it yet
   * (`inside` false), else the next missing or too short one after it, wrapping
   */
  next(inside: boolean): string | null;
  set(q: Question, value: QuestionValue): void;
  toggle(q: Question, value: string): void;
  setFollow(q: Question, text: string): void;
  revertOne(q: Question): void;
  revertAll(): void;
  changed(): string[];
  finish(): void;
  write(): Promise<void>;
  cancel(): Promise<void>;
};

/** Posts to the form's one submit path (`./submit`, relative to the address, which ends in a slash). */
async function post(body: BriefSubmit): Promise<{ ok: true } | { ok: false; why: string | null }> {
  try {
    const res = await fetch("submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    return { ok: false, why: (await res.text()).trim() || `HTTP ${res.status}` };
  } catch {
    return { ok: false, why: null };
  }
}

/** Whole minutes still to wait, rounded up; a minute or less is 0 (the form says "less than a minute"). */
export const minutesIn = (ms: number): number => (ms <= 60_000 ? 0 : Math.ceil(ms / 60_000));

export function createFormState(data: BriefData): FormState {
  const m = modelOf(data);
  const kept = signal<Kept>({ ...m.pre });
  const firstToAnswer = (): string | null => blocking(m, kept.value)[0]?.key ?? null;
  const current = signal<string | null>(firstToAnswer());
  const state: FormState = {
    data,
    model: m,
    kept,
    current,
    sidebar: signal(true),
    phone: signal(false),
    dialog: signal("none"),
    tried: signal(false),
    folded: signal({}),
    more: signal(false),
    ended: signal(null),
    problem: signal(null),
    sending: signal(false),
    minutesLeft: signal(data.timeout > 0 ? minutesIn(data.timeout * 1000) : null),
    counts: () => countsOf(m, kept.value),
    next(inside) {
      const all = questionsOf(m).map((q) => q.key);
      const open = new Set(blocking(m, kept.value).map((b) => b.key));
      if (!inside && current.value !== null && open.has(current.value)) return current.value;
      const from = current.value === null ? -1 : all.indexOf(current.value);
      for (let i = 1; i <= all.length; i++) {
        const key = all[(from + i) % all.length] as string;
        if (open.has(key)) return key;
      }
      return null;
    },
    set(q, value) {
      kept.value = record(m, kept.value, q, value);
      current.value = q.key;
    },
    toggle(q, value) {
      const now = (currentOf(m, kept.value, q) as string[] | undefined) ?? [];
      const next = now.includes(value) ? now.filter((v) => v !== value) : [...now, value];
      const follow = q["follow-up"];
      kept.value = record(m, kept.value, q, inChoiceOrder(q, next));
      // the follow-up's text box belongs to *other*: unticked, its text and its pre-fill are gone
      if (follow && !next.includes(follow.when)) {
        const rest = { ...kept.value };
        delete rest[follow.key];
        kept.value = rest;
      }
      current.value = q.key;
    },
    setFollow(q, text) {
      const follow = q["follow-up"];
      if (!follow) return;
      const rest = { ...kept.value };
      if (m.flagged.has(follow.key) || text !== "") rest[follow.key] = text;
      else delete rest[follow.key];
      kept.value = rest;
      current.value = q.key;
    },
    revertOne(q) {
      kept.value = revert(m, kept.value, revertKeys(q));
      current.value = q.key;
    },
    revertAll() {
      kept.value = revert(m, kept.value, Object.keys(m.pre));
    },
    changed: () => changedKeys(m, kept.value),
    finish() {
      state.tried.value = true;
      state.problem.value = null;
      state.dialog.value = blocking(m, kept.value).length > 0 ? "blocked" : "summary";
    },
    async write() {
      if (blocking(m, kept.value).length > 0 || state.sending.value) return;
      const counts = countsOf(m, kept.value);
      state.sending.value = true;
      const done = await post({ quizId: FORM_ID, given: givenOf(kept.value) });
      state.sending.value = false;
      if (done.ok) {
        state.dialog.value = "none";
        state.sidebar.value = false;
        state.ended.value = { kind: "written", counts };
      } else state.problem.value = done.why ?? "stopped";
    },
    async cancel() {
      if (state.sending.value) return;
      state.sending.value = true;
      const done = await post({ quizId: FORM_ID, cancel: true });
      state.sending.value = false;
      if (done.ok) {
        state.dialog.value = "none";
        state.sidebar.value = false;
        state.ended.value = { kind: "cancelled" };
      } else state.problem.value = done.why ?? "stopped";
    },
  };
  return state;
}
