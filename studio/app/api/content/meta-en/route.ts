import { z } from "zod";
import { writeMetaJson } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import {
  applyOptionalMetaFields,
  EN_SOURCE_HASH_PATTERN,
  readExistingEnValues,
  resolveUnit,
  UNIT_EN_KEYS,
  unitMetaSourceFields,
  type UnitLevel,
} from "@/lib/translation/units";

const levelSchema = z.enum(["root", "series", "course", "lesson"]);

/**
 * 英語ビュー用のメタ読み書き（studio-translation spec）。
 *
 * GET: 日本語原文（併記用）と既存の英訳・`en_source_hash` を返す。
 * PUT: `_en` フィールドと `en_source_hash` **だけ**を書く（省略=保全 / 空=削除 / 値=設定）。
 *
 * ⚠ 既存の save-course は target・cross_series 等を常時明示送信する規約のため、
 * 英語ビューの保存に流用すると日本語側フィールドを巻き込んで壊す。
 * 英語ビューの保存はこの専用経路に閉じる（設計判断は change の design.md 参照）。
 * author / author_en はここでは扱わない——author_en の手編集は
 * 既存のレッスンメタ保存（save-lesson-meta）が担う。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const level = levelSchema.safeParse(url.searchParams.get("level"));
  if (!level.success) {
    return Response.json({ error: "level が不正です" }, { status: 400 });
  }
  const names = {
    series: url.searchParams.get("series") ?? undefined,
    course: url.searchParams.get("course") ?? undefined,
    lesson: url.searchParams.get("lesson") ?? undefined,
  };
  const unit = resolveUnit(getProjectRoot(), level.data, names);
  if (!unit) {
    return Response.json({ error: "対象が見つかりません" }, { status: 404 });
  }
  const authorEn = unit.meta.author_en;
  return Response.json({
    ja: unitMetaSourceFields(unit),
    en: readExistingEnValues(unit),
    en_source_hash:
      typeof unit.meta.en_source_hash === "string"
        ? unit.meta.en_source_hash
        : null,
    // レッスンの英語ビューが手編集用に表示する（保存は save-lesson-meta 経由）
    ...(level.data === "lesson"
      ? { author_en: typeof authorEn === "string" ? authorEn : "" }
      : {}),
  });
}

const putSchema = z.object({
  level: levelSchema,
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
  /** `_en` フィールド。キーは階層の許可リストで検証する */
  fields: z.record(z.string(), z.string()),
  en_source_hash: z
    .string()
    .regex(EN_SOURCE_HASH_PATTERN)
    .or(z.literal(""))
    .optional(),
});

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { level, series, course, lesson, fields, en_source_hash } = parsed.data;
  const allowed = new Set<string>(UNIT_EN_KEYS[level as UnitLevel]);
  const unknownKey = Object.keys(fields).find((key) => !allowed.has(key));
  if (unknownKey) {
    return Response.json(
      { error: `この階層では書けないフィールドです: ${unknownKey}` },
      { status: 400 },
    );
  }

  const unit = resolveUnit(getProjectRoot(), level, { series, course, lesson });
  if (!unit) {
    return Response.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  try {
    const next: Record<string, unknown> = { ...unit.meta };
    applyOptionalMetaFields(next, {
      ...fields,
      ...(en_source_hash !== undefined ? { en_source_hash } : {}),
    });
    writeMetaJson(unit.dir, next);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
