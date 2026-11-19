# Step 5: decided gaps

Every gap of step 5 the owner has decided, in number order, as it stood when decided; the decisions themselves are written into `docs/design/`, which wins over anything here. The open ones are in [STEP5.md](STEP5.md), "Gaps". Step 5 numbers its gaps from G1 (step 4's are in [archive/STEP4-GAPS.md](archive/STEP4-GAPS.md)).

**G1. The shelf folder's layout.** COMMANDS.md says what a shelf holds (each quiz's current Markdown, assets and built page, an index page, the manifest) and that a quiz folder not in the manifest exits 1, but not how the folder is laid out or what the page is called. **Recommendation:** one folder per quiz at the top level, **named by the quiz's id** (as in the library, so `rename` moves nothing and a link someone saved keeps working; ids are slugs, so the URLs read well). It holds the version's source under its own file name, every asset and `materials` sheet at its relative path, the built page as `index.html` (so GitHub Pages serves it at `…/ID/`), `brief.yaml` only with `--with-brief`, and never `check.json` (the rules travel as `fullmark.toml`, G3). The top level holds `index.html` (the index page), `fullmark-shelf.json` and nothing else of fullmark's; README, LICENSE, `.github/` and other files of the owner's are left alone.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The shelf folder").

**G2. The manifest, `fullmark-shelf.json`.** Its fields are not written down, and its zod schema and JSON Schema were due in step 4 and not built (TECHNICAL_DESIGN.md, section 3, now says step 5). **Recommendation:** `{"format": "fullmark-shelf", "version": 2, "ui_lang", "with_brief", "fonts", "quizzes": [{"id", "name", "title", "lang", "hash", "added", "file", "files"}], "files"}`: `version` 2 like every 1.0 format (`results-v2`, `review-v2`); quizzes sorted by id; `hash` and `added` of the published version (so `import` can keep the time and spot a hand-edited file); `file` the source's name; `files` every path the sync wrote for that quiz, and the top-level `files` the paths it wrote at the root, so a later sync removes only paths the manifest lists. No time of publishing, so the same library state gives the same bytes. Written with sorted keys and a trailing newline, like `library.toml`. A manifest whose `format` is not `fullmark-shelf` is foreign and one whose `version` is above 2 is newer: both exit 2, as COMMANDS.md says. The schema goes to `schemas/fullmark-shelf-v2.schema.json` through `npm run schemas`.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The manifest").

