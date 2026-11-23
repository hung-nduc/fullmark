import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile } from "../../src/cli/check";
import { resolveProfile } from "../../src/core/config/resolve";
import { en, vi } from "../../src/core/i18n";
import { buildControls, CONTROLS, type Lang } from "../../src/core/i18n/controls";
import type { Quiz } from "../../src/core/ir";
import { parse } from "../../src/core/parse";
import { runChecks } from "../../src/core/rules/check";
import { findControl, namesControl } from "../../src/core/rules/names-control";
import { QUALITY_RULES } from "../../src/core/rules/quality";
import { defaultOptions } from "../../src/core/rules/registry";
import { capture, tempTree } from "../helpers/cli";

const ID = "content.names-control";
const MESSAGE = "names a control of the page; the paper has none";

function quiz(body: string, front = "title: T"): Quiz {
  const r = parse(`---\n${front}\n---\n\n${body}\n`, "t.md");
  const errors = r.issues.filter((i) => i.level === "error");
  expect(errors, body).toEqual([]);
  return r.quiz as Quiz;
}
const one = (hint: string, lang: Lang = "en") =>
  quiz(`## Pick one. {type=single id=q}\n\n- [x] a\n- [ ] b\n\n::: hint\n${hint}\n:::`, `title: T\nlang: ${lang}`);
const flags = (text: string, lang: Lang): boolean => findControl(text, lang) !== null;
const found = (text: string, lang: Lang) => findControl(text, lang)?.word;

describe("content.names-control: the word lists", () => {
  it("read the control labels from the catalogs", () => {
    expect(CONTROLS.en.labels).toEqual([en.page.check, en.page.submit, en.page.flag, en.page.hint]);
    expect(CONTROLS.vi.labels).toEqual([vi.page.check, vi.page.submit, vi.page.flag, vi.page.hint]);
    expect(CONTROLS.en.labels).toEqual(["Check", "Submit", "Flag", "Hint"]);
    expect(CONTROLS.vi.labels).toEqual(["Kiểm tra", "Nộp bài", "Đánh dấu", "Gợi ý"]);
  });

  it("a renamed label changes what is matched", () => {
    const renamed = buildControls({
      en: { page: { ...en.page, submit: "Hand in", check: "Verify", flag: "Mark", hint: "Clue" } },
      vi,
    });
    expect(findControl("The **Hand in** label.", "en", renamed)?.word).toBe("Hand in");
    expect(findControl("The **Submit** label.", "en", renamed)).toBeNull();
    expect(findControl("The **Submit** label.", "en")?.word).toBe("Submit");
  });
});

