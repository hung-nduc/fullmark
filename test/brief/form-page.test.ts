import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import type { BriefData } from "../../src/brief-form/data";
import { buildBriefForm } from "../../src/build/brief-form";
import { loadQuestions } from "../../src/cli/brief-questions";
import { briefEn, briefVi } from "../../src/core/i18n/brief";
import { toBase64 } from "../../src/core/keyblob";

/**
 * The page `quiz brief --web` builds in memory (foundation 9: the form is its own bundle, and a shared page carries none
 * of it) and the bundle it carries.
 */
const dist = resolve(import.meta.dirname, "..", "..", "dist");
const script = readFileSync(join(dist, "brief.js"), "utf8");
const css = readFileSync(join(dist, "page.css"), "utf8");
const briefCss = readFileSync(join(dist, "brief.css"), "utf8");

const data = (extra: Partial<BriefData> = {}): BriefData => ({
  version: 1,
  lang: "en",
  questions: loadQuestions(),
  prefill: { scope: "lectures 3 to 5, the Fourier transform", count: 25 },
  overrides: {},
  profiles: [
    { name: "default", file: null },
    { name: "draft", file: null },
    { name: "exam", file: null },
    { name: "survey", file: null },
  ],
  timeout: 1800,
  dir: "signals-midterm",
  target: "signals-midterm/brief.yaml",
  command: "quiz brief signals-midterm --web",
  ...extra,
});

const build = (d: BriefData = data()): string =>
  buildBriefForm({ data: d, script, css, briefCss, builtAt: "2026-11-16T09:00:00.000Z", version: "1.0.0-test" });
const html = build();

const dataOf = (page: string): BriefData => {
  const m = /<script type="application\/json" id="fm-data">([\s\S]*?)<\/script>/.exec(page);
  return JSON.parse(m?.[1] ?? "") as BriefData;
};

describe("the brief form's page", () => {
  it("holds the data the form reads: the question file, the pre-fills, the profiles, the timeout and the names", () => {
    const got = dataOf(html);
    expect(got).toEqual(JSON.parse(JSON.stringify(data())));
    expect(got.questions.questions).toHaveLength(14);
  });

  it("is the same bytes for the same input, and its script and styles are allowed by hash and by nothing else", () => {
    expect(build()).toBe(html);
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? "";
    const hash = (text: string) => `'sha256-${toBase64(sha256(utf8ToBytes(text)))}'`;
    expect(csp).toContain(`script-src ${hash(script)}`);
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] as string);
    expect(styles.length).toBeGreaterThanOrEqual(2);
    for (const s of styles) expect(csp).toContain(hash(s));
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe");
    expect(csp).not.toContain("frame-src");
  });

  it("offers every font (G114): the three that embed are in the page, and the theme is auto", () => {
    expect(html).toContain('id="fm-fonts"');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Brief: signals-midterm</title>");
    expect(build(data({ lang: "vi" }))).toContain('<html lang="vi">');
    expect(build(data({ lang: "vi" }))).toContain("<title>Yêu cầu: signals-midterm</title>");
  });

  it("carries no page runtime, no server module and no quiz", () => {
    const runtime = readFileSync(join(dist, "page.js"), "utf8");
    expect(html).not.toContain(runtime.slice(0, 200));
    expect(html).not.toContain('id="fm-licences"');
    expect(html).not.toContain('id="fm-quiz"');
  });

  it("refuses a script that would close its own tag", () => {
    expect(() =>
      buildBriefForm({ data: data(), script: "</SCRIPT>", css, briefCss, builtAt: "x", version: "x" }),
    ).toThrow("closing script tag");
  });

  it("escapes what is typed into the data block: a < never ends the script", () => {
    const hostile = build(data({ prefill: { scope: "</script><b>x" }, command: "quiz brief </script>" }));
    expect(hostile.match(/<\/script>/g)).toHaveLength(2);
    expect(dataOf(hostile).prefill.scope).toBe("</script><b>x");
  });
});

describe("the form's bundle and its words", () => {
  it("is under 60 KB gzipped, as the page runtime is", () => {
    const size = gzipSync(Buffer.from(script)).length;
    console.log(`brief form: ${script.length} bytes, ${size} bytes gzipped (limit ${60 * 1024})`);
    expect(size).toBeLessThan(60 * 1024);
  });

  it("is not in the page runtime, and carries neither zod nor the YAML parser (the question file is data)", () => {
    const page = readFileSync(join(dist, "page.js"), "utf8");
    expect(page).not.toContain("Write the brief");
    expect(script).toContain("Write the brief");
    expect(script).not.toContain("ZodError");
    expect(script).not.toContain("YAMLParseError");
  });

  const shape = (value: unknown): unknown =>
    typeof value === "function"
      ? `fn/${value.length}`
      : value !== null && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : "text";

  it("exist in English and Vietnamese with the same keys, and the same arguments for each function", () => {
    expect(shape(briefVi)).toEqual(shape(briefEn));
  });

  it("say the board's words (the Brief board's LANG), and COMMANDS.md's for the pre-fills and the summary", () => {
    expect(briefEn.revertAll(2)).toBe("Back to every pre-filled answer (2 changed)");
    expect(briefEn.revertTo("25 questions")).toBe("Back to the pre-filled answer: 25 questions");
    expect(briefVi.revertAll(2)).toBe("Về lại tất cả câu điền sẵn (2 câu đã sửa)");
    expect(briefVi.revertTo("25 câu")).toBe("Về lại câu điền sẵn: 25 câu");
    expect(briefEn.mPrefilled).toBe("✎ Pre-filled for you");
    expect(briefVi.mPrefilled).toBe("✎ Điền sẵn cho bạn");
    expect([briefEn.byYou, briefEn.byPrefilled, briefEn.byDefault]).toEqual(["Yours", "Pre-filled", "Default"]);
    expect([briefVi.byPrefilled, briefVi.prefilledW]).toEqual(["Điền sẵn", "điền sẵn"]);
    expect(briefEn.closesIn(29)).toBe("The form closes in 29 min if left open. Cancel writes nothing.");
    expect(briefVi.closesIn(29)).toBe("Biểu mẫu tự đóng sau 29 phút nếu để yên. Huỷ thì không ghi gì.");
    expect(briefEn.closesNever).toBe("Cancel writes nothing.");
    expect(briefVi.finish).toBe("Hoàn tất");
    expect(briefVi.cancel).toBe("Huỷ");
    expect(briefVi.doneLine(14, 12, 2)).toBe("14 câu trả lời: 12 của bạn, 2 mặc định.");
  });

  it("call the agent AI in Vietnamese, never trợ lý (COMMANDS.md, 'The forms')", () => {
    const all = JSON.stringify(briefVi, (_k, v) => (typeof v === "function" ? String(v(1, 1, 1, 1)) : v));
    expect(all).not.toMatch(/trợ lý/i);
    expect(briefVi.meta).toContain("AI");
    expect(briefVi.prefilledNote).toContain("AI");
    const file = JSON.stringify(loadQuestions());
    expect(file).not.toMatch(/trợ lý/i);
  });

  it("have a short name for each question of the file", () => {
    for (const q of loadQuestions().questions) {
      expect(briefEn.short[q.key as keyof typeof briefEn.short], q.key).toBeTruthy();
      expect(briefVi.short[q.key as keyof typeof briefVi.short], q.key).toBeTruthy();
    }
  });
});
