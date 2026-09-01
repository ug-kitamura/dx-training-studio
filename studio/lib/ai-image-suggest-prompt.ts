import type { ImagePromptLanguage } from "@/lib/ai-image-prompt";
import { stripCodeFences } from "@/lib/llm-response";
import type { Lesson } from "@/lib/schema";

/**
 * 自動入力が返すプロンプトの言語は編集言語に従う——英語ビューで日本語の
 * 骨子が入ると、そのまま生成に流れて日本語ラベルの図解になる。
 */
const LANGUAGE_LINE: Record<ImagePromptLanguage, string> = {
  ja: "- Japanese is fine unless the lesson context clearly needs another language for UI labels",
  en: "- Write the prompt in English, and state that every label inside the diagram must be in English",
};

function buildSystemPrompt(language: ImagePromptLanguage): string {
  const edition = language === "en" ? "an English" : "a Japanese";
  return `You write image diagram instructions for ${edition} DX training lesson editor.
The author uses your output as the prompt for AI diagram generation (same style as HTML comment instructions).
When a seed prompt is provided, refine and complete it into a polished generation prompt — keep the author's intent.
Respond with ONLY the prompt text — no markdown fences, no JSON, no preamble or explanation.

Prompt style:
- Describe diagram type (step flow, comparison, UI mock, timeline, etc.) and key visual elements
- Use creating-visual-explainers vocabulary (structure diagrams + terminal/editor/browser mocks when helpful)
- Short labels inside the diagram are OK to mention; do not write full lesson prose
${LANGUAGE_LINE[language]}
`.trim();
}

export function snippetAroundOffset(
  content: string,
  offset: number,
  radius = 500,
): string {
  const safe = Math.max(0, Math.min(offset, content.length));
  const start = Math.max(0, safe - radius);
  const end = Math.min(content.length, safe + radius);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < content.length) snippet = `${snippet}…`;
  return snippet;
}

/**
 * `cursorOffset` は渡された `lesson.content`（＝編集言語の本文）に対する offset
 * として解釈する——英語ビューでは英語本文と英語エディタのカーソルが対になる。
 */
export function buildSuggestPromptMessages(
  lesson: Lesson,
  cursorOffset: number,
  seedPrompt?: string,
  language: ImagePromptLanguage = "ja",
): { system: string; user: string } {
  const cursorContext = snippetAroundOffset(lesson.content, cursorOffset);
  const lessonName =
    language === "en" ? (lesson.name_en?.trim() || lesson.lesson) : lesson.lesson;

  const lines = [
    "## Task",
    "Write an image generation prompt suitable for inserting at the author's cursor position in this lesson.",
    "",
    "## Lesson metadata",
    `lesson: ${lessonName}`,
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
      "## Seed prompt (refine and complete this)",
      seed,
    );
  }

  lines.push(
    "",
    "## Full lesson markdown body",
    lesson.content,
    "",
    "Output the prompt text only.",
  );

  return { system: buildSystemPrompt(language), user: lines.join("\n") };
}

export function parseSuggestPromptResponse(raw: string): string {
  return stripCodeFences(raw);
}
