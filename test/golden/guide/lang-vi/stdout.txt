# Writing a quiz for fullmark

This is the authoring guide, printed by `quiz guide`. It says how a quiz is written in Markdown, from the smallest file to a timed exam. The commands that work on a quiz are in `quiz --help`; the rules an agent follows are in `quiz agent-guide`.

A quiz is one UTF-8 Markdown file. `quiz build` turns it into one offline HTML page; `quiz check` tells you what is wrong with it, with a line number and a fix for every finding. Every example below is a `quiz-example` block that passes `quiz check` (a test runs each one), so you can copy any of them.

## 1. A quiz file

A quiz file has three layers: YAML front matter, optional `#` sections, and `##` questions. `###` and deeper headings are an error.

````quiz-example
---
title: "Signals: the Laplace transform"
lang: en
time_limit: 45m
---

# Definitions {time=10m}

Answer every question in this part.

## Which region of convergence makes $\frac{1}{s+2}$ causal? {type=single points=2 tags=roc id=roc-causal}

- [ ] $\operatorname{Re}(s) < -2$
- [x] $\operatorname{Re}(s) > -2$
- [ ] all $s$

::: explanation
A causal signal's region of convergence is a right half-plane, to the right of the rightmost pole at $s = -2$.
:::
````

Rules that hold for the whole file:

- Nothing but blank lines may come between the front matter and the first heading.
- Only `#` and `##` ATX headings count. An underlined heading is plain text.
- Raw HTML is an error (`markdown.raw-html`), and an HTML comment is raw HTML too. Everything HTML was used for has its own syntax, in section 8.
- Images and audio sit in the quiz's folder or below it, and are named by a path relative to the file that names them, with the file's letter case exactly, so a quiz that passes on Windows also works on Linux. A path that leaves the quiz's folder is an error (`asset.outside`).
- A block that starts with `---` is a whole quiz. A block that starts with a heading is a fragment: paste it under the front matter of section 2 (a `title` is enough) and it works.

## 2. Front matter

Unknown keys are an error (`syntax.unknown-key`). Only `title` is required.

| Key | Values | Default |
|---|---|---|
| `title` | text. Quote it if it holds a colon followed by a space | required |
| `description` | Markdown shown on the start screen | none |
| `id` | the slug used in results and page storage | the file name, slugged |
| `kind` | `quiz` or `survey` (every question ungraded, no score) | `quiz` |
| `lang` | `en` or `vi`: the language the quiz is written in. It decides how numbers in answers are read and the language a grader writes feedback in | `en` |
| `ui_lang` | `en` or `vi`: the language of the page's own words. It never affects grading | `lang` |
| `profile` | a check profile (section 12) | `default`, or `survey` for a survey |
| `time_limit` | `90s`, `45m`, `1h30m`. When it runs out the page submits | untimed |
| `feedback` | `end` or `instant`. With `instant`, each auto-graded question can be checked at once and is then locked | `end` |
| `pass_mark` | 0 to 100, a percent of the auto-graded points, shown as the goal | none |
| `shuffle_questions`, `shuffle_choices` | `true` or `false` | `false` |
| `type_order` | `none`, `by-section` or `by-quiz`: the types come in a set order | `none` |
| `partial` | `true` or `false`: partial credit in `multi`, `ordering` and `matching` | `true` |
| `theme` | `auto`, `light`, `dark`, `oled`, `white`, `paper` | `auto` |
| `font` | `system`, `sans`, `serif`, `readable` | `system` |
| `look` | `free` or `locked` (the learner may not change theme or font) | `free` |
| `tags` | a list describing the whole quiz | none |
| `generated_by` | the exact model id that wrote this version, one line | none |
| `materials` | a list of Markdown sheets the learner can open at any time (section 10) | none |

A whole quiz with most of the keys:

````quiz-example
---
title: "Mock exam: signals"
description: Closed book. Answer every question.
id: signals-mock
lang: en
profile: exam
time_limit: 1h30m
feedback: end
pass_mark: 60
shuffle_questions: true
shuffle_choices: true
partial: true
look: locked
theme: paper
font: serif
tags: [signals, laplace]
generated_by: claude-sonnet-5-5
---

## Which transform turns convolution in time into a product? {type=single id=conv-product tags=laplace source="Lecture 4"}

