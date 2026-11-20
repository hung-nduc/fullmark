import { describe, expect, it } from "vitest";
import { storedPath } from "../src/cli/paths";

describe("storedPath (COMMANDS.md, 'Paths in output')", () => {
  it("shows a path that is absolute on another system as stored, never resolved against the drive", () => {
    if (process.platform === "win32")
      expect(storedPath("/home/minh/notes/study.md", "C:work")).toBe("/home/minh/notes/study.md");
    else expect(storedPath("/home/minh/notes/study.md", "/work")).toBe("/home/minh/notes/study.md");
  });

  it("shortens a path under the working directory and always uses `/`", () => {
    const cwd = process.platform === "win32" ? "C:work" : "/work";
    const inside = process.platform === "win32" ? "C:/work/notes/a.md" : "/work/notes/a.md";
    expect(storedPath(inside, cwd)).toBe("notes/a.md");
  });
});
