import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { rehypeGithubAlerts } from "rehype-github-alerts";
import { LessonPreviewImage } from "@/components/workspace/LessonPreviewImage";
import { rehypeSearchHighlight } from "@/lib/rehype-search-highlight";
import { normalizeSearchHighlightQuery } from "@/lib/search-highlight-matches";

/**
 * プレビューの remark プラグイン。
 * `remarkCjkFriendly` は全角約物に隣接する強調（`**…（…）**を`）を成立させる。
 */
export const lessonPreviewRemarkPlugins: PluggableList = [
  remarkGfm,
  remarkCjkFriendly,
];

/**
 * プレビューの rehype プラグイン。順序に意味がある。
 * `rehypeRaw` で本文中の生 HTML（`<details>` 等）を取り込み、`rehypeSanitize` で
 * `<script>` 等を除去する。アラート変換とハイライトは sanitize の後に置き、
 * 付与した class が剥がされないようにする。
 * サニタイズは既定スキーマで足りる（`details` / `summary` / `open` と
 * code の `language-*` class を既に許可している）。
 */
export const lessonPreviewRehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeSanitize,
  rehypeGithubAlerts,
  rehypeHighlight,
];

/**
 * ペイン1 の中身検索が生きているときの rehype プラグイン。
 * 一致箇所を塗るプラグインを**末尾**に足す（sanitize より後段でないと剥がされる）。
 * 検索語が無いときは既定の列をそのまま返す——無駄な木の走査をしないため。
 */
export function buildLessonPreviewRehypePlugins(
  searchHighlightQuery?: string,
): PluggableList {
  if (!normalizeSearchHighlightQuery(searchHighlightQuery)) {
    return lessonPreviewRehypePlugins;
  }
  return [
    ...lessonPreviewRehypePlugins,
    [rehypeSearchHighlight, { query: searchHighlightQuery }],
  ];
}

export type PreviewImageContext = {
  availableImagePaths: ReadonlySet<string> | null;
  imageAssetsRevision: number;
};

/** プレビュー用 markdown コンポーネント（画像可用性を Workspace から注入） */
export function createLessonPreviewMarkdownComponents(
  ctx: PreviewImageContext,
): Components {
  return {
    img({ src, alt }) {
      return (
        <LessonPreviewImage
          src={src}
          alt={alt}
          availableImagePaths={ctx.availableImagePaths}
          cacheRevision={ctx.imageAssetsRevision}
        />
      );
    },
  };
}
