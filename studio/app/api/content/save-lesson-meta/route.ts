import { z } from "zod";
import {
  MetaJsonParseError,
  readMetaJson,
  resolveLessonDirPath,
  writeMetaJson,
} from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import { lessonStatusSchema, slugSchema } from "@/lib/schema";
import { normalizeTags } from "@/lib/lesson-meta";
import {
  applyOptionalMetaFields,
  EN_SOURCE_HASH_PATTERN,
} from "@/lib/translation/units";

/**
 * レッスン `.meta.json` の保存。
 * 本文（contents.md）の保存経路（save-lesson）から独立している。
 * `id` はクライアントの値を受けず、既存値を保持する（進捗データのキー保護）。
 * 空文字は「キーを外す」を意味する（未設定の任意キーは書かない流儀）。
 */
const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
  meta: z.object({
    status: lessonStatusSchema.optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    estimated_minutes: z.number().int().min(0).max(180).optional(),
    author: z.string().optional(),
    author_en: z.string().optional(),
    name_en: z.string().optional(),
    description_en: z.string().optional(),
    en_source_hash: z
      .string()
      .regex(EN_SOURCE_HASH_PATTERN)
      .or(z.literal(""))
      .optional(),
    slug: z.union([slugSchema, z.literal("")]).optional(),
  }),
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

  const { series, course, lesson, meta } = parsed.data;
  const lessonDir = resolveLessonDirPath(getProjectRoot(), series, course, lesson);
  if (!lessonDir) {
    return Response.json(
      { error: `レッスンが見つかりません: ${series}/${course}/${lesson}` },
      { status: 404 },
    );
  }

  try {
    const existing = readMetaJson(lessonDir);
    const next: Record<string, unknown> = { ...existing };

    if (meta.status !== undefined) next.status = meta.status;
    if (meta.description !== undefined) next.description = meta.description;
    if (meta.tags !== undefined) next.tags = normalizeTags(meta.tags);
    if (meta.estimated_minutes !== undefined) {
      next.estimated_minutes = meta.estimated_minutes;
    }
    if (meta.author !== undefined) next.author = meta.author;
    if (meta.author_en !== undefined) {
      if (meta.author_en) next.author_en = meta.author_en;
      else delete next.author_en;
    }
    if (meta.slug !== undefined) {
      if (meta.slug) next.slug = meta.slug;
      else delete next.slug;
    }
    applyOptionalMetaFields(next, {
      name_en: meta.name_en,
      description_en: meta.description_en,
      en_source_hash: meta.en_source_hash,
    });

    writeMetaJson(lessonDir, next);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof MetaJsonParseError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
