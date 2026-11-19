import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { historyLibrary, noViolations, PHONES, root, submitAttempt } from "./helpers";
import { fiveQuizzes, longShelf, writeShelf } from "./shelf-fixture";

/**
 * A shelf, as a learner meets it (STEP5.md, slices 5a and 5b): the history library published to a folder with the real
 * CLI; the shelf's `index.html` opened from the file system, which lists the quizzes; then a quiz's link followed, again
 * from the file system with no server (the links name `ID/index.html`, G13), the quiz loads and answers, and its page
 * carries no server code (no `connect-src`).
 */
const cli = join(root, "dist", "cli.js");
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
  const links = page.locator("tbody th a");
  await expect(links).toHaveText(["Limits and continuity", "Study fixture"]);
  await expect(links.nth(0)).toHaveAttribute("href", "calculus-limits/index.html");
  await expect(links.nth(1)).toHaveAttribute("href", "study/index.html");
  await expect(page.locator("tbody tr").first()).toContainText("EN");
  await expect(page.locator("tbody tr").first().locator("td").nth(1)).toHaveText("2");
  expect(await page.locator("script").count()).toBe(0);
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("script-src 'none'");
  expect(policy).not.toContain("connect-src");
  expect(problems).toEqual([]);
});

test("following a quiz's link from the file system opens the quiz, which loads and answers; its page has no connect-src", async ({
  page,
}) => {
  const { shelf } = publishedShelf();
  const home = pathToFileURL(join(shelf, "index.html")).href;
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  await page.goto(home);
  await page.getByRole("link", { name: "Limits and continuity" }).click();
  await expect(page).toHaveURL(home.replace(/index\.html$/, "calculus-limits/index.html"));
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
});

/**
 * The index page as a table (STEP5.md, slice 5c; the look is the ShelfTable boards): axe in light and dark, no sideways
 * scroll and 44 px links at the three phone sizes, the headings kept at the top while a long shelf scrolls, and a phone
 * card's link opening the quiz from the file system.
 */
for (const scheme of ["light", "dark"] as const) {
  test(`axe finds nothing on the index page, en and vi, with five quizzes and with none (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [entries, ui] of [
      [fiveQuizzes(), "en"],
      [fiveQuizzes(), "vi"],
      [[], "en"],
    ] as const) {
      await page.goto(writeShelf([...entries], ui));
      await noViolations(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(writeShelf(fiveQuizzes()));
    await noViolations(page);
  });

  test(`the page takes its colours from the device (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(writeShelf(fiveQuizzes()));
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === "light" ? "rgb(236, 234, 229)" : "rgb(27, 29, 34)");
  });
}

