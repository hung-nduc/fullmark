import type { ComponentChildren } from "preact";
import type { PageGradeDetail, PageGradedCriterion } from "../data";
import { dayOf } from "../replay";
import { num } from "../results";
import { type Ctx, Html } from "./shared";

/**
 * The rubric box (TECHNICAL_DESIGN.md, section 6, "The rubric box"): one component for a question's rubric and its
 * grade, read-only here (after Submit and in the replay). It is written to be shared: the head, a section, the slot,
 * the total section and the note are separate pieces that take plain props, so the grading form (3f) imports them and
 * adds its controls. None of them reads the page's store.
 */

/** Spread, so the linter does not ask for a `<fieldset>`: the box is a named group of sections, not a form's. */
const group = (labelledby: string) => ({ role: "group", "aria-labelledby": labelledby }) as const;

/** How a slot is coloured: the results map's full, part and none, `band` neutral, `no` for a missing verdict. */
export type Res = "full" | "part" | "none" | "band" | "no";

export const resOf = (value: number, max: number): Res => (value >= max ? "full" : value <= 0 ? "none" : "part");

/** A box's head: the type over the step on the left, who graded over when on the right (the date left out when none). */
export function RubricHead({
  id,
  type,
  step,
  by,
  at,
}: {
  id: string;
  type: string;
  step: string;
  by: string;
  at: string | null;
}) {
  return (
    <div class="fm-box-head">
      <span class="fm-box-side">
        <span class="fm-box-type" id={id}>
          {type}
        </span>
        {step === "" ? null : <span class="fm-box-sub">{step}</span>}
      </span>
      <span class="fm-box-side fm-box-who">
        <span class="fm-box-by">{by}</span>
        {at === null ? null : <span class="fm-box-sub">{at}</span>}
      </span>
    </div>
  );
}

