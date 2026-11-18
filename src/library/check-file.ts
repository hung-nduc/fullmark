import { z } from "zod";
import { describeCheck, type ResolvedProfile, type ResolvedRule } from "../core/config/resolve";
import type { CustomCheck } from "../core/config/types";
import { findRule } from "../core/rules/registry";

/**
 * `check.json`: the resolved rules a library version was registered with (COMMANDS.md, `quiz library register`), so a
 * later re-check needs no config. The file is written with sorted keys, two-space indent and a final newline; the
 * reader turns it back into the `ResolvedProfile` that `runChecks` takes.
 */
export const CHECK_FORMAT = "fullmark-check";
export const CHECK_VERSION = 1;
export const CHECK_FILE = "check.json";

const LEVELS = ["error", "warning", "info", "off"] as const;
const source = z.object({ file: z.string(), line: z.number() }).strict().nullable();
const where = z
  .object({
    type: z.string().optional(),
    tag: z.string().optional(),
    section: z.string().optional(),
    graded: z.boolean().optional(),
  })
  .strict();
const base = { id: z.string(), where, level: z.enum(LEVELS), message: z.string().nullable(), source };
const CheckSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("count"),
      measure: z.enum(["questions", "points"]),
      min: z.number().nullable(),
      max: z.number().nullable(),
    })
    .strict(),
  z
    .object({ ...base, kind: z.literal("require"), field: z.enum(["tags", "explanation", "id", "points", "source"]) })
    .strict(),
  z.object({ ...base, kind: z.literal("forbid") }).strict(),
]);

const CheckFileSchema = z
  .object({
    format: z.literal(CHECK_FORMAT),
    version: z.literal(CHECK_VERSION),
    profile: z.string(),
    chain: z.array(z.object({ name: z.string(), origin: z.string() }).strict()),
    rules: z.array(
      z.object({ id: z.string(), level: z.enum(LEVELS), options: z.record(z.string(), z.unknown()) }).strict(),
    ),
    checks: z.array(CheckSchema),
    allowIgnore: z.boolean(),
  })
  .strict();

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The value with every object's keys in sorted order, so the same rules always make the same bytes. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compare)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sorted(v);
    }
    return out;
  }
  return value;
}

/** The text of a `check.json` for a resolved profile. */
export function renderCheck(profile: ResolvedProfile): string {
  const rules = [...profile.rules.values()]
    .sort((a, b) => compare(a.id, b.id))
    .map((r) => ({ id: r.id, level: r.level, options: r.options }));
  const body = {
    format: CHECK_FORMAT,
    version: CHECK_VERSION,
    profile: profile.name,
    chain: profile.chain,
    rules,
    checks: profile.checks,
    allowIgnore: profile.allowIgnore,
  };
  return `${JSON.stringify(sorted(body), null, 2)}\n`;
}

export type CheckRead = { ok: true; profile: ResolvedProfile } | { ok: false; message: string };

/** Reads the text of a `check.json` back into the profile it was made from, or says what is wrong with it. */
export function readCheck(text: string): CheckRead {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch (error) {
    return { ok: false, message: `not valid JSON (${(error as Error).message})` };
  }
  const parsed = CheckFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`).join("; "),
    };
  }
  const data = parsed.data;
  const checks = data.checks as CustomCheck[];
  const custom = new Map(checks.map((c) => [c.id, c]));
  const rules = new Map<string, ResolvedRule>();
  for (const r of data.rules) {
    const known = findRule(r.id);
    const check = custom.get(r.id);
    rules.set(r.id, {
      id: r.id,
      kind: known ? known.kind : "custom",
      level: r.level,
      options: r.options,
      origin: CHECK_FILE,
      optionOrigins: {},
      description: known ? known.summary : check ? (check.message ?? describeCheck(check)) : r.id,
    });
  }
  return {
    ok: true,
    profile: {
      name: data.profile,
      chain: data.chain,
      rules,
      checks,
      allowIgnore: data.allowIgnore,
      allowIgnoreOrigin: CHECK_FILE,
      files: [],
    },
  };
}