- [ ] The Hadamard transform
- [x] The Laplace transform
- [ ] The Hough transform

::: explanation
Convolution in time becomes multiplication in the transform domain, which is why transforms help with filters.
:::
````

`type_order` can be given in a long form that names the order itself:

````quiz-example
---
title: Ordered by type
type_order:
  by: by-quiz
  order: [[single, multi], truefalse, numeric]
---

## Which gas do plants take in? {type=single id=plant-gas}

- [x] Carbon dioxide
- [ ] Helium
- [ ] Neon

::: explanation
Plants take in carbon dioxide for photosynthesis.
:::

## Every prime above 2 is odd. {type=truefalse id=prime-odd}

```answer
value: true
```

::: explanation
Every even number above 2 has the divisor 2.
:::
````

## 3. Sections, intros and passages

A `#` heading starts a section. A quiz with no `#` heading is one section without a title. Within one quiz, either every question is in a titled section or none is: a question before the first `#` of a quiz that has sections is an error (`syntax.preamble`).

````quiz-example
# Part 2: Reading {id=reading time=20m}

Read the text, then answer the questions that follow.

::: passage
The Fourier transform was first used to solve the heat equation. It writes a signal as a sum of sinusoids.
:::

## What did the Fourier transform first solve? {type=single id=fourier-first}

- [x] The heat equation
- [ ] The wave of a pendulum
- [ ] A chess endgame

::: explanation
The passage says the transform was used first for the heat equation.
:::
````

| Attribute | Meaning |
|---|---|
| title | the heading text |
| `id` | the section's slug, used by `--section`, links and results. Default: the title, slugged. A title with no letters or digits needs an explicit `id=` |
| `time` | a suggested time, shown beside the section. Nothing locks when it passes. The quiz's `time_limit` is the only hard limit |
| `pick` | a bank: each attempt draws this many of the section's questions |

**The intro** is the Markdown between a `#` heading and the first `##`: instructions such as "Answer every question in this part". **A passage** is a text several questions share (a reading text, a case, a data table). It goes in a `::: passage` container in the intro; a section has at most one. A text for the whole quiz goes in `description`, not between the front matter and the first heading.

**A bank** draws some of a section's questions at random for each attempt, which makes practice drills differ every time. Write more questions than you need and set `pick`:

````quiz-example
# Drill: derivatives {id=drill pick=2}

## The derivative of $x^2$ is $2x$. {type=truefalse id=d-square}

```answer
value: true
```

::: explanation
The power rule lowers the exponent by one.
:::

## The derivative of $x^3$ is $2x^2$. {type=truefalse id=d-cube}

```answer
value: false
```

::: explanation
The power rule gives three times x squared.
:::

## The derivative of a constant is zero. {type=truefalse id=d-constant}

```answer
value: true
```

::: explanation
A constant does not change as x changes.
:::
````

Banks are per section. To draw from the whole quiz, put the questions in one section. `pick` must be from 1 to the section's question count (`section.pick`).

## 4. Questions

A `##` heading starts a question. The heading text is the prompt; Markdown between the heading and the answer is more of the prompt (paragraphs, lists, code, images, maths). The attributes go in `{...}` at the end of the heading:

````quiz-example
## Evaluate $\int_0^1 x^2\,dx$. {type=numeric points=2 tags=integrals id=int-x2 source="Lecture 4, slide 12"}

```answer
value: 1/3
```

::: explanation
The antiderivative is $x^3/3$, which is one third between 0 and 1.
:::
````

| Attribute | Meaning | Default |
|---|---|---|
| `type` | one of the types of section 6. Required | |
| `id` | the question's identity across versions. Required (see below) | |
| `points` | a number greater than 0 | `1` |
| `tags` | comma-separated, no spaces: they drive the reports on weak topics | none |
| `source` | where in the material the question comes from, quoted | none |
| `graded` | `false` makes the question ungraded (section 7) | `true` |
| `shuffle` | overrides `shuffle_choices` for this question | |
| `partial` | overrides `partial` for this question | |
| `case` | `sensitive` or `insensitive`, for `short`, `blanks` and `fields` | `insensitive` |
| `check-ignore`, `because` | ignore a quality finding on this question, with a reason (section 12) | |

