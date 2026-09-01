"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LazyMandala } from "@/components/workspace/mandala/LazyMandala";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";
import type { Series, Course } from "@/lib/schema";
import type { EditLanguage } from "@/lib/display-name";

type Props = {
  series: Series[];
  /** 選択中コース。未選択（undefined）なら領域ごと畳む */
  course: Course | undefined;
  onSelectCourse: (courseId: string) => void;
  /**
   * モーダルの開閉は親（Workspace）が持つ制御プロップ。
   * ⚠ 内部 state に戻さないこと——CourseMetaView は `key={course.id}` で
   * コース遷移のたび再マウントされるため、内部 state だと
   * 「モーダルからノードをクリックして遷移 → モーダルが消える」に戻る
   */
  modalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
  /** ノードのラベルに使う言語 */
  editLanguage: EditLanguage;
};

/** コースメタビュー右列のミニ曼陀羅（サムネイル＋拡大モーダル） */
export function MiniMandalaSection({
  series,
  course,
  onSelectCourse,
  modalOpen,
  onModalOpenChange,
  editLanguage,
}: Props) {
  const graph = useMemo(
    () => buildMandalaGraph(series, editLanguage),
    [series, editLanguage],
  );

  /**
   * ノードクリックで遷移した直後にモーダルが閉じるのを抑える。
   * 遷移でツリーの選択が変わり、その副作用で開閉プロップが揺れるため。
   */
  const suppressCloseRef = useRef(false);

  const handleOpenChange = useCallback(
    (open: boolean, eventDetails?: { cancel?: () => void }) => {
      if (!open && suppressCloseRef.current) {
        eventDetails?.cancel?.();
        return;
      }
      onModalOpenChange(open);
    },
    [onModalOpenChange],
  );

  const handleSelectFromModal = useCallback(
    (courseId: string) => {
      suppressCloseRef.current = true;
      onSelectCourse(courseId);
      window.setTimeout(() => {
        suppressCloseRef.current = false;
      }, 300);
    },
    [onSelectCourse],
  );

  const modal = (
    <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
      {/* 跨ぎ先が 3 つ以上あるコースでも横に収まる幅。カード自体は広げない。
          ⚠ 構成は公開サイトの曼陀羅モーダルと同じにする——**ダイアログは高さを
          持たず中身なり・キャンバスだけが絶対長・開閉アニメーション無し**。
          ダイアログに高さを持たせてフレックスで配ると、React Flow がマウント時に
          確定した座標と落ち着き後の寸法が食い違い、開き直すたびに中心がずれる
          （2026-08-21 に実機で再現）。詳細は GlobalHeader の同じコメントを参照 */}
      <DialogContent animated={false} className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>ミニ曼陀羅</DialogTitle>
        </DialogHeader>
        {course ? (
          <LazyMandala
            graph={graph}
            scope={{ kind: "course", courseId: course.id }}
            variant="card"
            currentCourseId={course.id}
            editLanguage={editLanguage}
            height="min(64vh, 520px)"
            onSelectCourse={handleSelectFromModal}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );

  // コース未選択時は領域ごと畳む
  // （モーダルは遷移の途中で開いたままにできるよう常に描く）
  if (!course) return modal;

  return (
    <>
      {/* 枠はサムネイルのボタン自身が持つ1枚だけ。⚠ ここに border や余白を
          足さないこと——呼び出し側（ペイン2 のフィールド）と二重・三重になる。
          高さは親のセルに追随（h-full）——グラフ側が大きくても親を押し広げない */}
      <div className="h-full min-w-0">
        <button
          type="button"
          // ⚠ 平常時に地を敷かないこと——キャンバス側がほぼ透明な地を持つので、
          // 二重になって意図した薄さにならない。地はキャンバスの 1 枚に任せ、
          // 3 つの面（サムネイル・拡大モーダル・全体曼陀羅）で同じ絵に見せる。
          // ホバーの地は残す——押せることの手がかりで、平常時の見た目は変えない。
          // ⚠ 内側に余白を持たせないこと。キャンバスは自前の角丸と地を持つので、
          // 余白があるとその隙間に親の地が見えて**枠が 2 重に見える**。
          // 角丸はキャンバス側（0.6rem）に合わせて枠と縁を一致させる
          className="block h-full w-full min-w-0 cursor-zoom-in overflow-hidden rounded-[0.6rem] border border-border/50 text-left transition-colors hover:bg-muted/40"
          onClick={() => onModalOpenChange(true)}
          aria-label="ミニ曼陀羅を拡大表示"
        >
          {/* サムネイルは compact ノード——カードのまま縮めると縮小率が上がって
              文字が潰れる。パン・ズームは無効（staticView）。
              ⚠ onSelectCourse は必ず渡すこと——コースノードだけは Mandala 側が
              staticView でもクリックを処理し、隣接コースへ直接遷移させる
              （中心コース自身のクリックは Mandala 側で無視される）。
              それ以外（余白・端子・辺）のクリックはこの div を素通りして
              親の button まで届き、そちらが拡大モーダルを開く */}
          <div className="pointer-events-none h-full w-full min-w-0">
            <LazyMandala
              graph={graph}
              scope={{ kind: "course", courseId: course.id }}
              variant="compact"
              currentCourseId={course.id}
              editLanguage={editLanguage}
              fill
              staticView
              onSelectCourse={onSelectCourse}
            />
          </div>
        </button>
      </div>
      {modal}
    </>
  );
}
