import type { Quiz } from "../core/ir";

/** A section by its slug or title, ignoring case; the plain-words problem (the valid sections) when there is none. */
export function findSection(quiz: Quiz, name: string): Quiz["sections"][number] | string {
  const wanted = name.toLowerCase();
  const titled = quiz.sections.filter((s) => s.title !== null && s.id !== "");
  const found =
    titled.find((s) => s.id.toLowerCase() === wanted) ?? titled.find((s) => (s.title ?? "").toLowerCase() === wanted);
  if (found !== undefined) return found;
  const valid = titled.map((s) => `${s.id} (${s.title})`);
  return `unknown section "${name}"; the sections are: ${valid.length > 0 ? valid.join(", ") : "(none: the quiz has no titled section)"}`;
}
