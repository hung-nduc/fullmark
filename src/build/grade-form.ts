import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { type Attempt, readAnswer } from "../core/attempt";
import { embeddedFonts, type FontsChoice, fontFaceCss, offeredFonts } from "../core/fonts";
import { countWords, type Graded } from "../core/grade";
import type { Question, Quiz } from "../core/ir";
import { toBase64 } from "../core/keyblob";
import { resolveRubric } from "../core/rubric/model";
import { themeCss } from "../core/themes";
import type { AutoKind, GradeCriterion, GradeData, GradeItem } from "../grade-form/data";
import { fontDataUri } from "./fonts";
import type { Highlight } from "./highlight";
import { escapeAttr, sampleHtml, scriptJson, unwrap } from "./page";
import { type Asset, createRenderer } from "./render";
import type { MathTools } from "./tex";

/** The order the kinds are named in, as the sidebar's "Scored by fullmark" row lists them (G98). */
const AUTO_KINDS: readonly AutoKind[] = ["choice", "fillin", "numeric", "ordering", "matching", "scale"];

export type GradeFormOptions = {
  quiz: Quiz;
  hash: string;
  assets: readonly Asset[];
  attempt: Attempt;
  graded: Graded;
  /** the grades template of this attempt (`gradesTemplate`): one entry per answered essay or code question */
  template: { grades: Record<string, Record<string, unknown>> };
  /** `--name` */
  name: string | null;
  /** the two files as the saved card names them */
  files: { grades: string; report: string };
  /** `dist/grade.js`, `dist/page.css` and `dist/grade.css`, read by the CLI */
  script: string;
  css: string;
  gradeCss: string;
  builtAt: string;
  version: string;
  math?: MathTools;
  highlight?: Highlight | null;
  fonts?: FontsChoice;
  fontData?: (path: string) => string;
};

const sha256Source = (text: string): string => `'sha256-${toBase64(sha256(utf8ToBytes(text)))}'`;

/** The form's data (see `GradeData`): the quiz's essays and code split into those to grade and those left blank. */
export function gradeDataOf(o: GradeFormOptions, md: ReturnType<typeof createRenderer>): GradeData {
  const front = o.quiz.frontMatter;
  const byId = new Map<string, Question>();
  for (const s of o.quiz.sections) for (const q of s.questions) byId.set(q.id, q);
  const itemOf = (q: Extract<Question, { type: "essay" | "code" }>, number: number): GradeItem => {
    const rubric = resolveRubric(q.rubric);
    const answer =
      q.type === "essay"
        ? (readAnswer("essay", o.attempt.state.answers[q.id] ?? null)?.text ?? "")
        : (readAnswer("code", o.attempt.state.answers[q.id] ?? null)?.code ?? "");
    const given = answer.trim() === "" ? null : answer;
    const words = given === null ? null : q.type === "essay" ? countWords(given) : given.split("\n").length;
    const criteria: GradeCriterion[] = rubric.criteria.map((c) => ({
      id: c.id,
      html: unwrap(md.block(c.text)),
      max: "max" in c ? c.max : null,
      weight: "weight" in c ? c.weight : null,
    }));
    return {
      id: q.id,
      number,
      type: q.type,
      points: q.points,
      promptHtml: md.block(q.prompt),
      answer: given,
      count: words,
      language: q.type === "code" ? q.language : null,
      sampleHtml: sampleHtml(q, md),
      mode: rubric.mode,
      step: rubric.mode === "banded" ? null : rubric.step,
      scale: rubric.mode === "banded" ? rubric.scale : null,
      round: rubric.mode === "banded" ? rubric.round : null,
      criteria,
      entry: o.template.grades[q.id] ?? {},
    };
  };
  const items: GradeItem[] = [];
  const unanswered: GradeItem[] = [];
  o.graded.questions.forEach((g, i) => {
    const q = byId.get(g.id);
    if (!q || (q.type !== "essay" && q.type !== "code")) return;
    if (g.status === "pending") items.push(itemOf(q, i + 1));
    else if (g.status === "unanswered") unanswered.push(itemOf(q, i + 1));
  });
  // the template lists them in the plan's order, which is the order here
  const taken = new Set([...items, ...unanswered].map((i) => i.id));
  const kindOf = (q: Question): AutoKind =>
    q.type === "single" || q.type === "multi" || q.type === "truefalse"
      ? "choice"
      : q.type === "short" || q.type === "blanks" || q.type === "fields"
        ? "fillin"
        : q.type === "numeric" || q.type === "ordering" || q.type === "matching" || q.type === "scale"
          ? q.type
          : "choice";
  const present = new Set<AutoKind>();
  for (const g of o.graded.questions) {
    const q = byId.get(g.id);
    if (q && !taken.has(g.id)) present.add(kindOf(q));
  }
  const blankPoints = unanswered.reduce((sum, u) => sum + u.points, 0);
  const total = o.graded.total;
  const at = o.attempt.state.submittedAt ?? o.attempt.state.startedAt;
  return {
    version: 1,
    page: {
      theme: front.theme,
      look: front.look,
      font: front.font,
      fonts: offeredFonts(o.fonts ?? "quiz", front.font),
    },
    quizId: front.id,
    quizHash: o.hash,
    title: front.title,
    uiLang: front.uiLang,
    attemptAt: at,
    name: o.name,
    items,
    unanswered,
    auto: {
      count: o.graded.questions.length - items.length - unanswered.length,
      earned: total.earned,
      points: Math.round((total.points - blankPoints) * 100) / 100,
      kinds: AUTO_KINDS.filter((k) => present.has(k)),
    },
    base: { earned: total.earned, points: total.points },
    files: o.files,
  };
}

