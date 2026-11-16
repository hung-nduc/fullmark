/**
 * The brief form's words (COMMANDS.md, `quiz brief`, "The forms"; the Brief board's `LANG` tables), in the language of
 * `--language`. The question file holds the words of every question, choice and hint; these are the form's own. They
 * are a file of their own, as the review form's are: they belong to `dist/brief.js` alone, so a shared page stays byte
 * for byte what it was. In Vietnamese the agent is "AI", never "trợ lý".
 */

/** The short name of each question, for the sidebar and the summary (the board's `QS`), by the question file's key. */
export type ShortNames = Record<
  | "purpose"
  | "scope"
  | "content.kinds"
  | "content.elsewhere"
  | "count"
  | "minutes"
  | "mix"
  | "difficulty"
  | "mode"
  | "language"
  | "weak_topics"
  | "commitment"
  | "request"
  | "profile",
  string
>;

const shortEn: ShortNames = {
  purpose: "Purpose",
  scope: "Scope",
  "content.kinds": "Material",
  "content.elsewhere": "Elsewhere",
  count: "Questions",
  minutes: "Time limit",
  mix: "Kinds",
  difficulty: "Difficulty",
  mode: "Mode",
  language: "Language",
  weak_topics: "Weak topics",
  commitment: "Commitment",
  request: "Request",
  profile: "Profile",
};

const shortVi: ShortNames = {
  purpose: "Mục đích",
  scope: "Phạm vi",
  "content.kinds": "Tài liệu",
  "content.elsewhere": "Tài liệu khác",
  count: "Số câu",
  minutes: "Thời gian",
  mix: "Dạng câu",
  difficulty: "Độ khó",
  mode: "Cách làm",
  language: "Ngôn ngữ",
  weak_topics: "Chủ đề yếu",
  commitment: "Cam kết",
  request: "Lời nhắn",
  profile: "Bộ quy tắc",
};

/** How hard a check is under a profile: the tag before each line of the profile box. */
export type CheckLevel = "fails" | "warns" | "note" | "off";
export type ProfileWords = { hint: string; forText: string; checks: { level: CheckLevel; text: string }[] };

/** What each built-in profile checks (TECHNICAL_DESIGN.md, section 5, "Profiles"), in the form's words. */
const profilesEn: Record<"default" | "draft" | "exam" | "survey", ProfileWords> = {
  default: {
    hint: "The usual checks: warnings, nothing fails.",
    forText: "for everything",
    checks: [
      {
        level: "warns",
        text: "Quality findings: a correct choice that gives itself away, a short explanation, answers bunched on one letter. You see them, and the quiz still passes.",
      },
    ],
  },
  draft: {
    hint: "Writing in progress: only broken quizzes fail.",
    forText: "for a quiz still being written",
    checks: [{ level: "note", text: "Quality findings, so only a quiz that cannot work fails." }],
  },
  exam: {
    hint: "Strictest, for a mock exam.",
    forText: "for a mock exam",
    checks: [
      { level: "fails", text: "Every quality warning." },
      { level: "fails", text: "A question without a tag, or with an explanation under 8 words." },
      { level: "fails", text: "One answer letter holding more than 40% of the answers." },
      { level: "fails", text: "A question count more than 10% from the brief." },
      { level: "fails", text: "A rule switched off inside the quiz." },
    ],
  },
  survey: {
    hint: "No right answers.",
    forText: "for a questionnaire",
    checks: [
      {
        level: "off",
        text: "The checks that assume a right answer: the giveaway choice, the explanations, the spread of answer letters.",
      },
    ],
  },
};

const profilesVi: typeof profilesEn = {
  default: {
    hint: "Kiểm tra thông thường: chỉ cảnh báo.",
    forText: "cho mọi bài",
    checks: [
      {
        level: "warns",
        text: "Lỗi chất lượng: đáp án đúng tự lộ, lời giải thích quá ngắn, đáp án dồn vào một chữ cái. Bạn thấy chúng, và bài vẫn đạt.",
      },
    ],
  },
  draft: {
    hint: "Đang viết dở: chỉ bài hỏng mới trượt.",
    forText: "cho bài đang viết dở",
    checks: [{ level: "note", text: "Lỗi chất lượng, nên bài chỉ trượt khi không thể chạy." }],
  },
  exam: {
    hint: "Chặt nhất, cho đề thi thử.",
    forText: "cho đề thi thử",
    checks: [
      { level: "fails", text: "Mọi cảnh báo chất lượng." },
      { level: "fails", text: "Câu không có thẻ chủ đề, hoặc lời giải thích dưới 8 từ." },
      { level: "fails", text: "Một chữ cái đáp án chiếm quá 40% số đáp án." },
      { level: "fails", text: "Số câu lệch quá 10% so với yêu cầu." },
      { level: "fails", text: "Quy tắc bị tắt ngay trong bài." },
    ],
  },
  survey: {
    hint: "Không có đáp án đúng.",
    forText: "cho bảng khảo sát",
    checks: [
      {
        level: "off",
        text: "Các kiểm tra giả định có đáp án đúng: đáp án tự lộ, lời giải thích, độ phân bố chữ cái đáp án.",
      },
    ],
  },
};

