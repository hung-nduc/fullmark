import { render } from "preact";
import { applyLook } from "../page/look";
import { createFormLook } from "../review/look";
import type { GradeData } from "./data";
import { Form } from "./Form";
import { installKeys } from "./keys";
import { createGradeState } from "./state";

/**
 * The grading form's entry (bundled by `scripts/build-page.mjs` into `dist/grade.js`, an IIFE of its own beside
 * `dist/review.js`). It reads the data block and draws the form into the empty root. The saved grades are the server's:
 * the form keeps nothing of its own.
 */
const dataElement = document.getElementById("fm-data");
const root = document.getElementById("fm-root");
if (dataElement && root) {
  const data = JSON.parse(dataElement.textContent ?? "") as GradeData;
  const state = createGradeState(data);
  const store = { look: createFormLook(data.page), screen: { phone: state.phone } };
  applyLook(store);
  // below 760 px the form is a phone's (the page's `PHONE_QUERY`): the sidebar starts closed, and closes when the window
  // narrows to a phone, since there it takes the whole screen
  const narrow = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 759px)") : null;
  const onNarrow = (): void => {
    const was = state.phone.value;
    state.phone.value = narrow?.matches === true;
    if (state.phone.value && !was) state.sidebar.value = false;
  };
  onNarrow();
  narrow?.addEventListener("change", onNarrow);
  render(<Form state={state} store={store} data={data} />, root);
  installKeys(state, store);
  (window as unknown as { fullmarkGrade: unknown }).fullmarkGrade = { ready: true };
}
