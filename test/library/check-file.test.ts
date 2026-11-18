import { afterEach, describe, expect, it } from "vitest";
import { checkFile } from "../../src/cli/check";
import { runChecks } from "../../src/core/rules/check";
import { CHECK_FORMAT, readCheck, renderCheck } from "../../src/library/check-file";
import { capture, tempTree } from "../helpers/cli";

const trees: { done(): void }[] = [];
afterEach(() => {
  for (const t of trees.splice(0)) t.done();
});

const quiz = `---
title: Stored rules
id: stored
profile: house
---

## One {type=single id=one points=3}

- [x] a
- [ ] b

::: explanation
Short.
:::

## Two {type=single id=two}

- [x] a
- [ ] b
`;

const config = `
[profiles.house]
extends = "default"
allow-ignore = false

[profiles.house.rules]
"explanation.short" = "error"
"choice.correct-longest" = "off"

[[profiles.house.checks]]
id = "custom.needs-tags"
kind = "require"
field = "tags"
level = "error"
`;

describe("check.json", () => {
  it("is written with sorted keys, two-space indent and a final newline, the same bytes every time", () => {
    const t = tempTree({ "q.md": quiz, "fullmark.toml": config });
    trees.push(t);
    const c = capture(t.dir);
    const r = checkFile(
      "q.md",
      { profile: null, config: null, strict: false, review: null, json: false, plain: true },
      c.io,
    );
    if (r.status === "error") throw new Error(r.message);
    const text = renderCheck(r.resolved);
    expect(text).toBe(renderCheck(r.resolved));
    expect(text.endsWith("}\n")).toBe(true);
    const json = JSON.parse(text);
    expect(Object.keys(json)).toEqual(["allowIgnore", "chain", "checks", "format", "profile", "rules", "version"]);
    expect(json.format).toBe(CHECK_FORMAT);
    expect(json.profile).toBe("house");
    expect(json.allowIgnore).toBe(false);
    const ids = json.rules.map((x: { id: string }) => x.id);
    expect(ids).toEqual([...ids].sort());
    expect(text).toContain('\n  "allowIgnore": false,\n');
  });

  it("round trips: the stored rules give the same issues as the original config", () => {
    const t = tempTree({ "q.md": quiz, "fullmark.toml": config });
    trees.push(t);
    const c = capture(t.dir);
    const r = checkFile(
      "q.md",
      { profile: null, config: null, strict: false, review: null, json: false, plain: true },
      c.io,
    );
    if (r.status === "error") throw new Error(r.message);
    expect(r.issues.map((i) => i.rule)).toEqual(expect.arrayContaining(["explanation.short", "custom.needs-tags"]));
    const read = readCheck(renderCheck(r.resolved));
    if (!read.ok) throw new Error(read.message);
    // the same quiz under the stored rules, with no config in sight
    const again = runChecks({
      quiz: r.loaded.quiz,
      issues: r.loaded.issues,
      file: "q.md",
      profile: read.profile,
      brief: null,
      briefIssues: [],
      contentFiles: null,
    });
    expect(again.issues).toEqual(r.issues);
    expect(again.ignored).toEqual(r.ignored);
    // and writing what was read gives the same bytes
    expect(renderCheck(read.profile)).toBe(renderCheck(r.resolved));
  });

  it("says what is wrong with a file that is not a check.json", () => {
    expect(readCheck("{")).toMatchObject({ ok: false });
    const bad = readCheck(JSON.stringify({ format: "other", version: 1 }));
    expect(bad.ok).toBe(false);
    expect(readCheck("{}").ok).toBe(false);
  });
});
