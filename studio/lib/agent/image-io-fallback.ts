/** スキル本文に含まれる場合、このワークスペースは画像・マルチモーダル入出力に非対応としてユーザーへ選択を促す */
const IMAGE_IO_KEYWORDS = [
  "画像を生成",
  "画像生成",
  "画像を読み取",
  "画像を読取",
  "画像を解析",
  "image generation",
  "generate an image",
  "generate images",
];

export const IMAGE_IO_FALLBACK_USER_MESSAGE =
  "このワークスペースは画像・マルチモーダルの生成/読取に対応していません。該当処理をスキップして続行するか、中止するかを選んでください。";

export const IMAGE_IO_FALLBACK_MODEL_HINT =
  "このワークスペースは画像・マルチモーダルの生成/読取に対応していない。当該処理はユーザーの選択によりスキップされている。テキストで完結する範囲の作業を続行すること。";

export function skillMentionsImageIO(text: string): boolean {
  const lower = text.toLowerCase();
  return IMAGE_IO_KEYWORDS.some((keyword) =>
    lower.includes(keyword.toLowerCase()),
  );
}
