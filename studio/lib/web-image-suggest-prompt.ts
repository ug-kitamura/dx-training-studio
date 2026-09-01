import { snippetAroundOffset } from "@/lib/ai-image-suggest-prompt";
import { stripCodeFences } from "@/lib/llm-response";
import type { Lesson } from "@/lib/schema";

const SYSTEM_PROMPT = `You write image search briefs for a Japanese DX training lesson editor.
The author uses your output as a human-readable description in the Web image search tab.
When a seed brief is provided, refine and complete it into a clear stock-image search description.
Respond with ONLY the brief text — no markdown fences, no JSON, no preamble or explanation.

Brief style:
- One or two short Japanese sentences describing what stock photo/illustration to find
- Prefer realistic everyday business scenes (office, PC work, meetings, hands on keyboard)
- Do NOT output English keyword lists or Pixabay query strings
- Do NOT describe diagram layouts or HTML — this is for stock image search, not AI diagram generation
`.trim();

export function buildWebSuggestPromptMessages(
  lesson: Lesson,
  cursorOffset: number,
  seedPrompt?: string,
): { system: string; user: string } {
  const cursorContext = snippetAroundOffset(lesson.content, cursorOffset);

  const lines = [
    "## Task",
    "Write a stock image search brief suitable for inserting at the author's cursor position in this lesson.",
    "",
    "## Lesson metadata",
    `lesson: ${lesson.lesson}`,
    `description: ${lesson.description}`,
    `tags: ${lesson.tags.join(", ")}`,
    "",
    "## Text around cursor (insertion point)",
    cursorContext,
  ];

  const seed = seedPrompt?.trim();
  if (seed) {
    lines.push(
      "",
      "## Seed brief (refine and complete this)",
      seed,
    );
  }

  lines.push(
    "",
    "## Full lesson markdown body",
    lesson.content,
    "",
    "Output the brief text only (Japanese).",
  );

  return { system: SYSTEM_PROMPT, user: lines.join("\n") };
}

export function parseWebSuggestPromptResponse(raw: string): string {
  return stripCodeFences(raw);
}
