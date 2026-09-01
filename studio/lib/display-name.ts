import type { Course, Lesson, Series } from "@/lib/schema";

/**
 * 編集言語（`studio-translation` spec）。ワークスペース全体で1つのモード。
 *
 * ⚠ 面ごとの設定ではない。選択階層が変わっても保たれる。
 */
export type EditLanguage = "ja" | "en";

/**
 * コンテンツの表示名を編集言語で解決する（studio-translation spec）。
 *
 * 規則は **`en` なら `name_en`（trim 後非空）→ 無ければ日本語名**。
 * 公開サイトの `name_en ?? name` と同じフォールバックで、未訳のユニットが
 * 名前を失わないようにする——止めると曼陀羅とツリーが空欄だらけになりナビが死ぬ。
 *
 * ⚠ **UI 文言（ボタン・見出し・ダイアログ）をここへ通さないこと。**
 * 英語になるのはコンテンツ由来の名前と、その隣の識別ラベルだけ、という
 * 射程の線引きを「この関数を通るかどうか」で表している。
 *
 * ⚠ **並べ替え・選択・パス解決のキーには使わないこと。** 名前の正本は
 * フォルダ名（日本語）のままで、これは表示のための別名にすぎない。
 */
export function resolveDisplayName(
  jaName: string,
  nameEn: string | undefined,
  language: EditLanguage,
): string {
  if (language === "en") {
    const trimmed = nameEn?.trim();
    if (trimmed) return trimmed;
  }
  return jaName;
}

export function seriesDisplayName(
  series: Pick<Series, "name" | "name_en">,
  language: EditLanguage,
): string {
  return resolveDisplayName(series.name, series.name_en, language);
}

export function courseDisplayName(
  course: Pick<Course, "name" | "name_en">,
  language: EditLanguage,
): string {
  return resolveDisplayName(course.name, course.name_en, language);
}

export function lessonDisplayName(
  lesson: Pick<Lesson, "lesson" | "name_en">,
  language: EditLanguage,
): string {
  return resolveDisplayName(lesson.lesson, lesson.name_en, language);
}

/**
 * 全体（ホーム）の表示名。`name_en` → `name` → ワークスペース名の順。
 * 全体だけは日本語名自体が任意（未設定ならワークスペース名が出る）なので、
 * 段が1つ多い。
 */
export function workspaceDisplayName(
  meta: { name?: string; name_en?: string },
  workspaceName: string,
  language: EditLanguage,
): string {
  const ja = meta.name?.trim() || workspaceName;
  return resolveDisplayName(ja, meta.name_en, language);
}
