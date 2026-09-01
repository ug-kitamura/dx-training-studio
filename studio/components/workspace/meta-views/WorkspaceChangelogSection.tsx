"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { aiRequestHeaders, AI_KEY_ERROR } from "@/lib/agent-request-headers";
import {
  CHANGELOG_INITIAL_TEMPLATE,
  CHANGELOG_PROMISE_TEXT,
  insertChangelogEntry,
} from "@/lib/changelog-entry";
import { createLessonContentDiff } from "@/lib/lesson-content-diff";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";

/** GET /api/content/changelog の応答 */
type ChangelogData = {
  exists: boolean;
  content: string;
  mtimeMs: number | null;
  firstEntryDate: string | null;
};

type DraftResponse = {
  entry: string | null;
  notes: string[];
  baselineDate: string | null;
  usedLessons: { series: string; course: string; lesson: string }[];
  truncated: boolean;
  message?: string;
  error?: string;
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs leading-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

/** 親（ホームのビュー）が保存とAI下書きを外から起動するための口 */
export type ChangelogControls = {
  /** dirty のときだけ呼ぶ（呼び分けは親の責務） */
  save: () => Promise<void>;
  dirty: boolean;
  generateDraft: () => void;
  generating: boolean;
  loading: boolean;
};

type Props = {
  /** 保存・下書きの口を親へ渡す。⚠ 渡したら親が必ずボタンを出すこと */
  onControlsReady?: (controls: ChangelogControls) => void;
};

/**
 * ホームのペイン2・GitHub リンクの下に置く変更履歴の編集セクション。
 *
 * - 正本は `contents/changelog.md`（⚠ 生成物 `mandala/content/changelog.md` と
 *   1 文字違い。ここが触るのは contents/ 側だけ）
 * - 手動編集が一次手段。**保存の入口はホームに1つだけ**（このセクションは
 *   専用の保存ボタンを持たず、保存関数を親へ渡す）
 * - AI 下書きは「新規エントリ」だけを受け取り、挿入はクライアントが行う。
 *   ⚠ 採用（`反映`）は正本に書かない——textarea へ入れて未保存にするだけ。
 *   AI が正本に書く経路を1つも残さないための構造（英語ビューの翻訳と同じ流儀）
 */
export function WorkspaceChangelogSection({ onControlsReady }: Props) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // AI 下書き
  const [generating, setGenerating] = useState(false);
  const [draftEntry, setDraftEntry] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [draftInfo, setDraftInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/content/changelog")
      .then((res) => res.json())
      .then((data: ChangelogData) => {
        if (cancelled) return;
        setContent(data.content);
        setBaseMtimeMs(data.mtimeMs);
      })
      .catch(() => {
        // 読み込めなくても空から編集を始められる
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** ホームの保存から呼ばれる。⚠ dirty でないときは親が呼ばない */
  const save = (): Promise<void> => {
    setErrorText(null);
    return fetch("/api/content/changelog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, baseMtimeMs }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          mtimeMs?: number | null;
          error?: string;
        };
        if (res.status === 409) {
          setErrorText(
            `${data.error ?? "外部で変更されています"}（再読込すると外部の内容に置き換わります）`,
          );
          throw new Error("conflict");
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBaseMtimeMs(data.mtimeMs ?? null);
        setDirty(false);
      })
      .catch((err: unknown) => {
        if (!errorText) setErrorText(`保存エラー: ${String(err)}`);
        throw err;
      });
  };

  const reload = () => {
    setLoading(true);
    setErrorText(null);
    void fetch("/api/content/changelog")
      .then((res) => res.json())
      .then((data: ChangelogData) => {
        setContent(data.content);
        setBaseMtimeMs(data.mtimeMs);
        setDirty(false);
      })
      .finally(() => setLoading(false));
  };

  const generateDraft = () => {
    setGenerating(true);
    setErrorText(null);
    setDraftEntry(null);
    setDraftNotes([]);
    setDraftInfo(null);
    const settings = loadWorkspaceSettings();
    // ⚠ 基準日は送らない。既定（changelog 先頭エントリの日付）にサーバが従う
    void fetch("/api/content/changelog/draft", {
      method: "POST",
      headers: aiRequestHeaders(settings),
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const data = (await res.json()) as DraftResponse;
        if (res.status === 401) {
          setErrorText(AI_KEY_ERROR);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (!data.entry) {
          setDraftInfo(data.message ?? "下書きは生成されませんでした");
          return;
        }
        setDraftEntry(data.entry);
        setDraftNotes(data.notes);
        setDraftInfo(
          `対象 ${data.usedLessons.length} レッスン${data.truncated ? "（多数のため一部に絞りました）" : ""}`,
        );
      })
      .catch((err: unknown) => {
        setErrorText(`下書きエラー: ${String(err)}`);
      })
      .finally(() => setGenerating(false));
  };

  useEffect(() => {
    onControlsReady?.({ save, dirty, generateDraft, generating, loading });
    // 親のボタンの disabled を追従させるため、状態が変わるたびに渡し直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, generating, loading, content, baseMtimeMs]);

  const proposedContent =
    draftEntry !== null ? insertChangelogEntry(content, draftEntry) : null;

  /** AI 下書きの採用。⚠ 正本には書かない——未保存の本文にするだけ */
  const applyDraft = () => {
    if (proposedContent === null) return;
    setContent(proposedContent);
    setDirty(true);
    setDraftEntry(null);
    setDraftNotes([]);
    setDraftInfo(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">変更履歴</p>
      <p className="text-xs text-muted-foreground">
        公開サイトの変更履歴ページの正本（contents/changelog.md）。
        {CHANGELOG_PROMISE_TEXT}
      </p>
      <textarea
        aria-label="変更履歴"
        value={content}
        disabled={loading}
        rows={12}
        className={TEXTAREA_CLASS}
        placeholder={CHANGELOG_INITIAL_TEMPLATE}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
      />
      {draftInfo && draftEntry === null ? (
        <p className="text-xs text-muted-foreground">{draftInfo}</p>
      ) : null}
      {errorText ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">{errorText}</p>
          <Button size="sm" variant="outline" onClick={reload}>
            再読込
          </Button>
        </div>
      ) : null}
      {draftEntry !== null && proposedContent !== null ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium">
            AI 下書き（編集してから反映できます）
            {draftInfo ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {draftInfo}
              </span>
            ) : null}
          </p>
          <textarea
            aria-label="AI 下書きエントリ"
            value={draftEntry}
            rows={8}
            className={TEXTAREA_CLASS}
            onChange={(e) => setDraftEntry(e.target.value)}
          />
          {draftNotes.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="text-xs font-medium">
                AI からの指摘（履歴には書き込まれません）
              </p>
              <ul className="list-disc pl-4 text-xs">
                {draftNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="max-h-64 overflow-auto rounded border border-border">
            <LessonDiffView
              diff={createLessonContentDiff(
                "contents/changelog.md",
                content,
                proposedContent,
              )}
            />
          </div>
          <div className="flex gap-2">
            {/* ⚠ ここで正本に書かない。保存はホームの1つのボタンだけ */}
            <Button size="sm" onClick={applyDraft}>
              反映
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftEntry(null);
                setDraftNotes([]);
                setDraftInfo(null);
              }}
            >
              破棄
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 親が AI 下書きボタンを描くときの共通見た目 */
export function ChangelogDraftButton({
  controls,
}: {
  controls: ChangelogControls | null;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => controls?.generateDraft()}
      disabled={!controls || controls.loading || controls.generating}
    >
      {controls?.generating ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      AI で下書き
    </Button>
  );
}
