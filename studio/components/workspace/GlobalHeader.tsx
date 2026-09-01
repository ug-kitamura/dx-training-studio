"use client";

import { Fragment, useState, useMemo, useRef, useCallback } from "react";
import { BookOpen, Languages, Network, Settings } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Series } from "@/lib/schema";
import type { EditLanguage } from "@/lib/display-name";
import { LazyMandala } from "@/components/workspace/mandala/LazyMandala";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";

/**
 * GitHub マーク。lucide はブランドアイコンを持たないのでインラインで描く。
 * ⚠ **サイズは隣の lucide アイコン（`size-4`）と揃えない。** 塗りつぶしの塊は
 * 外接箱をほぼ100%埋めるのに対し、lucide の線アイコンは stroke 込みでも
 * 箱の 9 割ほどしか埋めない。同じ 16px を与えると猫だけ大きく見えるため、
 * ここは一回り小さい 15px にする（公開サイト側 `.dxm-mandala-button` の
 * コメントと同じ判断・そちらは逆向きの補正）。
 * ⚠ 寸法は **`size-*` クラスで**渡すこと。`width`/`height` 属性では効かない
 * ——Button の `[&_svg:not([class*='size-'])]:size-4` が CSS で上書きするため。
 * 裏を返すと `size-` を持つ svg は Button 側が手を出さない約束になっている。
 */
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="size-[15px]"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}


type GlobalHeaderProps = {
  seriesName: string;
  courseName: string;
  lessonName: string;
  series?: Series[];
  selectedSeriesId?: string;
  selectedCourseId?: string;
  /** 全体メタの github_url。未設定ならリンクを出さない */
  githubUrl?: string;
  /** 編集言語（アプリのモード）。切替の入口はこのヘッダーに1つだけ置く */
  editLanguage: EditLanguage;
  onEditLanguageChange: (language: EditLanguage) => void;
  onSelectSeries?: (seriesId: string) => void;
  onSelectCourse?: (courseId: string) => void;
  onOpenSettings?: () => void;
  onOpenCompanyContext?: () => void;
};

/**
 * パンくずの1段。`onNavigate` を持つ段はリンク（上位階層）、持たない段が現在地。
 */
type Crumb = { label: string; onNavigate?: () => void };

/**
 * 選択階層から段の配列を作る。
 *
 * ⚠ **段を先に組んでから描くこと。** 以前は「各段が自分の後ろに区切りを足す」
 * 形だったため、コース選択時（レッスン名が空）に行き先の無い区切りが末尾へ残った。
 * 配列にしておけば「区切りは段と段の間だけ」が構造で保証される。
 *
 * 段が1つ以下（ホーム選択・シリーズ選択）のときは空を返す——1段だけのパンくずは
 * 現在地の情報を足しておらず、公開サイトもシリーズトップには出さない。
 */
function buildCrumbs({
  seriesName,
  courseName,
  lessonName,
  selectedSeriesId,
  selectedCourseId,
  onSelectSeries,
  onSelectCourse,
}: {
  seriesName: string;
  courseName: string;
  lessonName: string;
  selectedSeriesId: string;
  selectedCourseId: string;
  onSelectSeries?: (seriesId: string) => void;
  onSelectCourse?: (courseId: string) => void;
}): Crumb[] {
  const crumbs: Crumb[] = [];
  if (seriesName) {
    crumbs.push({
      label: seriesName,
      onNavigate:
        selectedSeriesId && onSelectSeries
          ? () => onSelectSeries(selectedSeriesId)
          : undefined,
    });
  }
  if (courseName) {
    crumbs.push({
      label: courseName,
      onNavigate:
        selectedCourseId && onSelectCourse
          ? () => onSelectCourse(selectedCourseId)
          : undefined,
    });
  }
  if (lessonName) crumbs.push({ label: lessonName });

  // 最後の段は現在地なので、自分自身への移動は持たせない
  if (crumbs.length > 0) crumbs[crumbs.length - 1].onNavigate = undefined;
  return crumbs.length < 2 ? [] : crumbs;
}

