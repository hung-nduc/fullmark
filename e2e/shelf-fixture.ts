import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildShelfIndex, type ShelfEntry } from "../src/build/shelf-index";
import type { QuestionType } from "../src/core/ir";

/**
 * The quizzes of the ShelfTable boards (docs/mockup/boards/ShelfTable.dc.html): five, and the long shelf of 24, as entries
 * of the index page. The index page is built by the real `buildShelfIndex`; the quiz pages themselves are not needed to look
 * at it, so a link here goes nowhere.
 */
type Row = [
  id: string,
  title: string,
  lang: "en" | "vi",
  exam: boolean,
  instant: boolean,
  types: QuestionType[],
  questions: number,
  points: number,
  minutes: number,
  pass: number,
];

const FIVE: Row[] = [
  ["calculus-limits", "Calculus: limits and continuity", "en", false, false, ["single", "numeric"], 12, 12, 0, 0],
  ["ielts-task2", "IELTS Writing Task 2: practice set", "en", true, false, ["essay"], 1, 9, 40, 0],
  [
    "rust-ownership",
    "Rust basics: ownership and borrowing",
    "en",
    false,
    true,
    ["single", "short", "code"],
    15,
    20,
    0,
    0,
  ],
  [
    "signals-final",
    "Signals and Systems: final review",
    "en",
    true,
    false,
    ["single", "truefalse", "numeric", "essay"],
    82,
    100,
    140,
    60,
  ],
  [
    "tin-hieu-giua-ky",
    "Tín hiệu và hệ thống: ôn tập giữa kỳ",
    "vi",
    false,
    false,
    ["single", "blanks", "numeric"],
    32,
    40,
    45,
    50,
  ],
];

const MORE: Row[] = [
  [
    "calculus-derivatives",
    "Calculus: derivatives and their uses",
    "en",
    false,
    true,
    ["single", "numeric"],
    18,
    18,
    0,
    0,
  ],
  ["calculus-integrals", "Calculus: integrals", "en", false, false, ["numeric", "short"], 14, 20, 30, 0],
  ["calculus-midterm", "Calculus: midterm", "en", true, false, ["single", "numeric", "essay"], 25, 50, 90, 50],
  ["circuits-week1", "Circuits: Ohm's and Kirchhoff's laws", "en", false, true, ["single", "numeric"], 10, 10, 0, 0],
  ["circuits-final", "Circuits: final exam", "en", true, false, ["single", "numeric", "essay"], 40, 100, 120, 50],
  ["giai-tich-chuong-1", "Giải tích: giới hạn và liên tục", "vi", false, false, ["single", "numeric"], 20, 20, 0, 0],
  ["giai-tich-cuoi-ky", "Giải tích: thi cuối kỳ", "vi", true, false, ["single", "numeric", "essay"], 30, 100, 90, 50],
  [
    "ielts-reading-1",
    "IELTS Reading: academic test 1",
    "en",
    true,
    false,
    ["single", "truefalse", "blanks"],
    40,
    40,
    60,
    0,
  ],
  ["ielts-task1", "IELTS Writing Task 1: charts", "en", true, false, ["essay"], 1, 9, 20, 0],
  ["linear-algebra-1", "Linear algebra: vectors and matrices", "en", false, true, ["single", "numeric"], 16, 16, 0, 0],
  ["linear-algebra-2", "Linear algebra: eigenvalues", "en", false, false, ["numeric", "short"], 12, 15, 0, 0],
  ["probability-1", "Probability: counting and events", "en", false, true, ["single", "numeric"], 15, 15, 0, 0],
  [
    "probability-final",
    "Probability: final review",
    "en",
    true,
    false,
    ["single", "numeric", "essay"],
    36,
    80,
    120,
    55,
  ],
  ["rust-traits", "Rust: traits and generics", "en", false, true, ["single", "code"], 12, 18, 0, 0],
  ["rust-errors", "Rust: error handling", "en", false, false, ["short", "code"], 8, 14, 0, 0],
  [
    "signals-fourier",
    "Signals and Systems: the Fourier transform",
    "en",
    false,
    false,
    ["single", "numeric"],
    16,
    20,
    25,
    0,
  ],
  ["signals-sampling", "Signals and Systems: sampling", "en", false, true, ["single", "numeric"], 12, 12, 0, 0],
  [
    "tin-hieu-cuoi-ky",
    "Tín hiệu và hệ thống: thi cuối kỳ",
    "vi",
    true,
    false,
    ["single", "numeric", "essay"],
    40,
    100,
    120,
    50,
  ],
  ["xac-suat-on-tap", "Xác suất thống kê: ôn tập", "vi", false, true, ["single", "numeric"], 24, 24, 0, 0],
];

const entry = (r: Row): ShelfEntry => ({
  id: r[0],
  title: r[1],
  lang: r[2],
  exam: r[3],
  instant: r[4],
  types: r[5],
  questions: r[6],
  points: r[7],
  timeLimit: r[8] > 0 ? r[8] * 60 : null,
  passMark: r[9] > 0 ? r[9] : null,
});

export const fiveQuizzes = (): ShelfEntry[] => FIVE.map(entry);
export const longShelf = (): ShelfEntry[] => [...FIVE, ...MORE].map(entry);

/** Writes an index page into a fresh folder named `name` and returns its `file://` URL. */
export function writeShelf(entries: ShelfEntry[], ui: "en" | "vi" = "en", name = "quizzes"): string {
  const dir = join(mkdtempSync(join(tmpdir(), "fm-shelf-")), name);
  mkdirSync(dir);
  writeFileSync(join(dir, "index.html"), buildShelfIndex(name, entries, ui));
  return `file://${join(dir, "index.html")}`;
}
