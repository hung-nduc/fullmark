import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A command loads only what it uses (TECHNICAL_DESIGN.md, section 7, "CLI startup"). tsup splits `dist/` into chunks
 * with the commands' lazy `import()` as the boundaries; this reads the chunks' static `import` lines (the ones Node
 * runs at load) and checks that `--version`, `--acknowledgements`, `check`, `rules`, `ids`, `grade`, `inspect`, `new`, `template` and `stats` never reach the page builder, the
 * page renderer (Preact and the components) or the Markdown-to-HTML path of `build`, and never reach the library
 * (`src/library/`); `library init`, `status`, `path`, `register`, `list`, `info`, `stats`, `grade` (without `--web`), `rename`, `rm` and `template add` reach neither the page builder, the renderer nor the server; `library take` loads the server; `library share` loads the page builder and no server; `library review` loads the form's server and page builder through `quiz review`'s chunk only.
 */
const dist = resolve(import.meta.dirname, "..", "dist");
const files = readdirSync(dist).filter((f) => f.endsWith(".js"));

/** esbuild leaves a `// path` comment above each module it bundles. */
const BUILD_ONLY = [
  "// node_modules/preact/",
  "// node_modules/preact-render-to-string/",
  "// node_modules/@preact/signals",
  "// src/page/",
  "// src/build/render.ts",
  "// src/build/page.ts",
  "// src/cli/build.ts",
];

/** The one-shot server (`src/serve/`): only the commands that serve load it. */
const SERVE_ONLY = ["// src/serve/"];

/** The library's store: only the `library` commands load it. */
const LIBRARY_ONLY = ["// src/library/", "// src/cli/library-"];

/** The terminal form's prompts (`@clack/prompts`): only `brief --tui` loads them. */
const CLACK = ["// node_modules/@clack/", "// node_modules/sisteransi/", "// node_modules/fast-wrap-ansi/"];

/** The chunk that holds a source file, found by esbuild's `// path` comment. */
function chunkWith(marker: string): string {
  const name = files.find((f) => readFileSync(join(dist, f), "utf8").includes(marker));
  if (!name) throw new Error(`no chunk of dist/ holds ${marker}: run npm run build`);
  return name;
}

function entry(prefix: string): string {
  const name = files.find((f) => f === `${prefix}.js` || (f.startsWith(`${prefix}-`) && f.endsWith(".js")));
  if (!name) throw new Error(`dist/${prefix}*.js not found: run npm run build`);
  return name;
}

/** The file and every file it imports statically, however deep. Dynamic `import()` is not followed. */
function closure(start: string): string[] {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(join(dist, file), "utf8");
    for (const m of text.matchAll(
      /^(?:import|export)\b[^"';]*?\bfrom\s*"\.\/([^"]+\.js)"|^import\s*"\.\/([^"]+\.js)"/gm,
    )) {
      queue.push((m[1] ?? m[2]) as string);
    }
  }
  return [...seen];
}

function textOf(list: string[]): string {
  return list.map((f) => readFileSync(join(dist, f), "utf8")).join("\n");
}

