import type { Lesson } from "@/lib/schema";
import { sanitizeImageSlug } from "@/lib/image-slug";
import { stripCodeFences } from "@/lib/llm-response";

export type AiImageGenerationResult = {
  slug: string;
  alt: string;
  html: string;
};

const GRAPHIC_VOCABULARY = `
## Visual vocabulary (see contracts/image-slot-contract.md — generation quality)

- Show familiar UIs with Tailwind mocks (terminal, editor, browser, chat, app screens) — do not describe them in prose outside the diagram.
- Combine structural diagrams AND experience-reproduction mocks when both help.
- Structural patterns: analogy, step flow, left-right compare, card grid, number cards, nested blocks, misconception vs truth, timeline.
- Experience mocks: chat UI, editor UI (traffic lights + sidebar), terminal UI, browser UI, generic app mini-screens.
- Paint each UI mock in the palette that app is actually known for: dark for VS Code, Cursor, terminals and command prompts; light for GitHub, Claude Code, Notepad++. When unsure, editor / terminal / code-block mocks are dark. A mock that does not look like the real screen is a worse cue for the learner.
- When two cards sit side by side for comparison, align the elements across them.
- Use Lucide via data-lucide attributes only. No emoji. Tailwind utility classes only inside the diagram block.
- Text may appear INSIDE steps, cards, and UI mocks (short labels, 2-3 line hints like model-answer step flow). Optional one-line diagram title (h3).
- Do NOT output intro paragraphs, summaries, or captions OUTSIDE the single diagram wrapper card.
`.trim();

const FEW_SHOT_FLOW = `
Example quality (single diagram block inside html field — structure and density reference):

<div class="bg-custom-surface border border-custom-border rounded-xl p-6">
  <h3 class="text-lg font-bold text-slate-900 text-center mb-6">APIリクエスト〜レスポンスの流れ</h3>
  <div class="flex flex-row items-stretch justify-center gap-0">
    <div class="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
      <div class="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">1</div>
      <i data-lucide="send" class="w-6 h-6 text-blue-600 mx-auto mb-2"></i>
      <div class="font-bold text-blue-700 text-sm mb-1">リクエスト送信</div>
      <div class="text-xs text-custom-muted leading-relaxed">アプリがAPIに<br>リクエストを送る</div>
    </div>
    <div class="flex items-center justify-center w-10"><i data-lucide="chevron-right" class="w-5 h-5 text-custom-dim"></i></div>
    <div class="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
      <div class="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">2</div>
      <i data-lucide="reply" class="w-6 h-6 text-emerald-600 mx-auto mb-2"></i>
      <div class="font-bold text-emerald-700 text-sm mb-1">レスポンス返却</div>
      <div class="text-xs text-custom-muted leading-relaxed">結果がアプリに<br>届く</div>
    </div>
  </div>
</div>
`.trim();

/**
 * 図中テキストと `alt` の言語。編集言語（`ja` / `en`）に従う——英語ビューで
 * 生成した図解に日本語ラベルが載ると、そのまま英語版本文へ挿入されてしまう。
 * `slug` は言語によらず英語 kebab-case（ファイル名のため）。
 */
export type ImagePromptLanguage = "ja" | "en";

const LANGUAGE_SPEC: Record<
  ImagePromptLanguage,
  { audience: string; altShape: string; extraRules: string[]; fewShotNote: string }
> = {
  ja: {
    audience: "Japanese DX courses",
    altShape: "短い日本語説明（1行）",
    extraRules: [],
    fewShotNote: "",
  },
  en: {
    audience: "English DX courses",
    altShape: "short English description (one line)",
    extraRules: [
      "- ALL text inside the diagram (titles, labels, hints, UI mock contents) MUST be written in English. The lesson context below is the English edition of the lesson.",
    ],
    fewShotNote:
      "\n\n(The example above uses Japanese labels because it is the Japanese edition. Write every label in your output in English.)",
  },
};

