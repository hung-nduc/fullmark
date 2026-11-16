# Proposal: chemical structures drawn from SMILES

**Status: proposal, not in v1 scope.** Nothing here changes a v1 format. It builds on two v1 facts: maths, chemistry formulas included (`\ce{…}`, KaTeX's mhchem), is rendered at build, so the page carries no renderer ([QUIZ_SYNTAX.md](../QUIZ_SYNTAX.md), section 8; [TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN.md), section 8); and images, SVG included, sit in the quiz's folder with required alt text.

## The idea

Organic chemistry asks about structures: a skeletal formula, a ring, a functional group, which of four isomers is chiral. Today an author draws each one in a chemistry editor (ChemDraw, MarvinSketch, Ketcher), exports an SVG into `assets/`, and keeps the drawing and the quiz in step by hand. A structure written as text in the quiz, in SMILES (`CC(=O)O` for acetic acid, `c1ccccc1` for benzene), and drawn by fullmark at build would keep the quiz one Markdown file that diffs, reviews and versions like the rest of it.

## What works with v1 as it is

- **Formulas, equations and units** with `\ce{…}` and `\pu{…}`: `\ce{H2SO4}`, `\ce{CuSO4.5H2O}`, `\ce{A <=> B}`, `\pu{123 kJ/mol}`.
- **Condensed chains** as formulas: `\ce{CH3-CH2-OH}`.
- **Structures as images:** an SVG per structure, exported from an editor, with alt text naming the compound. Choices can be images, so "which of these is the product" works.

## What it needs

1. **A syntax.** An inline form, such as `{smiles}` after a code span, or a fenced block with the language `smiles`, so a structure can sit in a prompt, a choice, an explanation or a materials sheet. The alt text is required, as for an image: a screen reader cannot read a drawing, and the SMILES string is not an answer to "what is this".
2. **A renderer at build.** SMILES to SVG in Node, inlined into the page as images are, so the page stays offline and carries no drawing code. Candidates: RDKit's JavaScript build (`@rdkit/rdkit`, the reference toolkit, a WebAssembly file of several MB, loaded only when a quiz has a structure), or SmilesDrawer (small, pure JavaScript, less exact on hard cases). The choice is the main open question; the startup budget (TECHNICAL_DESIGN.md, section 7) requires lazy loading either way.
3. **A check rule.** `check` refuses a SMILES string the renderer cannot parse, with its line, as `math.syntax` does for maths.
4. **Themes.** The SVG's lines and atom labels take the theme's text colour, so a structure reads in dark and OLED as in light, and prints in black.
5. **The printed paper.** The same SVG, sized to the paper's text, so a structure prints as it shows.
6. **The quiz hash** covers the SMILES text, and the renderer's version is pinned, so the same quiz always draws the same picture.

## Left out

Drawing or editing structures in the page (an answer that is a structure), reaction schemes with arrows between structures, 3D models, and names (IUPAC) to structures. Each is much larger than drawing a fixed structure, and none is needed for the common question "which structure is…".
