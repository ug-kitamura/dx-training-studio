import type { StorageErrorKind } from "@/lib/image-storage/types";

/**
 * 画像が出せなかった理由。`missing` 以外を「存在しません」と表示してはならない
 * ——ストレージ障害が「コンテンツの不備」に化けると調査が誤った方向へ進む。
 */
export type ImageErrorKind = "missing" | StorageErrorKind;

export const IMAGE_ERROR_MESSAGE: Record<ImageErrorKind, string> = {
  missing: "画像が存在しません",
  blocked: "ストレージが利用上限でブロックされています",
  "read-failed": "ストレージから読み込めません",
  "not-connected": "ストレージに接続できません",
};

export const VIDEO_ERROR_MESSAGE: Record<ImageErrorKind, string> = {
  ...IMAGE_ERROR_MESSAGE,
  missing: "動画が存在しません",
};

/**
 * 直近のプローブ結果を短時間だけ使い回す。
 *
 * ストレージがブロックされると 1 画面のサムネイル全部が同時に失敗する。
 * 1 枚ごとにプローブすると、その枚数だけ余計なストレージ操作が増えて
 * 状況を悪化させる——理由はストレージ全体で共通なので 1 回で足りる。
 */
const PROBE_MEMO_MS = 5_000;
let memo: { kind: ImageErrorKind; at: number } | null = null;
/**
 * 進行中のプローブ。1 画面のサムネイルは**同時に**失敗するので、
 * 結果を待たずに次が走らないよう promise ごと共有する
 * （結果だけを覚えると、最初の一群が丸ごと競合して撃ち抜けてしまう）。
 */
let inFlight: Promise<ImageErrorKind> | null = null;

/** テスト用 */
export function resetImageErrorProbe(): void {
  memo = null;
  inFlight = null;
}

function isStorageErrorKind(value: unknown): value is StorageErrorKind {
  return value === "blocked" || value === "read-failed" || value === "not-connected";
}

/**
 * 失敗した画像 URL を 1 度だけ引き直して理由を判別する。
 * 判別できなければ `missing`（従来の表示）へ落ちる。
 */
export function probeImageError(url: string): Promise<ImageErrorKind> {
  if (memo && Date.now() - memo.at < PROBE_MEMO_MS) {
    return Promise.resolve(memo.kind);
  }
  if (inFlight) return inFlight;

  inFlight = runProbe(url).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runProbe(url: string): Promise<ImageErrorKind> {
  let kind: ImageErrorKind = "missing";
  try {
    const res = await fetch(url);
    if (res.status !== 404) {
      const data: { kind?: unknown } = await res.json();
      if (isStorageErrorKind(data.kind)) kind = data.kind;
    }
  } catch {
    // ネットワーク断など。従来表示へ落とす
  }

  memo = { kind, at: Date.now() };
  return kind;
}
