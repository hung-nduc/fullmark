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
  questions: (n: number) => `${n} ${n === 1 ? "question" : "questions"}`,
  timeLimit: (time: string) => `time limit ${time}`,
  hours: (n: number) => `${n} h`,
  minutes: (n: number) => `${n} min`,
  seconds: (n: number) => `${n} s`,
  /** what a quiz's language badge says, for the screen reader */
  language: { en: "English", vi: "Vietnamese" },
};

export type ShelfMessages = typeof shelfEn;

export const shelfVi = {
  heading: "Bài kiểm tra",
  empty: "Kệ này chưa có bài kiểm tra nào.",
  listLabel: "Bài kiểm tra",
  questions: (n: number) => `${n} câu hỏi`,
  timeLimit: (time: string) => `thời gian làm bài ${time}`,
  hours: (n: number) => `${n} giờ`,
  minutes: (n: number) => `${n} phút`,
  seconds: (n: number) => `${n} giây`,
  language: { en: "Tiếng Anh", vi: "Tiếng Việt" },
} satisfies ShelfMessages;
