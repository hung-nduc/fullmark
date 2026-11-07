import { computed, signal } from "@preact/signals";
import { type GradeMessages, gradeEn, gradeVi } from "../core/i18n/grade";
import { num } from "../page/results";
import type { GradeData, GradeItem } from "./data";
import { acceptedValue, type Evaluated, emptyFill, entryOf, evaluate, type Fill, pressed, specOf } from "./logic";

export type Saved = { graded: number; pending: GradeItem[]; earned: number; points: number; name: string };

/** The form's state: what has been typed for each question, where the grader is, the dialog and the result. */
export function createGradeState(data: GradeData) {
  const r: GradeMessages = data.uiLang === "vi" ? gradeVi : gradeEn;
  const all = [...data.items, ...data.unanswered].sort((a, b) => a.number - b.number);
  const fills = signal<Record<string, Fill>>(Object.fromEntries(data.items.map((i) => [i.id, emptyFill(i)])));
  const current = signal<string>((data.items[0] ?? data.unanswered[0])?.id ?? "");
  const sidebar = signal(true);
  /** the sidebar groups the grader has folded (`grade`, `blank`, `auto`) */
  const fold = signal<Record<string, boolean>>({});
  const dialog = signal<"none" | "finish">("none");
  const name = signal(data.name ?? "");
  const sending = signal(false);
  const error = signal<string | null>(null);
  const saved = signal<Saved | null>(null);

  const patch = (id: string, change: (fill: Fill) => Fill): void => {
    const fill = fills.value[id];
    if (fill === undefined) return;
    fills.value = { ...fills.value, [id]: change(fill) };
  };
  const itemOf = (id: string): GradeItem | undefined => data.items.find((i) => i.id === id);

  const evaluated = computed(() =>
    Object.fromEntries(data.items.map((i) => [i.id, evaluate(i, fills.value[i.id] ?? emptyFill(i))])),
  ) as { value: Record<string, Evaluated> };

  /** The sums of the status line: questions graded, their points given, and the score so far. */
  const totals = computed(() => {
    let graded = 0;
    let earned = 0;
    let points = 0;
    for (const i of data.items) {
      const e = evaluated.value[i.id];
      if (e?.condition === "done" && e.total) {
        graded++;
        earned += e.total.earned;
        points += i.points;
      }
    }
    const round = (x: number): number => Math.round(x * 100) / 100;
    const base = data.base;
    const score = { earned: round(base.earned + earned), points: round(base.points + points) };
    return { graded, given: { earned: round(earned), points: round(points) }, score };
  });

  /** The first question after `from` that is not graded, going on from the one the grader is at. */
  const nextUngraded = (): string | null => {
    const at = all.findIndex((q) => q.id === current.value);
    for (let k = 1; k <= all.length; k++) {
      const q = all[(at + k) % all.length];
      if (q !== undefined && itemOf(q.id) !== undefined && evaluated.value[q.id]?.condition !== "done") return q.id;
    }
    return null;
  };

  return {
    data,
    r,
    all,
    fills,
    current,
    sidebar,
    fold,
    dialog,
    name,
    sending,
    error,
    saved,
    evaluated,
    totals,
    nextUngraded,
    itemOf,
    /** a value typed (or set by a button) for a criterion, or for the holistic score when `crit` is null */
    setRaw: (id: string, crit: string | null, raw: string) =>
      patch(id, (f) =>
        crit === null
          ? { ...f, score: raw }
          : { ...f, cells: { ...f.cells, [crit]: { ...(f.cells[crit] as object), raw } as Fill["cells"][string] } },
      ),
    setNote: (id: string, crit: string, note: string) =>
      patch(id, (f) => ({
        ...f,
        cells: { ...f.cells, [crit]: { ...(f.cells[crit] as Fill["cells"][string]), note } },
      })),
    setText: (id: string, which: "why" | "improve", text: string) => patch(id, (f) => ({ ...f, [which]: text })),
    setVerdict: (id: string, crit: string, verdict: "met" | "partly" | "missed" | null) =>
      patch(id, (f) => ({ ...f, verdicts: { ...f.verdicts, [crit]: verdict } })),
    /** + or − on a control */
    press: (id: string, crit: string | null, dir: 1 | -1) => {
      const item = itemOf(id);
      const fill = fills.value[id];
      if (!item || !fill) return;
      const spec = specOf(item, crit ?? undefined);
      const raw = crit === null ? fill.score : (fill.cells[crit]?.raw ?? "");
      const now = raw.trim() === "" ? null : acceptedValue(spec, raw);
      if (now === null && raw.trim() !== "") return;
      const next = pressed(spec, now, dir, item.mode === "banded");
      if (next === null) return;
      patch(id, (f) =>
        crit === null
          ? { ...f, score: num(next, data.uiLang) }
          : {
              ...f,
              cells: {
                ...f.cells,
                [crit]: { ...(f.cells[crit] as Fill["cells"][string]), raw: num(next, data.uiLang) },
              },
            },
      );
    },
    /** every score, verdict, note and text of the question */
    clear: (id: string) => {
      const item = itemOf(id);
      if (item) fills.value = { ...fills.value, [id]: emptyFill(item) };
    },
    /** the grades document of the submit: every question's entry, in the template's order */
    document: () => ({
      format: "fullmark-grades",
      version: 2,
      grader: { kind: "human", name: name.value.trim() },
      grades: Object.fromEntries(data.items.map((i) => [i.id, entryOf(i, fills.value[i.id] ?? emptyFill(i))])),
    }),
  };
}

export type GradeState = ReturnType<typeof createGradeState>;
