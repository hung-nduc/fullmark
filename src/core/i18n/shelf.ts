/**
 * The words of a shelf's index page (COMMANDS.md, `quiz library publish`, "The index page"), in both languages. They sit
 * in a file of their own, imported only by the build, so the page's runtime does not carry words it never shows.
 */
export const shelfEn = {
  /** the page's own title when the shelf folder has no name to show */
  heading: "Quizzes",
  empty: "No quizzes on this shelf yet.",
  /** the screen reader's name for the list of quizzes */
  listLabel: "Quizzes",
  /** the line under the heading: "5 quizzes · 2 languages" */
  summary: (quizzes: number, languages: number) =>
    `${quizzes} ${quizzes === 1 ? "quiz" : "quizzes"} · ${languages} ${languages === 1 ? "language" : "languages"}`,
  /** the column headings; the phone's card labels its numbers with the short forms */
  head: { quiz: "Quiz", type: "Type", questions: "Questions", points: "Points", time: "Time limit", pass: "Pass mark" },
  headShort: { questions: "Questions", points: "Points", time: "Time", pass: "Pass" },
  exam: "Exam",
  practice: "Practice",
  instant: "instant feedback",
  /** what a quiz's language badge says, for the screen reader */
  language: { en: "English", vi: "Vietnamese" },
};

export type ShelfMessages = typeof shelfEn;

export const shelfVi = {
  heading: "Bài kiểm tra",
  empty: "Kệ này chưa có bài kiểm tra nào.",
  listLabel: "Bài kiểm tra",
  summary: (quizzes: number, languages: number) => `${quizzes} bài · ${languages} ngôn ngữ`,
  head: { quiz: "Bài", type: "Loại", questions: "Câu hỏi", points: "Điểm", time: "Thời gian", pass: "Điểm đạt" },
  headShort: { questions: "Câu hỏi", points: "Điểm", time: "Thời gian", pass: "Đạt" },
  exam: "Thi",
  practice: "Luyện tập",
  instant: "phản hồi ngay",
  language: { en: "Tiếng Anh", vi: "Tiếng Việt" },
} satisfies ShelfMessages;
