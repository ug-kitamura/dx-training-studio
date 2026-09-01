import fs from "node:fs";
import { lessonMetaFileSchema } from "@/lib/schema";

export type LessonMetaWriteResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

/**
 * レッスン `.meta.json` への agent 書込の検査。
 *
 * 門を開ける代わりに、保護の本来の目的（id と表示順を壊さない）を検査として残す:
 * 1. JSON としてパースできること
 * 2. レッスンメタスキーマに適合すること（未知キー拒否。`order` もここで弾かれる）
 * 3. `id` / `en_source_hash` は agent の値を無視し、既存 `.meta.json` の値を保持する
 *    （既存が無ければキーを書かない——id の採番はローダー、鮮度ハッシュは翻訳の
 *    実行主体の責務。agent が書けると古い翻訳を最新と偽装できてしまう）
 *
 * 検査を通った内容は整形（2スペースインデント）して返す。
 */
export function prepareLessonMetaWrite(
  absolutePath: string,
  relativePath: string,
  newContent: string,
): LessonMetaWriteResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(newContent);
  } catch (cause) {
    return {
      ok: false,
      error: [
        `.meta.json は JSON として妥当な内容で書いてください: ${relativePath}`,
        `原因: ${cause instanceof Error ? cause.message : String(cause)}`,
      ].join("\n"),
    };
  }

  const validated = lessonMetaFileSchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return {
      ok: false,
      error: [
        `レッスン .meta.json のスキーマに適合しません: ${relativePath}`,
        `${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "不正な内容"}`,
        "書けるキー: slug / status / description / tags / estimated_minutes / author / author_en / name_en / description_en",
      ].join("\n"),
    };
  }

  // id と en_source_hash は既存値を保護する（agent の値は無視する）
  const data: Record<string, unknown> = { ...validated.data };
  delete data.id;
  delete data.en_source_hash;
  const existing = readProtectedFields(absolutePath);
  const result: Record<string, unknown> = {
    ...(existing.id ? { id: existing.id } : {}),
    ...data,
    ...(existing.enSourceHash ? { en_source_hash: existing.enSourceHash } : {}),
  };

  return { ok: true, content: JSON.stringify(result, null, 2) };
}

function readProtectedFields(absolutePath: string): {
  id?: string;
  enSourceHash?: string;
} {
  if (!fs.existsSync(absolutePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as Record<
      string,
      unknown
    >;
    return {
      ...(typeof raw.id === "string" && raw.id ? { id: raw.id } : {}),
      ...(typeof raw.en_source_hash === "string" && raw.en_source_hash
        ? { enSourceHash: raw.en_source_hash }
        : {}),
    };
  } catch {
    // 既存が壊れている場合は保護値を復元できない。上書きで修復される
    return {};
  }
}
