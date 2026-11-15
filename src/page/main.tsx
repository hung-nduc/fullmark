import { hydrate } from "preact";
import { en, vi } from "../core/i18n";
import { App } from "./App";
import type { PageData } from "./data";
import { installKeys } from "./keys";
import { applyLook } from "./look";
import { focusScrollingCode } from "./scrollfocus";
import { createStore } from "./store";

/**
 * The page runtime's entry (bundled by `scripts/build-page.mjs` into one IIFE). It reads the data block, hydrates the
 * tree the build rendered and announces itself on the attach point. It knows nothing about a server.
 */
const dataElement = document.getElementById("fm-data");
const root = document.getElementById("fm-root");
if (dataElement && root) {
  const data = JSON.parse(dataElement.textContent ?? "") as PageData;
  // `localStorage` may throw on access (a blocked or sandboxed page): the store wraps every use
  const store = createStore(data, { storage: () => window.localStorage });
  // the grader's frame (G103) has the look of the form that holds it: the form sets it, the page sets none and has no keys
  const grader = data.quizzes.some((q) => q.replay?.grader === true);
  // first: the theme, so the page never shows another one than the learner's
  if (!grader) applyLook(store);
  hydrate(<App store={store} />, root);
  focusScrollingCode(root, (data.quizzes[0]?.uiLang === "vi" ? vi : en).page.codeBlock);
  (window as unknown as { fullmark: unknown }).fullmark = { events: store.events, autosave: store.autosave };
  // after hydration, so the first render is the one the build made: then a saved attempt is restored over it
  const start = (): void => {
    store.restore();
    store.run();
    if (!grader) installKeys(store);
    store.events.emit("ready", { quizIds: [...store.quizzes.keys()] });
  };
  // a served page has a second script (the server module) after this one: it is listening before anything is emitted,
  // so a restored attempt that is submitted on the spot (its deadline passed) is heard
  if (store.served && document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}