**G3. One `fullmark.toml` per quiz folder, not one at the shelf's root.** COMMANDS.md says a shelf holds "a `fullmark.toml` with the custom profiles those quizzes use", and `import` reads it. But step 4's G38 makes `share --source` write `profile = NAME` when a quiz was registered under a profile other than its own, and one root file can name only one profile, so a shelf of quizzes registered under different profiles cannot say each one's. **Recommendation:** each quiz folder gets exactly the `fullmark.toml` `share --source` would write for that version (G35 and G38: none when the quiz would get the same rules by itself), and the root gets none. `quiz check DIR/ID/FILE.md` then finds what the library found, because the nearest `fullmark.toml` is the quiz folder's. `import` checks each quiz under the nearest `fullmark.toml`, as `register` does, so a hand-made folder with one root file still works. COMMANDS.md (`publish`, `import`) and TECHNICAL_DESIGN.md (section 5, "In the library") are reworded to match.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` and `quiz library import`; TECHNICAL_DESIGN.md, section 5, "In the library".

**G4. Where the shelf folder is remembered, and a missing one.** "Remembered in the config after the first successful sync", keyed by shelf name, but the key's shape and what happens when a later sync names another folder are not written down; nor is a `DIR` that does not exist. **Recommendation:** `config.toml` gains `[shelves]` with `public = "/abs/path"` (written by the same writer as the `library` key, keeping the rest of the file and its comments). Each successful sync records its `DIR` there, replacing the one before, and says so in a line when it changes ("remembered DIR as the public shelf"). A missing `DIR` is created (its parents too); fullmark never runs `git init` in it.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("Remembered", "The sync").

**G5. A shelf inside a repository, not at its root.** COMMANDS.md commits only "if `DIR` is its own git repository". GitHub Pages also serves a repository's `docs/` folder, a common place for a site beside other files, and then nothing would be committed. **Recommendation:** commit when `DIR` is anywhere inside a git work tree, with `git -C DIR commit -- PATHS` holding only the paths the sync wrote or removed (as in the library, the owner's own changes are never swept in), message `fullmark: publish`. A failed commit is a warning, as in the library. Never `git init`, never push.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("Git").

**G6. What a sync refuses in a folder it did not write.** "A quiz folder in `DIR` is not in the manifest" exits 1, but a "quiz folder" is not defined, nor what happens in a non-empty folder with no manifest (the first sync into an existing site). **Recommendation:** a quiz folder is a top-level folder holding an `.md` file and an `index.html` at its top level. With a manifest, such a folder that the manifest does not list exits 1 (a quiz copied in by hand, or another tool's), naming it, with the fix "move it out of DIR, or import it into the library first". With no manifest, the folder may hold anything except a quiz folder (same exit) or an `index.html` at its root (exit 1: the sync would overwrite the owner's page; fix "move it, or publish into an empty folder"). A sync never removes or changes a path its manifest does not list.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("What a sync refuses", Exit).

**G7. `import` into a library that already has some of the quizzes.** COMMANDS.md covers the same hash (unchanged) and a different one ("adds a version, with a warning if the file was edited after publishing"), but not a name taken by another quiz, a shelf older than the library, or which version becomes current. **Recommendation:** quizzes are matched **by id**. Same id: the library's name is kept (a rename in the library is the owner's), and a note says when the shelf calls it otherwise. The shelf's hash is the current version: unchanged. It is an older version of the quiz: unchanged, with a note "the shelf has an older version (HASH)"; nothing goes backwards. A new hash: a new version, made current, as `register --update` does, with `added` the manifest's time when the file still matches the manifest's hash, else now, with the warning that it was edited after publishing. New id: registered under the shelf's name; a name already taken by another quiz refuses the import (all or nothing, exit 1), with the suggestion of a free name as `register` gives. Every imported quiz gets the `public` shelf entry, and `source` is the file's absolute path in `DIR` (so `list` shows `changed` when the shelf's file is edited later).

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library import` ("With a manifest").

**G8. `import` without a manifest: which id.** COMMANDS.md says every `DIR/*/*.md` is registered "with a new id and its slugged title", but a 1.0 quiz carries its `id` in its front matter, and `register` takes it from there and refuses a taken one. **Recommendation:** as `register`: the front matter's id, the slugged title as the name (else the id), all or nothing, a taken id or name refused with its suggestion; no shelf entry, since no shelf owned the folder; `added` is now. Two `.md` files in one folder are two quizzes, each registered with the folder's assets.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library import` ("Without a manifest").

**G9. The shelf's index page.** COMMANDS.md says it lists every quiz with its `lang` badge and has `--ui-lang` for its own chrome, but not what else it shows or how it looks. It is the one new screen of the step, and a phone opens it first (TECHNICAL_DESIGN.md, foundation 8: phones are supported through a shelf). **Recommendation:** a static page with no script at all: a heading (the shelf folder's name), then one row per quiz sorted by title, each with its title as the link to `ID/`, the `EN`/`VI` badge, the number of questions and the time limit when there is one. The page's theme tokens with light and dark through `prefers-color-scheme`, system fonts (no embedded font), a CSP with only its own style sheet's hash, the phone sizes of foundation 8. The planner draws it on the "fullmark themes" canvas, styled like the form boards, for the owner to approve before slice 5c; 5a writes a plain version with the same content.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); the board is drawn before slice 5c.

**G10. The output of `publish` and `import`.** COMMANDS.md has no Output block for either. **Recommendation:** these, with the `--json` shapes COMMANDS.md already gives:

```text
$ quiz library publish signals --on
signals is on the public shelf
committed 1a2b3c4 fullmark: publish signals --on
next: quiz library publish

$ quiz library publish ~/sites/quizzes --dry-run
would publish 3 quizzes to /home/minh/sites/quizzes
  add     signals/    new on the shelf
  update  calculus/   version 7c1e → 2b9d
  remove  old-quiz/   off the shelf
  update  index.html
nothing written (--dry-run)

