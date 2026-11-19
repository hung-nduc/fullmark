import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { buildShelfIndex, type ShelfEntry } from "../../src/build/shelf-index";
import { shelfEn, shelfVi } from "../../src/core/i18n/shelf";
import { toBase64 } from "../../src/core/keyblob";

/** The shelf's plain index page (STEP5.md, slice 5a; the look comes in 5c): its content, its CSP, and that it is deterministic. */
const entries: ShelfEntry[] = [
  {
    id: "rust",
    title: "Rust basics",
    lang: "en",
    questions: 12,
    points: 20,
    timeLimit: null,
    passMark: null,
    exam: false,
    instant: true,
    types: ["code", "short", "single"],
  },
  {
    id: "toan",
    title: "Toán rời rạc",
    lang: "vi",
    questions: 1,
    points: 2.5,
    timeLimit: 5400,
    passMark: 60,
    exam: true,
    instant: false,
    types: ["essay", "numeric", "multi", "blanks"],
  },
  {
    id: "calc",
    title: 'Limits & "continuity" <b>',
    lang: "en",
    questions: 3,
    points: null,
    timeLimit: 90,
    passMark: 50,
    exam: false,
    instant: false,
    types: ["numeric"],
  },
];

/** The `<tr>` of one quiz. */
const rowOf = (page: string, id: string): string => {
  const start = page.indexOf(`<tr><th scope="row"><span class="q"><span class="top"><a href="${id}/index.html"`);
  return page.slice(start, page.indexOf("</tr>", start));
};

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

  it("is one table with a caption, column headings and each quiz's title as the row heading", () => {
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain("<caption>Quizzes</caption>");
    expect(html.match(/<th scope="col">/g)).toHaveLength(6);
    expect(html).toContain(
      '<th scope="col">Quiz</th><th scope="col">Type</th><th scope="col">Questions</th><th scope="col">Points</th><th scope="col">Time limit</th><th scope="col">Pass mark</th>',
    );
    expect(html.match(/<th scope="row">/g)).toHaveLength(3);
  });

  it("counts the quizzes and the languages under the heading, in both languages, with the plurals", () => {
    expect(html).toContain('<p class="summary">3 quizzes · 2 languages</p>');
    const one = [entries[0] as ShelfEntry];
    expect(buildShelfIndex("s", one, "en")).toContain("1 quiz · 1 language<");
    expect(buildShelfIndex("s", entries, "vi")).toContain("3 bài · 2 ngôn ngữ");
  });

  it("an exam: Exam, no instant feedback, its numbers, time limit as the start screen writes it and a pass mark", () => {
    const row = rowOf(html, "toan");
    expect(row).toContain('class="pill exam"');
    expect(row).toContain("Exam</span>");
    expect(row).not.toContain("instant feedback");
    expect(row).toContain('data-label="Questions">1</td>');
    expect(row).toContain('data-label="Points">2.5</td>');
    expect(row).toContain('data-label="Time">1 h 30 min</td>');
    expect(row).toContain('data-label="Pass">60%</td>');
    expect(row).toContain('<span class="badge" title="Vietnamese">VI</span>');
  });

  it("a practice quiz with instant feedback, no time limit and no pass mark: dashes", () => {
    const row = rowOf(html, "rust");
    expect(row).toContain('class="pill"');
    expect(row).toContain("Practice</span>");
    expect(row).toContain('<span class="instant">instant feedback</span>');
    expect(row).toContain('data-label="Time">\u2013</td>');
    expect(row).toContain('data-label="Pass">\u2013</td>');
    expect(row).toContain('data-label="Questions">12</td>');
    expect(row).toContain('data-label="Points">20</td>');
  });

  it("unknown points (a bank of unequal questions) and a time limit with seconds", () => {
    const row = rowOf(html, "calc");
    expect(row).toContain('data-label="Points">\u2013</td>');
    expect(row).toContain('data-label="Time">1 min 30 s</td>');
    expect(row).toContain('data-label="Pass">50%</td>');
  });

  it("lists the question types under the title in the default type order, first letter capitalised, with the interface's names", () => {
    expect(rowOf(html, "rust")).toContain('<span class="kinds">Single choice · short answers · code</span>');
    expect(rowOf(html, "toan")).toContain(
      '<span class="kinds">Multiple choice · fill in the blanks · numeric answers · essays</span>',
    );
    // a quiz of a Vietnamese language on an English index keeps the index's words; a Vietnamese index uses the Vietnamese ones
    const vi = buildShelfIndex("s", entries, "vi");
    expect(rowOf(vi, "toan")).toContain('<span class="kinds">Nhiều lựa chọn · điền vào chỗ trống · ');
    expect(rowOf(vi, "toan")).toContain("Thi</span>");
    // G18: no capital inside the list ("Đúng/Sai" is "đúng/sai")
    const first = entries[0] as ShelfEntry;
    const mixed = buildShelfIndex("s", [{ ...first, types: ["single", "truefalse", "essay"] }], "vi");
    expect(mixed).toContain('<span class="kinds">Một lựa chọn · đúng/sai · tự luận</span>');
    expect(buildShelfIndex("s", [{ ...first, types: ["single", "truefalse", "essay"] }], "en")).toContain(
      '<span class="kinds">Single choice · true or false · essays</span>',
    );
    expect(rowOf(vi, "toan")).toContain('data-label="Thời gian">1 giờ 30 phút</td>');
    expect(rowOf(vi, "toan")).toContain('data-label="Điểm">2,5</td>');
    expect(rowOf(vi, "rust")).toContain("phản hồi ngay");
    expect(vi).toContain('<th scope="col">Điểm đạt</th>');
  });

  it("has no style attribute anywhere", () => {
    expect(html).not.toMatch(/\sstyle=/);
    expect(buildShelfIndex("s", [], "en")).not.toMatch(/\sstyle=/);
  });

  it("keeps the headings at the top (sticky, a clip and no scroll box) and restyles the table into cards under 520 px", () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(style).toContain("position:sticky;top:0");
    expect(style).toContain("overflow:clip");
    expect(style).not.toMatch(/overflow(-y)?:(auto|scroll)/);
    expect(style).toContain("@media (max-width:519px)");
    expect(style).toContain("attr(data-label)");
  });

  it("carries only the light and the dark token sets", () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(style).not.toContain("data-theme");
    expect(style).not.toContain("#000000");
  });

  it("escapes what a title can hold", () => {
    expect(html).toContain("Limits &amp; &quot;continuity&quot; &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("keeps the language of the interface apart from each quiz's own: --ui-lang vi changes the chrome only", () => {
    const vi = buildShelfIndex("kệ", entries, "vi");
    expect(vi).toContain('<html lang="vi">');
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

  it("vi has exactly the words of en", () => {
    expect(Object.keys(shelfVi).sort()).toEqual(Object.keys(shelfEn).sort());
    expect(Object.keys(shelfVi.language).sort()).toEqual(Object.keys(shelfEn.language).sort());
  });
});