**Where the attribute block starts.** It is the last `{` on the heading line that is outside maths and code and is not escaped, up to the `}` that ends the line. Braces in `$\frac{1}{s+2}$` or in `` `f{x}` `` are never a block. Inside it, write `name=value` pairs separated by spaces; a value with a space, `=`, `{`, `}` or `"` is double-quoted (`source="Lecture 4, slide 12"`), and `\"` and `\\` are the only escapes. A block that does not parse, an unknown name or a name given twice is an error (`syntax.attributes`, `syntax.unknown-key`), never read as text. A prompt that must end in a literal `{` writes `\{`, or puts the brace in maths.

**Every question states its `type`.** Nothing is guessed: a question with checkboxes is `type=multi` even when only one choice is right.

### Ids

An id is how fullmark knows that a question in a new version is the same question as before. Results, `--missed`, `stats`, reviews and grades all follow it; if an id changes, that question's history starts over.

- **Every question has one** (`question.id-missing`). You do not have to invent them: leave `id` out while writing, then run `quiz ids quiz.md`, which gives every question without an id a random one such as `id=q-k7m2qx` and changes nothing else. It never changes an id that exists, so it is safe to run at any time.
- A hand-written id is welcome: lowercase letters, digits and `-`, starting with a letter, at most 64 characters (`question.id-format`).
- Unique within the quiz (`question.id-duplicate`). A copied question keeps its id: delete it from the copy and run `quiz ids` again.
- Never derive an id from a question's position or its wording: both change all the time.

## 5. Hints and explanations

Two containers, written the same way everywhere:

````quiz-example
## What is the derivative of $\sin x$? {type=short id=d-sin}

```answer
accept: ["cos x", "cos(x)"]
```

::: hint
It is another function you know from trigonometry.
:::

::: explanation
The derivative of sine is cosine, and the derivative of cosine is minus sine.
:::
````

A question has at most one of each, and both are content. **Order inside a question:** the prompt, then the answer (the choices, the list, the `answer` block; for `blanks` the prompt holds the answer), then the hint and the explanation in either order. Nothing else may follow the answer (`question.trailing-text`). Containers do not nest, and an unclosed one is an error (`syntax.container`).

Give every auto-graded question an explanation that says why the answer is right and what the wrong choices get wrong. `quiz check` warns about an explanation under four words (`explanation.short`).

## 6. Question types

Every type has one minimal example. Where the answer is not in the body, it goes in a fenced `answer` block holding YAML.

### single and multi

A `single` has exactly one `[x]`; a `multi` has one or more.

````quiz-example
## Which ion drives phase 3 repolarization? {type=single id=repol-ion}

- [ ] Sodium
- [x] Potassium
- [ ] Calcium

::: explanation
Potassium flows out of the cell in phase 3 and brings the voltage back down.
:::

## Which of these are linear operations? {type=multi id=linear-ops}

- [x] Convolution with a fixed kernel
- [ ] Squaring the signal
- [x] Differentiation

::: explanation
Squaring breaks additivity, the other two operations keep it.
:::
````

- Every item needs `[ ]` or `[x]` (`[X]` is the same), and a question needs at least two choices.
- A choice may hold a fenced code block indented two spaces under it.
- The choices are the last list before the hint or the explanation. A list inside the prompt that comes right before the choices uses a different bullet (`*`), or Markdown joins the two lists into one.
- **Follow-up text.** End a choice with `{input}` or `{input="What is it?"}` to ask for a few words when it is picked ("Other"). It never changes the score. A trailing `{...}` that does not start with `input` is the choice's text, so `{1, 2}` is safe.

````quiz-example
## Which editor do you use most? {type=single id=editor graded=false}

- [ ] Vim
- [ ] Emacs
- [ ] Something else {input="Which one?"}
````

### truefalse

````quiz-example
## Every differentiable function is continuous. {type=truefalse id=diff-cont}

```answer
value: true
```

::: explanation
Differentiability at a point forces continuity there.
:::
````

### numeric

````quiz-example
## The pole of $H(s) = \frac{1}{s+2}$ is at $s = $ {type=numeric id=pole-at}

```answer
value: -2
tolerance: 0.01
unit: ""
```

::: explanation
The denominator is zero when s equals minus two.
:::
````

