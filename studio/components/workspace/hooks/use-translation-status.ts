"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTranslationStatus,
  type TranslationStatuses,
} from "@/lib/translation/client";

/**
 * 選択中ユニットの翻訳鮮度（studio-translation spec）。
 *
 * 再取得の契機: 選択変更（deps）・保存成功や翻訳適用（refresh() を呼ぶ）・
 * 日本語本文の編集（呼び出し側が contentSignal を変える——自動保存と同じ
 * debounce 感覚で古さがチップへ追随する）。
 */
export function useTranslationStatus(args: {
  seriesName: string | undefined;
  courseName: string | undefined;
  lessonName: string | undefined;
  /** 日本語側の編集を検知する軽い信号（本文の長さ等）。変化で遅延再取得する */
  contentSignal?: unknown;
}) {
  const { seriesName, courseName, lessonName, contentSignal } = args;
  const [data, setData] = useState<TranslationStatuses | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(() => {
    const current = ++generation.current;
    void fetchTranslationStatus({
      series: seriesName,
      course: courseName,
      lesson: lessonName,
    })
      .then((result) => {
        if (generation.current === current) setData(result);
      })
      .catch(() => {
        // 鮮度は補助情報。取得失敗でチップを消すだけにする
        if (generation.current === current) setData(null);
      });
  }, [seriesName, courseName, lessonName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 日本語側の編集: 自動保存（800ms）より少し遅らせて再取得する
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    const timer = setTimeout(refresh, 1200);
    return () => clearTimeout(timer);
  }, [contentSignal, refresh]);

  return { data, refresh };
}