export const briefEn = {
  brief: "Brief",
  meta: "what the agent should write",
  questions: "Questions",
  appearance: "Appearance",
  cancel: "Cancel",
  finish: "Finish",
  theme: "Theme",
  font: "Font",
  themeName: { light: "Light", dark: "Dark", oled: "OLED", white: "White", paper: "Paper" },
  fontName: { system: "System", sans: "Sans", serif: "Serif", readable: "Readable" },
  answered: (n: number, m: number) => `Answered ${n} of ${m}`,
  answeredAria: "Questions answered",
  yoursW: "yours",
  prefilledW: "pre-filled",
  defaultW: "default",
  toAnswer: (n: number) => `${n} to answer`,
  ready: "Ready to finish",
  qOf: (i: number, n: number) => `Question ${i} of ${n}`,
  onlyYou: "only you can answer",
  optional: "optional",
  mYou: "✓ Your answer",
  mPrefilled: "✎ Pre-filled for you",
  mDefault: "○ Default",
  mNoGoal: "○ No goal",
  mMissing: "! Needs your answer",
  /** the summary's "Chosen by" column (COMMANDS.md, "The forms") */
  byYou: "Yours",
  byPrefilled: "Pre-filled",
  byDefault: "Default",
  noGoalW: "No goal",
  prefilledChip: "Pre-filled for you",
  prefilledNote:
    "The agent filled in what you told it. Check each answer marked Pre-filled for you, change what is wrong, then press Finish.",
  prefilledKeep:
    "A pre-filled answer you keep is written to brief.yaml as your own answer. Change one, and its card offers a way back to it.",
  intro:
    "Answer what the agent should know before it writes your quiz. Every question has a default except the purpose and the scope.",
  step: (i: number, of: number) => `Step ${i} of ${of}`,
  example: "For example:",
  tooShort: (n: number, min: number) =>
    `Too short: ${n} of the ${min} words needed. Name the chapters, lectures or topics.`,
  needed: "Needed: the agent cannot start without it.",
  pickOne: "Needed: pick one. It sets the defaults below.",
  nothingPicked: "Nothing is picked for you. Until you pick, the defaults below are those of Self-study.",
  followsPurpose: (purpose: string) => `The default for ${purpose}. It follows the purpose until you change it.`,
  weakNote: "There is no history here, so the agent picks the weak topics from your reports.",
  words: (n: number) => `${n} ${n === 1 ? "word" : "words"}`,
  otherPh: "problem sets from the tutorials",
  scopePh: "Chapters, lectures or topics",
  emptyPh: "Leave empty for none",
  noLimit: "No limit",
  minutesW: "minutes",
  questionsW: "questions",
  noGoalHint: "No goal: leave empty for none",
  pctHint: "% on the results card",
  fewer: "One question fewer",
  moreQ: "One question more",
  takeOff: (n: number) => `Take ${n} off`,
  add: (n: number) => `Add ${n}`,
  more: "More options",
  profileIs: (p: string) => `Check profile: ${p}`,
  chosenProfile: "Chosen by you, whatever the purpose.",
  profileFollows: (p: string) => `Follows the purpose (${p}).`,
  closeSide: "Close the sidebar (Esc)",
  lgYou: "Your answer",
  lgPrefilled: "Pre-filled for you",
  lgDefault: "Default",
  lgMissing: "Needs your answer",
  lgCurrent: "current",
  keyNext: "next to answer",
  keyQ: "questions",
  keyClose: "close",
  closesIn: (min: number) => `The form closes in ${min} min if left open. Cancel writes nothing.`,
  closesSoon: "The form closes in less than a minute if left open. Cancel writes nothing.",
  closesNever: "Cancel writes nothing.",
  none: "None",
  notAnswered: "Not answered",
  minShort: (n: number) => `${n} min`,
  nQuestions: (n: number) => `${n} questions`,
  otherIs: (x: string) => `Other: ${x}`,
  dlgTitle: "Write the brief?",
  dlgBody: (n: number, y: number, a: number, d: number) =>
    `${n} answers: ${y} yours, ${a} pre-filled for you, ${d} defaults.`,
  dlgNote: (file: string) =>
    `Writes ${file} and an empty content/. A pre-filled answer you keep is recorded as yours, a default as decided_by: default.`,
  goBack: "Go back",
  write: "Write the brief",
  editAria: (x: string) => `Go to the question: ${x}`,
  colQuestion: "Question",
  colAnswer: "Answer",
  colBy: "Chosen by",
  sumHint: "Click a row to go back to its question.",
  revertTo: (x: string) => `Back to the pre-filled answer: ${x}`,
  revertAll: (n: number) => `Back to every pre-filled answer (${n} changed)`,
  profHead: "What each profile checks",
  profChosen: "Chosen",
  levels: { fails: "Fails", warns: "Warns", note: "Note", off: "Off" } as Record<CheckLevel, string>,
  profEvery: "Every profile",
  profEveryText: "A quiz that cannot work: bad syntax, a missing answer key, a missing image.",
  profFoot:
    "Profiles of your own, from fullmark.toml or config.toml, are listed here too. The agent never changes the profile to make a quiz pass.",
  profileOwn: (file: string) => `your own, from ${file}`,
  profiles: profilesEn,
  short: shortEn,
  blkTitle: "Some answers are missing",
  blkLead: "Nothing is written until these are answered:",
  whyPurpose: "pick what the quiz is for",
  whyScope: "say what the quiz covers",
  whyVague: (min: number) => `too short, give at least ${min} words`,
  written: "Brief written",
  doneLine: (n: number, y: number, d: number) => `${n} answers: ${y} yours, ${d} defaults.`,
  fileBrief: "the brief, for the agent",
  fileContent: "empty: put your material here",
  closed: "The server has stopped. You can close this tab.",
  cancelled: "Cancelled",
  cancelledLine: "Nothing was written. To start again, run:",
  copy: "Copy",
  copied: "Copied",
  stopped: "The server has stopped, so nothing was sent. Run the command again to start over.",
  notSent: (why: string) => `The brief was not written: ${why}`,
  sending: "Writing the brief",
  main: "Questions",
  sections: "Sections",
};