describe("content.names-control: screen words", () => {
  const sentences: [Lang, string, string, string][] = [
    ["en", "button", "Use the button below.", "A buttonhole is sewn."],
    ["en", "click", "Click the diagram.", "A clicker is a remote."],
    ["en", "tap", "Tapping the screen helps.", "A tapestry hangs on the wall."],
    ["en", "press", "She pressed on.", "Pressure rises with depth."],
    ["en", "sidebar", "See the sidebar.", "A sidebarless layout."],
    ["en", "scroll", "Scroll down.", "An ancient scrollwork carving."],
    ["vi", "nút", "Bấm vào nút này.", "Một nút thắt khó gỡ."],
    ["vi", "bấm", "Bấm vào đây.", "Bấmx là gì."],
    ["vi", "nhấn", "Nhấn vào đây.", "Điều này nhấn mạnh ý chính."],
    ["vi", "thanh bên", "Xem thanh bên trái.", "Thanh nhôm bên trong."],
    ["vi", "cuộn", "Cuộn xuống dưới.", "Cuộn cảm có điện cảm L."],
  ];
  for (const [lang, word, flagged, left] of sentences) {
    it(`${lang} "${word}": flags one sentence and leaves another`, () => {
      expect(flags(flagged, lang), flagged).toBe(true);
      // the leaving sentence may still hold another entry's word; only this entry's is under test
      if (word === "nút") expect(flags("Một nút thắt khó gỡ.", lang)).toBe(true);
      else expect(flags(left, lang), left).toBe(false);
    });
  }

  it("en forms: -s, -es, -ed, -ing and a doubled consonant", () => {
    for (const s of [
      "buttons",
      "clicks",
      "clicked",
      "clicking",
      "taps",
      "tapped",
      "tapping",
      "presses",
      "pressed",
      "pressing",
      "sidebars",
      "scrolls",
      "scrolled",
      "scrolling",
      "BUTTON",
    ]) {
      expect(flags(`word ${s} here`, "en"), s).toBe(true);
    }
    expect(found("She tapped the screen", "en")).toBe("tapped");
  });

  it("en click, tap and press flag only as an instruction (G11)", () => {
    for (const s of [
      "Tap the button.",
      "Press here.",
      "Click on Submit.",
      "Then tap a choice.",
      "Press an arrow key.",
      "Pressing this opens it.",
      "Tapped the screen twice.",
      "Click\nthe diagram.",
    ]) {
      expect(flags(s, "en"), s).toBe(true);
    }
    expect(found("Click on Submit.", "en")).toBe("Click");
    expect(found("Pressing this opens it.", "en")).toBe("Pressing");
    for (const s of [
      "A bypass capacitor at the tap.",
      "A hydraulic press.",
      "The press release came out.",
      "A tap changer sits on the transformer.",
    ]) {
      expect(flags(s, "en"), s).toBe(false);
    }
    // a word that only starts with an instruction's follower does not count
    expect(flags("Some tap theory is old.", "en")).toBe(false);
    expect(flags("We press another one.", "en")).toBe(false);
    expect(flags("They pressed it.", "en")).toBe(true);
    expect(flags("the hint, press to see it", "en")).toBe(true);
  });

  it("en click, tap and press flag where they open a sentence, a line or a list item (G21)", () => {
    for (const s of [
      "Press Enter to submit.",
      "Click to see the hint.",
      "Press it to continue.",
      "press it",
      "Done. Tap to go on.",
      "It works.\nclick twice",
      "- click twice",
      "1. tap twice",
      "> press twice",
      'He said "yes." Tap twice.',
      "then press Enter",
      "and click Submit",
    ]) {
      expect(flags(s, "en"), s).toBe(true);
    }
    expect(found("Done. Tap to go on.", "en")).toBe("Tap");
    for (const s of [
      "The valve has a tap. A tap changer sits on the transformer.",
      "We used a press, then a drill.",
      "e.g. a hydraulic press works",
      "With a tap twice a day.",
    ]) {
      expect(flags(s, "en"), s).toBe(false);
    }
    // a sentence opening with one as a noun is flagged: rare, and only a warning
    expect(flags("Tap water is safe.", "en")).toBe(true);
    // button, sidebar and scroll stay as they are
    expect(flags("The red button.", "en")).toBe(true);
    expect(flags("Scroll.", "en")).toBe(true);
  });

  it("vi screen words match as a whole sequence of syllables", () => {
    expect(flags("Cuộn trang.", "vi")).toBe(true);
    expect(flags("cuộn.", "vi")).toBe(true);
    expect(flags("thanh   bên", "vi")).toBe(true);
    expect(flags("thanh", "vi")).toBe(false);
    expect(flags("cuộnx", "vi")).toBe(false);
  });

  it("vi leaves 'nhấn mạnh', 'cuộn dây' and 'cuộn cảm'", () => {
    for (const s of ["Hãy nhấn mạnh ý này.", "Một cuộn dây đồng.", "Cuộn cảm lý tưởng.", "NHẤN MẠNH"]) {
      expect(flags(s, "vi"), s).toBe(false);
    }
    expect(flags("Nhấn mạnh rồi nhấn nút.", "vi")).toBe(true);
  });

  it("matches NFC and case-insensitively", () => {
    expect(flags("Nhấn vào đây".normalize("NFD"), "vi")).toBe(true);
    expect(flags("CLICK here", "en")).toBe(true);
  });
});

describe("content.names-control: control labels", () => {
  const plain: [Lang, string, string][] = [
    ["en", "Check", "Check your units."],
    ["en", "Submit", "Submit a proof of the claim."],
    ["en", "Flag", "Flag semaphores carry a message."],
    ["en", "Hint", "Hint: start from the units."],
    ["vi", "Kiểm tra", "Kiểm tra lại đơn vị."],
    ["vi", "Nộp bài", "Nộp bài tập cho thầy."],
    ["vi", "Đánh dấu", "Đánh dấu vào ô đúng trên giấy."],
    ["vi", "Gợi ý", "Gợi ý: bắt đầu từ đơn vị."],
  ];
  for (const [lang, label, ordinary] of plain) {
    it(`${lang} "${label}": flagged in bold and as a button, left as an ordinary word`, () => {
      expect(found(`Then **${label}** to continue.`, lang), "bold").toBe(label);
      expect(found(`Then __${label}__ to continue.`, lang), "underscores").toBe(label);
      expect(found(`Then **${label}:** to continue.`, lang), "trailing colon").toBe(label);
      expect(found(`Then **${label.toUpperCase()}** to continue.`, lang), "case").toBe(label.toUpperCase());
      if (lang === "en") expect(found(`The ${label} button is here.`, lang), "button").toBeDefined();
      else expect(found(`Nút ${label} ở đây.`, lang), "nút").toBeDefined();
      expect(flags(ordinary, lang), ordinary).toBe(false);
      expect(flags(`The word **${label} more** is bold.`, lang), "a longer bold run").toBe(false);
    });
  }

  it("flags 'the Submit button' on the label, and 'nút Nộp bài'", () => {
    expect(found("Use the Submit button.", "en")).toBe("Submit");
    expect(found("Hãy bấm nút Nộp bài.", "vi")).toBe("bấm");
    expect(found("Dùng nút Nộp bài.", "vi")).toBe("nút");
    expect(found("Xem Nộp bài", "vi")).toBeUndefined();
  });
});