for (const phone of PHONES) {
  test(`at ${phone.width} x ${phone.height} the index page does not scroll sideways, each row is a card and its link is 44 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.goto(writeShelf(longShelf()));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(phone.width);
    // one card per row: each row's cells are in a grid, the column headings are not drawn
    expect(
      await page
        .locator("tbody tr")
        .first()
        .evaluate((e) => getComputedStyle(e).display),
    ).toBe("grid");
    expect((await page.locator("thead").boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
    const links = page.locator("tbody th a");
    const n = await links.count();
    expect(n).toBe(24);
    for (let i = 0; i < n; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box?.height ?? 0, `link ${i}`).toBeGreaterThanOrEqual(43.9); // Firefox reports 43.99999 for a 44 px box
      expect(box?.width ?? 0, `link ${i}`).toBeGreaterThanOrEqual(43.9); // Firefox reports 43.99999 for a 44 px box
    }
    // the numbers are labelled by the card
    const label = await page
      .locator("tbody td")
      .nth(1)
      .evaluate((e) => getComputedStyle(e, "::before").content);
    expect(label).toBe('"Questions"');
  });
}

/** G19: the four numbers of a phone card never touch, at the three phone sizes, in both languages, with the longest time limit. */
for (const phone of PHONES) {
  for (const ui of ["en", "vi"] as const) {
    test(`at ${phone.width} x ${phone.height} (${ui}) the numbers of a card are 8 px apart and stay in the card`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await page.goto(writeShelf(fiveQuizzes(), ui));
      const longest = ui === "en" ? "2 h 20 min" : "2 giờ 20 phút";
      await expect(page.locator("tbody td.n", { hasText: longest })).toHaveCount(1);
      const rows = page.locator("tbody tr");
      for (let i = 0; i < (await rows.count()); i++) {
        const row = rows.nth(i);
        const card = await row.boundingBox();
        const cells = await row.locator("td.n").all();
        const boxes = [];
        for (const c of cells) {
          const b = await c.boundingBox();
          expect(b, `row ${i}`).not.toBeNull();
          if (!b || !card) continue;
          boxes.push(b);
          expect(b.x, `row ${i}`).toBeGreaterThanOrEqual(card.x);
          expect(b.x + b.width, `row ${i}`).toBeLessThanOrEqual(card.x + card.width + 0.5);
          // the text does not spill out of its cell
          expect(await c.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `row ${i}`).toBe(true);
        }
        for (let a = 0; a < boxes.length - 1; a++) {
          const [l, r] = [boxes[a], boxes[a + 1]];
          if (!l || !r) continue;
          const gap = r.x - (l.x + l.width);
          expect(gap, `row ${i}, cells ${a} and ${a + 1}`).toBeGreaterThanOrEqual(7.9);
        }
      }
    });
  }
}

/** G20: the line above a phone card's numbers is one line across the card, not one per cell. */
test("at 360 x 780 the line above a card's numbers is one element across the card's content width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(writeShelf(fiveQuizzes()));
  const rows = page.locator("tbody tr");
  for (let i = 0; i < (await rows.count()); i++) {
    const r = await rows.nth(i).evaluate((tr) => {
      const rs = getComputedStyle(tr);
      const line = getComputedStyle(tr, "::after");
      return {
        content: line.content,
        lineWidth: Number.parseFloat(line.width),
        lineTop: Number.parseFloat(line.borderTopWidth),
        inner: tr.clientWidth - Number.parseFloat(rs.paddingLeft) - Number.parseFloat(rs.paddingRight),
        cellTops: [...tr.querySelectorAll("td.n")].map((c) => Number.parseFloat(getComputedStyle(c).borderTopWidth)),
      };
    });
    expect(r.content, `row ${i}`).toBe('""');
    expect(r.lineTop, `row ${i}`).toBe(1);
    expect(Math.abs(r.lineWidth - r.inner), `row ${i}`).toBeLessThanOrEqual(1);
    expect(r.cellTops, `row ${i}`).toEqual([0, 0, 0, 0]);
  }
});

test("on a long shelf the column headings stay at the top of the window while the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(writeShelf(longShelf()));
  const head = page.locator("thead th").first();
  expect((await head.boundingBox())?.y).toBeGreaterThan(20);
  // the page is the scroller: nothing in it has a scroll box of its own
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1500);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("*")].some(
        (e) =>
          /(auto|scroll)/.test(getComputedStyle(e).overflowY) &&
          e !== document.documentElement &&
          e.scrollHeight > e.clientHeight,
      ),
    ),
  ).toBe(false);
  await page.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight / 2)));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  for (const th of await page.locator("thead th").all()) expect((await th.boundingBox())?.y).toBeCloseTo(0, 0);
});

test("a phone card's link opens the quiz from the file system", async ({ page }) => {
  const { shelf } = publishedShelf();
  await page.setViewportSize({ width: 390, height: 844 });
  const home = pathToFileURL(join(shelf, "index.html")).href;
  await page.goto(home);
  await page.getByRole("link", { name: "Study fixture" }).click();
  await expect(page).toHaveURL(home.replace(/index\.html$/, "study/index.html"));
  await expect(page.locator(".fm-start")).toBeVisible();
});
