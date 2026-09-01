import { createTwoFilesPatch } from "diff";

/** HEAD 正本と現在 content から unified diff を生成する */
export function createLessonContentDiff(
  filePath: string,
  headContent: string,
  currentContent: string,
): string {
  if (headContent === currentContent) return "";
  return createTwoFilesPatch(
    filePath,
    filePath,
    headContent,
    currentContent,
    "HEAD",
    "現在",
  );
}