describe("content.names-control: what is read", () => {
  const rule = QUALITY_RULES.find((r) => r.id === ID);
  if (!rule) throw new Error("missing");
  const lines = (q: Quiz): number[] =>
    rule.run(q, { brief: null, contentFiles: null, review: null }, defaultOptions(rule)).map((f) => f.line);
  const pick = (extra: string) => `## Q {type=single id=q}\n\n${extra}`;

  it("is a warning with no options and the catalogue's message", () => {
    expect(rule.level).toBe("warning");
    expect(Object.keys(rule.options.shape)).toEqual([]);
    const f = rule.run(
      one("Click on **Check** to see the answer."),
      { brief: null, contentFiles: null, review: null },
      {},
    );
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toBe(MESSAGE);
    expect(f[0]?.fix).toBe(
      'reword "Check": say what it is, not which control shows it (QUIZ_SYNTAX.md, section 8)'.replace(
        "Check",
        "Click",
      ),
    );
  });

  it("flags each kind of text once", () => {
    const cases: [string, string, string?][] = [
      ["description", "## Q {type=single id=q}\n\n- [x] a\n- [ ] b", "title: T\ndescription: Click here to begin."],
      ["section intro", "# Part\n\nClick here first.\n\n## Q {type=single id=q}\n\n- [x] a\n- [ ] b"],
      ["prompt", "## Click the right one. {type=single id=q}\n\n- [x] a\n- [ ] b"],
      ["choice", "## Q {type=single id=q}\n\n- [x] a\n- [ ] press the key"],
      ["hint", "## Q {type=single id=q}\n\n- [x] a\n- [ ] b\n\n::: hint\nScroll up.\n:::"],
      ["explanation", "## Q {type=single id=q}\n\n- [x] a\n- [ ] b\n\n::: explanation\nThe button is wrong.\n:::"],
      ["ordering item", "## Q {type=ordering id=q}\n\n1. first\n2. click the second"],
      ["matching item", "## Q {type=matching id=q}\n\n- a :: click here\n- b :: y"],
      [
        "rubric criterion",
        "## Q {type=essay id=q}\n\n```answer\nrubric:\n  - Says what the sidebar holds\n  - Is clear\n```",
      ],
      [
        "passage",
        "# Part\n\n::: passage\nScroll through the text.\n:::\n\n## Q {type=single id=q}\n\n- [x] a\n- [ ] b",
      ],
      ["fields label", "## Q {type=fields id=q}\n\n```answer\nfields:\n  - label: Press the value\n    value: 1\n```"],
    ];
    for (const [name, body, front] of cases) {
      const r = parse(`---\n${front ?? "title: T"}\n---\n\n${body}\n`, "t.md");
      if (!r.quiz) throw new Error(`${name}: ${JSON.stringify(r.issues)}`);
      expect(lines(r.quiz), name).toHaveLength(1);
    }
  });

  it("does not read titles, ids or the sample answer", () => {
    const q = quiz(
      "# Click on part {id=press}\n\n## Q {type=essay id=click}\n\n```answer\nsample_answer: |\n  Click the button.\nrubric:\n  - Fine\n  - Good\n```",
      "title: Press the button",
    );
    expect(lines(q)).toEqual([]);
  });

  it("reports the line of the text that holds the match", () => {
    const src = [
      "---",
      "title: T",
      "---",
      "",
      "## Q {type=single id=q}",
      "",
      "Say it.",
      "",
      "- [x] a",
      "- [ ] b",
      "",
      "::: hint",
      "First line.",
      "Click the item.",
      ":::",
    ].join("\n");
    const r = parse(src, "t.md");
    expect(lines(r.quiz as Quiz)).toEqual([14]);
  });

  it("does not read code, inline code or maths", () => {
    const body = (t: string) => quiz(pick(`${t}\n\n- [x] a\n- [ ] b`));
    expect(lines(body("What does `click()` do?"))).toEqual([]);
    expect(
      lines(body("```python\npress = 1\nclick = 2\n```\n\nWhat is press?".replace("What is press?", "What is it?"))),
    ).toEqual([]);
    expect(lines(body("Let $press = 2$ and $$click + tap$$ hold."))).toEqual([]);
    expect(lines(body("It costs $5 and $6; click the item."))).toHaveLength(1);
    expect(lines(body("Then ``a ` click`` ends."))).toEqual([]);
  });

  it("flags a bold label and leaves the same word unbolded", () => {
    expect(lines(one("Click **Check**."))).toHaveLength(1);
    expect(lines(one("Then **Check** the units."))).toHaveLength(1);
    expect(lines(one("Then check the units."))).toEqual([]);
    expect(lines(one("Check your units."))).toEqual([]);
  });

  it("is quiet for a language's other list", () => {
    expect(lines(one("Click here.", "vi"))).toEqual([]);
    expect(lines(one("Bấm vào đây.", "en"))).toEqual([]);
    expect(lines(one("Bấm vào đây.", "vi"))).toHaveLength(1);
    expect(lines(one("Click here.", "en"))).toHaveLength(1);
  });

  it("gives one finding for three matches in one text, on the first match's line", () => {
    const q = one("Fine.\nClick the item, click the item, click the item.");
    expect(lines(q)).toHaveLength(1);
    expect(lines(one("Fine.\nClick the item."))[0]).toBe((lines(one("Click the item."))[0] ?? 0) + 1);
  });

  it("is silenced by check-ignore with a reason, and reported as ignored", () => {
    const text = (extra: string) =>
      `---\ntitle: T\n---\n\n## Q {type=single id=q${extra}}\n\n- [x] a\n- [ ] b\n\n::: hint\nClick the item.\n:::\n`;
    const run = (src: string) => {
      const parsed = parse(src, "quiz.md");
      const resolved = resolveProfile("default", { user: null, project: null }).profile;
      if (!resolved) throw new Error("profile");
      return runChecks({
        quiz: parsed.quiz,
        issues: parsed.issues,
        file: "quiz.md",
        profile: resolved,
        brief: null,
        briefIssues: [],
        contentFiles: null,
      });
    };
    expect(run(text("")).issues.filter((i) => i.rule === ID)).toHaveLength(1);
    const ignored = run(text(' check-ignore="content.names-control" because="a lab with a real button"'));
    expect(ignored.issues.filter((i) => i.rule === ID)).toEqual([]);
    expect(ignored.ignored).toHaveLength(1);
  });
});

