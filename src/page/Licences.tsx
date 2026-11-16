import { Fragment } from "preact";
import { Icon } from "./icons";
import { tabKeys } from "./Materials";
import type { PageMessages } from "./questions/shared";

/** One package or font the page embeds. */
export type Notice = { name: string; version: string; licence: string; copyright: string };
/** What a page embeds and the licence texts it must carry (TECHNICAL_DESIGN.md, section 3, "Licences"). */
export type Licences = {
  notices: readonly Notice[];
  texts: readonly { licence: string; body: string }[];
};

/**
 * What the Information tab lists: build inputs only, so two builds of one quiz stay byte-identical. Never the Node
 * version, the operating system, a path or the user's name. An option left at its default is `null`.
 */
export type BuildInfo = {
  fullmark: string;
  /** the short version: the first 4 characters of the quiz hash */
  quiz: string;
  builtAt: string;
  /** what shapes the page: Preact, KaTeX with maths, Shiki with highlighted code, each embedded font */
  packages: readonly { name: string; version: string }[];
  options: {
    /** each option's value as used, with the value it has when not given */
    profile: string;
    fonts: string;
    uiLang: string;
    /** the interface language the quiz's front matter asks for, which `--ui-lang` may change */
    uiLangDefault: string;
    theme: string;
    look: string;
    strict: boolean;
  };
};

/** The id of the popup, which the build writes after the page's root. */
export const LICENCES_ID = "fm-licences";