- `value` is one number; `values: [2, -2]` lists several accepted ones. `tolerance` is absolute and `rel_tolerance` is relative; give at most one. The default is an exact match. `unit` is shown after the box.
- In the source a number is written with a decimal point whatever the quiz's `lang`. It may be an integer, a decimal, `1e-3` or a fraction (`value: 1/3`). With a fraction and no tolerance, `1/3` and `0.333333333333` match and `0.33` does not.
- The learner may type the same forms. With `lang: vi` a decimal comma (`2,5`) is read too; with `lang: en`, `2,5` is never silently marked wrong, the box says a comma is not a decimal point.
- Numbers are compared as numbers: `2x` and `x*2` are not compared as equal.

### short

````quiz-example
## Which rule differentiates a composition? {type=short id=chain-rule}

```answer
accept: ["chain rule", "the chain rule"]
patterns: ['^chain( rule)?$']
```

::: explanation
The derivative of a composition multiplies the outer and inner derivatives.
:::
````

Matching trims, collapses spaces, applies Unicode NFC and ignores case unless the question says `case=sensitive`. List every spelling you accept in `accept`. `patterns` are optional regular expressions that must match the whole answer; they must be valid in JavaScript's `u` mode (no lookbehind, no inline flags). A graded `short` needs `accept` or `patterns` (`short.key`).

### blanks

````quiz-example
## Complete the rules. {type=blanks points=2 id=deriv-rules}

The derivative of $\sin x$ is [[cos x|cos(x)]] and half of one is [[=0.5±0.01]].

::: explanation
Sine differentiates to cosine, and half of one is one half.
:::
````

- `[[answer|variant]]` is a text blank; `[[=0.5±0.01]]` is a numeric one with a tolerance (`+-` is the same as `±`).
- Blanks may be in the heading or the body (paragraphs, lists, quotes, table cells) and inside fenced code; never inside maths, link text or an image's alt text (`blanks.syntax`). In a table cell, write the `|` between variants as `\|`.
- `\[[` is a literal `[[`, not a blank.
- Points are split equally among the blanks. There is no `answer` block.

### fields

Several short answers under one prompt, each its own box:

````quiz-example
## Let $f(x) = x^3 - 3x$. {type=fields points=4 id=cubic-fields}

```answer
fields:
  - label: "$f'(x)$ ="
    accept: ["3x^2-3", "3x^2 - 3"]
    points: 2
  - label: "Number of critical points"
    value: 2
    points: 2
  - label: "Notes"
```

::: explanation
The derivative is three x squared minus three, which is zero at two points.
:::
````

A field takes the keys of `numeric` or of `short`, not both, and needs a `label`. A field with neither is ungraded and has no points. **Points are absolute:** either every graded field has `points` and they add up to the question's `points`, or no field has them and the question's points are split equally among the graded fields (`fields.points`).

### ordering

Write the items in the correct order; the page shows them shuffled, never in the right order.

````quiz-example
## Put the steps of induction in order. {type=ordering points=2 id=induction-steps}

1. Check the base case.
2. Assume the claim for $n = k$.
3. Prove it for $n = k + 1$.

::: explanation
Induction starts at the base, then assumes, then steps forward.
:::
````

At least two items and no duplicates (`ordering.items`). With `partial`, each item in its right place earns an equal share.

### matching

````quiz-example
## Match each transform to its domain. {type=matching points=3 id=transform-domain}

- Laplace :: continuous time
- Z :: discrete time
- DTFT :: discrete time, on the unit circle
- :: frequency only

::: explanation
The first three pair a transform with its signal type, the last is a distractor.
:::
````

`left :: right`. A bullet that starts with `::` adds a distractor on the right. At least two pairs, and every right-hand item unique (`matching.pairs`). The page always shows the right-hand items shuffled, never in source order.

### essay

An essay is never auto-graded: the report hands the answer and the rubric to a grader.

````quiz-example
## Explain why the ROC of a causal system is a right half-plane. {type=essay points=6 id=roc-essay}

```answer
min_words: 120
max_words: 0
rubric:
  mode: additive
  criteria:
    - Defines causality in time (1 pts)
    - Links causality to the Laplace integral's convergence (3 pts)
    - Concludes about the poles (2 pts)
sample_answer: |
  A causal signal is zero for t < 0, so the integral only runs over positive time and converges to the right of the poles.
```
````

`min_words`, `max_words` (0 means no maximum) and `rubric` shape the question; `sample_answer` is the model answer, shown after submit and on the printed key. Leave it out to show nothing. A rubric is explained in section 11.

