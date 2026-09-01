import { saveStagingImage } from "@/lib/image-store";
import {
  isAllowedUploadMime,
  isImageSource,
  isMp4FileName,
  MAX_MP4_BYTES,
} from "@/lib/image-path";
import { getProjectRoot } from "@/lib/project-root";

const MP4_SIZE_ERROR =
  "MP4 は 3 MB 以下にしてください（10 秒以内の録画を推奨）";

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "フォームデータが不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const sourceRaw = formData.get("source")?.toString() ?? "uploaded";
  if (!(file instanceof File)) {
    return Response.json({ error: "file が必要です" }, { status: 400 });
  }
  if (!isImageSource(sourceRaw)) {
    return Response.json({ error: "source が不正です" }, { status: 400 });
  }
  if (!isAllowedUploadMime(file.type, file.name)) {
    return Response.json(
      { error: "画像または MP4 ファイルのみアップロードできます" },
      { status: 400 },
    );
  }

  const isMp4 =
    file.type === "video/mp4" ||
    (file.type === "" && isMp4FileName(file.name));

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (isMp4 && buffer.length > MAX_MP4_BYTES) {
      return Response.json({ error: MP4_SIZE_ERROR }, { status: 413 });
    }
    const entry = await saveStagingImage(
      getProjectRoot(),
      sourceRaw,
      file.name,
      buffer,
    );
    return Response.json({ file: entry });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "アップロードに失敗しました" },
      { status: 500 },
    );
  }
}
