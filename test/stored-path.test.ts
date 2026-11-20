import { describe, expect, it } from "vitest";
import { storedPath } from "../src/cli/paths";

describe("storedPath (COMMANDS.md, 'Paths in output')", () => {
  it("shows a path that is absolute on another system as stored, whichever system reads it", () => {
    // read on Windows, then on Linux: the platform is passed, since a run is on one system
    expect(storedPath("/home/minh/notes/study.md", "C:/work", "C:/lib", "win32")).toBe("/home/minh/notes/study.md");
    expect(storedPath("D:/studying/quiz.md", "/work", "/lib", "linux")).toBe("D:/studying/quiz.md");
    expect(storedPath("D:\\studying\\quiz.md", "/work", "/lib", "linux")).toBe("D:/studying/quiz.md");
  });

  it("shortens an absolute path of this system under the working directory and always uses `/`", () => {
    const cwd = process.platform === "win32" ? "C:/work" : "/work";
    const inside = process.platform === "win32" ? "C:/work/notes/a.md" : "/work/notes/a.md";
    expect(storedPath(inside, cwd)).toBe("notes/a.md");
  });

  it("resolves a relative path against the folder it is relative to, then shows it like any path", () => {
    const here = process.platform === "win32" ? "C:/work" : "/work";
    expect(storedPath("../notes/a.md", here, `${here}/library`)).toBe("notes/a.md");
    expect(storedPath("../../notes/a.md", `${here}/deep`, `${here}/library/x`)).toBe(`${here}/notes/a.md`);
  });
});