### code

The answer is exported, never run: a grader judges it by reading.

````quiz-example
## Write `largest`. {type=code points=3 id=largest-code}

```answer
language: rust
starter: |
  fn largest(v: &[i32]) -> i32 {
      todo!()
  }
rubric:
  - Correct for every non-empty slice
  - Does not panic on a one-element slice
  - Idiomatic iterator use
sample_answer: |
  fn largest(v: &[i32]) -> i32 { *v.iter().max().unwrap() }
```
````

`language` is required (`code.language`).

### scale

A rating row. It is always ungraded:

````quiz-example
## How confident are you with Fourier transforms? {type=scale id=fourier-confidence}

```answer
min: 1
max: 5
labels:
  1: Not at all
  5: Very confident
```
````

`max - min` must be from 1 to 10 (`scale.range`).

## 7. Ungraded questions and surveys

- `graded=false` on a heading makes one question ungraded inside a quiz: no score, no right or wrong, never sent to a grader.
- `kind: survey` in the front matter makes every question ungraded; the page shows no score and its last button reads Finish.
- `scale` is always ungraded.

| Type | Can be ungraded | What to write |
|---|---|---|
| `single`, `multi` | yes | choices with no `[x]` |
| `short` | yes | no `answer` block |
| `fields` | yes | fields with only a `label` |
| `essay` | yes | `answer` optional, no `rubric` |
| `ordering` | yes: a ranking | the usual list |
| `scale` | always | |
| `truefalse`, `numeric`, `blanks`, `matching`, `code` | no: error | |

````quiz-example
---
title: Course feedback
kind: survey
---

## Which part helped you most? {type=single id=helped-most}

- [ ] The lectures
- [ ] The labs
- [ ] The reading

## Rank these topics by interest. {type=ordering id=topic-rank}

1. Signals
2. Statistics
3. Imaging

## Anything else you want to tell us? {type=essay id=anything-else}
````

In a survey, `[x]`, `pass_mark`, `pick`, `feedback: instant`, `partial` and `graded=` are errors (`survey.forbidden`). An answer key on an ungraded question is `question.ungraded-key`. `points=` on an ungraded question is only a warning.

## 8. Markdown inside a quiz