function buildSystemPrompt(language: ImagePromptLanguage): string {
  const spec = LANGUAGE_SPEC[language];
  const rules = [
    "- ONE diagram block only (e.g. bg-custom-surface rounded-xl card). No page hero, no outer prose.",
    "- Use custom.* Tailwind colors: custom-surface, custom-border, custom-muted, custom-dim, custom-accent, etc.",
    '- Lucide icons: <i data-lucide="name" class="..."></i>',
    "- No <script>, no <style>, no external images, no emoji.",
    "- Target width roughly 640–960 CSS px (wider for UI mocks like editor/terminal, narrower for flow/card diagrams). Prefer vertical stacking over too many horizontal columns. Keep in-diagram text at text-xs (12px) or larger.",
    "- The diagram's own ground (outer card and page background) is light and never follows the app's dark theme. Inside a UI mock, use that app's own default palette instead — see the visual vocabulary below.",
    ...spec.extraRules,
  ].join("\n");

  return `You create training diagram HTML for ${spec.audience}.
Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{"slug":"english-kebab-case","alt":"${spec.altShape}","html":"<div>...</div>"}

Rules for html:
${rules}

${GRAPHIC_VOCABULARY}

${FEW_SHOT_FLOW}${spec.fewShotNote}`;
}

/**
 * `lesson` はレッスン未選択（ホーム・シリーズ・コース選択中）でも AI タブを使えるよう
 * 任意。無いときはレッスン文脈ブロックを組まず、著者プロンプトだけを指示として渡す。
 *
 * `language` が `en` のとき、`lesson.content` は**英語本文**（`contents.en.md`）で
 * あることを前提とする——どの本文を渡すかは呼び出し側の責務（サーバーは正本を
 * 読みに行かない）。レッスン名は `name_en` があればそれを使う。
 */
export function buildImageGenerationMessages(
  lesson: Lesson | undefined,
  prompt: string,
  language: ImagePromptLanguage = "ja",
): { system: string; user: string } {
  const lessonName =
    language === "en" ? (lesson?.name_en?.trim() || lesson?.lesson) : lesson?.lesson;

  const user = [
    "## Author prompt (primary instruction)",
    prompt.trim(),
    ...(lesson
      ? [
          "",
          "## Lesson context (reference only — do not duplicate as outer prose in html)",
          `lesson: ${lessonName}`,
          `description: ${lesson.description}`,
          `tags: ${lesson.tags.join(", ")}`,
          "",
          "## Full lesson markdown body",
          lesson.content,
        ]
      : []),
    "",
    "Generate JSON with slug, alt, and html for the author prompt.",
  ].join("\n");

  return { system: buildSystemPrompt(language), user };
}

function fallbackSlugFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split(/\r?\n/)[0] ?? "diagram";
  return sanitizeImageSlug(firstLine.slice(0, 32));
}

function fallbackAltFromPrompt(prompt: string): string {
  const line = prompt.trim().split(/\r?\n/).find((l) => l.trim().length > 0) ?? "図解";
  return line.trim().slice(0, 80);
}

/** Claude 応答をパース。JSON 失敗時は HTML 抽出 + プロンプトから slug/alt を推定 */
export function parseAiGenerationResponse(
  raw: string,
  prompt: string,
): AiImageGenerationResult {
  const cleaned = stripCodeFences(raw);

  try {
    const parsed = JSON.parse(cleaned) as {
      slug?: string;
      alt?: string;
      html?: string;
    };
    const html = parsed.html?.trim();
    if (html) {
      return {
        slug: sanitizeImageSlug(parsed.slug ?? fallbackSlugFromPrompt(prompt)),
        alt: (parsed.alt ?? fallbackAltFromPrompt(prompt)).trim().slice(0, 120),
        html,
      };
    }
  } catch {
    // fall through
  }

  const htmlOnly = cleaned.match(/^[\s\S]*(<div[\s\S]*<\/div>)[\s\S]*$/i)?.[1]?.trim();
  if (htmlOnly) {
    return {
      slug: fallbackSlugFromPrompt(prompt),
      alt: fallbackAltFromPrompt(prompt),
      html: htmlOnly,
    };
  }

  if (cleaned.includes("<div")) {
    return {
      slug: fallbackSlugFromPrompt(prompt),
      alt: fallbackAltFromPrompt(prompt),
      html: cleaned,
    };
  }

  throw new Error("Claude 応答から HTML を取得できませんでした");
}