export type BriefMessages = typeof briefEn;

export const briefVi: BriefMessages = {
  brief: "Yêu cầu",
  meta: "những gì AI sẽ viết",
  questions: "Câu hỏi",
  appearance: "Giao diện",
  cancel: "Hủy",
  finish: "Hoàn tất",
  theme: "Màu nền",
  font: "Phông chữ",
  themeName: { light: "Sáng", dark: "Tối", oled: "OLED", white: "Trắng", paper: "Giấy" },
  fontName: { system: "Hệ thống", sans: "Sans", serif: "Serif", readable: "Dễ đọc" },
  answered: (n, m) => `Đã trả lời ${n} / ${m}`,
  answeredAria: "Số câu đã trả lời",
  yoursW: "của bạn",
  prefilledW: "điền sẵn",
  defaultW: "mặc định",
  toAnswer: (n) => `Còn ${n} câu`,
  ready: "Sẵn sàng hoàn tất",
  qOf: (i, n) => `Câu ${i} / ${n}`,
  onlyYou: "chỉ bạn trả lời được",
  optional: "không bắt buộc",
  mYou: "✓ Bạn chọn",
  mPrefilled: "✎ Điền sẵn cho bạn",
  mDefault: "○ Mặc định",
  mNoGoal: "○ Không đặt mục tiêu",
  mMissing: "! Cần bạn trả lời",
  byYou: "Của bạn",
  byPrefilled: "Điền sẵn",
  byDefault: "Mặc định",
  noGoalW: "Không đặt mục tiêu",
  prefilledChip: "Điền sẵn cho bạn",
  prefilledNote:
    "AI đã điền sẵn theo những gì bạn nói. Hãy xem từng câu có nhãn Điền sẵn cho bạn, sửa chỗ chưa đúng, rồi bấm Hoàn tất.",
  prefilledKeep:
    "Câu điền sẵn mà bạn giữ lại sẽ được ghi vào brief.yaml là câu trả lời của bạn. Nếu bạn sửa một câu, thẻ của câu đó có nút để về lại câu điền sẵn.",
  intro: "Trả lời những gì AI cần biết trước khi viết bài. Mọi câu đều có giá trị mặc định, trừ mục đích và phạm vi.",
  step: (i, of) => `Bước ${i} / ${of}`,
  example: "Ví dụ:",
  tooShort: (n, min) => `Quá ngắn: ${n} / ${min} từ cần có. Hãy nêu rõ chương, bài giảng hoặc chủ đề.`,
  needed: "Bắt buộc: AI không thể bắt đầu nếu thiếu.",
  pickOne: "Bắt buộc: chọn một. Nó quyết định các giá trị mặc định bên dưới.",
  nothingPicked: "Không có lựa chọn sẵn. Khi bạn chưa chọn, các giá trị mặc định bên dưới là của Tự học.",
  followsPurpose: (purpose) => `Mặc định của ${purpose}. Nó đổi theo mục đích cho đến khi bạn sửa.`,
  weakNote: "Ở đây chưa có lịch sử làm bài, nên AI chọn chủ đề yếu từ các báo cáo của bạn.",
  words: (n) => `${n} từ`,
  otherPh: "bài tập của các buổi trợ giảng",
  scopePh: "Chương, bài giảng hoặc chủ đề",
  emptyPh: "Để trống nếu không có",
  noLimit: "Không giới hạn",
  minutesW: "phút",
  questionsW: "câu",
  noGoalHint: "Không đặt mục tiêu: để trống",
  pctHint: "% trên thẻ kết quả",
  fewer: "Bớt một câu",
  moreQ: "Thêm một câu",
  takeOff: (n) => `Bớt ${n}`,
  add: (n) => `Thêm ${n}`,
  more: "Tuỳ chọn khác",
  profileIs: (p) => `Bộ quy tắc: ${p}`,
  chosenProfile: "Do bạn chọn, bất kể mục đích.",
  profileFollows: (p) => `Theo mục đích (${p}).`,
  closeSide: "Đóng thanh bên (Esc)",
  lgYou: "Bạn chọn",
  lgPrefilled: "Điền sẵn cho bạn",
  lgDefault: "Mặc định",
  lgMissing: "Cần bạn trả lời",
  lgCurrent: "đang xem",
  keyNext: "câu cần trả lời tiếp",
  keyQ: "câu hỏi",
  keyClose: "đóng",
  closesIn: (min) => `Biểu mẫu tự đóng sau ${min} phút nếu để yên. Hủy thì không ghi gì.`,
  closesSoon: "Biểu mẫu tự đóng sau chưa đầy một phút nếu để yên. Hủy thì không ghi gì.",
  closesNever: "Hủy thì không ghi gì.",
  none: "Không có",
  notAnswered: "Chưa trả lời",
  minShort: (n) => `${n} phút`,
  nQuestions: (n) => `${n} câu`,
  otherIs: (x) => `Khác: ${x}`,
  dlgTitle: "Ghi bản yêu cầu?",
  dlgBody: (n, y, a, d) => `${n} câu trả lời: ${y} của bạn, ${a} điền sẵn cho bạn, ${d} mặc định.`,
  dlgNote: (file) =>
    `Ghi ${file} và thư mục content/ trống. Câu điền sẵn mà bạn giữ lại được ghi là của bạn, giá trị mặc định ghi là decided_by: default.`,
  goBack: "Quay lại",
  write: "Ghi bản yêu cầu",
  editAria: (x) => `Đến câu hỏi: ${x}`,
  colQuestion: "Câu hỏi",
  colAnswer: "Câu trả lời",
  colBy: "Ai chọn",
  sumHint: "Bấm vào một dòng để quay về câu hỏi đó.",
  revertTo: (x) => `Về lại câu điền sẵn: ${x}`,
  revertAll: (n) => `Về lại tất cả câu điền sẵn (${n} câu đã sửa)`,
  profHead: "Mỗi bộ quy tắc kiểm tra gì",
  profChosen: "Đang chọn",
  levels: { fails: "Trượt", warns: "Cảnh báo", note: "Ghi chú", off: "Tắt" },
  profEvery: "Mọi bộ quy tắc",
  profEveryText: "Bài không thể chạy: sai cú pháp, thiếu đáp án, thiếu hình.",
  profFoot:
    "Các bộ quy tắc riêng của bạn trong fullmark.toml hoặc config.toml cũng hiện ở đây. AI không bao giờ đổi bộ quy tắc để bài được đạt.",
  profileOwn: (file) => `của riêng bạn, từ ${file}`,
  profiles: profilesVi,
  short: shortVi,
  blkTitle: "Còn thiếu câu trả lời",
  blkLead: "Chưa ghi gì cho đến khi các câu này được trả lời:",
  whyPurpose: "chọn mục đích của bài",
  whyScope: "nêu nội dung bài kiểm tra",
  whyVague: (min) => `quá ngắn, cần ít nhất ${min} từ`,
  written: "Đã ghi bản yêu cầu",
  doneLine: (n, y, d) => `${n} câu trả lời: ${y} của bạn, ${d} mặc định.`,
  fileBrief: "bản yêu cầu cho AI",
  fileContent: "trống: đặt tài liệu của bạn vào đây",
  closed: "Máy chủ đã dừng. Bạn có thể đóng thẻ này.",
  cancelled: "Đã hủy",
  cancelledLine: "Chưa ghi gì. Để bắt đầu lại, chạy:",
  copy: "Sao chép",
  copied: "Đã chép",
  stopped: "Máy chủ đã dừng nên chưa gửi được gì. Hãy chạy lại lệnh để bắt đầu lại.",
  notSent: (why) => `Chưa ghi được bản yêu cầu: ${why}`,
  sending: "Đang ghi bản yêu cầu",
  main: "Câu hỏi",
  sections: "Các phần",
};