| Need | Syntax |
|---|---|
| maths | `$inline$` and `$$display$$`, anywhere text is allowed (choices, labels, explanations), never in code. Chemistry: `\ce{H2O}` for formulas and `\pu{5 mol/L}` for units |
| code | a fenced block with a language, highlighted |
| image | `![alt text](assets/chart.png)`, optionally `{width=300}` straight after the `)`. Alt text is required. png, jpg, gif, webp, svg |
| audio | `![Track 1](track1.mp3)`: an audio player, the alt text is the caption. mp3, ogg, wav, m4a |
| subscript, superscript | `H~2~O`, `m^2^` |
| highlight, underline | `==NOT==`, `++NOT++` |
| line break in a table cell | a trailing `\` |

````quiz-example
## What does the curve in the figure show? {type=single id=figure-curve}

![A magnitude response that falls after 1 kHz](assets/chart.png){width=300}

```python
y = sum(h[k] * x[n - k] for k in range(len(h)))
```

Chemistry works too: $\ce{2H2 + O2 -> 2H2O}$ at $\pu{25 C}$, and so does H~2~O, m^2^, ==this== and ++this++.

- [x] A low-pass filter
- [ ] A high-pass filter
- [ ] An all-pass filter

::: explanation
The magnitude falls after the cut-off, so only low frequencies pass.
:::
````

````quiz-example
## Listen to the track. How many notes do you hear? {type=numeric id=count-notes}

![Track 1](track1.mp3)

```answer
value: 3
```

::: explanation
The track holds three separate notes.
:::
````

Video and remote URLs are not supported (`asset.remote`). An image without alt text is `asset.alt`.

A table works like any Markdown table, and a trailing `\` in a cell breaks the line:

````quiz-example
## Read the table. Which row has the largest value? {type=single id=read-table}

| Row | Value |
|---|---|
| A | 3 |
| B | 7 \
(a record) |
| C | 5 |

- [ ] A
- [x] B
- [ ] C

::: explanation
Row B holds seven, which beats three and five.
:::
````

**Write for the page and the paper alike.** A quiz becomes a page and, with `quiz build --print`, a paper, from the same text. The description, the section intros, the questions, the choices, hints, explanations, rubrics and materials say only what holds on both. They never name a control of the page (the Check or Submit button, Flag, Hint, the sidebar, a key) and never say when the page shows something ("after you submit", "click to reveal"). Write what a thing is ("A hint for the learner"), not which control shows it. `quiz check` warns when the text names a control (`content.names-control`).

## 9. Assets

Images and audio live in the quiz's folder, usually in an `assets/` subfolder, and are embedded in the page. Check them with `quiz check`:

| Rule | When |
|---|---|
| `asset.missing` | the file does not exist, or its letter case differs from the path's |
| `asset.outside` | the path leaves the quiz's folder |
| `asset.type` | a format fullmark does not embed |
| `asset.remote` | a URL |
| `asset.alt` | an image with no alt text |

The quiz's hash covers its assets, so changing an image makes a new version.

## 10. Materials

Materials are the sheets an exam hands out: a formula table, constants, a z-table. They travel inside the page, the printed paper and the library with the quiz, so everyone who takes a quiz works from the same sheet. They are not for open-book notes.

List the sheets in the front matter, with paths relative to the quiz:

````quiz-example
---
title: Trigonometry with a formula sheet
materials:
  - materials/formulas.md
---

## What is $\sin^2 x + \cos^2 x$? {type=numeric id=pythagoras}

```answer
value: 1
```

::: explanation
The sheet lists this identity as the first line.
:::
````

A sheet is ordinary Markdown with maths, tables and images, and holds no questions. It starts with one `#` heading (its name) and may have `##` to `######` below it (`materials.heading`). A sheet has no front matter, no `:::` containers and no question syntax: no `{type=...}`, no `[x]` lists, no `answer` block, no `[[blank]]` (`materials.question`). Keep sheets in a subfolder such as `materials/`. A sheet's image paths are relative to the sheet's own folder, so from `materials/formulas.md` the quiz's shared images are `../assets/z-table.png`. A sheet can give away an answer; what it holds is up to the author. A listed file that does not exist is `materials.missing`.

## 11. Rubrics

An essay or code question needs a rubric: the criteria a grader judges the answer by. There are three modes.

**Holistic** (the default): a list of bullets that guide a free judgement. The grader gives one score.

````quiz-example
## Compare the Fourier and Laplace transforms. {type=essay points=4 id=compare-essay}

```answer
rubric:
  - Says the Fourier transform needs a signal that settles
  - Says the Laplace transform adds a decaying factor
  - Names one use of each
```
````

**Additive**: points per criterion, which must add up to the question's points. Write `(0.5 pts)` at the end of a bullet, or the long form with an `id`:

````quiz-example
## Derive the transfer function of an RC filter. {type=essay points=3 id=rc-transfer}

```answer
rubric:
  mode: additive
  step: 0.25
  criteria:
    - Establish the definitions (0.5 pts)
    - Derive the transfer function (1.5 pts)
    - id: interp
      text: Interpret the poles
      points: 1
```
````

**Banded**: each criterion gets a band on a scale, and the tool combines them (IELTS style). A preset names the whole rubric:

````quiz-example
## Do you agree that cities should ban cars? Give reasons. {type=essay points=9 id=ielts-cars}

```answer
min_words: 250
rubric:
  preset: ielts-writing-task2
```
````

or declare the scale yourself:

````quiz-example
## Describe your favourite experiment. {type=essay points=9 id=experiment-essay}

```answer
rubric:
  mode: banded
  scale: {min: 0, max: 9, step: 0.5}
  round: nearest-step
  criteria:
    - {id: tr, text: Task response, weight: 2}
    - {id: cc, text: Coherence and cohesion}
    - {id: lr, text: Lexical resource}
```
````

The grader gives components (a score or a band per criterion); the tool adds, weights and rounds, so a model never does the arithmetic. `show_rubric: false` in the `answer` block hides the criteria on the page before submit, for a mock exam. A rubric of the wrong shape is `syntax.value`; a rubric that is inconsistent is a `rubric.*` error (`rubric.sum` when additive points do not add up, `rubric.scale` for a bad scale). Write three to five criteria that someone can check: `quiz check` warns about fewer (`rubric.thin`) and about an essay without one (`rubric.missing`).