/**
 * The grading form's page, built in memory (TECHNICAL_DESIGN.md, section 7, foundation 9): the page's styles and the
 * form's, the data block and the one script. The CSP allows that script and the styles by hash, and the form's own
 * `submit` (`connect-src 'self'`). Pure: the same input gives the same bytes. `build`'s page is not touched.
 */
export function buildGradeForm(o: GradeFormOptions): string {
  if (o.script.toLowerCase().includes("</script")) throw new Error("the grading form holds a closing script tag");
  const maths = o.math?.start();
  let hasMath = false;
  const md = createRenderer(o.assets, {
    ...(maths
      ? {
          math: (tex: string, display: boolean) => {
            hasMath = true;
            return maths.render(tex, display);
          },
        }
      : {}),
    highlight: o.highlight,
  });
  const data = gradeDataOf(o, md);
  const front = o.quiz.frontMatter;
  const choice = o.fonts ?? "quiz";
  const css = themeCss(front.theme, front.font, offeredFonts(choice, front.font)) + o.css + o.gradeCss;
  const embedded = embeddedFonts(choice, front.font);
  const fontCss = embedded.length === 0 ? null : fontFaceCss(embedded, o.fontData ?? fontDataUri);
  const mathCss = hasMath ? (maths?.css() ?? null) : null;
  const csp = [
    "default-src 'none'",
    `script-src ${sha256Source(o.script)}`,
    `style-src ${[css, ...(fontCss === null ? [] : [fontCss]), ...(mathCss === null ? [] : [mathCss])].map(sha256Source).join(" ")}`,
    "img-src data:",
    "media-src data:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "connect-src 'self'",
    "frame-src 'self'",
  ].join("; ");
  return [
    "<!doctype html>",
    `<html lang="${data.uiLang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">`,
    `<meta name="generator" content="${escapeAttr(`fullmark ${o.version}; built ${o.builtAt}`)}">`,
    `<title>${escapeAttr(data.title)}</title>`,
    '<link rel="icon" href="data:,">',
    `<style>${css}</style>`,
    ...(fontCss === null ? [] : [`<style id="fm-fonts">${fontCss}</style>`]),
    ...(mathCss === null ? [] : [`<style id="fm-katex">${mathCss}</style>`]),
    "</head>",
    "<body>",
    '<div id="fm-root"></div>',
    `<script type="application/json" id="fm-data">${scriptJson(data)}</script>`,
    `<script>${o.script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
