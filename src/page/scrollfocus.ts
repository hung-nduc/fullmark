/**
 * A highlighted code block (`.fm-hl`) that scrolls sideways takes keyboard focus, so it can be scrolled without a mouse
 * (G106): `tabindex="0"`, a group role and a name, its language or `fallback`. Whether a block scrolls depends on the
 * width it is drawn at, so it is decided here, in the browser, and again when the block's width changes; a block that
 * does not scroll is left out of the tab order. Wherever the page draws one: prompts, explanations, sample answers.
 */
const BLOCK = "pre.fm-hl";

const languageOf = (block: Element): string | null => {
  const cls = [...(block.querySelector("code")?.classList ?? [])].find((c) => c.startsWith("language-"));
  return cls === undefined ? null : cls.slice("language-".length);
};

function mark(block: HTMLElement, fallback: string): void {
  if (block.scrollWidth > block.clientWidth) {
    block.tabIndex = 0;
    block.setAttribute("role", "group");
    block.setAttribute("aria-label", languageOf(block) ?? fallback);
  } else {
    block.removeAttribute("tabindex");
    block.removeAttribute("role");
    block.removeAttribute("aria-label");
  }
}

/** Watches `root` for code blocks, now and as they are added. Returns a function that stops it. */
export function focusScrollingCode(root: HTMLElement, fallback: string): () => void {
  if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return () => undefined;
  const seen = new WeakSet<Element>();
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) mark(entry.target as HTMLElement, fallback);
  });
  const scan = (): void => {
    for (const block of root.querySelectorAll<HTMLElement>(BLOCK)) {
      if (seen.has(block)) continue;
      seen.add(block);
      resize.observe(block); // observing reports once at the start, which is the first check
    }
  };
  scan();
  const watch = new MutationObserver(scan);
  watch.observe(root, { childList: true, subtree: true });
  return () => {
    watch.disconnect();
    resize.disconnect();
  };
}