$ quiz library publish ~/sites/quizzes
published 3 quizzes to /home/minh/sites/quizzes: 1 added, 1 updated, 1 removed
remembered /home/minh/sites/quizzes as the public shelf
committed 5d6e7f8 fullmark: publish (in /home/minh/sites/quizzes)
next: git -C /home/minh/sites/quizzes push   (fullmark never pushes)

$ quiz library publish
unchanged: /home/minh/sites/quizzes already matches the library (3 quizzes)

$ quiz library import ~/sites/quizzes --into ~/quiz-library-2
library ready /home/minh/quiz-library-2 (new folder, git repository)
imported 3 quizzes: calculus, rust-basics, signals (on the public shelf)
committed 9a8b7c6 fullmark: import calculus rust-basics signals
note a shelf holds no results, reports or older versions: import restores quizzes, not a backup
```

`--on` for a quiz already on the shelf (and `--off` for one that is not) says so, commits nothing and exits 0. An unknown name exits 1 as in every library command.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` and `quiz library import` (Output); `--on` twice and `--off` twice in "`NAME --on | --off`".

**G11. `import --into` when the machine already has a library.** "Create a library at `PATH` first, with the rules of `library init`": `init` records the new library in `config.toml` and, without `--force`, refuses to switch from another one. `import` has no `--force`, so on a machine with a library `--into` would always fail, the round-trip test included. **Recommendation:** `--into` creates the library with `init`'s rules for the folder (new, missing or empty; refused otherwise, exit 2) and records it in the config only when the config names no library yet. Otherwise the config is left alone, and the output adds a line "your library is still OLD; use this one with `FULLMARK_LIBRARY=PATH` or `quiz library init PATH --force`".

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library import` ("`--into PATH`", Output).

**G12. An unknown quiz name in `publish NAME --on | --off`.** G10's text, written into COMMANDS.md, says an unknown name "exits 1 as in every library command", but every other library command exits **2** for an unknown quiz (`info`, `take`, `replay`, `review`, `share`, `template add`, `grade`); the slip was the planner's. 5a followed the text and exits 1. **Recommendation:** exit 2, as every library command; COMMANDS.md's `publish` Exit list corrected, the code and its golden (`publish-unknown`) changed first in 5b.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` (Exit); built first in 5b.

**G13. The index page's links from a file.** The index links each quiz as `ID/`. Over http (GitHub Pages) that serves `ID/index.html`, but a shelf opened from the disk (`file://`), which is how an owner looks at it before pushing, shows a folder listing instead of the quiz. **Recommendation:** link `ID/index.html`, which works both ways; COMMANDS.md's "The index page" says so.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); built first in 5b.

**G14. The favicon request on a shared page over http.** A browser asks a served page for `/favicon.ico`; the CSP of every shared page (since step 2) blocks it, and Firefox logs a CSP error in the console. Nothing breaks and nothing is sent. An empty icon would need `img-src data:` in the CSP. **Recommendation:** no change: the blocked request is the CSP doing its job, and the message is only in the console. The 5a spec ignores that one message, with a comment saying why.

**Decided by the owner on 2026-11-19, as recommended.** Written into nothing to write into the design: no change; the 5a spec keeps ignoring that one console message, with its comment.

