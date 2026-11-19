import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { buildShelfIndex, limitText, type ShelfEntry } from "../../src/build/shelf-index";
import { shelfEn, shelfVi } from "../../src/core/i18n/shelf";
import { toBase64 } from "../../src/core/keyblob";

/** The shelf's plain index page (STEP5.md, slice 5a; the look comes in 5c): its content, its CSP, and that it is deterministic. */
const entries: ShelfEntry[] = [
  { id: "rust", title: "Rust basics", lang: "en", questions: 12, timeLimit: null },
  { id: "toan", title: "Toán rời rạc", lang: "vi", questions: 1, timeLimit: 5400 },
  { id: "calc", title: 'Limits & "continuity" <b>', lang: "en", questions: 3, timeLimit: 90 },
];

describe("buildShelfIndex", () => {
  const html = buildShelfIndex("my-shelf", entries, "en");

  it("is a static page: no script at all, no network, no embedded font", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("@font-face");
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("connect-src");
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  });

  it("allows only its own style sheet, by hash", () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    const policy = /Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(policy).toContain(`style-src 'sha256-${toBase64(sha256(utf8ToBytes(style)))}'`);
    expect(html.match(/<style/g)).toHaveLength(1);
    // light and dark from the device, from the theme tokens
    expect(style).toContain("prefers-color-scheme:dark");
    expect(style).toContain("--bg:");
  });

  it("has the shelf folder's name as the heading and title, and each quiz as a link to ID/index.html sorted by title", () => {
    expect(html).toContain("<title>my-shelf</title>");
    expect(html).toContain("<h1>my-shelf</h1>");
    const order = ["Limits &amp;", "Rust basics", "Toán rời rạc"].map((t) => html.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(html).toContain('<a href="rust/index.html" lang="en">Rust basics</a>');
    expect(html).toContain('<a href="toan/index.html" lang="vi">Toán rời rạc</a>');
  });

  it("shows the language badge, the number of questions and the time limit when there is one", () => {
    expect(html).toContain('lang="en" title="English">EN</span>');
    expect(html).toContain('lang="vi" title="Vietnamese">VI</span>');
    expect(html).toContain("12 questions");
    expect(html).toContain("1 question<");
    expect(html).toContain("time limit 1 h 30 min");
    expect(html).toContain("time limit 1 min 30 s");
    expect(html.match(/time limit/g)).toHaveLength(2);
  });

  it("escapes what a title can hold", () => {
    expect(html).toContain("Limits &amp; &quot;continuity&quot; &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("keeps the language of the interface apart from each quiz's own: --ui-lang vi changes the chrome only", () => {
    const vi = buildShelfIndex("kệ", entries, "vi");
    expect(vi).toContain('<html lang="vi">');
    expect(vi).toContain("12 câu hỏi");
    expect(vi).toContain("thời gian làm bài 1 giờ 30 phút");
    expect(vi).toContain('<a href="rust/index.html" lang="en">Rust basics</a>');
    expect(vi).toContain("<h1>kệ</h1>");
  });

  it("is the same bytes for the same quizzes, whatever order they come in, and holds no time", () => {
    expect(buildShelfIndex("my-shelf", [...entries].reverse(), "en")).toBe(html);
    expect(html).not.toMatch(/\d{4}-\d\d-\d\dT/);
  });

  it("says so when the shelf is empty, in either language, and names itself when the folder has no name", () => {
    expect(buildShelfIndex("s", [], "en")).toContain("No quizzes on this shelf yet.");
    expect(buildShelfIndex("s", [], "vi")).toContain("Kệ này chưa có bài kiểm tra nào.");
    expect(buildShelfIndex("", [], "en")).toContain("<h1>Quizzes</h1>");
  });

  it("limitText: hours, minutes and seconds, only the parts there are", () => {
    expect([30, 60, 90, 3600, 5400, 3661].map((s) => limitText(s, shelfEn))).toEqual([
      "30 s",
      "1 min",
      "1 min 30 s",
      "1 h",
      "1 h 30 min",
      "1 h 1 min 1 s",
    ]);
  });

  it("vi has exactly the words of en", () => {
    expect(Object.keys(shelfVi).sort()).toEqual(Object.keys(shelfEn).sort());
    expect(Object.keys(shelfVi.language).sort()).toEqual(Object.keys(shelfEn.language).sort());
  });
});