/** The slot: its words for assistive technology, and what it shows (the "/" is hidden from it). */
export function RubricSlot({
  res,
  name,
  verdict = false,
  children,
}: {
  res: Res;
  name: string;
  verdict?: boolean;
  children: ComponentChildren;
}) {
  return (
    <span class="fm-slot" data-res={res} data-verdict={verdict ? "" : undefined}>
      <span class="fm-sr">{name}</span>
      <span class="fm-slot-in" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

/** A value over a maximum: "1.25 / 1.5". */
export function SlotValue({ value, of }: { value: string; of: string }) {
  return (
    <>
      <span class="fm-slot-value">{value}</span>
      <span class="fm-slot-of"> / {of}</span>
    </>
  );
}

/** A name over a muted line on the left, the slot on the right; `wide` is the verdicts' wider column. */
export function RubricRow({
  name,
  meta,
  wide,
  slot,
}: {
  name: ComponentChildren;
  meta?: string;
  wide: boolean;
  slot: ComponentChildren;
}) {
  return (
    <div class="fm-box-row" data-wide={wide ? "" : undefined}>
      <span class="fm-box-name">
        <span class="fm-box-title">{name}</span>
        {meta ? <span class="fm-box-sub">{meta}</span> : null}
      </span>
      {slot}
    </div>
  );
}

/** The note under a section's row: muted text. */
export const RubricNote = ({ text }: { text: string }) => <p class="fm-box-note">{text}</p>;

/** The total section: the card fill, the 2 px rule over it, the label in `accent` over a muted line. */
export function RubricTotal({
  label,
  how,
  wide,
  slot,
}: {
  label: string;
  how: string;
  wide: boolean;
  slot: ComponentChildren;
}) {
  return (
    <div class="fm-box-total">
      <div class="fm-box-row" data-wide={wide ? "" : undefined}>
        <span class="fm-box-name">
          <span class="fm-box-title fm-box-label">{label}</span>
          <span class="fm-box-sub">{how}</span>
        </span>
        {slot}
      </div>
    </div>
  );
}

/** "Why this score" and "To improve": a section of the box each, a label (and its muted tag) over the grader's text. */
export function RubricText({ label, tag, text }: { label: string; tag: string; text: string }) {
  return (
    <div class="fm-box-sec">
      <span class="fm-box-label-line">
        {label} <span class="fm-box-tag">· {tag}</span>
      </span>
      <p class="fm-box-note">{text}</p>
    </div>
  );
}

/**
 * What a grader gave an essay or code answer (a replay with a grades file), read-only. The numbers are the ones
 * `applyGrades` worked out; nothing is added up here.
 */
export function RubricBox({ grade, c }: { grade: PageGradeDetail; c: Ctx }) {
  const { t } = c;
  const lang = c.quiz.uiLang;
  const n = (x: number) => num(x, lang);
  const at = dayOf(grade.grader.at);
  const date = at === null ? null : t.gradedOn(at.day, t.monthsShort[at.month - 1] ?? "", at.year);
  const id = `${c.name}/grade`;
  const { mode, scale } = grade;
  const banded = mode === "banded";
  const holistic = mode === "holistic";
  const step =
    banded && scale !== null
      ? t.boxBands(n(scale.min), n(scale.max), n(scale.step))
      : grade.step === null
        ? ""
        : t.boxStep(n(grade.step));
  const sound = (name: string, shown: ComponentChildren, res: Res) => (
    <RubricSlot res={res} name={name}>
      {shown}
    </RubricSlot>
  );
  const none = (name: string) => sound(name, <span class="fm-slot-value">–</span>, "band");
  /** a criterion's slot: points (additive), a band (banded), or a verdict (holistic) */
  const slotOf = (row: PageGradedCriterion) => {
    if (holistic) {
      const v = row.verdict;
      return v === null ? (
        <RubricSlot res="no" name={t.boxNoVerdictIs} verdict>
          {t.boxNoVerdict}
        </RubricSlot>
      ) : (
        <RubricSlot
          res={v === "met" ? "full" : v === "partly" ? "part" : "none"}
          name={t.boxVerdictIs(t.gradeVerdicts[v])}
          verdict
        >
          {t.gradeVerdicts[v]}
        </RubricSlot>
      );
    }
    if (banded) {
      if (row.band === null || scale === null) return none(t.boxNoValue);
      return sound(t.boxBand(n(row.band), n(scale.max)), <SlotValue value={n(row.band)} of={n(scale.max)} />, "band");
    }
    if (row.earned === null || row.max === null) return none(t.boxNoValue);
    return sound(
      t.boxPoints(n(row.earned), n(row.max)),
      <SlotValue value={n(row.earned)} of={n(row.max)} />,
      resOf(row.earned, row.max),
    );
  };
  const total =
    banded && scale !== null && grade.band !== null
      ? sound(t.boxBand(n(grade.band), n(scale.max)), <SlotValue value={n(grade.band)} of={n(scale.max)} />, "band")
      : sound(
          t.boxPoints(n(grade.earned), n(grade.points)),
          <SlotValue value={n(grade.earned)} of={n(grade.points)} />,
          resOf(grade.earned, grade.points),
        );
  return (
    <div class="fm-box" id={id} {...group(`${id}-type`)} data-grade-mode={mode}>
      <RubricHead
        id={`${id}-type`}
        type={banded ? t.boxBanded : holistic ? t.boxHolistic : t.boxAdditive}
        step={step}
        by={t.boxGradedBy(grade.grader.name, grade.grader.kind)}
        at={date}
      />
      <ul class="fm-box-list">
        {grade.criteria.map((row, i) => (
          <li key={i} class="fm-box-sec">
            <RubricRow
              name={<Html html={row.html} tag="span" />}
              meta={holistic ? t.boxVerdictNote : undefined}
              wide={holistic}
              slot={slotOf(row)}
            />
            {row.note ? <RubricNote text={row.note} /> : null}
          </li>
        ))}
      </ul>
      <RubricTotal
        label={banded ? t.boxOverall : holistic ? t.boxScore : t.boxTotal}
        how={
          banded
            ? grade.mean !== null && grade.round !== null && scale !== null && grade.band !== null
              ? t.boxMean(n(grade.mean), grade.round, n(scale.step), n(grade.band))
              : ""
            : holistic
              ? t.boxGiven
              : t.boxSum
        }
        wide={holistic}
        slot={total}
      />
      {grade.justification !== null ? (
        <RubricText
          label={t.gradeJustification}
          tag={holistic ? t.boxRequiredOne : t.boxOptional}
          text={grade.justification}
        />
      ) : null}
      {grade.improvement !== null ? (
        <RubricText label={t.gradeImprovement} tag={t.boxOptional} text={grade.improvement} />
      ) : null}
    </div>
  );
}
