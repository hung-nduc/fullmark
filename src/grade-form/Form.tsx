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
import { acceptedValue, type Fill, specOf } from "./logic";
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

// -- the controls ----------------------------------------------------------------------------------------------------

/** The slot [erase | − | value | +] / [max] of every mode but verdicts (RubricC, the grade side). */
function Control({
  state,
  item,
  crit,
  what,
}: {
  state: GradeState;
  item: GradeItem;
  crit: string | null;
  what: string;
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
  return (
    <div class="fm-box fm-box-edit" id={id} {...group(`${id}-type`)} data-grade-mode={item.mode}>
      <RubricHead
        id={`${id}-type`}
        type={banded ? t.boxBanded : holistic ? t.boxHolistic : t.boxAdditive}
        step={step}
        by={r.gradedByYou}
        at={r.savedAtFinish}
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
                    <VerdictGroup state={state} item={item} crit={c.id} what={what} t={t} />
                  ) : (
                    <Control state={state} item={item} crit={c.id} what={what} />
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
            <Control state={state} item={item} crit={null} what={r.scoreName} />
          ) : (
            <span class="fm-ctl fm-ctl-calc" data-ctl="total">
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
        <span class="fm-box-label-line">
          {t.gradeJustification} <span class="fm-box-tag">· {whyRequired ? r.whyReq : t.boxOptional}</span>
        </span>
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
        <span class="fm-box-label-line">
          {t.gradeImprovement} <span class="fm-box-tag">· {t.boxOptional}</span>
        </span>
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
        <span class="fm-grade-meta">{r.head(item.number, kindOf(r, item), pointsOf(state, item))}</span>
        <span class="fm-grade-badge" data-condition={condition}>
          {r.badge[condition]}
          {condition === "half" && ev ? ` · ${r.halfOf(ev.given, ev.of)}` : ""}
          {condition === "done" && ev?.total
            ? ` · ${num(ev.total.earned, state.data.uiLang)} / ${num(item.points, state.data.uiLang)}`
            : ""}
        </span>
      </header>
      <Html html={item.promptHtml} class="fm-grade-prompt" />
      <Answer state={state} item={item} />
      <div class="fm-grade-rubric">
        <Box state={state} item={item} t={t} />
        <div class="fm-grade-clear">
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
        <span class="fm-grade-meta">{r.head(item.number, kindOf(r, item), pointsOf(state, item))}</span>
        <span class="fm-grade-badge" data-condition="blank">
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
  const fold = state.fold.value;
  const phone = state.phone.value;
  /** a row's click: the question opens; on a phone the sidebar covers the screen, so it closes first */
  const open = (id: string): void => {
    state.current.value = id;
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
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      class="fm-grade-row"
                      data-row={i.id}
                      data-condition={c}
                      aria-current={state.current.value === i.id ? "true" : undefined}
                      onClick={() => open(i.id)}
                    >
                      <span class="fm-grade-mark" aria-hidden="true">
                        {stateIcon(c)}
                      </span>
                      <span class="fm-grade-row-text">
                        <span class="fm-grade-row-name">{r.qn(i.number)}</span>
                        <span class="fm-grade-row-sub">
                          {kindOf(r, i)} · {modeOf(i)}
                        </span>
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
                      aria-current={state.current.value === i.id ? "true" : undefined}
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
            <div class="fm-grade-row fm-grade-auto" data-auto data-condition="done">
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
            </div>
          )}
        </div>
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
  }, [state.current.value, done]);
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
        <main class="fm-main" lang={data.uiLang} data-covered={covered ? "true" : undefined}>
          {done ? (
            <SavedCard state={state} />
          ) : item === undefined ? null : isBlank ? (
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