## 12. How `check` holds a quiz to rules

`quiz check quiz.md` reports every finding as `file:line`, a level, a rule id and a fix. Agents and scripts match on the **rule id** and never on the message.

**Two kinds of rule.** *Fixed rules* say whether a quiz can work at all: syntax, answer keys, matching pairs, banks, missing files. They are always errors and no profile can change them. The ids in this guide (`syntax.attributes`, `question.id-missing`, `choice.correct-count`, `asset.missing`...) are fixed rules. *Quality rules* say whether a question is good (a correct choice that gives itself away, a short explanation, answer positions that lean to one letter, a quiz that does not match its brief, a page that is large). Their level and thresholds depend on the profile.

`quiz rules` lists every rule, and `quiz rules RULE` says why it exists and where its threshold comes from.

**Profiles.** A profile is a named set of rule levels:

| Profile | For | What it does |
|---|---|---|
| `default` | everything | the baseline |
| `draft` | writing in progress | every quality rule is only information, so only fixed rules fail |
| `exam` | mock exams | every quality rule is an error, and inline ignores are not allowed |
| `survey` | questionnaires | the rules about answer keys and explanations are off. A `kind: survey` quiz gets it by itself |

The profile is chosen in this order: `--profile` on the command line, `profile:` in the front matter, `profile` in a `brief.yaml` beside the quiz, `[check] profile` in `fullmark.toml`, then `default`. `fullmark.toml`, found by looking up from the quiz, holds a person's own profiles and changes to the built-in ones. `quiz check --strict` makes warnings count as errors, which is how a quiz is held before it is built or filed.

**Ignoring one finding.** A question may carry `check-ignore` and a required reason:

````quiz-example
## Which of these describes a causal system? {type=single id=causal-def check-ignore="choice.correct-longest" because="the long answer is the point of the question"}

- [ ] One that ignores time
- [x] One whose output depends only on present and past input values
- [ ] One that is random

::: explanation
Causal means the output never depends on future input.
:::
````

Every ignore is reported as information, so nothing is silently hidden. Fixed rules cannot be ignored, and the `exam` profile does not allow ignores at all (`config.ignored` is then an error). An ignore with no `because`, or one that names a fixed or unknown rule, is `ignore.invalid`.

**The profile and the config belong to the owner of the quiz.** An agent never changes `profile:`, edits `fullmark.toml` or adds a `check-ignore` to make `check` pass: it fixes the quiz. `check` names the profile and the config files it used, so loosening would be visible.

**A brief.** If a `brief.yaml` (written by `quiz brief`) sits next to the quiz, `check` also warns when the quiz drifts from it (`brief.count`, `brief.mix`, `brief.mode`) and when a quiz written from a brief lacks `generated_by` (`brief.generated-by`).

## 13. The commonest mistakes

| You see | The fix |
|---|---|
| `question.type-missing` | add `type=...` to the heading's `{...}` |
| `question.id-missing` | run `quiz ids quiz.md` |
| `choice.correct-count` | a `single` has one `[x]`; a `multi` has at least one |
| `choice.marker` | start every choice with `[ ]` or `[x]` |
| `question.answer-block` | `truefalse`, `numeric`, `short`, `fields`, `essay`, `code` and `scale` need an `answer` block; the other types take none |
| `question.trailing-text` | the hint and the explanation come last; nothing else follows the answer |
| `syntax.unknown-key` | a misspelt key or attribute; the list is in sections 2 and 4 |
| `syntax.heading-level` | use only `#` and `##` |
| `markdown.raw-html` | remove the HTML tag or comment, and use the syntax of section 8 |
| `asset.missing` | the file is not there, or its letter case differs |
| `content.names-control` | rewrite the text so it does not name a button or a key |
| `choice.correct-longest` | the right answer is much longer than the others; shorten it or lengthen the others |
| `answers.position-skew` | the right answers sit in one position too often; spread them |

Run `quiz check quiz.md --strict`, fix every finding, and run it again until it is clean. `quiz inspect quiz.md` summarises the types, points, tags and answer positions so you can compare coverage with the material.

## 14. Where the answer key lives

The answer key is inside the page, only obfuscated. It stops a learner from seeing answers by accident, not someone who reads the page source, so never describe a quiz as secure. A printed paper made with `quiz build --print` carries no key unless you ask for one with `--answers`.
