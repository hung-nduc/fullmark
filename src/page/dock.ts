// The docked block is a whole number of pixels tall: its real height is rounded up, the block's own
// min-height and `--dock-h` (the sticky sidebar's top) take that one number, so they agree to the pixel.
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
  const watch = new ResizeObserver(measure);
  watch.observe(el);
  return () => watch.disconnect();
}
