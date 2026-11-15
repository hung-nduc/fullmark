import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import type { BriefData } from "../brief-form/data";
import { canonicalJson } from "../core/canonical";
import { embeddedFonts, fontFaceCss, offeredFonts } from "../core/fonts";
import { toBase64 } from "../core/keyblob";
import { themeCss } from "../core/themes";
import { fontDataUri } from "./fonts";

export type BriefFormOptions = {
  data: BriefData;
  /** `dist/brief.js`, `dist/page.css` and `dist/brief.css`, read by the CLI */
  script: string;
  css: string;
  briefCss: string;
  builtAt: string;
  version: string;
  fontData?: (path: string) => string;
};

const sha256Source = (text: string): string => `'sha256-${toBase64(sha256(utf8ToBytes(text)))}'`;

/** JSON that is safe inside a `<script>`: no `<`, and no line separators that old parsers mind. */
const scriptJson = (value: unknown): string =>
  canonicalJson(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

const escapeAttr = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * The brief form's page, built in memory (TECHNICAL_DESIGN.md, section 7, foundation 9): the page's styles and the
 * form's, the data block and the one script. It starts light or dark as the system is, in the system font, and offers
 * every theme and font (G114). The CSP allows that script and the styles by hash, and the form's own `submit`
 * (`connect-src 'self'`). Pure: the same input gives the same bytes.
 */
export function buildBriefForm(o: BriefFormOptions): string {
  if (o.script.toLowerCase().includes("</script")) throw new Error("the brief form holds a closing script tag");
  const offered = offeredFonts("all", "system");
  const css = themeCss("auto", "system", offered) + o.css + o.briefCss;
  const embedded = embeddedFonts("all", "system");
  const fontCss = embedded.length === 0 ? null : fontFaceCss(embedded, o.fontData ?? fontDataUri);
  const csp = [
    "default-src 'none'",
    `script-src ${sha256Source(o.script)}`,
    `style-src ${[css, ...(fontCss === null ? [] : [fontCss])].map(sha256Source).join(" ")}`,
    "img-src data:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "connect-src 'self'",
  ].join("; ");
  const title = o.data.lang === "vi" ? "Yêu cầu" : "Brief";
  return [
    "<!doctype html>",
    `<html lang="${o.data.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">`,
    `<meta name="generator" content="${escapeAttr(`fullmark ${o.version}; built ${o.builtAt}`)}">`,
    `<title>${escapeAttr(`${title}: ${o.data.dir}`)}</title>`,
    '<link rel="icon" href="data:,">',
    `<style>${css}</style>`,
    ...(fontCss === null ? [] : [`<style id="fm-fonts">${fontCss}</style>`]),
    "</head>",
    "<body>",
    '<div id="fm-root"></div>',
    `<script type="application/json" id="fm-data">${scriptJson(o.data)}</script>`,
    `<script>${o.script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