**G15. What 5a chose where the design was silent.** **Recommendation:** accept these and write them into COMMANDS.md, `publish`: (a) a path the sync would write that exists in `DIR`, differs and is not in the manifest (the owner's `rust/index.html` in a folder that is not a quiz folder) exits 1, nothing written, with the fix "move it, or publish into an empty folder"; (b) a manifest that is not valid JSON or not of the schema's shape exits 2, as a foreign one, and one whose `version` is below 2 is foreign; (c) `--json`'s `added`, `updated` and `removed` are arrays of quiz ids, and a dry run gives the same object with `"dry_run": true`; (d) `NAME --on | --off --json` gives `{"status": "on" | "off" | "unchanged", "name", "committed"}`; (e) `--on` or `--off` with a sync option, or both together, exits 2; (f) outside a git repository each sync says "not in a git repository, so nothing was committed".

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("`NAME --on | --off`", "What a sync refuses", "Git", the `--json` row, Exit); nothing to build, as 5a built it.

**G16. The index page: cards or a table.** G9 decided cards with the title, the `EN`/`VI` badge, the number of questions and the time limit. On seeing the boards, the owner asked for a richer page with the kind of exam, perhaps a table, as an alternative. Both are on the canvas under "Shelf: the index page (step 5, G9)": **A**, the cards (ShelfIndex and its variants), and **B**, a table (ShelfTable, ShelfTableDark, ShelfTableVi, ShelfTablePhone, ShelfTablePhoneDark). B adds a **Type** column (**Exam** when the quiz is checked under the `exam` profile or one extending it, else **Practice**, with "instant feedback" under it when `feedback: instant`), the question types under each title, the points and the pass mark, and a line under the heading counting the quizzes and the languages; on a phone each row becomes a card. All of it comes from the published version, so the manifest does not change. Neither has a font choice: the page has no script, so a choice could not be kept, and each quiz's own page already has Appearance; the page uses system fonts. **Recommendation:** B, the table, if the owner wants the type on the page; the type from the profile is the only signal fullmark has of an exam, so a quiz whose author never named a profile reads as Practice.

**Decided by the owner on 2026-11-19: B, the table, with the Type column** ("for verbosity"), against the planner's advice to leave the Type column out (the profile is an author's check setting, and a quiz that never names one reads as Practice); and a long shelf scrolls with the column headings kept at the top, drawn as ShelfTableLong and ShelfTablePhoneLong. No font choice. Written into COMMANDS.md, `quiz library publish` ("The index page"); the ShelfTable boards copied into `docs/mockup/boards/`; built in 5c.

**G17. What 5b chose where `import`'s design was silent.** **Recommendation:** accept these and write them into COMMANDS.md, `quiz library import`: (a) without a manifest, a quiz is any `DIR/FOLDER/*.md` that opens with a closed `---` block; a broken front matter is then refused by `check`, not skipped; files with no front matter (a `materials` sheet) and dot folders are skipped; (b) with a manifest, a listed quiz whose front matter has another id is refused (`import.id-mismatch`), one whose file is missing is refused (`import.missing`), and quiz folders the manifest does not list are ignored; (c) a quiz unchanged but without the `public` entry gets it and counts as imported, its `source` kept; (d) a taken name's fix reads "FREE is free: rename the quiz that has NAME (`quiz library rename NAME NEW`), or this one"; (e) a missing `DIR`, or one that is not a folder, exits 2; (f) an unchanged import prints `unchanged N quizzes: NAMES`, and the closing note on a backup comes on every import; (g) in `--json`, `refused[].name` is the manifest's name, else the front matter's id.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library import` ("What counts", the closing note, the `--json` row, Exit); nothing to build, as 5b built it.

**G18. A capital letter inside the Vietnamese question types.** The index lowers only the first letter of each type name after the first, so the paper's "Đúng/Sai" reads "đúng/Sai" (03-vi-desktop). **Recommendation:** every name after the first wholly in lower case, the first with only its first letter capitalised; type names hold no proper nouns, so nothing is lost.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); built in 5c's fixes.

**G19. The phone card's numbers touch.** At 390 px, "2 h 20 min" in TIME runs into "60%" in PASS (02-five-phone-dark); in Vietnamese ("2 giờ 20 phút") and at 360 px it is worse. **Recommendation:** the time column wider than the other three, a gap between the cells, and each value free to wrap at a space; tested at 360 × 780 with the longest value.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); built in 5c's fixes.

**G20. The line above a phone card's numbers is broken.** G19's fix puts a 12 px gap between the four cells, and each cell draws its own top border, so the line over the numbers is four segments (02-five-phone-light) where ShelfTablePhone draws one. **Recommendation:** the line belongs to the row of numbers, not to each cell: one continuous line across the card, the cells keeping their gap below it.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); built in step 5's last fix.

**G21. Two choices 5c made where the design was silent.** **Recommendation:** accept both and write them into COMMANDS.md, "The index page": (a) the question types are listed in the default type order (QUIZ_SYNTAX.md, `type_order`), whatever the quiz's own `type_order`, so every row reads the same way; (b) an empty shelf shows only its message ("No quizzes on this shelf yet."), with no count line.

**Decided by the owner on 2026-11-19, as recommended.** Written into COMMANDS.md, `quiz library publish` ("The index page"); nothing to build, as 5c built it.
