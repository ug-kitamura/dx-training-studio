"use client";

/**
 * App Router の Error Boundary。
 *
 * 主な発火経路は `app/page.tsx` の Zod `safeParse` 失敗（`data/*.json` の形式不正）。
 * ユーザーがデータを書き換えて壊した場合に「何が悪いか」を画面で読み取れるよう、
 * `error.message` をそのまま表示し、`reset()` で再試行ボタンを出す。
 *
 * Next.js の規約により Client Component（`"use client"`）必須。
 */

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-foreground">
      <div className="flex max-w-2xl flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold">読み込みに失敗しました</h1>
        <p className="text-sm text-muted-foreground">
          画面を表示するためのデータを準備できませんでした。
          <br />
          下のメッセージを参考に{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            data/*.json
          </code>{" "}
          を見直してください。
        </p>
      </div>
      <pre className="max-h-64 max-w-2xl overflow-auto rounded-lg border border-border bg-card px-4 py-3 text-left text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {error.message}
      </pre>
      <Button onClick={reset}>再読み込み</Button>
    </main>
  );
}