/** "16 Nov 2026, 10:58" in the reader's local time (`vi`: "16 thg 11 2026, 10:58"); null when it is not a date. */
export function builtAtText(iso: string, t: PageMessages): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const two = (n: number): string => String(n).padStart(2, "0");
  const date = t.gradedOn(d.getDate(), t.monthsShort[d.getMonth()] ?? "", d.getFullYear());
  return `${date}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Opens the popup; the first time it also wires the close button, a click on the backdrop and the return of the focus. */
export function openLicences(t: PageMessages): void {
  const dialog = document.getElementById(LICENCES_ID) as HTMLDialogElement | null;
  if (dialog === null || typeof dialog.showModal !== "function") return;
  const tabs = [...dialog.querySelectorAll<HTMLElement>("[data-info-tab]")];
  const show = (name: string): void => {
    for (const tab of tabs) {
      const on = tab.dataset.infoTab === name;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = dialog.querySelector<HTMLElement>(`[data-info-panel=${tab.dataset.infoTab}]`);
      if (panel !== null) panel.hidden = !on;
    }
  };
  if (dialog.dataset.wired === undefined) {
    dialog.dataset.wired = "true";
    for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.infoTab ?? "info"));
    dialog.querySelector<HTMLElement>("[role=tablist]")?.addEventListener("keydown", (e) => tabKeys(e));
    dialog.addEventListener("click", (event) => {
      // the dialog's own box is its backdrop and padding-free edge: a click on the content has a child as its target
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => document.querySelector<HTMLElement>("[data-action=licences]")?.focus());
  }
  show("info");
  // the page's bytes keep the ISO string; the reader sees their own time zone
  const built = dialog.querySelector<HTMLElement>("[data-built-at]");
  if (built !== null) built.textContent = builtAtText(built.dataset.builtAt ?? "", t) ?? built.dataset.builtAt ?? "";
  dialog.showModal();
}

/** The ⓘ icon at the foot of the page, bottom right; "Licences" is its accessible name and tooltip. */
export function LicencesButton({ t }: { t: PageMessages }) {
  return (
    <footer class="fm-foot">
      <button
        type="button"
        class="fm-licences-button"
        data-action="licences"
        aria-label={t.licences}
        title={t.licences}
        onClick={() => openLicences(t)}
      >
        <Icon name="info" size={18} />
      </button>
    </footer>
  );
}

const TABS = ["info", "licences"] as const;

/** One row of the Information tab: a name and its value. */
const Row = ({ label, value, builtAt }: { label: string; value: string; builtAt?: string }) => (
  <div class="fm-info-row">
    <dt>{label}</dt>
    <dd data-built-at={builtAt}>{value}</dd>
  </div>
);

/** The Information tab, in two groups: the quiz, and how the page was built. */
function InfoPanel({ t, info }: { t: PageMessages; info: BuildInfo }) {
  // every option shows the value it used, then "(default)" when that is the default
  const orDefault = (value: string, fallback: string): string =>
    value === fallback ? `${value} (${t.infoDefault})` : value;
  const o = info.options;
  return (
    <div id="fm-info-panel" role="tabpanel" aria-labelledby="fm-info-tab" data-info-panel="info">
      <p class="fm-licences-intro">{t.infoIntro}</p>
      <section class="fm-info-group" aria-labelledby="fm-info-quiz">
        <h3 id="fm-info-quiz">{t.infoGroupQuiz}</h3>
        <dl class="fm-info-list">
          <Row label={t.infoQuiz} value={info.quiz} />
          <Row label={t.infoBuilt} value={info.builtAt} builtAt={info.builtAt} />
          <Row label={t.infoTheme} value={orDefault(o.theme, "auto")} />
          <Row label={t.infoLook} value={orDefault(o.look, "free")} />
          <Row label={t.infoFonts} value={orDefault(o.fonts, "quiz")} />
          <Row label={t.infoUiLang} value={orDefault(o.uiLang, o.uiLangDefault)} />
        </dl>
      </section>
      <hr class="fm-info-rule" />
      <section class="fm-info-group" aria-labelledby="fm-info-built">
        <h3 id="fm-info-built">{t.infoGroupBuilt}</h3>
        <dl class="fm-info-list">
          <Row label={t.infoFullmark} value={info.fullmark} />
          <Row label={t.infoMadeWith} value={info.packages.map((p) => `${p.name} ${p.version}`).join(", ")} />
          <Row label={t.infoProfile} value={orDefault(o.profile, "default")} />
          <Row label={t.infoStrict} value={o.strict ? t.infoOn : `${t.infoOff} (${t.infoDefault})`} />
        </dl>
      </section>
    </div>
  );
}

/**
 * The popup: two tabs, Information (build inputs) and Licences (each notice, then each distinct licence text once in a
 * scrolling area). Rendered at build, so it needs no script to be read; the runtime only switches the tabs.
 */
export function LicencesDialog({ t, licences, info }: { t: PageMessages; licences: Licences; info: BuildInfo }) {
  const names = { info: t.infoTab, licences: t.licencesTab };
  return (
    <dialog id={LICENCES_ID} class="fm-licences" aria-labelledby="fm-licences-title">
      <div class="fm-licences-box">
        <div class="fm-licences-head">
          <h2 id="fm-licences-title">{t.licencesTitle}</h2>
          <form method="dialog">
            <button type="submit" class="fm-licences-close" aria-label={t.licencesClose} title={t.licencesClose}>
              <Icon name="cross" size={18} />
            </button>
          </form>
        </div>
        <div class="fm-licences-tabs" role="tablist" aria-label={t.infoTabs}>
          {TABS.map((name, i) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`fm-${name}-tab`}
              class="fm-licences-tab"
              data-info-tab={name}
              aria-selected={i === 0}
              aria-controls={`fm-${name}-panel`}
              tabIndex={i === 0 ? 0 : -1}
            >
              {names[name]}
            </button>
          ))}
        </div>
        <InfoPanel t={t} info={info} />
        <div id="fm-licences-panel" role="tabpanel" aria-labelledby="fm-licences-tab" data-info-panel="licences" hidden>
          <p class="fm-licences-intro">{t.licencesIntro}</p>
          <ul class="fm-licences-list">
            {licences.notices.map((n) => (
              <li key={n.name}>
                <strong>{n.name}</strong>
                <span class="fm-licences-meta">{t.licenceLine(n.version, n.licence)}</span>
                <span class="fm-licences-copy">{n.copyright}</span>
              </li>
            ))}
          </ul>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling area must be reachable from the keyboard */}
          <section class="fm-licences-texts" aria-label={t.licencesTexts} tabIndex={0}>
            {licences.texts.map((text) => (
              <Fragment key={text.body}>
                <h3>
                  {text.licence === "MIT"
                    ? t.licenceMitHeading
                    : text.licence === "OFL-1.1"
                      ? t.licenceOflHeading
                      : text.licence}
                </h3>
                <pre>{text.body}</pre>
              </Fragment>
            ))}
          </section>
        </div>
      </div>
    </dialog>
  );
}
