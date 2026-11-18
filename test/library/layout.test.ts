import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GITIGNORE_TEXT, libraryPaths, shortHash } from "../../src/library/layout";

describe("the library's layout", () => {
  const p = libraryPaths("/lib");
  const q = p.quiz("signals");

  it("names every path of COMMANDS.md's tree, by the quiz's id", () => {
    expect([p.index, p.gitignore, p.lock, p.quizzes]).toEqual(
      ["library.toml", ".gitignore", ".fullmark.lock", "quizzes"].map((f) => join("/lib", f)),
    );
    const h = "9f3a".padEnd(64, "0");
    expect(
      [
        q.dir,
        q.versions,
        q.version(h),
        q.results,
        q.result("20261118-142210"),
        q.grades,
        q.grade("20261118-142210", "20261118-150000"),
        q.reports,
        q.reportJson("20261118-142210"),
        q.reportMd("20261118-142210"),
        q.review,
        q.progress,
        q.progressFile(h),
      ].map((x) => x.slice(5).replaceAll("\\", "/")),
    ).toEqual([
      "quizzes/signals",
      "quizzes/signals/versions",
      `quizzes/signals/versions/${h}`,
      "quizzes/signals/results",
      "quizzes/signals/results/20261118-142210.json",
      "quizzes/signals/grades",
      "quizzes/signals/grades/20261118-142210-20261118-150000-grades.json",
      "quizzes/signals/reports",
      "quizzes/signals/reports/20261118-142210-report.json",
      "quizzes/signals/reports/20261118-142210-report.md",
      "quizzes/signals/review.json",
      "quizzes/signals/progress",
      `quizzes/signals/progress/${h}.json`,
    ]);
  });

  it("git-ignores the lock, the attempts in progress and temporary files", () => {
    expect(GITIGNORE_TEXT).toBe(".fullmark.lock\nquizzes/*/progress/\n*.tmp\n");
  });

  it("shows a version by its first 4 characters, more when two versions of a quiz share them", () => {
    const a = `9f3a${"0".repeat(60)}`;
    const b = `41c0${"0".repeat(60)}`;
    expect(shortHash(a, [a, b])).toBe("9f3a");
    const c = `9f3a1${"0".repeat(59)}`;
    expect(shortHash(a, [a, c])).toBe("9f3a0");
    expect(shortHash(c, [a, c])).toBe("9f3a1");
    expect(shortHash(a, [a])).toBe("9f3a");
  });
});
