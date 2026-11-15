import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { en, vi } from "../core/i18n";
import type { GradeMessages } from "../core/i18n/grade";
import { AppearanceButton, AppearanceMenu, type LookStore } from "../page/Appearance";
import { Icon } from "../page/icons";
import { RubricHead, RubricRow, RubricTotal, resOf } from "../page/questions/RubricBox";
import { Html } from "../page/questions/shared";
import { dayOf } from "../page/replay";
import { num } from "../page/results";
import type { GradeData, GradeItem } from "./data";
import {
  acceptedValue,
  evaluate,
  type Fill,
  sameCell,
  sameImprove,
  sameScore,
  sameVerdict,
  sameWhy,
  specOf,
} from "./logic";
import type { GradeState } from "./state";

type PageT = typeof en.page;

/** Spread, so the linter does not ask for `<input type="radio">` and `<fieldset>`: these are styled segmented buttons. */
const radio = (checked: boolean) => ({ role: "radio", "aria-checked": checked }) as const;
/** A scrolling box the keyboard can reach (axe: scrollable-region-focusable). */
const reachable = { tabIndex: 0 } as const;
const group = (labelledby: string) => ({ role: "group", "aria-labelledby": labelledby }) as const;

const VERDICTS = ["met", "partly", "missed"] as const;

