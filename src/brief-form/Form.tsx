import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { wordCount } from "../core/brief/defaults";
import type { Question } from "../core/brief/questions";
import { type BriefMessages, briefEn, briefVi, type CheckLevel, type ProfileWords } from "../core/i18n/brief";
import { THEME_NAMES } from "../core/themes";
import type { Look } from "../page/store";
import { blocking, countsOf, currentOf, isVague, type Mark, markOf, question, questionsOf } from "./logic";
import { COLS, COMMITMENT_START, cardId, choicesOf, displayOf, ICONS, labelOf, MORE_KEYS, STEP } from "./parts";
import type { FormState } from "./state";

type Props = { state: FormState; look: Look };

const FONTS = ["system", "sans", "serif", "readable"] as const;

function Ico({ d, size = 16, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="bf-ico"
    >
      <path d={d} />
    </svg>
  );
}

const messages = (state: FormState): BriefMessages => (state.data.lang === "vi" ? briefVi : briefEn);

/** Makes a question the current one, opens what holds it, scrolls its card into view and focuses its first control. */
export function jump(state: FormState, key: string): void {
  state.dialog.value = "none";
  if (MORE_KEYS.includes(key)) state.more.value = true;
  state.current.value = key;
  if (typeof document === "undefined") return;
  setTimeout(() => {
    const card = document.getElementById(cardId(key));
    if (!card) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    const target =
      card.querySelector<HTMLElement>("input, textarea") ??
      card.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      card.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
  }, 0);
}

// -- the bar -------------------------------------------------------------------------------------------------------