describe("what each command loads", () => {
  it("the build command does hold the page builder (so the check below is not empty)", () => {
    const text = textOf(closure(entry("build")));
    for (const marker of BUILD_ONLY) expect(text, marker).toContain(marker);
  });

  it("the replay command holds the page builder, and `replay --help` (main) does not", () => {
    const text = textOf(closure(entry("replay-command")));
    for (const marker of BUILD_ONLY) expect(text, marker).toContain(marker);
  });

  it("the serve command holds the page builder and the server (so the checks below are not empty)", () => {
    const text = textOf(closure(entry("serve")));
    for (const marker of [...BUILD_ONLY, ...SERVE_ONLY]) expect(text, marker).toContain(marker);
  });

  it("the review command holds the page builder and the server, and the form is not in its chunks (dist/review.js is a bundle of its own)", () => {
    const review = chunkWith("// src/cli/review.ts");
    const text = textOf(closure(review));
    for (const marker of [...BUILD_ONLY, ...SERVE_ONLY]) {
      expect(text, marker).toContain(marker);
    }
    // the form's code and its words belong to the browser bundle, never to the CLI
    expect(text).not.toContain("// src/review/");
    expect(text).not.toContain("// src/core/i18n/review.ts");
    // a command of its own: `main` and `check` reach it by no static import
    expect(closure(entry("main"))).not.toContain(review);
    expect(closure(entry("check"))).not.toContain(review);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${review}")`);
    for (const marker of CLACK) expect(text, marker).not.toContain(marker);
  });

  it("grade --web is a chunk of its own with the page builder and the server, and the form is not in it (dist/grade.js)", () => {
    const web = chunkWith("// src/cli/grade-web.ts");
    const text = textOf(closure(web));
    for (const marker of [...BUILD_ONLY, ...SERVE_ONLY]) expect(text, marker).toContain(marker);
    expect(text).not.toContain("// src/grade-form/");
    expect(text).not.toContain("// src/core/i18n/grade.ts");
    // `grade` without --web reaches it by a dynamic import only: it loads neither the server nor the form
    expect(closure(entry("main"))).not.toContain(web);
    expect(closure(entry("grade"))).not.toContain(web);
    expect(closure(entry("check"))).not.toContain(web);
    expect(readFileSync(join(dist, entry("grade")), "utf8")).toContain(`import("./${web}")`);
    for (const marker of CLACK) expect(text, marker).not.toContain(marker);
  });

  it("the build and replay commands never load the server", () => {
    for (const name of ["build", "replay-command"]) {
      const text = textOf(closure(entry(name)));
      for (const marker of SERVE_ONLY) expect(text, `${name}: ${marker}`).not.toContain(marker);
    }
  });

  it("the watcher and the reload server are a chunk of their own, loaded by a dynamic import() for `--watch`", () => {
    const watch = chunkWith("// src/cli/build-watch.ts");
    const text = textOf(closure(watch));
    for (const marker of ["// src/cli/watcher.ts", "// src/serve/reload-server.ts", "// src/build/reload.ts"]) {
      expect(text, marker).toContain(marker);
    }
    expect(readFileSync(join(dist, chunkWith("// src/cli/build.ts")), "utf8")).toContain(`import("./${watch}")`);
    // a plain build, and `check`, never load it or the server
    expect(closure(entry("build"))).not.toContain(watch);
    expect(closure(entry("check"))).not.toContain(watch);
    expect(textOf(closure(entry("check")))).not.toContain("// src/serve/");
  });

  it("the prompts are a chunk of their own, loaded by a dynamic import() when the form starts", () => {
    const prompts = chunkWith("// node_modules/@clack/prompts/");
    const text = textOf(closure(prompts));
    for (const marker of CLACK) expect(text, marker).toContain(marker);
    const form = chunkWith("// src/cli/brief-tui.ts");
    expect(readFileSync(join(dist, form), "utf8")).toContain(`import("./${prompts}")`);
    expect(closure(form)).not.toContain(prompts);
    expect(closure(chunkWith("// src/cli/brief.ts"))).not.toContain(prompts);
  });

  it("brief --web is a chunk of its own with the server, and the form is not in it (dist/brief.js)", () => {
    const web = chunkWith("// src/cli/brief-web.ts");
    const text = textOf(closure(web));
    for (const marker of [...SERVE_ONLY, "// src/build/brief-form.ts"]) expect(text, marker).toContain(marker);
    // the form's code and its words belong to the browser bundle, never to the CLI; it needs no page builder either
    expect(text).not.toContain("// src/brief-form/");
    expect(text).not.toContain("// src/core/i18n/brief.ts");
    expect(text).not.toContain("// src/page/");
    expect(text).not.toContain("// src/build/page.ts");
    for (const marker of CLACK) expect(text, marker).not.toContain(marker);
    // `brief` through flags and `--tui` reach it by a dynamic import only: they load neither the server nor the form
    const brief = chunkWith("// src/cli/brief.ts");
    expect(readFileSync(join(dist, brief), "utf8")).toContain(`import("./${web}")`);
    expect(closure(brief)).not.toContain(web);
    expect(textOf(closure(brief))).not.toContain("// src/serve/");
    const tui = chunkWith("// src/cli/brief-tui.ts");
    expect(closure(tui)).not.toContain(web);
    expect(textOf(closure(tui))).not.toContain("// src/serve/");
    expect(closure(entry("main"))).not.toContain(web);
    expect(closure(entry("check"))).not.toContain(web);
    expect(textOf(closure(entry("check")))).not.toContain("// src/serve/");
  });

  for (const [name, start] of [
    ["main", entry("main")],
    ["check", entry("check")],
    ["brief through flags", chunkWith("// src/cli/brief.ts")],
    ["brief --web", chunkWith("// src/cli/brief-web.ts")],
    ["build", entry("build")],
    ["serve", entry("serve")],
  ] as const) {
    it(`${name} never loads @clack/prompts`, () => {
      const text = textOf(closure(start));
      for (const marker of CLACK) expect(text, marker).not.toContain(marker);
    });
  }

  for (const name of [
    "main",
    "check",
    "rules",
    "ids",
    "grade",
    "acknowledgements",
    "inspect",
    "new",
    "template",
    "stats",
  ]) {
    it(`${name} never loads the one-shot server`, () => {
      const text = textOf(closure(entry(name)));
      for (const marker of SERVE_ONLY) expect(text, marker).not.toContain(marker);
    });

    it(`${name} never loads the library`, () => {
      const text = textOf(closure(entry(name)));
      for (const marker of LIBRARY_ONLY) expect(text, marker).not.toContain(marker);
    });

    it(`${name} never reaches the page builder, the renderer or the build's Markdown-to-HTML path`, () => {
      const list = closure(entry(name));
      expect(list.some((f) => f.startsWith("build-"))).toBe(false);
      const text = textOf(list);
      for (const marker of BUILD_ONLY) expect(text, marker).not.toContain(marker);
    });
  }

  it("library take is a chunk of its own with the page builder, the server and the library, reached by a dynamic import() from main", () => {
    const chunk = chunkWith("// src/cli/library-take.ts");
    const text = textOf(closure(chunk));
    for (const m of [...BUILD_ONLY, ...SERVE_ONLY, "// src/library/"]) expect(text, m).toContain(m);
    for (const m of CLACK) expect(text, m).not.toContain(m);
    expect(closure(entry("main"))).not.toContain(chunk);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
    // the commands that only read the library never reach it
    for (const marker of ["// src/cli/library-list.ts", "// src/cli/library-info.ts", "// src/cli/library-status.ts"])
      expect(closure(chunkWith(marker))).not.toContain(chunk);
  });

  it("library replay is a chunk of its own with the page builder and the library but not the server, reached by a dynamic import() from main", () => {
    const chunk = chunkWith("// src/cli/library-replay.ts");
    const text = textOf(closure(chunk));
    for (const m of [...BUILD_ONLY, "// src/library/"]) expect(text, m).toContain(m);
    for (const m of [...SERVE_ONLY, ...CLACK]) expect(text, m).not.toContain(m);
    expect(closure(entry("main"))).not.toContain(chunk);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
  });

  it("library grade --web is a chunk of its own, reached by a dynamic import() from library grade, and loads the form's server and page builder through quiz grade --web's chunk", () => {
    const grade = chunkWith("// src/cli/library-grade.ts");
    const web = chunkWith("// src/cli/library-grade-web.ts");
    const form = chunkWith("// src/cli/grade-web.ts");
    expect(web).not.toBe(grade);
    // `library grade` without --web reaches neither by a static import, and `main` reaches none of the three
    expect(closure(grade)).not.toContain(web);
    expect(closure(grade)).not.toContain(form);
    expect(readFileSync(join(dist, grade), "utf8")).toContain(`import("./${web}")`);
    expect(closure(entry("main"))).not.toContain(web);
    // the server and the page builder are `quiz grade --web`'s own chunk, a dynamic import from the web chunk
    expect(closure(web)).not.toContain(form);
    expect(readFileSync(join(dist, web), "utf8")).toContain(`import("./${form}")`);
    const text = textOf(closure(form));
    for (const m of [...BUILD_ONLY, ...SERVE_ONLY]) expect(text, m).toContain(m);
    for (const m of CLACK) expect(text, m).not.toContain(m);
  });

  it("library share is a chunk of its own with the page builder and the library but not the server, reached by a dynamic import() from main", () => {
    const chunk = chunkWith("// src/cli/library-share.ts");
    const text = textOf(closure(chunk));
    for (const m of [...BUILD_ONLY, "// src/library/"]) expect(text, m).toContain(m);
    for (const m of [...SERVE_ONLY, ...CLACK]) expect(text, m).not.toContain(m);
    expect(closure(entry("main"))).not.toContain(chunk);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
  });

  it("library review is a chunk of its own, reached by a dynamic import() from main, and loads the form's server and page builder through quiz review's chunk by a dynamic import() only", () => {
    const chunk = chunkWith("// src/cli/library-review.ts");
    const form = chunkWith("// src/cli/review.ts");
    expect(chunk).not.toBe(form);
    // the chunk reaches the library, and neither the server nor the page builder by a static import
    const text = textOf(closure(chunk));
    expect(text).toContain("// src/library/");
    for (const m of [...BUILD_ONLY, ...SERVE_ONLY, ...CLACK]) expect(text, m).not.toContain(m);
    expect(closure(chunk)).not.toContain(form);
    expect(readFileSync(join(dist, chunk), "utf8")).toContain(`import("./${form}")`);
    expect(closure(entry("main"))).not.toContain(chunk);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
    // `quiz review` and `check` never reach the library
    expect(textOf(closure(form))).not.toContain("// src/library/");
    expect(textOf(closure(entry("check")))).not.toContain("// src/library/");
  });

  it("library template add reaches neither the page builder, the renderer nor the server, and `quiz template` reaches no library", () => {
    const chunk = chunkWith("// src/cli/library-template.ts");
    const text = textOf(closure(chunk));
    for (const m of [...BUILD_ONLY, ...SERVE_ONLY, ...CLACK]) expect(text, m).not.toContain(m);
    expect(closure(chunk).some((f) => f.startsWith("build-"))).toBe(false);
    expect(text).toContain("// src/library/");
    expect(closure(entry("main"))).not.toContain(chunk);
    expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
    expect(textOf(closure(entry("template")))).not.toContain("// src/library/");
  });

  for (const [command, marker] of [
    ["init", "// src/cli/library-init.ts"],
    ["status", "// src/cli/library-status.ts"],
    ["path", "// src/cli/library-path.ts"],
    ["register", "// src/cli/library-register.ts"],
    ["list", "// src/cli/library-list.ts"],
    ["info", "// src/cli/library-info.ts"],
    ["stats", "// src/cli/library-stats.ts"],
    ["grade", "// src/cli/library-grade.ts"],
    ["rename", "// src/cli/library-rename.ts"],
    ["rm", "// src/cli/library-rm.ts"],
  ] as const) {
    it(`library ${command} is a chunk of its own, reached by a dynamic import() from main, and never loads the page builder, the renderer or the server`, () => {
      const chunk = chunkWith(marker);
      const list = closure(chunk);
      const text = textOf(list);
      for (const m of [...BUILD_ONLY, ...SERVE_ONLY, ...CLACK]) expect(text, m).not.toContain(m);
      expect(list.some((f) => f.startsWith("build-"))).toBe(false);
      expect(text).toContain("// src/library/");
      expect(closure(entry("main"))).not.toContain(chunk);
      expect(readFileSync(join(dist, entry("main")), "utf8")).toContain(`import("./${chunk}")`);
    });
  }
});
