"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import { SaveButton } from "@/components/workspace/SaveButton";
import type { EnMetaControls } from "@/components/workspace/translation/EnMetaSection";
import { TRANSLATE_LABEL } from "@/components/workspace/translation/translationLabels";

/**
 * メタビュー（全体・シリーズ・コース）の英語ビューで見出し行に置くボタン列。
 *
 * `EnMetaSection` は `hideActionBar` を渡すとボタンを描かず、操作だけを
 * `onControlsReady` で親へ渡す。3面が同じ JSX を書き写さないための共有部品。
 *
 * 並びは**左＝AI が下書きを作る（原文から翻訳）／右＝人が正本に書く（保存）**で
 * 固定する（studio-translation spec）。⚠ 面の都合で入れ替えないこと。
 */
export function EnMetaActionBar({
  controls,
}: {
  controls: EnMetaControls | null;
}) {
  const busy = !controls || controls.loading || controls.translating;
  return (
    <PaneActionBar
      aiSlot={
        <Button
          size="sm"
          variant="outline"
          onClick={() => controls?.translate()}
          disabled={busy}
        >
          {controls?.translating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {TRANSLATE_LABEL}
        </Button>
      }
      saveSlot={
        <SaveButton
          onSave={() => controls?.save() ?? Promise.resolve()}
          disabled={!controls || controls.loading}
        />
      }
    />
  );
}
