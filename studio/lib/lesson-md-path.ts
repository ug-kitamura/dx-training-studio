import { resolveLessonFilePath, CONTENTS_DIR_NAME } from "@/lib/contents-loader";
import {
  LESSON_CONTENTS_EN_FILENAME,
  LESSON_CONTENTS_FILENAME,
} from "@/lib/lesson-paths";
import path from "node:path";
import { getProjectRoot } from "@/lib/project-root";

/**
 * git HEAD 参照用のレッスン本文の相対パス（`/` 区切り）。
 *
 * `language: "en"` では同じフォルダの `contents.en.md` を指す——英語ビューの
 * 差分は訳文の差分でなければならない（studio-translation spec）。
 * ⚠ 英語版はまだ存在しないことがある。**このパスの実在は保証しない**——
 * 呼び出し側（`resolveLessonGitDiff`）が HEAD 不在・ファイル不在を扱う。
 */
export function resolveLessonMdPath(
  series: string,
  course: string,
  lesson: string,
  language: "ja" | "en" = "ja",
): string {
  const filename =
    language === "en" ? LESSON_CONTENTS_EN_FILENAME : LESSON_CONTENTS_FILENAME;
  const projectRoot = getProjectRoot();
  const absolutePath = resolveLessonFilePath(projectRoot, series, course, lesson);
  if (absolutePath) {
    const dir = path.dirname(absolutePath);
    return path
      .relative(projectRoot, path.join(dir, filename))
      .replace(/\\/g, "/");
  }
  const sanitize = (n: string) => n.replace(/[/\\:*?"<>|]/g, "_").trim();
  return `${CONTENTS_DIR_NAME}/${sanitize(series)}/${sanitize(course)}/${sanitize(lesson)}/${filename}`;
}
