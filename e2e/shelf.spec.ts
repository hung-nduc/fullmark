import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { historyLibrary, root, submitAttempt } from "./helpers";

/**
 * A shelf, as a learner meets it (STEP5.md, slice 5a): the history library published to a folder with the real CLI; the
 * shelf's `index.html` opened from the file system, which lists the quizzes; then a quiz's link followed, the quiz loads
 * and answers, and its page carries no server code (no `connect-src`). A link to `ID/` is a folder: from `file://` a
 * browser lists it instead of opening its `index.html`, so the link is followed over http, from a static server on
 * 127.0.0.1 (a shelf is served that way: GitHub Pages).
 */
const cli = join(root, "dist", "cli.js");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown",
  ".json": "application/json",
};

function publishedShelf(): { shelf: string; env: Record<string, string> } {
  const t = historyLibrary();
  // its own machine config: the shelf's folder is remembered there, never in the one the tests share
  const config = join(t.dir, "config.toml");
  writeFileSync(config, "");
  const env = { ...process.env, ...t.env, FULLMARK_CONFIG: config, NO_COLOR: "1" };
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: t.dir, env, encoding: "utf8" });
  run("library", "publish", "study-fixture", "--on");
  run("library", "publish", "limits-and-continuity", "--on");
  const shelf = join(t.dir, "shelf");
  mkdirSync(shelf);
  run("library", "publish", shelf);
  return { shelf, env };
}

/** The files of a folder over http: a folder's URL is its `index.html`, as on GitHub Pages. */
function serve(dir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
    let file = join(dir, path);
    if (path.endsWith("/") || path.endsWith("\\")) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      done({ server, origin: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}` });
    }),
  );
}

test("the shelf's index page opens from the file system and lists the quizzes, with no script and no network", async ({
  page,
}) => {
  const { shelf } = publishedShelf();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  await page.goto(`file:///${join(shelf, "index.html").replaceAll("\\", "/")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("shelf");
  const links = page.locator("ul a");
  await expect(links).toHaveText(["Limits and continuity", "Study fixture"]);
  await expect(links.nth(0)).toHaveAttribute("href", "calculus-limits/");
  await expect(links.nth(1)).toHaveAttribute("href", "study/");
  await expect(page.locator("li").first()).toContainText("EN");
  await expect(page.locator("li").first()).toContainText("2 questions");
  expect(await page.locator("script").count()).toBe(0);
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("script-src 'none'");
  expect(policy).not.toContain("connect-src");
  expect(problems).toEqual([]);
});

test("following a quiz's link opens the quiz, which loads and answers; its page has no connect-src", async ({
  page,
}) => {
  const { shelf } = publishedShelf();
  const { server, origin } = await serve(shelf);
  try {
    const requests: string[] = [];
    const problems: string[] = [];
    page.on("request", (r) => {
      if (!/^(data|blob):/.test(r.url())) requests.push(r.url());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    // a quiz page names no icon (a shared page is the same bytes as `quiz build`'s, foundation 9): over http Firefox asks
    // the host for /favicon.ico and logs the CSP refusing it; that is the browser's, not a fault of the page
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon.ico")) problems.push(m.text());
    });
    await page.goto(`${origin}/`);
    await page.getByRole("link", { name: "Limits and continuity" }).click();
    await expect(page).toHaveURL(`${origin}/calculus-limits/`);
    await expect(page.locator(".fm-start")).toBeVisible();
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(policy).not.toContain("connect-src");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator(".fm-question")).toHaveCount(2);
    await page.locator(".fm-question").first().getByLabel("The right one").check();
    await submitAttempt(page);
    const total = page.locator(".fm-total");
    await expect(total).toHaveAttribute("data-earned", "1");
    await expect(total).toHaveAttribute("data-points", "2");
    expect(problems).toEqual([]);
    // only the shelf's own files were asked for: the index, the quiz page and the browser's icon request, nothing elsewhere
    expect(requests.every((u) => u.startsWith(origin))).toBe(true);
    expect(requests.filter((u) => !u.endsWith("favicon.ico"))).toEqual([`${origin}/`, `${origin}/calculus-limits/`]);
  } finally {
    server.close();
  }
});
