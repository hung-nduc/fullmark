import { render } from "preact";
import { applyLook } from "../page/look";
import { createFormLook } from "../review/look";
import type { BriefData } from "./data";
import { Form } from "./Form";
import { installKeys } from "./keys";
import { createFormState, minutesIn } from "./state";

/**
 * The brief form's entry (bundled by `scripts/build-page.mjs` into `dist/brief.js`, an IIFE of its own beside
 * `dist/review.js`). It reads the data block and draws the form into the empty root. The form starts in light or dark
 * as the system is, in the system font (G114); a choice in Appearance lasts while the page is open and is not stored.
 * The brief is the command's: the form keeps nothing of its own.
 */
const dataElement = document.getElementById("fm-data");
const root = document.getElementById("fm-root");
if (dataElement && root) {
  const data = JSON.parse(dataElement.textContent ?? "") as BriefData;
  const state = createFormState(data);
  const look = createFormLook({
    theme: "auto",
    look: "free",
    font: "system",
    fonts: ["system", "sans", "serif", "readable"],
  });
  applyLook({ look });
  // below 760 px (the page's `PHONE_QUERY`) the form is a phone's: the sidebar starts closed, and closes when the window
  // narrows to a phone, since there it takes the whole screen
  const narrow = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 759px)") : null;
  const onNarrow = (): void => {
    const was = state.phone.value;
    state.phone.value = narrow?.matches === true;
    if (state.phone.value && !was) state.sidebar.value = false;
  };
  onNarrow();
  narrow?.addEventListener("change", onNarrow);
  state.sidebar.value = !state.phone.value;
  render(<Form state={state} look={look} />, root);
  installKeys(state, look);
  // the minutes left, counted from when the page loaded (G113), updated each minute
  if (data.timeout > 0) {
    const loaded = Date.now();
    setInterval(() => {
      state.minutesLeft.value = minutesIn(data.timeout * 1000 - (Date.now() - loaded));
    }, 60_000);
  }
  (window as unknown as { fullmarkBrief: unknown }).fullmarkBrief = { ready: true };
}