function Bar({ state, look }: Props) {
  const b = messages(state);
  const { model, kept } = state;
  const c = countsOf(model, kept.value);
  const total = questionsOf(model).length;
  const open = blocking(model, kept.value);
  const notReady = open.length;
  const ready = total - notReady;
  const ended = state.ended.value !== null;
  return (
    <header class="bf-header">
      <div class="bf-bar">
        <h1 class="bf-title">
          <span class="bf-kicker">{b.brief}</span>
          <span class="bf-dir" lang="en">
            {state.data.dir}
          </span>
        </h1>
        <span class="bf-meta">{b.meta}</span>
        <div class="bf-actions">
          {ended ? null : (
            <button
              type="button"
              class="bf-btn"
              data-action="sidebar"
              aria-expanded={state.sidebar.value}
              aria-keyshortcuts="Q"
              title={`${b.questions} (Q)`}
              data-on={state.sidebar.value ? "true" : undefined}
              onClick={() => {
                state.sidebar.value = !state.sidebar.value;
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M15 4v16" />
              </svg>
              <span class="bf-btn-text">{b.questions}</span>
            </button>
          )}
          <button
            type="button"
            class="bf-btn bf-icon-btn"
            data-action="appearance"
            aria-expanded={look.menu.value}
            aria-label={b.appearance}
            title={b.appearance}
            data-on={look.menu.value ? "true" : undefined}
            onClick={() => {
              look.menu.value = !look.menu.value;
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
            </svg>
          </button>
          {ended ? null : (
            <>
              <button
                type="button"
                class="bf-btn"
                data-action="cancel"
                disabled={state.sending.value}
                onClick={() => void state.cancel()}
              >
                {b.cancel}
              </button>
              <button
                type="button"
                class="bf-btn bf-primary"
                data-action="finish"
                disabled={state.sending.value}
                onClick={() => state.finish()}
              >
                {b.finish}
              </button>
            </>
          )}
        </div>
      </div>
      {ended ? null : (
        <ul class="bf-status" aria-label={b.questions}>
          <li class="bf-seg" data-seg="answered">
            <span>{b.answered(ready, total)}</span>
            <progress class="bf-progress" max={total} value={ready} aria-label={b.answeredAria} />
            <b>{Math.round((100 * ready) / total)}%</b>
          </li>
          <li class="bf-seg" data-seg="counts">
            <span>
              <b data-mark="you">{c.you}</b> {b.yoursW} · <b data-mark="prefilled">{c.prefilled}</b> {b.prefilledW} ·{" "}
              <b>{c.default}</b> {b.defaultW}
            </span>
          </li>
          <li class="bf-seg" data-seg="left">
            <b data-ready={notReady === 0 ? "true" : "false"}>{notReady === 0 ? b.ready : b.toAnswer(notReady)}</b>
          </li>
        </ul>
      )}
      <Menu state={state} look={look} b={b} />
    </header>
  );
}

function Menu({ look, b }: Props & { b: BriefMessages }) {
  const open = look.menu.value;
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      if (target?.closest("[data-look-menu], [data-action=appearance]")) return;
      look.menu.value = false;
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, [open, look]);
  if (!open) return null;
  return (
    <div class="fm-look-menu bf-menu" data-look-menu>
      <div class="fm-look-row">
        <span class="fm-look-label">{b.theme}</span>
        {THEME_NAMES.map((k) => (
          <button
            key={k}
            type="button"
            class="fm-pill"
            data-theme-pick={k}
            aria-pressed={look.shown.value === k}
            onClick={() => look.pick(k)}
          >
            {b.themeName[k]}
          </button>
        ))}
      </div>
      <div class="fm-look-row" data-font-row>
        <span class="fm-look-label">{b.font}</span>
        {FONTS.map((id) => (
          <button
            key={id}
            type="button"
            class={`fm-pill fm-font-${id}`}
            data-font-pick={id}
            aria-pressed={id === look.font.value}
            onClick={() => look.pickFont(id)}
          >
            {b.fontName[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

// -- a card ---------------------------------------------------------------------------------------------------------

function Revert({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button type="button" class="bf-revert" data-action="revert" onClick={onClick}>
      <Ico d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
      {text}
    </button>
  );
}

function Choices({ state, q, mark, tried }: { state: FormState; q: Question; mark: Mark; tried: boolean }) {
  const b = messages(state);
  const { model, kept } = state;
  const multi = q.kind === "multi";
  const value = currentOf(model, kept.value, q);
  const list = choicesOf(state.data, b, q);
  const cols = COLS[q.key] ?? 1;
  const labelId = `lbl-${cardId(q.key)}`;
  return (
    <fieldset class="bf-choices" aria-labelledby={labelId} style={`--cols:${cols}`} data-cols={cols}>
      {list.map((c) => {
        const on = multi ? ((value as string[] | undefined) ?? []).includes(c.value) : value === c.value;
        const classes = `bf-choice${q.key === "profile" ? " bf-mono" : ""}`;
        const flagged = mark === "missing" && tried ? "true" : undefined;
        return multi ? (
          <label key={c.value} class={classes} data-on={on ? "true" : "false"} data-flagged={flagged}>
            <input
              type="checkbox"
              class="bf-input-hidden"
              data-choice={c.value}
              checked={on}
              onChange={() => state.toggle(q, c.value)}
            />
            <span class="bf-box" aria-hidden="true">
              {on ? <Ico d="M5 12l5 5L19 7" size={12} stroke={3.5} /> : null}
            </span>
            <span class="bf-choice-text">
              <span class="bf-choice-label">{c.label}</span>
              <span class="bf-hint">{c.hint}</span>
            </span>
          </label>
        ) : (
          <button
            key={c.value}
            type="button"
            class={classes}
            data-choice={c.value}
            data-flagged={flagged}
            aria-pressed={on}
            onClick={() => state.set(q, c.value)}
          >
            <span class="bf-radio" aria-hidden="true" data-on={on ? "true" : "false"} />
            <span class="bf-choice-text">
              <span class="bf-choice-label">{c.label}</span>
              <span class="bf-hint">{c.hint}</span>
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

function NumberField({ state, q }: { state: FormState; q: Question }) {
  const b = messages(state);
  const { model, kept } = state;
  const raw = currentOf(model, kept.value, q);
  const v = typeof raw === "number" ? raw : 0;
  const optional = q.optional === true;
  const min = q.min ?? 0;
  const max = q.max;
  const step = STEP[q.key] ?? 1;
  const blank = optional && v === 0;
  // minutes may be fractional (`--minutes 37.5`), as the flags allow; the others are whole numbers
  const numeric = q.key === "minutes" ? /^\d+(\.\d+)?$/ : /^\d+$/;
  const clamp = (n: number): number => Math.max(min, max === undefined ? n : Math.min(max, n));
  const labelId = `lbl-${cardId(q.key)}`;
  const dec = (): void => {
    if (blank) return;
    state.set(q, clamp(v - step));
  };
  const inc = (): void => state.set(q, blank ? (q.key === "commitment" ? COMMITMENT_START : min) : clamp(v + step));
  const note =
    q.key === "minutes"
      ? v === 0
        ? b.noLimit
        : b.minutesW
      : q.key === "commitment"
        ? blank
          ? b.noGoalHint
          : b.pctHint
        : b.questionsW;
  return (
    <div class="bf-numrow">
      <div class="bf-slot">
        <button
          type="button"
          class="bf-slot-btn"
          data-action="dec"
          aria-label={q.key === "count" ? b.fewer : b.takeOff(step)}
          title={q.key === "count" ? b.fewer : b.takeOff(step)}
          onClick={dec}
        >
          −
        </button>
        <input
          type="number"
          class="bf-slot-input"
          aria-labelledby={labelId}
          min={min}
          max={max}
          step="any"
          value={blank ? "" : v}
          placeholder="–"
          onInput={(e) => {
            const text = (e.currentTarget as HTMLInputElement).value.trim();
            if (numeric.test(text) && Number(text) >= min && (max === undefined || Number(text) <= max)) {
              state.set(q, Number(text));
            }
          }}
          onChange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            const text = input.value.trim();
            if (text === "") state.set(q, optional ? 0 : min);
            else if (numeric.test(text)) state.set(q, clamp(Number(text)));
            const now = currentOf(model, kept.value, q);
            input.value = optional && now === 0 ? "" : String(now);
          }}
        />
        <button
          type="button"
          class="bf-slot-btn"
          data-action="inc"
          aria-label={q.key === "count" ? b.moreQ : b.add(step)}
          title={q.key === "count" ? b.moreQ : b.add(step)}
          onClick={inc}
        >
          +
        </button>
      </div>
      <span class="bf-num-note">{note}</span>
    </div>
  );
}

const PURPOSE_KEY = "purpose";

function Card({ state, q, index }: { state: FormState; q: Question; index: number }) {
  const b = messages(state);
  const lang = state.data.lang;
  const { model, kept } = state;
  const k = kept.value;
  const total = questionsOf(model).length;
  const mark = markOf(model, k, q);
  const vague = isVague(model, k, q);
  const tried = state.tried.value;
  const value = currentOf(model, k, q);
  const isCurrent = state.current.value === q.key;
  const bad = (mark === "missing" && tried) || vague;
  const id = cardId(q.key);
  const labelId = `lbl-${id}`;
  const purposeName = labelOf(
    state.data,
    b,
    question(model, PURPOSE_KEY),
    String(k.purpose ?? question(model, PURPOSE_KEY).default),
  );
  const markText =
    mark === "missing"
      ? b.mMissing
      : mark === "you"
        ? b.mYou
        : mark === "prefilled"
          ? b.mPrefilled
          : q.key === "commitment"
            ? b.mNoGoal
            : b.mDefault;
  const head =
    b.qOf(index + 1, total) +
    (q["human-only"] && !q.optional ? ` · ${b.onlyYou}` : q.optional ? ` · ${b.optional}` : "");
  const changed = state.changed();
  const follow = q["follow-up"];
  const wasChanged = changed.includes(q.key) || (follow !== undefined && changed.includes(follow.key));
  const pre = model.pre;
  const revertText = wasChanged
    ? b.revertTo(
        displayOf(
          state.data,
          b,
          model,
          k,
          q,
          pre[q.key] ?? undefined,
          follow === undefined ? undefined : String(pre[follow.key] ?? ""),
        ),
      )
    : "";
  const words = typeof value === "string" ? wordCount(value) : 0;
  const min = q["min-words"];
  // the line under the answer: a problem in red, or a quiet note
  let error: { kind: string; text: string } | null = null;
  let note: string | null = null;
  if (q.key === "scope") {
    if (vague) error = { kind: "vague", text: b.tooShort(words, min ?? 0) };
    else if (mark === "missing" && tried) error = { kind: "needed", text: b.needed };
    else if (typeof value === "string" && value !== "") note = b.words(words);
  }
  if (q.key === PURPOSE_KEY && mark === "missing") {
    if (tried) error = { kind: "needed", text: b.pickOne };
    else note = b.nothingPicked;
  }
  if (q.key === "mix" && mark === "default") note = b.followsPurpose(purposeName);
  if (q.key === "weak_topics" && value === "yes") note = b.weakNote;
  if (q.key === "profile") note = mark === "default" ? b.profileFollows(purposeName) : b.chosenProfile;
  const field = (long: boolean) => {
    const common = {
      class: "bf-field",
      "aria-labelledby": labelId,
      "data-flagged": bad ? "true" : undefined,
      "aria-invalid": bad ? ("true" as const) : undefined,
      "aria-describedby": error ? `${id}-err` : undefined,
      value: typeof value === "string" ? value : "",
      placeholder:
        q.key === "scope" ? b.scopePh : q.key === "request" || q.key === "content.elsewhere" ? b.emptyPh : undefined,
      onInput: (e: Event) => state.set(q, (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value),
    };
    return long ? <textarea {...common} rows={3} /> : <input type="text" {...common} />;
  };
  return (
    <section
      class="bf-card"
      id={id}
      aria-labelledby={labelId}
      data-qkey={q.key}
      data-mark={mark}
      data-current={isCurrent ? "true" : undefined}
      onFocusIn={() => {
        state.current.value = q.key;
      }}
    >
      <div class="bf-card-head">
        <span class="bf-card-name">
          <Ico d={ICONS[q.key] ?? ""} />
          {head}
        </span>
        <span class="bf-mark" data-mark={mark} data-testid="mark">
          {markText}
        </span>
      </div>
      <h3 class="bf-q" id={labelId}>
        {q.label[lang]}
      </h3>
      <p class="bf-help">{q.help[lang]}</p>
      {q.kind === "choice" || q.kind === "multi" || q.key === "profile" ? (
        <Choices state={state} q={q} mark={mark} tried={tried} />
      ) : null}
      {follow && Array.isArray(value) && value.includes(follow.when) ? (
        <div class="bf-follow">
          <label for={`${id}-other`} class="bf-note-label">
            {follow.label[lang]}
          </label>
          <span class="bf-hint">{follow.help[lang]}</span>
          <input
            id={`${id}-other`}
            type="text"
            class="bf-field"
            value={String(k[follow.key] ?? "")}
            placeholder={b.otherPh}
            onInput={(e) => state.setFollow(q, (e.currentTarget as HTMLInputElement).value)}
          />
        </div>
      ) : null}
      {q.kind === "text" && q.key !== "profile" ? field(q.key === "request") : null}
      {q.kind === "number" ? <NumberField state={state} q={q} /> : null}
      {q.example ? (
        <p class="bf-example">
          {b.example} <i>{q.example[lang]}</i>
        </p>
      ) : null}
      {error ? (
        <p class="bf-err" id={`${id}-err`} data-error={error.kind} aria-live="polite">
          {error.text}
        </p>
      ) : null}
      {note ? <p class="bf-note">{note}</p> : null}
      {wasChanged ? (
        <div class="bf-revert-row">
          <Revert text={revertText} onClick={() => state.revertOne(q)} />
        </div>
      ) : null}
    </section>
  );
}

function ProfileBox({ state }: { state: FormState }) {
  const b = messages(state);
  const { model, kept } = state;
  const chosen = String(currentOf(model, kept.value, questionsOf(model).find((x) => x.key === "profile") as Question));
  const level = (l: CheckLevel) => (
    <span class="bf-lvl" data-level={l}>
      {b.levels[l]}
    </span>
  );
  return (
    <div class="bf-profbox" data-profile-box>
      <h4 class="bf-prof-head">{b.profHead}</h4>
      <div class="bf-prof-list">
        {state.data.profiles.map((p) => {
          const known = (b.profiles as Record<string, ProfileWords | undefined>)[p.name];
          const own = p.file !== null || !known;
          return (
            <div class="bf-prof-row" key={p.name} data-profile={p.name} data-chosen={p.name === chosen}>
              <div class="bf-prof-id">
                <code class="bf-prof-name">{p.name}</code>
                <span class="bf-prof-for">{own ? b.profileOwn(p.file ?? "") : known.forText}</span>
                {p.name === chosen ? <span class="bf-chosen">{b.profChosen}</span> : null}
              </div>
              {own ? null : (
                <ul class="bf-prof-checks">
                  {known.checks.map((c) => (
                    <li key={c.text}>
                      {level(c.level)}
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <div class="bf-prof-row" data-every>
          <div class="bf-prof-id">
            <span class="bf-prof-every">{b.profEvery}</span>
          </div>
          <ul class="bf-prof-checks">
            <li>
              {level("fails")}
              <span>{b.profEveryText}</span>
            </li>
          </ul>
        </div>
      </div>
      <p class="bf-note">{b.profFoot}</p>
    </div>
  );
}

// -- the page -------------------------------------------------------------------------------------------------------

function Prefilled({ state }: { state: FormState }) {
  const b = messages(state);
  const n = state.changed().length;
  return (
    <div class="bf-agent" role="note" data-agent-note>
      <span class="bf-chip">{b.prefilledChip}</span>
      <p>{b.prefilledNote}</p>
      <p class="bf-note">{b.prefilledKeep}</p>
      {n > 0 ? <Revert text={b.revertAll(n)} onClick={() => state.revertAll()} /> : null}
    </div>
  );
}

function Notice({ state }: { state: FormState }) {
  const b = messages(state);
  const p = state.problem.value;
  if (p === null) return null;
  return (
    <div class="bf-notice" role="alert" data-problem>
      {p === "stopped" ? b.stopped : b.notSent(p)}
    </div>
  );
}

function Form_({ state }: { state: FormState }) {
  const b = messages(state);
  const { model } = state;
  const file = state.data.questions;
  const hasPrefill = Object.keys(model.pre).length > 0;
  const numbered = new Map(questionsOf(model).map((q, i) => [q.key, i]));
  const sections = file.sections.map((s, si) => ({
    s,
    si,
    qs: questionsOf(model).filter((q) => q.section === s.id && !MORE_KEYS.includes(q.key)),
  }));
  const more = questionsOf(model).filter((q) => MORE_KEYS.includes(q.key));
  const moreOpen = state.more.value;
  const profile = more[0];
  return (
    <>
      {hasPrefill ? <Prefilled state={state} /> : <p class="bf-intro">{b.intro}</p>}
      {sections.map(({ s, si, qs }) => (
        <div class="bf-section" key={s.id}>
          <div class="bf-section-head">
            <span class="bf-kicker">{b.step(si + 1, file.sections.length)}</span>
            <h2 class="bf-h2" id={`sec-${s.id}`}>
              {s.title[state.data.lang]}
            </h2>
          </div>
          {qs.map((q) => (
            <Card key={q.key} state={state} q={q} index={numbered.get(q.key) as number} />
          ))}
        </div>
      ))}
      {profile ? (
        <div class="bf-more">
          <button
            type="button"
            class="bf-more-btn"
            data-action="more"
            aria-expanded={moreOpen}
            onClick={() => {
              state.more.value = !moreOpen;
            }}
          >
            <Ico d="M9 6l6 6-6 6" size={14} stroke={2.5} />
            {b.more}
            <span class="bf-more-summary">{b.profileIs(String(currentOf(model, state.kept.value, profile)))}</span>
          </button>
          {moreOpen ? (
            <>
              <Card state={state} q={profile} index={numbered.get(profile.key) as number} />
              <ProfileBox state={state} />
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** The command that starts again, in a box of its own: one flag and its value per unbroken piece, and Copy. */
function Command({ state }: { state: FormState }) {
  const b = messages(state);
  const text = state.data.command;
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLPreElement>(null);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard here: select the command, so the person can copy it themselves
      const range = document.createRange();
      if (ref.current) range.selectNodeContents(ref.current);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
  };
  const parts = text.split(/ (?=--[a-z])/);
  return (
    <div class="bf-cmd" data-command>
      <div class="bf-cmd-head">
        <p>{b.cancelledLine}</p>
        <button type="button" class="bf-btn bf-cmd-copy" onClick={() => void copy()} aria-live="polite">
          {copied ? (
            <Ico d="M5 12.5l4.5 4.5L19 7" />
          ) : (
            <Ico d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          )}
          {copied ? b.copied : b.copy}
        </button>
      </div>
      <pre ref={ref} class="bf-cmd-text">
        <code>
          {parts.map((part, i) => (
            <Fragment key={part}>
              {i > 0 ? " " : null}
              <span class={part.length > 48 ? undefined : "bf-cmd-part"}>{part}</span>
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}

function Ended({ state }: { state: FormState }) {
  const b = messages(state);
  const ended = state.ended.value;
  if (ended === null) return null;
  if (ended.kind === "cancelled") {
    return (
      <section class="bf-card bf-end" role="status" data-ended="cancelled">
        <div class="bf-end-title">{b.cancelled}</div>
        <Command state={state} />
        <p class="bf-note">{b.closed}</p>
      </section>
    );
  }
  const c = ended.counts;
  const total = c.you + c.prefilled + c.default + c.missing;
  const folder = state.data.target.replace(/brief\.yaml$/, "");
  return (
    <section class="bf-card bf-end" role="status" data-ended="written">
      <div class="bf-end-title bf-ok">
        <Ico d="M5 12.5l4.5 4.5L19 7" size={22} stroke={2.5} />
        {b.written}
      </div>
      <p class="bf-strong">{b.doneLine(total, c.you + c.prefilled, c.default)}</p>
      <ul class="bf-files">
        <li>
          <code class="bf-code">{state.data.target}</code> {b.fileBrief}
        </li>
        <li>
          <code class="bf-code">{`${folder}content/`}</code> {b.fileContent}
        </li>
      </ul>
      <p class="bf-note">{b.closed}</p>
    </section>
  );
}

// -- the sidebar ----------------------------------------------------------------------------------------------------

function Glyph({ mark, vague }: { mark: Mark; vague: boolean }) {
  const m = vague ? "missing" : mark;
  return (
    <span class="bf-lg" data-mark={m} aria-hidden="true">
      {m === "you" ? "✓" : m === "prefilled" ? "✎" : m === "missing" ? "!" : ""}
    </span>
  );
}

function Side({ state }: { state: FormState }) {
  const b = messages(state);
  const { model, kept } = state;
  const lang = state.data.lang;
  const k = kept.value;
  const file = state.data.questions;
  const left = state.minutesLeft.value;
  const closes = left === null ? b.closesNever : left < 1 ? b.closesSoon : b.closesIn(left);
  return (
    <aside class="bf-side" aria-label={b.questions} data-side>
      <div class="bf-side-head">
        <h2 class="bf-side-title">{b.questions}</h2>
        <button
          type="button"
          class="bf-btn bf-icon-btn"
          data-action="close-sidebar"
          aria-label={b.closeSide}
          title={b.closeSide}
          onClick={() => {
            state.sidebar.value = false;
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div class="bf-side-body">
        {file.sections.map((s) => {
          const rows = questionsOf(model).filter((q) => q.section === s.id);
          const open = !state.folded.value[s.id];
          const m = rows.filter((q) => markOf(model, k, q) === "missing" || isVague(model, k, q)).length;
          return (
            <div class="bf-group" key={s.id}>
              <button
                type="button"
                class="bf-group-head"
                aria-expanded={open}
                data-group={s.id}
                data-open={open ? "true" : "false"}
                onClick={() => {
                  state.folded.value = { ...state.folded.value, [s.id]: open };
                }}
              >
                <Ico d="M9 6l6 6-6 6" size={12} stroke={3} />
                <span class="bf-group-title">{s.title[lang]}</span>
                <span class="bf-group-count" data-open-count={m > 0 ? "true" : undefined}>
                  {m > 0 ? b.toAnswer(m) : `${rows.length} / ${rows.length}`}
                </span>
              </button>
              {open
                ? rows.map((q) => {
                    const mark = markOf(model, k, q);
                    const vague = isVague(model, k, q);
                    return (
                      <a
                        key={q.key}
                        class="bf-row"
                        href={`#${cardId(q.key)}`}
                        data-row={q.key}
                        data-mark={vague ? "missing" : mark}
                        data-current={state.current.value === q.key ? "true" : undefined}
                        aria-current={state.current.value === q.key ? "true" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          jump(state, q.key);
                        }}
                      >
                        <Glyph mark={mark} vague={vague} />
                        <span class="bf-row-text">
                          <span class="bf-row-short">{b.short[q.key as keyof typeof b.short]}</span>
                          <span class="bf-row-sub">{displayOf(state.data, b, model, k, q)}</span>
                        </span>
                      </a>
                    );
                  })
                : null}
            </div>
          );
        })}
        <div class="bf-legend">
          <span class="bf-lgi">
            <Glyph mark="you" vague={false} />
            {b.lgYou}
          </span>
          <span class="bf-lgi">
            <Glyph mark="prefilled" vague={false} />
            {b.lgPrefilled}
          </span>
          <span class="bf-lgi">
            <Glyph mark="default" vague={false} />
            {b.lgDefault}
          </span>
          <span class="bf-lgi">
            <Glyph mark="missing" vague={false} />
            {b.lgMissing}
          </span>
          <span class="bf-lgi">
            <span class="bf-lg" data-mark="current" aria-hidden="true" />
            {b.lgCurrent}
          </span>
        </div>
        <div class="bf-keys">
          <span class="bf-lgi">
            <kbd class="bf-kbd">N</kbd> {b.keyNext}
          </span>
          <span class="bf-lgi">
            <kbd class="bf-kbd">Q</kbd> {b.keyQ}
          </span>
          <span class="bf-lgi">
            <kbd class="bf-kbd">Esc</kbd> {b.keyClose}
          </span>
        </div>
        <p class="bf-note" data-closes>
          {closes}
        </p>
      </div>
    </aside>
  );
}

// -- the dialogs ----------------------------------------------------------------------------------------------------

function Dialogs({ state }: { state: FormState }) {
  const b = messages(state);
  const kind = state.dialog.value;
  const el = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const d = el.current;
    if (d === null || kind === "none") return;
    if (!d.open) d.showModal();
    back.current?.focus();
    // gone (Go back, Esc, or a row that took the focus to its question): the focus returns to Finish unless one took it
    return () => {
      setTimeout(() => {
        if (document.activeElement === null || document.activeElement === document.body) {
          document.querySelector<HTMLElement>("[data-action=finish]")?.focus();
        }
      }, 0);
    };
  }, [kind]);
  if (kind === "none") return null;
  const { model, kept } = state;
  const k = kept.value;
  const lang = state.data.lang;
  const close = (): void => {
    state.dialog.value = "none";
  };
  if (kind === "blocked") {
    const open = blocking(model, k);
    return (
      <dialog
        ref={el}
        class="bf-dialog bf-small"
        data-dialog="blocked"
        aria-labelledby="bf-dlg-title"
        onCancel={() => {
          state.dialog.value = "none";
        }}
      >
        <h2 id="bf-dlg-title">{b.blkTitle}</h2>
        <p>{b.blkLead}</p>
        <ul class="bf-miss">
          {open.map((o) => {
            const q = questionsOf(model).find((x) => x.key === o.key) as Question;
            return (
              <li key={o.key}>
                <a
                  href={`#${cardId(o.key)}`}
                  data-miss={o.key}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(state, o.key);
                  }}
                >
                  {b.short[q.key as keyof typeof b.short]}
                </a>
                :{" "}
                {o.why === "vague" ? b.whyVague(q["min-words"] ?? 0) : o.why === "purpose" ? b.whyPurpose : b.whyScope}
              </li>
            );
          })}
        </ul>
        <div class="bf-dialog-actions">
          <button type="button" class="bf-btn" data-action="go-back" ref={back} onClick={close}>
            {b.goBack}
          </button>
        </div>
      </dialog>
    );
  }
  const c = countsOf(model, k);
  const total = questionsOf(model).length;
  return (
    <dialog
      ref={el}
      class="bf-dialog"
      data-dialog="summary"
      aria-labelledby="bf-dlg-title"
      onCancel={() => {
        state.dialog.value = "none";
      }}
    >
      <h2 id="bf-dlg-title">{b.dlgTitle}</h2>
      <p>{b.dlgBody(total, c.you, c.prefilled, c.default)}</p>
      <div class="bf-sum" data-summary>
        <div class="bf-sum-th" aria-hidden="true">
          <span class="bf-th-label">{b.colQuestion}</span>
          <span class="bf-th-cell">{b.colAnswer}</span>
          <span class="bf-th-right">{b.colBy}</span>
        </div>
        {state.data.questions.sections.map((s) => (
          <div key={s.id} class="bf-sum-group-wrap">
            <div class="bf-sum-group">{s.title[lang]}</div>
            {questionsOf(model)
              .filter((q) => q.section === s.id)
              .map((q) => {
                const mark = markOf(model, k, q);
                return (
                  <a
                    key={q.key}
                    class="bf-sumrow"
                    href={`#${cardId(q.key)}`}
                    data-sumrow={q.key}
                    data-mark={mark}
                    title={b.editAria(b.short[q.key as keyof typeof b.short])}
                    onClick={(e) => {
                      e.preventDefault();
                      jump(state, q.key);
                    }}
                  >
                    <span class="bf-cell-label">{b.short[q.key as keyof typeof b.short]}</span>
                    <span class="bf-cell-val">{displayOf(state.data, b, model, k, q)}</span>
                    <span class="bf-cell-mark">
                      {mark === "you" ? b.byYou : mark === "prefilled" ? b.byPrefilled : b.byDefault}
                    </span>
                  </a>
                );
              })}
          </div>
        ))}
      </div>
      <p class="bf-note">{b.sumHint}</p>
      <p class="bf-note">{b.dlgNote(state.data.target)}</p>
      <Notice state={state} />
      <div class="bf-dialog-actions">
        <button type="button" class="bf-btn" data-action="go-back" ref={back} onClick={close}>
          {b.goBack}
        </button>
        <button
          type="button"
          class="bf-btn bf-primary"
          data-action="write"
          disabled={state.sending.value}
          onClick={() => void state.write()}
        >
          {b.write}
        </button>
      </div>
    </dialog>
  );
}

export function Form({ state, look }: Props) {
  const b = messages(state);
  const ended = state.ended.value !== null;
  const sidebar = state.sidebar.value && !ended;
  return (
    <div class="bf" data-phase={ended ? "ended" : "asking"} lang={state.data.lang}>
      <Bar state={state} look={look} />
      <div class="bf-body">
        <main class="bf-main" data-wide={sidebar ? undefined : "false"} aria-label={b.main}>
          {state.dialog.value === "summary" ? null : <Notice state={state} />}
          {ended ? <Ended state={state} /> : <Form_ state={state} />}
        </main>
        {sidebar ? <Side state={state} /> : null}
      </div>
      <Dialogs state={state} />
    </div>
  );
}