/** Line icons of the form's own (the page's icon set stays as it is, so a shared page does not change). */
const EraserIcon = () => (
  <svg
    class="fm-svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 17l9-10 8 7-5 6H8zM9 21h12" />
  </svg>
);
const TrashIcon = () => (
  <svg
    class="fm-svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

/** The four-point sparkle with its small star: the mark of a pre-filled value everywhere (the GradeAI board's `sparkle`). */
const SPARKLE =
  "M10 2.5l1.9 5.6 5.6 1.9-5.6 1.9L10 17.5l-1.9-5.6L2.5 10l5.6-1.9zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z";
/** The sparkle's main star, and a pencil where its small star sits (the board's `sparkleMain` and `penSmall`). */
const SPARKLE_MAIN = "M10 2.5l1.9 5.6 5.6 1.9-5.6 1.9L10 17.5l-1.9-5.6L2.5 10l5.6-1.9z";
const PEN_SMALL = "M13.2 23.2l.8-3.3 6.4-6.4a1.7 1.7 0 0 1 2.4 2.4l-6.4 6.4z";

const Sparkle = ({ size = 14 }: { size?: number }) => (
  <svg class="fm-svg fm-spark" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={SPARKLE} />
  </svg>
);
/** An AI's grade, adjusted: one drawing, the main star and the pencil haloed in the row's wash. */
const SparklePen = ({ size = 18 }: { size?: number }) => (
  <svg class="fm-svg fm-spark-pen" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path class="fm-spark-main" d={SPARKLE_MAIN} />
    <path class="fm-spark-small" d={PEN_SMALL} />
  </svg>
);
/** A person's grade, adjusted: the pencil alone. */
const PenIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    class="fm-svg fm-pen"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/**
 * A pre-filled value's box (the GradeAI board's `aiChip`): the sparkle and the value. Lit and pressed while the value is
 * as given, and a press does nothing; plain once it changed, still showing the given value, and a press puts it back.
 * `kind` is its size: `score` (76 px), `verdict` (88 px) or `text` (the small "AI's" by a label).
 */
function GivenChip({
  on,
  text,
  label,
  kind,
  restore,
}: {
  on: boolean;
  text: string;
  label: string;
  kind: "score" | "verdict" | "text";
  restore: () => void;
}) {
  return (
    <button
      type="button"
      class="fm-given"
      data-kind={kind}
      data-act="given"
      data-on={on ? "" : undefined}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={on ? undefined : restore}
    >
      <Sparkle size={kind === "text" ? 13 : 14} />
      {text === "" ? null : <span>{text}</span>}
    </button>
  );
}

/** "A, B and C": names joined as the form's language does. */
const joinNames = (r: GradeMessages, names: readonly string[]): string =>
  names.length <= 2 ? names.join(r.and) : `${names.slice(0, -1).join(", ")}${r.and}${names[names.length - 1]}`;

/** The pre-filled questions' graders with their counts, in the order they first appear: "A (2) and B (2)". */
function gradersOf(state: GradeState): string {
  const counts = new Map<string, number>();
  for (const i of state.data.items) {
    if (i.given !== null) counts.set(i.given.grader.name, (counts.get(i.given.grader.name) ?? 0) + 1);
  }
  return joinNames(
    state.r,
    [...counts].map(([name, n]) => `${name} (${n})`),
  );
}

/** The distinct graders of the pre-filled questions, in the order they first appear. */
function graderNames(data: GradeData): string[] {
  return [...new Set(data.items.flatMap((i) => (i.given === null ? [] : [i.given.grader.name])))];
}

// -- the controls ----------------------------------------------------------------------------------------------------

/** The slot [erase | − | value | +] / [max] of every mode but verdicts (RubricC, the grade side). */
function Control({
  state,
  item,
  crit,
  what,
  chip,
}: {
  state: GradeState;
  item: GradeItem;
  crit: string | null;
  what: string;
  /** `--grades`: the pre-filled box that leads the slot */
  chip?: ComponentChildren;
}) {
  const { r } = state;
  const n = (x: number) => num(x, state.data.uiLang);
  const spec = specOf(item, crit ?? undefined);
  const fill = state.fills.value[item.id] as Fill;
  const raw = crit === null ? fill.score : (fill.cells[crit]?.raw ?? "");
  const value = raw.trim() === "" ? null : acceptedValue(spec, raw);
  const invalid = raw.trim() !== "" && value === null;
  const step = spec.step ?? 0.5;
  const banded = item.mode === "banded";
  const label = banded ? r.bandOf(what) : r.pointsFor(what);
  const empty = raw === "";
  const stateAttr = invalid ? "bad" : value !== null ? "set" : undefined;
  return (
    <span class="fm-ctl" data-ctl={crit ?? "score"}>
      {chip}
      <span class="fm-ctl-group" data-state={stateAttr}>
        <button
          type="button"
          class="fm-ctl-erase"
          data-act="erase"
          aria-label={r.erase(what)}
          aria-disabled={empty}
          onClick={() => (crit === null ? state.setRaw(item.id, null, "") : state.setRaw(item.id, crit, ""))}
        >
          <EraserIcon />
        </button>
        <button
          type="button"
          class="fm-ctl-step"
          data-act="less"
          aria-label={r.less(what, n(step))}
          title={r.lessTip(n(step))}
          disabled={value !== null && value - step < spec.min - 1e-9}
          onClick={() => state.press(item.id, crit, -1)}
        >
          −
        </button>
        <input
          class="fm-ctl-value"
          type="text"
          inputMode="decimal"
          autocomplete="off"
          aria-label={label}
          aria-invalid={invalid ? "true" : undefined}
          value={raw}
          placeholder="–"
          onInput={(e) => state.setRaw(item.id, crit, (e.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="fm-ctl-step"
          data-act="more"
          aria-label={r.more(what, n(step))}
          title={r.moreTip(n(step))}
          disabled={value !== null && value + step > spec.max + 1e-9}
          onClick={() => state.press(item.id, crit, 1)}
        >
          +
        </button>
      </span>
      <span class="fm-ctl-of" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        class="fm-ctl-max"
        data-act="full"
        data-full={value !== null && value >= spec.max ? "" : undefined}
        aria-label={r.full(what, n(spec.max))}
        onClick={() => state.setRaw(item.id, crit, n(spec.max))}
      >
        {n(spec.max)}
      </button>
      {invalid ? (
        <span class="fm-ctl-error" role="alert">
          {spec.step === null ? r.offAny(n(spec.max)) : r.offStep(n(spec.min), n(spec.max), n(spec.step))}
        </span>
      ) : null}
    </span>
  );
}

/** [erase | Met | Partly | Missed]: an optional verdict, not scored, a radio group (the arrow keys move within it). */
function VerdictGroup({
  state,
  item,
  crit,
  what,
  t,
}: {
  state: GradeState;
  item: GradeItem;
  crit: string;
  what: string;
  t: PageT;
}) {
  const { r } = state;
  const chosen = (state.fills.value[item.id] as Fill).verdicts[crit] ?? null;
  const onKey = (e: KeyboardEvent): void => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const at = chosen === null ? (dir === 1 ? -1 : 3) : VERDICTS.indexOf(chosen);
    const next = VERDICTS[(at + dir + 3) % 3] as (typeof VERDICTS)[number];
    state.setVerdict(item.id, crit, next);
    queueMicrotask(() =>
      (e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`[data-verdict="${next}"]`)?.focus(),
    );
  };
  return (
    <span class="fm-ctl fm-ctl-verdicts" role="radiogroup" aria-label={r.verdictFor(what)} data-ctl={crit}>
      <button
        type="button"
        class="fm-ctl-erase"
        data-act="erase"
        aria-label={r.erase(what)}
        aria-disabled={chosen === null}
        onClick={() => state.setVerdict(item.id, crit, null)}
      >
        <EraserIcon />
      </button>
      {VERDICTS.map((v) => (
        <button
          key={v}
          type="button"
          {...radio(chosen === v)}
          class="fm-ctl-verdict"
          data-verdict={v}
          tabIndex={chosen === v || (chosen === null && v === "met") ? 0 : -1}
          onKeyDown={onKey}
          onClick={() => state.setVerdict(item.id, crit, chosen === v ? null : v)}
        >
          {t.gradeVerdicts[v]}
        </button>
      ))}
    </span>
  );
}

// -- the box ----------------------------------------------------------------------------------------------------------

const plain = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function NoteField({
  label,
  required,
  value,
  missing,
  tried,
  id,
  onInput,
}: {
  label: string;
  required: boolean;
  value: string;
  missing: string | null;
  tried: boolean;
  id: string;
  onInput: (v: string) => void;
}) {
  return (
    <div class="fm-note-field">
      <div class="fm-note-row">
        <textarea
          id={id}
          class="fm-note-input"
          rows={2}
          aria-label={label}
          aria-required={required ? "true" : undefined}
          aria-invalid={missing !== null ? "true" : undefined}
          aria-describedby={missing !== null ? `${id}-req` : undefined}
          placeholder={label}
          data-required={required ? "" : undefined}
          data-missing={missing !== null ? (tried ? "tried" : "") : undefined}
          value={value}
          onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
        />
        {required ? (
          <span class="fm-note-dot" aria-hidden="true" data-tried={missing !== null && tried ? "" : undefined} />
        ) : null}
      </div>
      {missing !== null ? (
        <span class="fm-note-missing" id={`${id}-req`}>
          {missing}
        </span>
      ) : null}
    </div>
  );
}

function Box({ state, item, t }: { state: GradeState; item: GradeItem; t: PageT }) {
  const { r } = state;
  const lang = state.data.uiLang;
  const n = (x: number) => num(x, lang);
  const fill = state.fills.value[item.id] as Fill;
  const ev = state.evaluated.value[item.id];
  const holistic = item.mode === "holistic";
  const banded = item.mode === "banded";
  const scale = item.scale;
  const id = `grade/${item.id}`;
  const step =
    banded && scale
      ? t.boxBands(n(scale.min), n(scale.max), n(scale.step))
      : item.step === null
        ? ""
        : t.boxStep(n(item.step));
  const total = ev?.total ?? null;
  const how = holistic
    ? r.holHow
    : total === null
      ? (banded ? r.bandPart : r.sumPart)(ev?.given ?? 0, ev?.of ?? item.criteria.length)
      : banded && total.mean !== null && total.band !== null && scale && item.round
        ? t.boxMean(n(total.mean), item.round, n(scale.step), n(total.band))
        : r.sumHow;
  const maxOf = banded && scale ? scale.max : item.points;
  const whyRequired = holistic && fill.score.trim() !== "";
  // `--grades`: what the file gave this question, and the grader it is from
  const given = item.given;
  const base = state.base[item.id];
  const human = given?.grader.kind === "human";
  const adjusted = state.adjusted(item.id);
  const givenTotal = given && base ? (evaluate(item, base).total ?? null) : null;
  const shownTotal = (x: { earned: number; band: number | null } | null): number | null =>
    x === null ? null : banded && x.band !== null ? x.band : x.earned;
  const head = (() => {
    if (!given) return { by: r.gradedByYou, at: r.savedAtFinish as string | null };
    const name = given.grader.name;
    const ai = given.grader.kind === "ai";
    const day = dayOf(given.grader.at ?? null);
    const date = day === null ? null : t.gradedOn(day.day, t.monthsShort[day.month - 1] ?? "", day.year);
    return adjusted
      ? { by: r.adjustedBy(`${name}${ai ? ` ${r.aiMark}` : ""}`), at: r.savedAtFinish as string | null }
      : {
          by: t.boxGradedBy(name, given.grader.kind),
          at: date === null ? r.unchanged : `${date} · ${r.unchanged}`,
        };
  })();
  /** a text's "✦ AI's" by its label (Why this score, To improve) */
  const textChip = (which: "why" | "improve", label: string) =>
    given && base ? (
      <GivenChip
        kind="text"
        on={which === "why" ? sameWhy(fill, base) : sameImprove(fill, base)}
        text={r.chipText(human)}
        label={
          (which === "why" ? sameWhy(fill, base) : sameImprove(fill, base))
            ? r.chipInUse(r.whatText(label), "", human)
            : r.chipBack(r.whatText(label), "", human)
        }
        restore={() => state.restoreText(item.id, which)}
      />
    ) : null;
  return (
    <div
      class="fm-box fm-box-edit"
      id={id}
      {...group(`${id}-type`)}
      data-grade-mode={item.mode}
      data-given={given ? "" : undefined}
    >
      <RubricHead
        id={`${id}-type`}
        type={banded ? t.boxBanded : holistic ? t.boxHolistic : t.boxAdditive}
        step={step}
        by={head.by}
        at={head.at}
      />
      <ul class="fm-box-list">
        {item.criteria.map((c) => {
          const what = plain(c.html);
          const cell = fill.cells[c.id];
          const lostCap = banded ? (scale?.max ?? 0) : (c.max ?? 0);
          const v = cell ? acceptedValue(specOf(item, c.id), cell.raw) : null;
          const lost = v !== null && v < lostCap;
          const missing = lost && (cell?.note ?? "").trim() === "";
          return (
            <li class="fm-box-sec" key={c.id} data-crit={c.id}>
              <RubricRow
                name={<Html html={c.html} tag="span" />}
                meta={holistic ? t.boxVerdictNote : undefined}
                wide={holistic}
                slot={
                  holistic ? (
                    given && base ? (
                      <span class="fm-ctl-pair">
                        <GivenChip
                          kind="verdict"
                          on={sameVerdict(c.id, fill, base)}
                          text={
                            base.verdicts[c.id]
                              ? t.gradeVerdicts[base.verdicts[c.id] as keyof typeof t.gradeVerdicts]
                              : r.none
                          }
                          label={
                            sameVerdict(c.id, fill, base)
                              ? r.chipInUse(
                                  r.whatVerdict(what),
                                  base.verdicts[c.id]
                                    ? t.gradeVerdicts[base.verdicts[c.id] as keyof typeof t.gradeVerdicts]
                                    : "",
                                  human,
                                )
                              : r.chipBack(
                                  r.whatVerdict(what),
                                  base.verdicts[c.id]
                                    ? t.gradeVerdicts[base.verdicts[c.id] as keyof typeof t.gradeVerdicts]
                                    : "",
                                  human,
                                )
                          }
                          restore={() => state.restoreVerdict(item.id, c.id)}
                        />
                        <VerdictGroup state={state} item={item} crit={c.id} what={what} t={t} />
                      </span>
                    ) : (
                      <VerdictGroup state={state} item={item} crit={c.id} what={what} t={t} />
                    )
                  ) : (
                    <Control
                      state={state}
                      item={item}
                      crit={c.id}
                      what={what}
                      chip={
                        given && base ? (
                          <GivenChip
                            kind="score"
                            on={sameCell(item, c.id, fill, base)}
                            text={base.cells[c.id]?.raw === "" ? r.none : (base.cells[c.id]?.raw ?? r.none)}
                            label={
                              sameCell(item, c.id, fill, base)
                                ? r.chipInUse(r.whatRow(what), base.cells[c.id]?.raw ?? "", human)
                                : r.chipBack(r.whatRow(what), base.cells[c.id]?.raw ?? "", human)
                            }
                            restore={() => state.restoreRow(item.id, c.id)}
                          />
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {holistic ? null : (
                <NoteField
                  id={`${id}/${c.id}/note`}
                  label={lost ? r.noteReq : r.noteOpt}
                  required={lost}
                  value={cell?.note ?? ""}
                  missing={missing ? r.noteMissing : null}
                  tried={state.tried.value}
                  onInput={(text) => state.setNote(item.id, c.id, text)}
                />
              )}
            </li>
          );
        })}
      </ul>
      <RubricTotal
        label={banded ? t.boxOverall : holistic ? t.boxScore : t.boxTotal}
        how={how}
        wide={holistic}
        slot={
          holistic ? (
            <Control
              state={state}
              item={item}
              crit={null}
              what={r.scoreName}
              chip={
                given && base ? (
                  <GivenChip
                    kind="score"
                    on={sameScore(item, fill, base)}
                    text={base.score === "" ? r.none : base.score}
                    label={
                      sameScore(item, fill, base)
                        ? r.chipInUse(r.whatScore, base.score, human)
                        : r.chipBack(r.whatScore, base.score, human)
                    }
                    restore={() => state.restoreScore(item.id)}
                  />
                ) : undefined
              }
            />
          ) : (
            <span class="fm-ctl fm-ctl-calc" data-ctl="total">
              {given && base && givenTotal ? (
                // a computed total shows the given total, display only: dashed once it differs from the rows' total
                <span
                  class="fm-given"
                  data-kind="score"
                  data-act="given"
                  data-total=""
                  data-on={shownTotal(total) === shownTotal(givenTotal) ? "" : undefined}
                  role="img"
                  aria-label={
                    shownTotal(total) === shownTotal(givenTotal)
                      ? r.totalOn(human)
                      : r.totalWas(n(shownTotal(givenTotal) as number), human)
                  }
                  title={
                    shownTotal(total) === shownTotal(givenTotal)
                      ? r.totalOn(human)
                      : r.totalWas(n(shownTotal(givenTotal) as number), human)
                  }
                >
                  <Sparkle size={14} />
                  <span>{n(shownTotal(givenTotal) as number)}</span>
                </span>
              ) : null}
              <span
                class="fm-ctl-calc-value"
                data-res={total === null ? "none" : banded ? "band" : resOf(total.earned, item.points)}
              >
                {total === null ? r.none : n(banded && total.band !== null ? total.band : total.earned)}
              </span>
              <span class="fm-ctl-of" aria-hidden="true">
                /
              </span>
              <span class="fm-ctl-max" data-static>
                {n(maxOf)}
              </span>
            </span>
          )
        }
      />
      <div class="fm-box-sec">
        <div class="fm-box-label-row">
          <span class="fm-box-label-line">
            {t.gradeJustification} <span class="fm-box-tag">· {whyRequired ? r.whyReq : t.boxOptional}</span>
          </span>
          {textChip("why", t.gradeJustification)}
        </div>
        <NoteField
          id={`${id}/why`}
          label={t.gradeJustification}
          required={whyRequired}
          value={fill.why}
          missing={whyRequired && fill.why.trim() === "" ? r.whyMissing : null}
          tried={state.tried.value}
          onInput={(text) => state.setText(item.id, "why", text)}
        />
      </div>
      <div class="fm-box-sec">
        <div class="fm-box-label-row">
          <span class="fm-box-label-line">
            {t.gradeImprovement} <span class="fm-box-tag">· {t.boxOptional}</span>
          </span>
          {textChip("improve", t.gradeImprovement)}
        </div>
        <NoteField
          id={`${id}/improve`}
          label={t.gradeImprovement}
          required={false}
          value={fill.improve}
          missing={null}
          tried={false}
          onInput={(text) => state.setText(item.id, "improve", text)}
        />
      </div>
    </div>
  );
}

/** The card badge's icon (RubricPhone's `ICON`): a clock for waiting and half graded, a mark for a note, a tick for graded. */
const BADGE_ICONS: Record<string, string> = {
  none: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  half: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  blank: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  note: "M12 7v6M12 17v.01",
  done: "M5 12.5l4.5 4.5L19 7",
  // a graded card shows the replay's result badge (COMMANDS.md, `quiz grade`, "The card's state"): RubricC's icons
  correct: "M5 12.5l4.5 4.5L19 7",
  partial: "M12 4a8 8 0 0 1 0 16z",
  incorrect: "M6 6l12 12M18 6L6 18",
};
function BadgeIcon({ condition }: { condition: string }) {
  return (
    <svg
      class="fm-svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={BADGE_ICONS[condition]} />
    </svg>
  );
}

// -- the card ---------------------------------------------------------------------------------------------------------

const kindOf = (r: GradeMessages, item: GradeItem): string => (item.type === "essay" ? r.essay : r.code);
const pointsOf = (state: GradeState, item: GradeItem): string =>
  state.r.points(num(item.points, state.data.uiLang), item.points === 1);

/** On a phone (G79): the answer open and the sample closed, each a `details` (RubricPhone), stacked. */
function PhoneAnswer({ state, item }: { state: GradeState; item: GradeItem }) {
  const { r } = state;
  const count = item.count === null ? "" : item.type === "essay" ? r.words(item.count) : r.lines(item.count);
  return (
    <>
      <details class="fm-grade-fold" data-fold="answer" open>
        <summary>{count === "" ? r.answer : `${r.answer} · ${count}`}</summary>
        {item.type === "code" ? (
          <pre class="fm-grade-fold-text" data-code lang={item.language ?? undefined}>
            {item.answer}
          </pre>
        ) : (
          <div class="fm-grade-fold-text">{item.answer}</div>
        )}
      </details>
      {item.sampleHtml === null ? null : (
        <details class="fm-grade-fold" data-fold="sample">
          <summary>{r.sample}</summary>
          <Html html={item.sampleHtml} class="fm-grade-fold-text" />
        </details>
      )}
    </>
  );
}

function Answer({ state, item }: { state: GradeState; item: GradeItem }) {
  const { r } = state;
  const [showSample, setShowSample] = useState(false);
  if (state.phone.value) return <PhoneAnswer state={state} item={item} />;
  const hasSample = item.sampleHtml !== null;
  const open = hasSample && showSample;
  const toggle = hasSample ? (
    <button
      type="button"
      class="fm-button fm-grade-sample-button"
      data-action="sample"
      aria-pressed={open}
      onClick={() => setShowSample(!open)}
    >
      {open ? r.hideSample : r.showSample}
    </button>
  ) : null;
  return (
    <div class="fm-grade-answer" data-sample={open ? "open" : "closed"}>
      <div class="fm-grade-answer-head">
        <h2>{r.answer}</h2>
        <span class="fm-grade-count">
          {item.count === null ? "" : item.type === "essay" ? r.words(item.count) : r.lines(item.count)}
        </span>
        {open ? null : toggle}
      </div>
      {open ? (
        <div class="fm-grade-answer-head fm-grade-sample-head">
          <h2>{r.sample}</h2>
          {toggle}
        </div>
      ) : null}
      {item.type === "code" ? (
        <pre class="fm-grade-answer-text" {...reachable} data-code lang={item.language ?? undefined}>
          {item.answer}
        </pre>
      ) : (
        <div class="fm-grade-answer-text" {...reachable}>
          {item.answer}
        </div>
      )}
      {open ? (
        <section class="fm-grade-answer-text fm-grade-sample-text" {...reachable} aria-label={r.sample}>
          <Html html={item.sampleHtml as string} />
        </section>
      ) : null}
    </div>
  );
}

function Sample({ state, item }: { state: GradeState; item: GradeItem }) {
  if (item.sampleHtml === null) return null;
  return (
    <details class="fm-grade-sample">
      <summary>{state.r.sample}</summary>
      <Html html={item.sampleHtml} />
    </details>
  );
}

function Card({ state, item, t }: { state: GradeState; item: GradeItem; t: PageT }) {
  const { r } = state;
  const ev = state.evaluated.value[item.id];
  const condition = ev?.condition ?? "none";
  const earned = condition === "done" ? ev?.total?.earned : undefined;
  const result =
    earned === undefined ? null : earned >= item.points ? "correct" : earned <= 0 ? "incorrect" : "partial";
  const idx = state.all.findIndex((q) => q.id === item.id);
  const prev = state.all[idx - 1];
  const next = state.all[idx + 1];
  const go = (id: string): void => {
    state.current.value = id;
  };
  return (
    <article
      class="fm-question fm-grade-card"
      data-qid={item.id}
      data-condition={condition}
      aria-label={r.qn(item.number)}
    >
      <header class="fm-grade-card-head">
        <span class="fm-grade-meta">{r.head(item.number, pointsOf(state, item), kindOf(r, item))}</span>
        <span class="fm-grade-badge" data-condition={condition} data-result={result ?? undefined}>
          <BadgeIcon condition={result ?? condition} />
          {result === null ? r.badge[condition] : t.status[result]}
          {condition === "half" && ev ? ` · ${r.halfOf(ev.given, ev.of)}` : ""}
          {result !== null && earned !== undefined
            ? ` · ${num(earned, state.data.uiLang)} / ${num(item.points, state.data.uiLang)}`
            : ""}
        </span>
      </header>
      <Html html={item.promptHtml} class="fm-grade-prompt" />
      <Answer state={state} item={item} />
      <div class="fm-grade-rubric">
        <Box state={state} item={item} t={t} />
        <div class="fm-grade-clear">
          {item.given !== null && state.adjusted(item.id) ? (
            <button
              type="button"
              class="fm-button fm-grade-undo"
              data-action="restore"
              onClick={() => state.restoreAll(item.id)}
            >
              <Sparkle size={16} /> {r.restoreAll(item.given.grader.kind === "human")}
            </button>
          ) : null}
          <button type="button" class="fm-button" data-action="clear" onClick={() => state.clear(item.id)}>
            <TrashIcon /> {r.clearQuestion}
          </button>
        </div>
      </div>
      {state.phone.value ? null : (
        <footer class="fm-grade-foot">
          <button
            type="button"
            class="fm-button"
            data-action="prev"
            disabled={prev === undefined}
            onClick={() => prev && go(prev.id)}
          >
            ← {r.prev}
          </button>
          <button
            type="button"
            class="fm-button"
            data-action="next"
            disabled={next === undefined}
            onClick={() => next && go(next.id)}
          >
            {r.next} →
          </button>
        </footer>
      )}
    </article>
  );
}

/** An essay or code question left blank (G82): read-only, nothing about it is written. */
function BlankCard({ state, item }: { state: GradeState; item: GradeItem }) {
  const { r } = state;
  const lang = state.data.uiLang;
  const idx = state.all.findIndex((q) => q.id === item.id);
  const prev = state.all[idx - 1];
  const next = state.all[idx + 1];
  return (
    <article class="fm-question fm-grade-card" data-qid={item.id} data-blank aria-label={r.qn(item.number)}>
      <header class="fm-grade-card-head">
        <span class="fm-grade-meta">{r.head(item.number, pointsOf(state, item), kindOf(r, item))}</span>
        <span class="fm-grade-badge" data-condition="blank">
          <BadgeIcon condition="blank" />
          {r.noAnswer(num(item.points, lang))}
        </span>
      </header>
      <Html html={item.promptHtml} class="fm-grade-prompt" />
      <p class="fm-grade-blank">{r.noAnswerBody(num(item.points, lang))}</p>
      {item.criteria.length > 0 ? (
        <ul class="fm-grade-criteria">
          {item.criteria.map((c) => (
            <li key={c.id}>
              <Html html={c.html} tag="span" />
              {c.max !== null ? <span class="fm-box-sub"> · {num(c.max, lang)}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Sample state={state} item={item} />
      {state.phone.value ? null : (
        <footer class="fm-grade-foot">
          <button
            type="button"
            class="fm-button"
            data-action="prev"
            disabled={prev === undefined}
            onClick={() => {
              if (prev) state.current.value = prev.id;
            }}
          >
            ← {r.prev}
          </button>
          <button
            type="button"
            class="fm-button"
            data-action="next"
            disabled={next === undefined}
            onClick={() => {
              if (next) state.current.value = next.id;
            }}
          >
            {r.next} →
          </button>
        </footer>
      )}
    </article>
  );
}

// -- the bar and the sidebar ------------------------------------------------------------------------------------------

/** What `applyLook` sets on a document root: the form's look, which its frame copies. */
const LOOK_ATTRIBUTES = ["data-theme", "data-size", "data-font"] as const;

function Bar({ state, store, t }: { state: GradeState; store: LookStore; t: PageT }) {
  const { r, data } = state;
  const lang = data.uiLang;
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dock.current;
    const root = document.documentElement;
    if (!el) return;
    const measure = (): void => root.style.setProperty("--dock-h", `${el.offsetHeight}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const at = dayOf(data.attemptAt);
  const date = at === null ? null : t.gradedOn(at.day, t.monthsShort[at.month - 1] ?? "", at.year);
  const totals = state.totals.value;
  const pre = state.prefilled.value;
  const done = state.saved.value !== null;
  const pct = totals.score.points > 0 ? Math.round((100 * totals.score.earned) / totals.score.points) : 0;
  const phone = state.phone.value;
  const here = state.all.find((q) => q.id === state.current.value);
  return (
    <header class="fm-dock" data-dock data-phone={phone ? "true" : undefined} ref={dock}>
      <div class="fm-topbar">
        {phone ? (
          <div class="fm-phone-head">
            <h1 class="fm-title">{r.phoneTitle(data.title)}</h1>
            <span class="fm-phone-line" data-compact>
              {r.gradedOf(totals.graded, data.items.length)}
              {here === undefined ? "" : ` · ${r.qn(here.number)}`}
            </span>
          </div>
        ) : (
          <h1 class="fm-title">
            <span class="fm-review-label">{r.label}</span> {data.title}
            {date === null ? null : <span class="fm-grade-attempt"> {r.attemptOf(date)}</span>}
          </h1>
        )}
        <div class="fm-topbar-actions">
          <button
            type="button"
            class={phone ? "fm-button fm-icon-button fm-side-button" : "fm-button fm-side-button"}
            data-action="sidebar"
            aria-expanded={state.sidebar.value}
            aria-keyshortcuts="Q"
            aria-label={phone ? r.questions : undefined}
            title={r.sideTitle}
            onClick={() => {
              state.sidebar.value = !state.sidebar.value;
            }}
          >
            <Icon name="panel" size={18} />
            {phone ? null : r.questions}
          </button>
          {store.look.locked && !phone ? null : <AppearanceButton t={t} store={store} />}
          {phone ? null : (
            <button
              type="button"
              class="fm-button fm-primary"
              data-action="finish"
              disabled={done}
              onClick={state.openFinish}
            >
              {r.finish}
            </button>
          )}
        </div>
      </div>
      {phone ? null : (
        <ul class="fm-status" aria-label={t.statusLabel}>
          <li class="fm-status-seg" data-seg="graded">
            {r.gradedOf(totals.graded, data.items.length)}
          </li>
          <li class="fm-status-seg" data-seg="given">
            {r.given(num(totals.given.earned, lang), num(totals.given.points, lang))}
          </li>
          <li class="fm-status-seg" data-seg="score">
            {r.scoreSoFar(num(totals.score.earned, lang), num(totals.score.points, lang), pct)}
          </li>
          {pre.total === 0 ? null : (
            // where the grades came from, once, for the whole sitting: the pill's tooltip lists the graders
            <li class="fm-status-pill" data-seg="prefilled" title={r.preFilledFrom(gradersOf(state))}>
              <Sparkle size={15} />
              <span>{r.preFilled(pre.asGiven, pre.adjusted)}</span>
            </li>
          )}
        </ul>
      )}
      {store.look.locked && !phone ? null : <AppearanceMenu t={t} store={store} />}
    </header>
  );
}

const svg = {
  class: "fm-svg",
  fill: "none",
  stroke: "currentColor",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;
const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...svg} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" stroke-width="3">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
const BangIcon = () => (
  <svg {...svg} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" stroke-width="3">
    <path d="M12 5v9M12 19v.01" />
  </svg>
);
/** Half graded: a ring with one fixed arc (about a third), "started", never a half and never a spinner (Grade board). */
const RingIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...svg} aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" stroke-width="2.5">
    <circle cx="8" cy="8" r="6" class="fm-ring-track" />
    <circle cx="8" cy="8" r="6" pathLength="100" stroke-dasharray="30 100" transform="rotate(-90 8 8)" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    {...svg}
    aria-hidden="true"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    stroke-width="3"
    data-open={open ? "" : undefined}
  >
    <path d="M7 9l5 6 5-6" />
  </svg>
);
const CloseIcon = () => (
  <svg {...svg} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" stroke-width="2">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const stateIcon = (c: "none" | "half" | "note" | "done") =>
  c === "done" ? <CheckIcon /> : c === "half" ? <RingIcon /> : c === "note" ? <BangIcon /> : null;

/** A sidebar group's head: a button with its chevron, its name and its count; it folds the group under it. */
function GroupHead({ state, id, name, count }: { state: GradeState; id: string; name: string; count: string }) {
  const open = !state.fold.value[id];
  return (
    <button
      type="button"
      class="fm-grade-group"
      data-group={id}
      aria-expanded={open}
      onClick={() => {
        state.fold.value = { ...state.fold.value, [id]: open };
      }}
    >
      <ChevronIcon open={open} />
      <span class="fm-grade-group-name">{name}</span>
      <span class="fm-grade-group-count">{count}</span>
    </button>
  );
}

function Side({ state, t }: { state: GradeState; t: PageT }) {
  const { r, data } = state;
  const lang = data.uiLang;
  const n = (x: number) => num(x, lang);
  const modeOf = (i: GradeItem): string =>
    i.mode === "banded" && i.scale
      ? (t.boxBands(n(i.scale.min), n(i.scale.max), n(i.scale.step)).split(",")[0] ?? "")
      : (i.mode === "holistic" ? t.boxHolistic : t.boxAdditive).toLowerCase();
  const gradedCount = data.items.filter((i) => state.evaluated.value[i.id]?.condition === "done").length;
  const pre = state.prefilled.value;
  const fold = state.fold.value;
  const phone = state.phone.value;
  /** a row's click: the question opens; on a phone the sidebar covers the screen, so it closes first */
  const open = (id: string): void => {
    // the same question again after the frame: the card comes back, so `marked` goes down with no change of `current`
    state.marked.value = false;
    state.current.value = id;
    if (phone) state.sidebar.value = false;
  };
  /** the "Scored by fullmark" row, chosen as a question row is (G100) */
  const openMarked = (): void => {
    state.marked.value = true;
    if (phone) state.sidebar.value = false;
  };
  const sub = (kinds: readonly (keyof typeof r.autoKinds)[]): string =>
    kinds.length === 0 ? r.autoSub : `${r.autoSub} · ${kinds.map((k) => r.autoKinds[k]).join(", ")}`;
  return (
    <aside class="fm-side fm-grade-side" aria-label={r.questions} data-phone={phone ? "" : undefined}>
      {phone ? (
        <>
          <div class="fm-back-row">
            <button
              type="button"
              class="fm-back"
              data-action="close-sidebar"
              onClick={() => {
                state.sidebar.value = false;
                document.querySelector<HTMLElement>("[data-action=sidebar]")?.focus();
              }}
            >
              <Icon name="back" size={18} stroke={2.2} />
              {t.backToQuestion(state.all.find((q) => q.id === state.current.value)?.number ?? 1)}
            </button>
          </div>
          <div class="fm-side-head">
            <h2 class="fm-side-title">{r.questions}</h2>
          </div>
        </>
      ) : (
        <div class="fm-side-head">
          <h2 class="fm-side-title">{r.questions}</h2>
          <button
            type="button"
            class="fm-button fm-side-close"
            data-action="close-sidebar"
            aria-label={r.closeSide}
            title={r.closeSide}
            onClick={() => {
              state.sidebar.value = false;
            }}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      <div class="fm-grade-side-body">
        <nav class="fm-grade-section" aria-label={r.toGrade}>
          <GroupHead state={state} id="grade" name={r.toGrade} count={r.gradedShort(gradedCount, data.items.length)} />
          {fold.grade ? null : (
            <ul class="fm-grade-list">
              {data.items.map((i) => {
                const ev = state.evaluated.value[i.id];
                const c = ev?.condition ?? "none";
                // `--grades`: where the grade came from (the sparkle: an AI; the tick: a person), and whether it was
                // changed in this sitting (a pencil); a question that is not graded keeps its state's mark
                const given = i.given;
                const changed = state.adjusted(i.id);
                const mark =
                  given === null || c !== "done"
                    ? null
                    : given.grader.kind === "ai"
                      ? changed
                        ? "ai-adjusted"
                        : "ai"
                      : changed
                        ? "person-adjusted"
                        : "person";
                const subText =
                  given === null
                    ? null
                    : c === "done"
                      ? changed
                        ? r.adjustedSub
                        : r.gradeOf(given.grader.name)
                      : r.states[c].toLowerCase();
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      class="fm-grade-row"
                      data-row={i.id}
                      data-condition={c}
                      data-mark={mark ?? undefined}
                      data-adjusted={mark !== null && changed ? "" : undefined}
                      aria-current={state.current.value === i.id && !state.marked.value ? "true" : undefined}
                      onClick={() => open(i.id)}
                    >
                      <span class="fm-grade-mark" aria-hidden="true">
                        {mark === "ai" ? (
                          <Sparkle size={15} />
                        ) : mark === "ai-adjusted" ? (
                          <SparklePen />
                        ) : mark === "person-adjusted" ? (
                          <PenIcon />
                        ) : (
                          stateIcon(c)
                        )}
                      </span>
                      <span class="fm-grade-row-text">
                        <span class="fm-grade-row-name">{r.qn(i.number)}</span>
                        <span class="fm-grade-row-sub">{subText ?? `${kindOf(r, i)} · ${modeOf(i)}`}</span>
                      </span>
                      <span class="fm-grade-row-score">
                        {ev?.total ? n(ev.total.earned) : r.none} / {n(i.points)}
                      </span>
                      <span class="fm-sr">{r.states[c]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        {data.unanswered.length > 0 ? (
          <div class="fm-grade-section">
            <GroupHead state={state} id="blank" name={r.notAnswered} count={String(data.unanswered.length)} />
            {fold.blank ? null : (
              <ul class="fm-grade-list">
                {data.unanswered.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      class="fm-grade-row"
                      data-blank
                      data-row={i.id}
                      aria-current={state.current.value === i.id && !state.marked.value ? "true" : undefined}
                      onClick={() => open(i.id)}
                    >
                      <span class="fm-grade-row-name">{r.qnKind(i.number, kindOf(r, i))}</span>
                      <span class="fm-grade-row-score">0 / {n(i.points)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <div class="fm-grade-section">
          <GroupHead
            state={state}
            id="auto"
            name={r.autoHead}
            count={`${n(data.auto.earned)} / ${n(data.auto.points)}`}
          />
          {fold.auto ? null : (
            <button
              type="button"
              class="fm-grade-row fm-grade-auto"
              data-auto
              data-condition="done"
              aria-current={state.marked.value ? "true" : undefined}
              onClick={openMarked}
            >
              <span class="fm-grade-mark" aria-hidden="true">
                <CheckIcon />
              </span>
              <span class="fm-grade-row-text">
                <span class="fm-grade-row-name">{r.autoTitle(data.auto.count)}</span>
                <span class="fm-grade-row-sub">{sub(data.auto.kinds)}</span>
              </span>
              <span class="fm-grade-row-score">
                {n(data.auto.earned)} / {n(data.auto.points)}
              </span>
            </button>
          )}
        </div>
        {pre.total > 0 ? (
          <div class="fm-grade-legend" data-legend data-given>
            <span>
              <span class="fm-grade-key" data-key="ai">
                <Sparkle size={11} />
              </span>
              {r.legendAi}
            </span>
            <span>
              <span class="fm-grade-key" data-key="ai">
                <SparklePen size={13} />
              </span>
              {r.legendAiAdjusted}
            </span>
            <span>
              <span class="fm-grade-key" data-key="done">
                <CheckIcon size={10} />
              </span>
              {r.legendPerson}
            </span>
            <span>
              <span class="fm-grade-key" data-key="pen">
                <PenIcon size={11} />
              </span>
              {r.legendPersonAdjusted}
            </span>
            <span>
              <span class="fm-grade-key" data-key="note">
                <BangIcon />
              </span>
              {r.states.note}
            </span>
            <span>
              <span class="fm-grade-key" data-key="current" />
              {r.current}
            </span>
          </div>
        ) : (
          <div class="fm-grade-legend" data-legend>
            <span>
              <span class="fm-grade-key" data-key="done">
                <CheckIcon size={10} />
              </span>
              {r.states.done}
            </span>
            <span>
              <span class="fm-grade-key" data-key="half">
                <RingIcon />
              </span>
              {r.states.half}
            </span>
            <span>
              <span class="fm-grade-key" data-key="note">
                <BangIcon />
              </span>
              {r.states.note}
            </span>
            <span>
              <span class="fm-grade-key" data-key="none" />
              {r.states.none}
            </span>
            <span>
              <span class="fm-grade-key" data-key="current" />
              {r.current}
            </span>
            <span>
              <span class="fm-grade-key" data-key="required">
                <i />
              </span>
              {r.required}
            </span>
          </div>
        )}
        <p class="fm-grade-keys">
          <span>
            <kbd>N</kbd> {r.keyNext}
          </span>
          <span>
            <kbd>Q</kbd> {r.keyQuestions}
          </span>
          <span>
            <kbd>Esc</kbd> {r.keyClose}
          </span>
        </p>
      </div>
    </aside>
  );
}

// -- Finish and the saved card ----------------------------------------------------------------------------------------

function Dialog({ state }: { state: GradeState }) {
  const { r, data } = state;
  const lang = data.uiLang;
  const n = (x: number) => num(x, lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = state.dialog.value === "finish";
  useLayoutEffect(() => {
    const el = dialog.current;
    if (el === null || !open) return;
    if (!el.open) el.showModal();
  }, [open]);
  if (!open) return null;
  const close = (goTo: string | null = null): void => {
    state.dialog.value = "none";
    state.error.value = null;
    dialog.current?.close();
    if (goTo !== null) state.current.value = goTo;
    else document.querySelector<HTMLElement>("[data-action=finish]")?.focus();
  };
  const problems = data.items.flatMap((i) =>
    (state.evaluated.value[i.id]?.problems ?? []).map((p) => ({ item: i, p })),
  );
  const totals = state.totals.value;
  const left = data.items.filter((i) => state.evaluated.value[i.id]?.condition !== "done");
  const none = totals.graded === 0;
  const fromFlag = data.name !== null;
  const nameOk = state.name.value.trim() !== "";
  const save = async (): Promise<void> => {
    state.sending.value = true;
    state.error.value = null;
    try {
      const reply = await fetch("./submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: data.quizId, quizHash: data.quizHash, grades: state.document() }),
      });
      if (reply.ok) {
        const who = (fromFlag ? data.name : state.name.value.trim()) as string;
        state.saved.value = {
          graded: totals.graded,
          pending: left,
          earned: totals.score.earned,
          points: totals.score.points,
          name: who,
        };
        state.dialog.value = "none";
        dialog.current?.close();
      } else state.error.value = `${r.refused} ${await reply.text()}`;
    } catch {
      state.error.value = r.failed;
    } finally {
      state.sending.value = false;
    }
  };
  return (
    <dialog
      ref={dialog}
      class="fm-dialog fm-grade-dialog"
      data-grade-dialog={problems.length > 0 ? "blocked" : "finish"}
      aria-labelledby="fm-grade-dialog-title"
      onCancel={() => {
        state.dialog.value = "none";
      }}
    >
      <h2 id="fm-grade-dialog-title">{problems.length > 0 ? r.blockedT : r.finishT}</h2>
      {problems.length > 0 ? (
        <>
          <p>{r.blockedBody}</p>
          <ul class="fm-grade-problems">
            {problems.map(({ item, p }) => (
              <li key={`${item.id}-${p}`}>
                <a
                  href={`#${item.id}`}
                  data-problem={item.id}
                  onClick={(e) => {
                    e.preventDefault();
                    close(item.id);
                  }}
                >
                  {r.qn(item.number)}
                </a>
                : {r.problems[p]}
              </li>
            ))}
          </ul>
          <div class="fm-dialog-actions">
            <button type="button" class="fm-button" data-action="dialog-back" autofocus onClick={() => close()}>
              {r.goBack}
            </button>
          </div>
        </>
      ) : (
        <>
          {none ? (
            <p>{r.nothing}</p>
          ) : (
            <>
              <p>{r.summary(totals.graded, data.items.length, n(totals.given.earned), n(totals.given.points))}</p>
              {left.length > 0 ? (
                <p class="fm-grade-dialog-note">{r.pending(left.map((i) => r.qn(i.number)).join(", "), left.length)}</p>
              ) : null}
            </>
          )}
          {fromFlag ? (
            <p>{r.gradedAs(data.name as string)}</p>
          ) : (
            <label class="fm-grade-name">
              <span>{r.yourName}</span>
              <input
                type="text"
                data-field="name"
                autocomplete="off"
                value={state.name.value}
                onInput={(e) => {
                  state.name.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
              <span class="fm-grade-dialog-note">{r.nameHelp}</span>
            </label>
          )}
          {state.error.value !== null ? (
            <p class="fm-grade-error" role="alert">
              {state.error.value}
            </p>
          ) : null}
          <div class="fm-dialog-actions">
            <button type="button" class="fm-button" data-action="dialog-back" autofocus onClick={() => close()}>
              {r.goBack}
            </button>
            <button
              type="button"
              class="fm-button fm-primary"
              data-action="save"
              disabled={none || (!fromFlag && !nameOk) || state.sending.value}
              onClick={() => void save()}
            >
              {state.sending.value ? r.saving : r.saveGrades}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

function SavedCard({ state }: { state: GradeState }) {
  const { r, data } = state;
  const s = state.saved.value;
  if (s === null) return null;
  const n = (x: number) => num(x, data.uiLang);
  const pct = s.points > 0 ? Math.round((100 * s.earned) / s.points) : 0;
  return (
    <section class="fm-question fm-grade-saved" role="status" data-grade-saved>
      <h2 class="fm-grade-saved-title">
        <CheckIcon size={22} /> {r.saved}
      </h2>
      <p class="fm-grade-saved-score">{r.doneScore(n(s.earned), n(s.points), pct)}</p>
      <p>{r.doneGraded(s.graded, s.name, s.pending.map((i) => r.qn(i.number)).join(", "))}</p>
      {graderNames(data).length === 0 ? null : <p>{r.reviewing(joinNames(r, graderNames(data)))}</p>}
      <ul class="fm-grade-files">
        <li>
          <code>{data.files.grades}</code> {r.gradesFile}
        </li>
        <li>
          <code>{data.files.report}</code> {r.reportFile}
        </li>
      </ul>
      <p class="fm-grade-dialog-note">{r.closed}</p>
    </section>
  );
}

/** On a phone: ← Previous, Finish and Next → docked at the foot of the screen (RubricPhone's foot bar, G79). */
function Footbar({ state, covered }: { state: GradeState; covered: boolean }) {
  const { r } = state;
  const idx = state.all.findIndex((q) => q.id === state.current.value);
  const prev = state.all[idx - 1];
  const next = state.all[idx + 1];
  const go = (id: string | undefined): void => {
    if (id !== undefined) state.current.value = id;
  };
  return (
    <div class="fm-footbar" data-footbar data-covered={covered ? "true" : undefined}>
      <button
        type="button"
        class="fm-button fm-icon-button"
        data-action="prev"
        aria-label={r.prevName}
        title={r.prevName}
        disabled={prev === undefined}
        onClick={() => go(prev?.id)}
      >
        <Icon name="back" size={18} />
      </button>
      <button type="button" class="fm-button fm-primary" data-action="finish" onClick={state.openFinish}>
        {r.finish}
      </button>
      <button
        type="button"
        class="fm-button fm-icon-button"
        data-action="next"
        aria-label={r.nextName}
        title={r.nextName}
        disabled={next === undefined}
        onClick={() => go(next?.id)}
      >
        <span class="fm-flip">
          <Icon name="back" size={18} />
        </span>
      </button>
    </div>
  );
}

export function Form({
  state,
  store,
  data,
}: {
  state: GradeState;
  store: LookStore;
  data: GradeData;
}): ComponentChildren {
  const t: PageT = data.uiLang === "vi" ? vi.page : en.page;
  const done = state.saved.value !== null;
  const item = state.all.find((q) => q.id === state.current.value);
  const isBlank = item !== undefined && data.unanswered.includes(item);
  // a question opened by the sidebar or the keys starts at the top of its card
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.current.value, done, state.marked.value]);
  // the frame is made the first time the row is chosen and kept (hidden) after, so the replay keeps its scroll and filter
  const made = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const marked = state.marked.value && !done;
  if (marked) made.current = true;
  // the frame follows the form's look (G103): its theme, text size and font are the form's own, set when it loads and
  // whenever they change; the frame's page sets none and stores none
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const root = document.documentElement;
    const copy = (): void => {
      const target = el.contentDocument?.documentElement;
      if (!target) return;
      for (const name of LOOK_ATTRIBUTES) {
        const value = root.getAttribute(name);
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
    copy();
    el.addEventListener("load", copy);
    const watch = new MutationObserver(copy);
    watch.observe(root, { attributes: true, attributeFilter: [...LOOK_ATTRIBUTES] });
    return () => {
      el.removeEventListener("load", copy);
      watch.disconnect();
    };
  }, [made.current]);
  const phone = state.phone.value;
  // on a phone an open sidebar takes the screen: what is under it is not there (as Review's)
  const covered = phone && state.sidebar.value && !done;
  return (
    <div
      class="fm-quiz fm-grade"
      data-quiz={data.quizId}
      data-phase={done ? "saved" : "grading"}
      data-phone={phone ? "true" : undefined}
    >
      <Bar state={state} store={store} t={t} />
      <div class="fm-body" data-side={state.sidebar.value && !done ? "open" : "closed"}>
        <main
          class="fm-main"
          lang={data.uiLang}
          aria-label={marked ? state.r.autoHead : undefined}
          data-covered={covered ? "true" : undefined}
          data-marked={marked ? "" : undefined}
        >
          {made.current ? (
            <iframe
              ref={frame}
              class="fm-grade-frame"
              data-frame="marked"
              src="./marked"
              title={state.r.markedTitle(data.auto.count)}
              hidden={!marked}
            />
          ) : null}
          {done ? (
            <SavedCard state={state} />
          ) : marked || item === undefined ? null : isBlank ? (
            <BlankCard key={item.id} state={state} item={item} />
          ) : (
            <Card key={item.id} state={state} item={item} t={t} />
          )}
        </main>
        {state.sidebar.value && !done ? <Side state={state} t={t} /> : null}
      </div>
      {phone && !done ? <Footbar state={state} covered={covered} /> : null}
      <Dialog state={state} />
    </div>
  );
}