export function GlobalHeader({
  seriesName,
  courseName,
  lessonName,
  series = [],
  selectedSeriesId = "",
  selectedCourseId = "",
  githubUrl = "",
  editLanguage,
  onEditLanguageChange,
  onSelectSeries,
  onSelectCourse,
  onOpenSettings,
  onOpenCompanyContext,
}: GlobalHeaderProps) {
  const crumbs = useMemo(
    () =>
      buildCrumbs({
        seriesName,
        courseName,
        lessonName,
        selectedSeriesId,
        selectedCourseId,
        onSelectSeries,
        onSelectCourse,
      }),
    [
      seriesName,
      courseName,
      lessonName,
      selectedSeriesId,
      selectedCourseId,
      onSelectSeries,
      onSelectCourse,
    ],
  );

  const [mandalaOpen, setMandalaOpen] = useState(false);
  const suppressMandalaModalCloseRef = useRef(false);

  // 言語を変えたらラベルを作り直す（ID と辺は不変なのでレイアウトは動かない）
  const mandalaGraph = useMemo(
    () => buildMandalaGraph(series, editLanguage),
    [series, editLanguage],
  );

  /**
   * ノードクリックで遷移した直後にモーダルが閉じるのを抑える。
   * 遷移でツリーの選択が変わり、その副作用で開閉が揺れるため。
   */
  const handleMandalaModalOpenChange = useCallback(
    (open: boolean, eventDetails?: { cancel?: () => void }) => {
      if (!open && suppressMandalaModalCloseRef.current) {
        eventDetails?.cancel?.();
        return;
      }
      setMandalaOpen(open);
    },
    [],
  );

  const handleSelectFromMandala = useCallback(
    (courseId: string) => {
      suppressMandalaModalCloseRef.current = true;
      onSelectCourse?.(courseId);
      window.setTimeout(() => {
        suppressMandalaModalCloseRef.current = false;
      }, 300);
    },
    [onSelectCourse],
  );

  /** シリーズ枠のクリック。コースと同じく、遷移でモーダルを閉じない */
  const handleSelectSeriesFromMandala = useCallback(
    (seriesId: string) => {
      suppressMandalaModalCloseRef.current = true;
      onSelectSeries?.(seriesId);
      window.setTimeout(() => {
        suppressMandalaModalCloseRef.current = false;
      }, 300);
    },
    [onSelectSeries],
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      {crumbs.length > 0 ? (
        <Breadcrumb
          className="min-w-0 flex-1 overflow-hidden"
          aria-label="パンくず"
        >
          <BreadcrumbList className="flex-nowrap text-[11px]">
            {crumbs.map((crumb, index) => {
              const isCurrent = index === crumbs.length - 1;
              return (
                <Fragment key={`${index}-${crumb.label}`}>
                  {/* 区切りは段と段の間だけ。末尾には出さない */}
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem
                    className={isCurrent ? "min-w-0" : "shrink-0"}
                  >
                    {isCurrent ? (
                      <BreadcrumbPage className="truncate font-bold">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        variant="quiet"
                        render={
                          <button type="button" onClick={crumb.onNavigate} />
                        }
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        // パンくずが無いときも右側ボタンの位置を動かさないための余白
        <div className="min-w-0 flex-1" />
      )}

      {/* 言語切替（studio-translation spec）。Studio 全体で**ここ1つだけ**。
          ⚠ ペイン2 の各面のヘッダーに戻さないこと——言語は面ごとの設定ではなく
          アプリのモードで、常時見えていることが「選択を変えてもモードが保たれる」
          ことの説明になっている。
          ⚠ ツールチップを付けないこと。隣のメニューが表記だけで説明していて、
          ここだけ挙動が違うと浮く。状態はボタンの表記自身が示す（色で示さない）。 */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs text-header-action"
        aria-pressed={editLanguage === "en"}
        aria-label={
          editLanguage === "ja" ? "英語ビューに切り替える" : "日本語ビューに戻る"
        }
        onClick={() =>
          onEditLanguageChange(editLanguage === "ja" ? "en" : "ja")
        }
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">
          {editLanguage === "ja" ? "英語ビューに切り替える" : "日本語ビューに戻る"}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs text-header-action"
        onClick={() => setMandalaOpen(true)}
      >
        <Network className="h-4 w-4" />
        <span className="hidden sm:inline">DXトレーニング曼陀羅</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs text-header-action"
        onClick={() => onOpenCompanyContext?.()}
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">社内コンテキスト</span>
      </Button>

      {githubUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-header-action"
          aria-label="GitHub リポジトリを開く"
          // 中身が <a> なので native button のセマンティクスを外す（Base UI の要求）
          nativeButton={false}
          render={
            <a href={githubUrl} target="_blank" rel="noreferrer">
              <GitHubMark />
            </a>
          }
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-header-action"
        onClick={() => onOpenSettings?.()}
        aria-label="設定"
      >
        <Settings className="size-4" />
      </Button>

      {/* 曼陀羅フルスクリーンモーダル */}
      <Dialog open={mandalaOpen} onOpenChange={handleMandalaModalOpenChange}>
        {/* ⚠ 構成は公開サイトの曼陀羅モーダルと同じにする——**ダイアログは高さを
            持たず中身なり・キャンバスだけがビューポート由来の絶対長・開閉
            アニメーション無し（animated={false}）**。
            ダイアログに高さを持たせてフレックスで配ると、React Flow がマウント時に
            確定した座標とレイアウトの落ち着き後の寸法が食い違い、開き直すたびに
            中心がずれる（2026-08-21 に実機で再現）。`fill`（% の連鎖）も同根。
            キャンバスが絶対長ならマウントの時点で幾何が確定していて、時机に依らない */}
        <DialogContent animated={false} className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editLanguage === "en"
                ? "DX Training Mandala"
                : "DXトレーニング曼陀羅"}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded bg-card p-3">
            {mandalaOpen ? (
              <LazyMandala
                graph={mandalaGraph}
                scope={{ kind: "global" }}
                variant="compact"
                currentCourseId={selectedCourseId}
                currentSeriesId={selectedSeriesId}
                editLanguage={editLanguage}
                // ツールバー・ヘッダー等の約 155px を足しても画面に収まる上限
                height="min(72vh, 680px)"
                onSelectCourse={handleSelectFromMandala}
                onSelectSeries={handleSelectSeriesFromMandala}
                showChrome
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
