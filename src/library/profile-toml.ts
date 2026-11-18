import { type ResolvedProfile, resolveProfile } from "../core/config/resolve";
import type { CustomCheck } from "../core/config/types";

/** A TOML basic string. `JSON.stringify` writes one, except that TOML wants DEL escaped too. */
const str = (s: string): string => JSON.stringify(s).replaceAll("\u007f", "\\u007f");

const value = (v: unknown): string => {
  if (typeof v === "string") return str(v);
  if (Array.isArray(v)) return `[${v.map(value).join(", ")}]`;
  return JSON.stringify(v);
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const where = (w: CustomCheck["where"]): string => {
  const parts = Object.entries(w)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${value(v)}`);
  return `{ ${parts.join(", ")} }`;
};

function checkLines(name: string, c: CustomCheck, level: string): string[] {
  const lines = ["", `[[profiles.${name}.checks]]`, `id = ${str(c.id)}`, `kind = ${str(c.kind)}`];
  if (Object.keys(c.where).length > 0) lines.push(`where = ${where(c.where)}`);
  if (c.kind === "count") {
    lines.push(`measure = ${str(c.measure)}`);
    if (c.min !== null) lines.push(`min = ${c.min}`);
    if (c.max !== null) lines.push(`max = ${c.max}`);
  } else if (c.kind === "require") lines.push(`field = ${str(c.field)}`);
  lines.push(`level = ${str(level)}`);
  if (c.message !== null) lines.push(`message = ${str(c.message)}`);
  return lines;
}

/**
 * The `fullmark.toml` that `library share --source` writes beside a shared quiz (STEP4-GAPS.md, G35), or null when the
 * version's profile is a built-in one with no change, which `quiz check` knows by name.
 *
 * Otherwise `[check] profile = NAME` and `[profiles.NAME]`: `extends` the nearest built-in profile of the chain, then
 * each rule whose level or options differ from that built-in's, sorted by id, the custom checks, and `allow-ignore`
 * when it differs. A profile that changes a built-in one of its own name (an overlay) has no `extends`, as in the
 * original. `quiz check` on the shared folder finds the issues the library found under `check.json`.
 */
export function profileToml(profile: ResolvedProfile): string | null {
  // a leaf that is a built-in definition is a built-in profile with no change
  if (profile.chain[0]?.origin === "built-in") return null;
  const parent = profile.chain.find((c) => c.origin === "built-in")?.name ?? "default";
  const base = resolveProfile(parent, { user: null, project: null }).profile;
  const name = profile.name;
  const lines = ["[check]", `profile = ${str(name)}`, "", `[profiles.${name}]`];
  if (parent !== name) lines.push(`extends = ${str(parent)}`);
  if (base !== null && profile.allowIgnore !== base.allowIgnore) lines.push(`allow-ignore = ${profile.allowIgnore}`);
  for (const rule of [...profile.rules.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (rule.kind === "custom") continue;
    const was = base?.rules.get(rule.id);
    const parts: string[] = [];
    if (was === undefined || rule.level !== was.level) parts.push(`level = ${str(rule.level)}`);
    for (const key of Object.keys(rule.options).sort()) {
      if (was === undefined || !same(rule.options[key], was.options[key]))
        parts.push(`${key} = ${value(rule.options[key])}`);
    }
    if (parts.length > 0) lines.push(`rules.${str(rule.id)} = { ${parts.join(", ")} }`);
  }
  for (const check of profile.checks)
    lines.push(...checkLines(name, check, profile.rules.get(check.id)?.level ?? check.level));
  return `${lines.join("\n")}\n`;
}
