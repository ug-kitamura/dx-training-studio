import { z } from "zod";
import {
  getContentsDir,
  findSeriesDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { slugSchema } from "@/lib/schema";
import { getProjectRoot } from "@/lib/project-root";
import {
  applyOptionalMetaFields,
  EN_SOURCE_HASH_PATTERN,
} from "@/lib/translation/units";

const schema = z.object({
  series: z.string().min(1),
  // 未設定は「キーを書かない」で表すため、空文字と欠落の両方を受ける
  slug: slugSchema.or(z.literal("")).optional(),
  catch: z.string().optional(),
  description: z.string().optional(),
  name_en: z.string().optional(),
  catch_en: z.string().optional(),
  description_en: z.string().optional(),
  en_source_hash: z.string().regex(EN_SOURCE_HASH_PATTERN).or(z.literal("")).optional(),
});

/** シリーズ `.meta.json` の公開サイト向けフィールド（slug / catch / description）を保存する */
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

  const { series, slug, catch: catchCopy, description } = parsed.data;
  const contentsDir = getContentsDir(getProjectRoot());
  const seriesDir = findSeriesDir(contentsDir, series);
  if (!seriesDir) {
    return Response.json(
      { error: `シリーズフォルダが見つかりません: ${series}` },
      { status: 404 },
    );
  }

  try {
    // 公開サイト向けフィールドは「省略＝保全 / 空文字＝削除 / 値＝設定」。
    // 他の既存フィールド（id / order / _en 系等）は保全する
    const next: Record<string, unknown> = { ...readMetaJson(seriesDir) };
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
      en_source_hash: parsed.data.en_source_hash,
    });
    writeMetaJson(seriesDir, next);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
