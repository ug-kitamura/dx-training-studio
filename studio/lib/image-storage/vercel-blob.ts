import { del, get, head, list, put } from "@vercel/blob";
import {
  imageFileName,
  isCanonicalImagePath,
  type ImageSource,
} from "@/lib/image-path";
import {
  StorageBlockedError,
  StorageReadError,
  type CanonicalBackend,
} from "@/lib/image-storage/types";

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** ブロック中のストアが返す本文。403 の理由がこれかどうかで文言が変わる */
const BLOCKED_STORE_BODY = "Your store is blocked";

/**
 * SDK の失敗を 3 層のどれかに分類する。
 *
 * `@vercel/blob` は非 2xx を `Failed to fetch blob: 403 Forbidden` という
 * メッセージの例外にするだけで**本文を捨てる**。ブロック判別には本文が要るので、
 * 403 系のときだけ判別用に 1 回素の fetch を撃つ（既に壊れている状況なので許容）。
 * 判別に失敗しても `StorageReadError` に落ちるだけで、「存在しません」には戻らない。
 */
async function classifyBlobFailure(
  error: unknown,
  logicalPath: string,
  token: string,
): Promise<Error> {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("403")) return new StorageReadError();

  try {
    const meta = await head(logicalPath, { token });
    const res = await fetch(meta.url, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    if (body.includes(BLOCKED_STORE_BODY)) return new StorageBlockedError();
  } catch {
    // 判別できなければ read error として扱う
  }
  return new StorageReadError();
}

export function createVercelBlobCanonicalBackend(token: string): CanonicalBackend {
  return {
    async listCanonical() {
      let blobs: Awaited<ReturnType<typeof list>>["blobs"];
      try {
        ({ blobs } = await list({ prefix: "images/", token }));
      } catch (error) {
        throw new StorageReadError(
          error instanceof Error ? error.message : undefined,
        );
      }
      const result = [];
      for (const blob of blobs) {
        const pathname = blob.pathname;
        if (!isCanonicalImagePath(pathname)) continue;
        result.push({
          path: pathname,
          name: imageFileName(pathname),
          source: "uploaded" as ImageSource,
          uploadedAt: blob.uploadedAt.toISOString(),
          size: blob.size,
        });
      }
      return result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    },

    async readCanonical(logicalPath) {
      try {
        const result = await get(logicalPath, { access: "private", token });
        // SDK は 404 のとき null を返す＝「実体が無い」。ここだけが null の意味
        if (!result) return null;
        if (result.statusCode !== 200 || !result.stream) {
          throw new StorageReadError();
        }
        return streamToBuffer(result.stream);
      } catch (error) {
        if (error instanceof StorageBlockedError) throw error;
        if (error instanceof StorageReadError) throw error;
        throw await classifyBlobFailure(error, logicalPath, token);
      }
    },

    async putCanonical(logicalPath, data, source: ImageSource) {
      await put(logicalPath, data, {
        access: "private",
        token,
        allowOverwrite: true,
      });
      return {
        path: logicalPath,
        name: imageFileName(logicalPath),
        source,
        uploadedAt: new Date().toISOString(),
      };
    },

    async deleteCanonical(logicalPath) {
      await del(logicalPath, { token });
    },
  };
}
