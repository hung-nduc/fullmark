import { typingIn } from "../page/keys";
import type { Look } from "../page/store";
import { jump } from "./Form";
import { cardId } from "./parts";
import type { FormState } from "./state";

type KeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented?: boolean;
  target: { tagName?: string; type?: string; isContentEditable?: boolean } | null;
  preventDefault(): void;
};

/** Back to a button after Esc closes what it opened. */
const focusOn = (selector: string): void => {
  if (typeof document !== "undefined") document.querySelector<HTMLElement>(selector)?.focus();
};

/**
 * The form's keys (COMMANDS.md and the Brief board): `N` goes to the next question still to answer, `Q` opens and
 * closes the sidebar, `Esc` closes the Appearance menu or the sidebar (a dialog closes itself). No key acts while
 * typing in a field, with a modifier held, or while a dialog is open.
 */
export function keyHandler(state: FormState, look: Look): (event: KeyLike) => void {
  return (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (typingIn(event.target)) return;
    if (typeof document !== "undefined" && document.querySelector("dialog[open]") !== null) return;
    if (state.ended.value !== null) return;
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      const here = state.current.value === null ? null : document.getElementById(cardId(state.current.value));
      const key = state.next(here?.matches(":focus-within") === true);
      if (key !== null) jump(state, key);
      return;
    }
    if (event.key === "q" || event.key === "Q") {
      event.preventDefault();
      state.sidebar.value = !state.sidebar.value;
      return;
    }
    if (event.key === "Escape" && !event.defaultPrevented) {
      if (look.menu.value) {
        look.menu.value = false;
        focusOn("[data-action=appearance]");
      } else if (state.sidebar.value) {
        state.sidebar.value = false;
        focusOn("[data-action=sidebar]");
      }
    }
  };
}

export function installKeys(state: FormState, look: Look): () => void {
  const handler = keyHandler(state, look);
  const listener = (event: KeyboardEvent): void => handler(event as unknown as KeyLike);
  document.addEventListener("keydown", listener);
  return () => document.removeEventListener("keydown", listener);
}
