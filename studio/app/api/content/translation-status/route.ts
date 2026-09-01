import { z } from "zod";
import { getProjectRoot } from "@/lib/project-root";
import {
  bodyFreshness,
  changelogFreshness,
  isBodyUntranslated,
  isChangelogUntranslated,
  listMissingEnFields,
  metaFreshness,
  type TranslationFreshness,
} from "@/lib/translation/freshness";
import {
  readChangelogPair,
  readLessonBodies,
  resolveUnit,
  unitHasEnValues,
  unitMetaSourceFields,
  unitStoredEnSourceHash,
  type UnitLevel,
} from "@/lib/translation/units";

const querySchema = z.object({
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
});

type UnitStatus = {
  meta: TranslationFreshness;
  /**
   * メタの空欄（訳が入っていない `_en` キー）。原文が非空のものだけ。
   * ⚠ レッスンでは `author_en` も入りうる——翻訳ボタンでは埋まらないので、
   * 「翻訳を押せば消える」と読まないこと（`EN_FIELDS` の非対称）
   */
  metaMissing: string[];
  /** レッスンのみ（本文の鮮度） */
  body?: TranslationFreshness;
  /** レッスンのみ（本文の英訳がまだ入っていないか） */
  bodyMissing?: boolean;
};

/**
 * 選択に関わる各階層＋changelog の翻訳鮮度と空欄（studio-translation spec）。
 *
 * ⚠ 階層をまたいで合成しない。面ごとに独立した判定材料として返し、
 * どれを使うかは呼び出し側（面）が決める——合成すると、本文の話をしたい
 * ペイン2 ヘッダーにメタの状態が漏れる。
 *
 * ロード API とは分離した読み取り専用エンドポイント——正本への書き込み
 * 副作用を持たない（ローダーの id 書き戻しを翻訳チップのために走らせない）。
 * 再取得契機はクライアント側（選択変更・保存成功・翻訳適用・最新化）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    series: url.searchParams.get("series") ?? undefined,
    course: url.searchParams.get("course") ?? undefined,
    lesson: url.searchParams.get("lesson") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "クエリが不正です" }, { status: 400 });
  }

  const projectRoot = getProjectRoot();
  const { series, course, lesson } = parsed.data;

  const statuses: Partial<Record<UnitLevel, UnitStatus>> = {};
  const levels: Array<{ level: UnitLevel; enabled: boolean }> = [
    { level: "root", enabled: true },
    { level: "series", enabled: Boolean(series) },
    { level: "course", enabled: Boolean(series && course) },
    { level: "lesson", enabled: Boolean(series && course && lesson) },
  ];

  for (const { level, enabled } of levels) {
    if (!enabled) continue;
    const unit = resolveUnit(projectRoot, level, { series, course, lesson });
    if (!unit) continue;
    const sourceFields = unitMetaSourceFields(unit);
    const status: UnitStatus = {
      meta: metaFreshness(
        sourceFields,
        unitHasEnValues(unit),
        unitStoredEnSourceHash(unit),
      ),
      metaMissing: listMissingEnFields(sourceFields, unit.meta),
    };
    if (level === "lesson") {
      const { jaBody, enRaw } = readLessonBodies(unit.dir);
      status.body = bodyFreshness(jaBody, enRaw);
      status.bodyMissing = isBodyUntranslated(jaBody, enRaw);
    }
    statuses[level] = status;
  }

  const changelogPair = readChangelogPair(projectRoot);
  const changelog =
    changelogPair === null
      ? null
      : changelogFreshness(changelogPair.jaContent, changelogPair.enContent);
  const changelogMissing = isChangelogUntranslated(
    changelogPair?.jaContent ?? null,
    changelogPair?.enContent ?? null,
  );

  return Response.json({ statuses, changelog, changelogMissing });
}
