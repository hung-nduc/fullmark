import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/core/config/parse";
import { type Layers, resolveProfile } from "../../src/core/config/resolve";
import { profileToml } from "../../src/library/profile-toml";

/** The `fullmark.toml` of `library share --source` (STEP4-GAPS.md, G35), from the profile a version was registered with. */
const layersOf = (text: string): Layers => {
  const parsed = parseConfig(text, "fullmark.toml", "project");
  if (parsed.data === null) throw new Error(parsed.errors.map((e) => e.message).join("; "));
  return { user: null, project: parsed.data };
};
const resolved = (name: string, text = "") => {
  const r = resolveProfile(name, layersOf(text));
  if (r.profile === null) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r.profile;
};

describe("profileToml", () => {
  it("writes nothing for a built-in profile with no change", () => {
    for (const name of ["default", "draft", "exam", "survey"]) expect(profileToml(resolved(name)), name).toBeNull();
  });

  it("writes the custom profile: its parent, each rule that differs from the parent (by id), the checks, allow-ignore", () => {
    const text = `
[profiles.signals-exam]
extends = "exam"
allow-ignore = true
rules."brief.count" = { tolerance = 0.05 }
rules."explanation.short" = "warning"
rules."answers.position-skew" = { level = "off" }

[[profiles.signals-exam.checks]]
id = "custom.two-essays"
kind = "count"
where = { type = "essay" }
max = 2
level = "warning"
message = "The real exam has two essays at most."

[[profiles.signals-exam.checks]]
id = "custom.tags"
kind = "require"
field = "tags"
`;
    const toml = profileToml(resolved("signals-exam", text));
    expect(toml).toBe(`[check]
profile = "signals-exam"

[profiles.signals-exam]
extends = "exam"
allow-ignore = true
rules."answers.position-skew" = { level = "off" }
rules."brief.count" = { tolerance = 0.05 }
rules."explanation.short" = { level = "warning" }

[[profiles.signals-exam.checks]]
id = "custom.two-essays"
kind = "count"
where = { type = "essay" }
measure = "questions"
max = 2
level = "warning"
message = "The real exam has two essays at most."

[[profiles.signals-exam.checks]]
id = "custom.tags"
kind = "require"
field = "tags"
level = "error"
`);
    // and what it writes is a config that resolves to the same rules
    const again = resolved("signals-exam", toml as string);
    const first = resolved("signals-exam", text);
    for (const [id, rule] of first.rules) {
      expect(again.rules.get(id)?.level, id).toBe(rule.level);
      expect(again.rules.get(id)?.options, id).toEqual(rule.options);
    }
    expect(again.allowIgnore).toBe(first.allowIgnore);
  });

  it("writes a change to a built-in profile with no extends, as the original has none", () => {
    const toml = profileToml(resolved("exam", `[profiles.exam]\nrules."explanation.short" = { min-words = 12 }\n`));
    expect(toml).toBe(`[check]
profile = "exam"

[profiles.exam]
rules."explanation.short" = { min-words = 12 }
`);
  });

  it("a profile that extends nothing extends default", () => {
    expect(profileToml(resolved("plain", `[profiles.plain]\nrules."choice.in-stem" = "off"\n`))).toBe(`[check]
profile = "plain"

[profiles.plain]
extends = "default"
rules."choice.in-stem" = { level = "off" }
`);
  });
});
