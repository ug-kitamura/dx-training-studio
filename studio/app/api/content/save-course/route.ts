import { z } from "zod";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { courseStyleSchema, slugSchema } from "@/lib/schema";
import { getProjectRoot } from "@/lib/project-root";
import {
  applyOptionalMetaFields,
  EN_SOURCE_HASH_PATTERN,
} from "@/lib/translation/units";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  target: z.string().default(""),
  // 未設定は「キーを書かない」で表すため、空文字と欠落の両方を受ける
  style: courseStyleSchema.or(z.literal("")).optional(),
  slug: slugSchema.or(z.literal("")).optional(),
  catch: z.string().optional(),
  description: z.string().optional(),
  name_en: z.string().optional(),
  catch_en: z.string().optional(),
  description_en: z.string().optional(),
  target_en: z.string().optional(),
  en_source_hash: z.string().regex(EN_SOURCE_HASH_PATTERN).or(z.literal("")).optional(),
  cross_series_prev: z.array(z.string()).default([]),
  cross_series_next: z.array(z.string()).default([]),
  is_start: z.boolean().default(false),
  is_goal: z.boolean().default(false),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const {
    series,
    course,
    target,
    style,
    slug,
    catch: catchCopy,
    description,
    cross_series_prev,
    cross_series_next,
    is_start,
    is_goal,
  } = parsed.data;
  const contentsDir = getContentsDir(getProjectRoot());
  const seriesDir = findSeriesDir(contentsDir, series);
  if (!seriesDir) {
    return Response.json({ error: `シリーズフォルダが見つかりません: ${series}` }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, course);
  if (!courseDir) {
    return Response.json({ error: `コースフォルダが見つかりません: ${course}` }, { status: 404 });
  }

  try {
    const existing = readMetaJson(courseDir);
    // 未設定の表現は「キー無し」の1通りに保つため、既存の style も一度落とす
    const rest: Record<string, unknown> = { ...existing };
    delete rest.style;
    delete rest.is_start;
    delete rest.is_goal;
    // 公開サイト向けフィールドは「省略＝保全 / 空文字＝削除 / 値＝設定」
    const next: Record<string, unknown> = {
      ...rest,
      target,
      ...(style ? { style } : {}),
      cross_series_prev,
      cross_series_next,
      // 既定（false）はキーを書かない——style と同じく「未宣言＝キー無し」に保つ
      ...(is_start ? { is_start: true } : {}),
      ...(is_goal ? { is_goal: true } : {}),
    };
    if (slug !== undefined) {
      delete next.slug;
      if (slug) next.slug = slug;
    }
    if (catchCopy !== undefined) {
      delete next.catch;
      if (catchCopy.trim()) next.catch = catchCopy.trim();
    }
    if (description !== undefined) {
      delete next.description;
      if (description.trim()) next.description = description.trim();
    }
    applyOptionalMetaFields(next, {
      name_en: parsed.data.name_en,
      catch_en: parsed.data.catch_en,
      description_en: parsed.data.description_en,
      target_en: parsed.data.target_en,
      en_source_hash: parsed.data.en_source_hash,
    });
    writeMetaJson(courseDir, next);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
