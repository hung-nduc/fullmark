import { vi } from "vitest";

/**
 * Called at the top of a test file that runs real git many times per test. A git call costs about 225 ms on the owner's
 * Windows laptop against a few ms on Linux, so under the full parallel run such a test passed the 30 s default
 * (STEP6-GAPS.md, G5): on Windows the file gets 120 s a test, elsewhere the default stays.
 */
export function gitHeavy(): void {
  if (process.platform === "win32") vi.setConfig({ testTimeout: 120_000 });
}
