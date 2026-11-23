import type { Quiz } from "../ir";
import type { Messages } from "./en";
import { en } from "./en";
import { vi } from "./vi";

/** The languages a quiz is written in. */
export type Lang = Quiz["frontMatter"]["lang"];

/**
 * The words `content.names-control` looks for in one language (TECHNICAL_DESIGN.md, section 5): the page's control
 * labels, the words about working a screen, and the phrases that contain one of those words but are ordinary text.
 */
export type ControlWords = {
  /** the page's control labels, as the catalog spells them */
  labels: readonly string[];
  /** words about working a screen */
  screen: readonly string[];
  /** words that name a control only as an instruction: followed by "the", "on", "a", "an", "here" or "this" (English only) */
  instruction: readonly string[];
  /** phrases left alone, because they are ordinary words in the language */
  leave: readonly string[];
};

/** The words about working a screen, and the phrases left alone. They are not catalog text: they are about the page. */
const SCREEN = {
  en: { screen: ["button", "sidebar", "scroll"], instruction: ["click", "tap", "press"], leave: [] },
  vi: {
    screen: ["nút", "bấm", "nhấn", "thanh bên", "cuộn"],
    instruction: [],
    leave: ["nhấn mạnh", "cuộn dây", "cuộn cảm"],
  },
} satisfies Record<Lang, Pick<ControlWords, "screen" | "instruction" | "leave">>;

type Catalog = Pick<Messages, "page">;

/** Builds the lists from the catalogs, so a renamed button renames the rule's word. A language without a list does not compile. */
export function buildControls(catalogs: Record<Lang, Catalog>): Record<Lang, ControlWords> {
  const labels = (c: Catalog): string[] => [c.page.check, c.page.submit, c.page.flag, c.page.hint];
  return {
    en: { labels: labels(catalogs.en), ...SCREEN.en },
    vi: { labels: labels(catalogs.vi), ...SCREEN.vi },
  } satisfies Record<Lang, ControlWords>;
}

/** The lists as the catalogs have them now. */
export const CONTROLS: Record<Lang, ControlWords> = buildControls({ en, vi });
