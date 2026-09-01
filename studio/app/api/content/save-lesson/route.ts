import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  resolveLessonDirPath,
  resolveLessonFilePath,
} from "@/lib/contents-loader";
import {
  lessonFileTextEquals,
  normalizeLessonFileNewlines,
} from "@/lib/lesson-file-text";
import { getProjectRoot } from "@/lib/project-root";
import {
  formatSourceHashComment,
  parseEnBody,
} from "@/lib/translation/freshness";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
  content: z.string(),
  /** 保存先の言語。省略は ja（contents.md） */
  language: z.enum(["ja", "en"]).optional(),
  /**
   * en のみ: 原文ハッシュ（`sha256:<hex>`）。翻訳の適用だけが渡す。
   * 省略時は既存ファイルのハッシュ行を保持する——手動保存はハッシュに触らない
   */
  sourceHash: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .optional(),
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

  const { series, course, lesson, content, language, sourceHash } = parsed.data;

  if (language === "en") {
    return saveEnglishBody({ series, course, lesson, content, sourceHash });
  }

  const filePath = resolveLessonFilePath(getProjectRoot(), series, course, lesson);

  if (!filePath) {
    return Response.json(
      { error: `レッスンが見つかりません: ${series}/${course}/${lesson}` },
      { status: 404 },
    );
  }

  const normalizedContent = normalizeLessonFileNewlines(content);

  try {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (lessonFileTextEquals(existing, normalizedContent)) {
      if (existing !== normalizedContent) {
        fs.writeFileSync(filePath, normalizedContent, "utf-8");
      }
      return Response.json({ ok: true, skipped: true });
    }
    fs.writeFileSync(filePath, normalizedContent, "utf-8");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}

/**
 * 英語版本文（`contents.en.md`）の保存（studio-translation spec）。
 *
 * - `content` はハッシュ行を含まない本文（エディタにはハッシュ行を見せない）
 * - ハッシュ行の扱い: `sourceHash` が来ればその値で書く（翻訳の適用・最新化）。
 *   来なければ既存ファイルのハッシュ行を保持する（手動保存はハッシュに触らない）
 * - ファイルが無く本文が空なら作らない——空の `contents.en.md` を生まない
 * - ファイルが無く本文が非空・ハッシュ無しなら、ハッシュ行なしで作成する
 *   （手動翻訳＝鮮度不明＝stale 扱い。translation-freshness の規則）
 */
function saveEnglishBody(args: {
  series: string;
  course: string;
  lesson: string;
  content: string;
  sourceHash?: string;
}): Response {
  const lessonDir = resolveLessonDirPath(
    getProjectRoot(),
    args.series,
    args.course,
    args.lesson,
  );
  if (!lessonDir) {
    return Response.json(
      { error: `レッスンが見つかりません: ${args.series}/${args.course}/${args.lesson}` },
      { status: 404 },
    );
  }

  const enPath = path.join(lessonDir, "contents.en.md");
  const normalizedBody = normalizeLessonFileNewlines(args.content);
  const exists = fs.existsSync(enPath);

  if (!exists && !normalizedBody.trim() && !args.sourceHash) {
    return Response.json({ ok: true, skipped: true, created: false });
  }

  const hash =
    args.sourceHash ??
    (exists ? parseEnBody(fs.readFileSync(enPath, "utf-8")).sourceHash : null);
  const next = hash
    ? `${formatSourceHashComment(hash)}\n\n${normalizedBody.replace(/^\n+/, "")}`
    : normalizedBody;

  try {
    if (exists) {
      const existing = fs.readFileSync(enPath, "utf-8");
      if (lessonFileTextEquals(existing, next)) {
        if (existing !== next) fs.writeFileSync(enPath, next, "utf-8");
        return Response.json({ ok: true, skipped: true });
      }
    }
    fs.writeFileSync(enPath, next, "utf-8");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
