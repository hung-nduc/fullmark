/** A fenced code block of a Markdown file: its info string, its text and the line of its opening fence (1-based). */
export type Fenced = { info: string; text: string; line: number };

/**
 * The fenced blocks of a Markdown text, outermost first: a longer fence holds shorter ones (the guide writes a quiz
 * with an `answer` block inside a four-backtick `quiz-example`), and a block is closed by a fence of the same character
 * at least as long, with nothing after it.
 */
export function fencedBlocks(markdown: string): Fenced[] {
  const lines = markdown.split("\n");
  const blocks: Fenced[] = [];
  let open: { char: string; length: number; info: string; line: number; body: string[] } | null = null;
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/.exec(line);
      if (m)
        open = {
          char: (m[1] as string)[0] as string,
          length: (m[1] as string).length,
          info: m[2] ?? "",
          line: index + 1,
          body: [],
        };
      return;
    }
    const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (close && (close[1] as string)[0] === open.char && (close[1] as string).length >= open.length) {
      blocks.push({ info: open.info, text: open.body.join("\n"), line: open.line });
      open = null;
      return;
    }
    open.body.push(line);
  });
  if (open !== null) throw new Error(`the fence opened at line ${(open as { line: number }).line} is never closed`);
  return blocks;
}
