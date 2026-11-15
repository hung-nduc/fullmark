import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { type BriefOptions, runBrief } from "../src/cli/brief";
import { type Case, cases } from "../test/helpers/brief-cases";
import { capture } from "../test/helpers/cli";
import { fakeTerminal } from "../test/helpers/tui";
import { type Served, serveProcess } from "./helpers";

/**
 * Step 3's criterion (STEP3.md, "Done when"): the same answers through the flags, `--tui` and `--web` write the same
 * bytes, the same `defaults_applied` and the same warnings. The answer sets are 3i's (test/helpers/brief-cases.ts, which
 * test/brief/tui.test.ts also runs against the flags) and those 3h added with pre-fills changed and restored. The flags
 * and `--tui` run in process; `--web` is the real command in a subprocess, its form driven by Playwright.
 */
const NONE: BriefOptions = {
  purpose: null,
  scope: null,
  kinds: null,
  kindsOther: null,
  elsewhere: null,
  count: null,
  minutes: null,
  mix: null,
  difficulty: null,
  mode: null,
  weakTopics: null,
  commitment: null,
  language: null,
  request: null,
  profile: null,
  config: null,
  acceptDefaults: false,
  web: false,
  tui: false,
  json: true,
};

const dirs: string[] = [];
const served: Served[] = [];
test.afterEach(() => {
  for (const s of served.splice(0)) s.child.kill("SIGKILL");
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const folder = (files: Record<string, string> = {}): string => {
  const dir = mkdtempSync(join(tmpdir(), "fm-identity-"));
  dirs.push(dir);
  mkdirSync(join(dir, ".git"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
};

type Result = { text: string; defaults: unknown; warnings: unknown };
const resultOf = (dir: string, line: Record<string, unknown> | undefined): Result => {
  expect(line, "the outcome line").toMatchObject({ status: "written" });
  expect(existsSync(join(dir, "d", "brief.yaml"))).toBe(true);
  return {
    text: readFileSync(join(dir, "d", "brief.yaml"), "utf8"),
    defaults: line?.defaults_applied,
    warnings: line?.warnings,
  };
};

async function viaFlags(c: Case): Promise<Result> {
  const dir = folder(c.files);
  const io = capture(dir);
  expect(await runBrief("d", { ...NONE, ...c.flags }, io.io)).toBe(0);
  return resultOf(dir, JSON.parse(io.out[0] as string));
}

async function viaTui(c: Case): Promise<Result> {
  const dir = folder(c.files);
  const io = capture(dir);
  const term = fakeTerminal(c.script);
  expect(await runBrief("d", { ...NONE, ...c.form, tui: true }, { ...io.io, tui: term })).toBe(0);
  return resultOf(dir, JSON.parse(io.out[0] as string));
}

const FLAG_OF: Record<string, string> = {
  purpose: "--purpose",
  scope: "--scope",
  kinds: "--kinds",
  kindsOther: "--kinds-other",
  elsewhere: "--elsewhere",
  count: "--count",
  minutes: "--minutes",
  mix: "--mix",
  difficulty: "--difficulty",
  mode: "--mode",
  weakTopics: "--weak-topics",
  commitment: "--commitment",
  language: "--language",
  request: "--request",
  profile: "--profile",
};
const KEY_OF: Record<string, string> = {
  purpose: "purpose",
  scope: "scope",
  kinds: "content.kinds",
  elsewhere: "content.elsewhere",
  count: "count",
  minutes: "minutes",
  mix: "mix",
  difficulty: "difficulty",
  mode: "mode",
  weakTopics: "weak_topics",
  commitment: "commitment",
  language: "language",
  request: "request",
  profile: "profile",
};
const card = (page: Page, key: string) => page.locator(`section[data-qkey="${key}"]`);

/** Puts the form's answer for `field` at `value` (the flag's text), by the controls a person uses. */
async function answer(page: Page, field: string, value: string): Promise<void> {
  const key = KEY_OF[field] as string;
  const here = card(page, key);
  if (key === "profile") {
    if ((await page.locator("[data-action=more]").getAttribute("aria-expanded")) !== "true") {
      await page.locator("[data-action=more]").click();
    }
  }
  if (["scope", "content.elsewhere"].includes(key)) await here.locator("input[type=text]").fill(value);
  else if (key === "request") await here.locator("textarea").fill(value);
  else if (["count", "minutes", "commitment"].includes(key)) {
    const input = here.locator("input[type=number]");
    await input.fill(value);
    await input.blur();
  } else if (key === "content.kinds" || key === "mix") {
    const wanted = new Set(value.split(",").filter((x) => x !== ""));
    for (const box of await here.locator("input[type=checkbox]").all()) {
      const name = (await box.getAttribute("data-choice")) as string;
      if ((await box.isChecked()) !== wanted.has(name))
        await here.locator(`label:has([data-choice="${name}"])`).click();
    }
  } else
    await here.locator(`[data-choice="${key === "weak_topics" ? (value === "yes" ? "yes" : "no") : value}"]`).click();
}

/** Changes every pre-filled answer, then puts them back: each question's own button, then all at once. */
async function detour(page: Page): Promise<void> {
  const note = page.locator("[data-agent-note]");
  await card(page, "count").locator("[data-action=inc]").click();
  await card(page, "scope").locator("input[type=text]").fill("one two three four five six");
  await card(page, "mode").locator('[data-choice="each-question"]').click();
  await card(page, "request").locator("textarea").fill("something else entirely");
  await card(page, "purpose").locator('[data-choice="classmates"]').click();
  await expect(note.locator("[data-action=revert]")).toContainText("(5 changed)");
  await card(page, "count").locator("[data-action=revert]").click();
  await card(page, "purpose").locator("[data-action=revert]").click();
  await expect(note.locator("[data-action=revert]")).toContainText("(3 changed)");
  await note.locator("[data-action=revert]").click();
  await expect(note.locator("[data-action=revert]")).toHaveCount(0);
  for (const key of ["purpose", "scope", "count", "mode", "request"]) {
    await expect(card(page, key).locator("[data-testid=mark]")).toContainText("Pre-filled for you");
  }
}

async function viaWeb(page: Page, c: Case): Promise<Result> {
  const dir = folder(c.files);
  const args = Object.entries(c.form ?? {}).flatMap(([k, v]) =>
    typeof v === "string" ? [FLAG_OF[k] as string, v] : [],
  );
  const server = await serveProcess(dir, ["brief", "d", "--web", "--no-open", ...args]);
  served.push(server);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 940 });
  await page.goto(server.url);
  await page.locator(".bf").waitFor();
  if (c.detour) await detour(page);
  const have = (c.form ?? {}) as Record<string, string | null>;
  const want = c.flags as Record<string, string | null>;
  for (const field of Object.keys(KEY_OF)) {
    const value = want[field];
    if (value === null || value === undefined) continue;
    // an answer the flags pre-filled and the person keeps is left alone
    if (have[field] === value) continue;
    await answer(page, field, value);
  }
  if (want.kindsOther) await card(page, "content.kinds").locator("input[type=text]").fill(want.kindsOther);
  await page.locator("[data-action=finish]").click();
  await page.locator("[data-dialog=summary] [data-action=write]").click();
  await page.locator("[data-ended=written]").waitFor();
  const end = await server.end();
  expect(end.code).toBe(0);
  return resultOf(dir, end.lines[1]);
}

for (const c of cases) {
  test(`${c.name}: flags, --tui and --web write the same bytes, defaults_applied and warnings`, async ({ page }) => {
    const flags = await viaFlags(c);
    const tui = await viaTui(c);
    const web = await viaWeb(page, c);
    expect(web.text).toBe(flags.text);
    expect(tui.text).toBe(flags.text);
    expect(web.defaults).toEqual(flags.defaults);
    expect(tui.defaults).toEqual(flags.defaults);
    expect(web.warnings).toEqual(flags.warnings);
    expect(tui.warnings).toEqual(flags.warnings);
  });
}
