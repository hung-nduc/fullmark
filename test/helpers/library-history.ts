import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadQuiz } from "../../src/cli/load";
import { newLibrary, quizText } from "./library-register";

/**
 * The history helper (STEP4.md, G6): a library built through the real commands, in-process, with a fixed clock and the
 * git test environment. One quiz, `study`, in three versions (the stats fixtures' two, then a third that changes one
 * question, removes one and adds one), and the attempts the stats fixtures hold, filed into `results/` as `take` will
 * file them: on the first version, on the second, and one on the third that leaves an essay ungraded; reports for two
 * of them. 4d adds a practice of two questions on the second version (one wrong and later removed, one wrong and later
 * reworded) and leaves `even` unanswered in the last attempt, so that `--missed` has something gone and something
 * changed; 4e extends it with grades and regrades.
 */
const stats = resolve(import.meta.dirname, "..", "fixtures", "stats");
const read = (path: string): string => readFileSync(join(stats, path), "utf8");

/** The dates the three versions are registered on. */
export const VERSION_DATES = [
  "2026-10-01T09:00:00+00:00",
  "2026-10-15T09:00:00+00:00",
  "2026-11-10T09:00:00+00:00",
] as const;

/** The third version: the second without `odd`, `even` reworded, and `ratio` added. */
export function thirdVersion(second: string): string {
  const odd = /## Pick the odd one out\.[\s\S]*?(?=\n## |\n# |$)/;
  return `${second.replace(odd, "").replace("## Zero is even.", "## Zero is an even number.").trimEnd()}

## Which ratio is equal to one half? {type=single id=ratio tags=numbers}

- [ ] Two over three
- [x] Three over six
- [ ] Four over nine
`;
}

const stampOf = (iso: string): string => iso.replaceAll("-", "").replaceAll(":", "").replace("T", "-").slice(0, 15);

type Results = {
  quizHash: string;
  plan: { source: string; section?: string; questions: string[] };
  state: { answers: Record<string, unknown>; startedAt: string | null; submittedAt: string | null };
};

export async function buildHistory() {
  // `created` and `added` are written with the clock's offset: the library is built in UTC, whatever the machine's zone
  const zone = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    return await build();
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
}

async function build() {
  const t = await newLibrary();
  const quizPath = "notes/study.md";
  const v1 = read("quiz-v1.md");
  const v2 = read("quiz-v2.md");
  const v3 = thirdVersion(v2);
  const at = (iso: string) => ({ now: () => new Date(iso) });

  t.write({ [quizPath]: v1 });
  await t.register([quizPath], {}, at(VERSION_DATES[0]));
  t.write({ [quizPath]: v2 });
  await t.register([quizPath], { update: "study" }, at(VERSION_DATES[1]));
  t.write({ [quizPath]: v3 });
  await t.register([quizPath], { update: "study" }, at(VERSION_DATES[2]));
  // a second quiz nobody has taken
  t.write({
    "notes/limits.md": quizText("calculus-limits", "Limits and continuity", [
      ["limit", "What is a limit?"],
      ["cont", "When is a function continuous?"],
    ]),
  });
  await t.register(["notes/limits.md"], {}, at("2026-11-12T09:00:00+00:00"));
  const hashes = [v1, v2, v3].map((text, i) => {
    t.write({ [`.scratch/${i}.md`]: text });
    return loadQuiz(join(t.dir, `.scratch/${i}.md`)).hash as string;
  });

  const quiz = join(t.lib, "quizzes", "study");
  const file = (rel: string, text: string): void => {
    mkdirSync(join(quiz, rel, ".."), { recursive: true });
    writeFileSync(join(quiz, rel), text);
  };
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  const file1 = (name: string, version: number): string => {
    const r = JSON.parse(read(`results/${name}.json`)) as Results;
    const stamp = stampOf(r.state.submittedAt as string);
    file(`results/${stamp}.json`, json(r));
    expectHash(r.quizHash, hashes[version] as string);
    return stamp;
  };
  const stamps: Record<string, string> = {
    a1: file1("a1-v1", 0),
    a2: file1("a2-v1", 0),
    a3: file1("a3-v2", 1),
    a4: file1("a4-v2", 1),
    a5: file1("a5-v2", 1),
  };
  // the reports the grader filed for two of them
  file(`reports/${stamps.a1}-report.json`, read("reports/a1-v1-report.json"));
  file(`reports/${stamps.a4}-report.json`, read("reports/a4-v2-report.json"));

  // a practice of the two questions the retry did not cover, on the second version, both answered wrong: `odd` goes
  // from the third version, `even` is reworded in it (4d: what `--missed` counts as gone and as changed)
  const practice: Results = {
    quizHash: hashes[1] as string,
    plan: { source: "missed", questions: ["odd", "even"] },
    state: {
      answers: { odd: { choice: 0 }, even: { value: false } },
      startedAt: "2026-11-05T19:00:00",
      submittedAt: "2026-11-05T19:03:00",
      timeUsed: 180,
      sectionTime: {},
      flagged: [],
      checked: [],
      timedOut: false,
    } as unknown as Results["state"],
  };
  stamps.p1 = stampOf("2026-11-05T19:03:00");
  file(`results/${stamps.p1}.json`, json({ format: "fullmark-results", version: 2, ...practice, phase: "submitted" }));

  // an attempt on the third version, with an essay nobody has graded; `even` is left unanswered in it
  const six = JSON.parse(read("results/a4-v2.json")) as Results;
  six.quizHash = hashes[2] as string;
  six.plan.questions = six.plan.questions.filter((id) => id !== "odd");
  delete six.state.answers.odd;
  delete six.state.answers.even;
  six.state.answers.ielts = null;
  six.state.startedAt = "2026-11-16T20:00:00";
  six.state.submittedAt = "2026-11-16T20:14:12";
  file(`results/${stampOf("2026-11-16T20:14:12")}.json`, json(six));

  return { ...t, quizPath, hashes, stamps, texts: [v1, v2, v3] as const };
}

/** The recorded hashes in the stats fixtures are the hashes of the quiz files they are taken on. */
function expectHash(recorded: string, actual: string): void {
  if (recorded !== actual) throw new Error(`the stats fixture's results name ${recorded}, the version is ${actual}`);
}