describe("content.names-control: a catalog label in a test double", () => {
  it("is matched through the lists given", () => {
    const q = one("Press the **Verify**.");
    expect(namesControl(q)).toHaveLength(1);
    const lists = buildControls({ en: { page: { ...en.page, check: "Verify" } }, vi });
    expect(findControl("The **Verify** word.", "en")).toBeNull();
    expect(findControl("The **Verify** word.", "en", lists)?.word).toBe("Verify");
  });
});

describe("content.names-control: materials sheets", () => {
  it("are read by the loader, with the sheet's own file and line", () => {
    const t = tempTree({
      "q.md": "---\ntitle: T\nmaterials:\n  - sheet.md\n---\n\n## Q {type=single id=q}\n\n- [x] a\n- [ ] b\n",
      "sheet.md": "# Notes\n\nSome text.\n\nScroll to the table, then tap a row. Tap again.\n",
    });
    try {
      const out = checkFile(
        join(t.dir, "q.md"),
        { profile: null, config: null, strict: false, review: null, json: false, plain: true },
        capture(t.dir).io,
      );
      if (out.status === "error") throw new Error(out.message);
      const hits = out.issues.filter((i) => i.rule === ID);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.file.endsWith("sheet.md")).toBe(true);
      expect(hits[0]?.line).toBe(5);
      expect(hits[0]?.level).toBe("warning");
    } finally {
      t.done();
    }
  });

  it("a question's check-ignore does not hide a sheet's finding", () => {
    const t = tempTree({
      "q.md":
        '---\ntitle: T\nmaterials:\n  - sheet.md\n---\n\n## Q {type=single id=q check-ignore="content.names-control" because="x"}\n\n- [x] a\n- [ ] b\n',
      "sheet.md": "# Notes\n\nA\n\nB\n\nC\n\nD\n\nE\n\nClick here.\n",
    });
    try {
      const out = checkFile(
        join(t.dir, "q.md"),
        { profile: null, config: null, strict: false, review: null, json: false, plain: true },
        capture(t.dir).io,
      );
      if (out.status === "error") throw new Error(out.message);
      expect(out.issues.filter((i) => i.rule === ID)).toHaveLength(1);
    } finally {
      t.done();
    }
  });
});
