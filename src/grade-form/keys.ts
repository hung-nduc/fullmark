import type { LookStore } from "../page/Appearance";
import { typingIn } from "../page/keys";
import type { GradeState } from "./state";

/** Back to a button after Esc closes what it opened. */
const focusOn = (selector: string): void => {
  document.querySelector<HTMLElement>(selector)?.focus();
};

/**
 * The form's keys (COMMANDS.md, `quiz grade`, "Keys"): `Q` opens and closes the sidebar, `Esc` closes it or the
 * Appearance menu, `N` goes to the next question not graded. No key acts while typing, with a modifier held, or while
 * a dialog is open.
 */
export function installKeys(state: GradeState, store: LookStore): () => void {
  const listener = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (typingIn(event.target as { tagName?: string; type?: string; isContentEditable?: boolean } | null)) return;
    if (document.querySelector("dialog[open]") !== null) return;
    if (state.saved.value !== null) return;
    if (event.key === "q" || event.key === "Q") {
      event.preventDefault();
      state.sidebar.value = !state.sidebar.value;
    } else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      const next = state.nextUngraded();
      if (next !== null) state.current.value = next;
    } else if (event.key === "Escape" && !event.defaultPrevented) {
      if (store.look.menu.value) {
        store.look.menu.value = false;
        focusOn("[data-action=appearance]");
      } else if (state.sidebar.value) {
        state.sidebar.value = false;
        focusOn("[data-action=sidebar]");
      }
    }
  };
  document.addEventListener("keydown", listener);
  return () => document.removeEventListener("keydown", listener);
}
