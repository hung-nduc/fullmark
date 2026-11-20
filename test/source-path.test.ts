import { describe, expect, it } from "vitest";
import { absoluteHere, isStoredAbsolute, resolveSource, sameFile, sourceToStore } from "../src/cli/source-path";

describe("a library's source paths (STEP6-GAPS.md, G8 and G12)", () => {
  it("knows an absolute path of any system by its text", () => {
    for (const p of ["/home/minh/a.md", "//server/share/a.md", "D:/studying/a.md", "d:\\studying\\a.md"])
      expect(isStoredAbsolute(p)).toBe(true);
    for (const p of ["../notes/a.md", "a.md", "notes/D:/a.md"]) expect(isStoredAbsolute(p)).toBe(false);
  });

  it("says whether an absolute path means anything on this system", () => {
    expect(absoluteHere("/home/minh/a.md", "linux")).toBe(true);
    expect(absoluteHere("D:/studying/a.md", "linux")).toBe(false);
    expect(absoluteHere("D:/studying/a.md", "win32")).toBe(true);
    expect(absoluteHere("//server/share/a.md", "win32")).toBe(true);
    expect(absoluteHere("/home/minh/a.md", "win32")).toBe(false);
  });

  it("writes a source relative to the library when both are on one drive", () => {
    expect(sourceToStore("D:\\studying\\lectures\\a.md", "D:\\studying\\library", "win32")).toBe("../lectures/a.md");
    expect(sourceToStore("d:/studying/library/notes/a.md", "D:/studying/library", "win32")).toBe("notes/a.md");
    expect(sourceToStore("/home/minh/lectures/a.md", "/home/minh/library", "linux")).toBe("../lectures/a.md");
  });

  it("writes it absolute, with /, only across Windows drives", () => {
    expect(sourceToStore("E:\\lectures\\a.md", "D:\\studying\\library", "win32")).toBe("E:/lectures/a.md");
  });

  it("resolves a relative source against the library and uses an absolute one as it is", () => {
    expect(resolveSource("../lectures/a.md", "/home/minh/library", "linux")).toBe("/home/minh/lectures/a.md");
    expect(resolveSource("../lectures/a.md", "D:\\studying\\library", "win32")).toBe("D:\\studying\\lectures\\a.md");
    expect(resolveSource("/srv/a.md", "/home/minh/library", "linux")).toBe("/srv/a.md");
    expect(resolveSource("E:/lectures/a.md", "D:\\studying\\library", "win32")).toBe("E:/lectures/a.md");
  });

  it("finds nothing for a path that is absolute on another system", () => {
    expect(resolveSource("D:/studying/a.md", "/home/minh/library", "linux")).toBeNull();
    expect(resolveSource("/home/minh/a.md", "D:\\studying\\library", "win32")).toBeNull();
  });

  it("compares files case-insensitively on Windows only", () => {
    expect(sameFile("D:\\Studying\\a.md", "d:/studying/a.md", "win32")).toBe(true);
    expect(sameFile("/home/Minh/a.md", "/home/minh/a.md", "linux")).toBe(false);
  });
});
