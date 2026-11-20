// The docked block is a whole number of pixels tall: its real height is rounded up, the block's own
// min-height and `--dock-h` (the sticky sidebar's top) take that one number, so they agree to the pixel.
//
// The block's own size cannot be what is watched: its min-height holds it at the last height, so when its content
// shrinks (the Appearance menu closes, A−, a wider window) the block does not, and an observer on it never fires
// again (step 7, the dock bug). Its children are watched instead, and again whenever one comes or goes.
export function watchDock(el: HTMLElement, target: HTMLElement): () => void {
  const measure = (): void => {
    const kept = el.style.minHeight;
    el.style.minHeight = "";
    const real = el.getBoundingClientRect().height;
    if (real === 0) {
      // not laid out (a hidden frame): keep the last whole number
      el.style.minHeight = kept;
      return;
    }
    const h = Math.ceil(real);
    el.style.minHeight = `${h}px`;
    target.style.setProperty("--dock-h", `${h}px`);
  };
  measure();
  if (typeof ResizeObserver === "undefined") return () => {};
  const sizes = new ResizeObserver(measure);
  const watchChildren = (): void => {
    sizes.disconnect();
    for (const child of Array.from(el.children)) sizes.observe(child);
  };
  watchChildren();
  // a child that comes or goes (the menu, the dialog, the review bar) changes the height without resizing another
  const list =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          watchChildren();
          measure();
        });
  list?.observe(el, { childList: true });
  return () => {
    sizes.disconnect();
    list?.disconnect();
  };
}
