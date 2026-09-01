"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetaViewShell } from "@/components/workspace/meta-views/MetaViewShell";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_GRID,
  MetaDialogField,
  metaViewHeading,
  paneKindLabel,
} from "@/components/workspace/metaDialogLayout";
import { CrossSeriesCourseTreePicker } from "@/components/workspace/CrossSeriesCourseTreePicker";
import { MiniMandalaSection } from "@/components/workspace/MiniMandalaSection";
import { cn } from "@/lib/utils";
import type { Series, Course, CourseStyle } from "@/lib/schema";
import { COURSE_STYLES, COURSE_STYLE_LABELS, SLUG_PATTERN } from "@/lib/schema";
import {
  filterCrossSeriesIds,
  getIntraSeriesNeighbors,
  listCrossSeriesCourseCandidates,
  wouldCourseMetaEditCreateCycle,
} from "@/lib/course-flow";
import {
  EnMetaSection,
  type EnMetaControls,
} from "@/components/workspace/translation/EnMetaSection";
import { EnMetaActionBar } from "@/components/workspace/translation/EnMetaActionBar";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import { courseDisplayName, type EditLanguage } from "@/lib/display-name";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import { SaveButton } from "@/components/workspace/SaveButton";
import type { TranslationNoticeState } from "@/lib/translation/client";

/** Select は空文字を値に使えないため、未設定を表すセンチネル */
const COURSE_STYLE_UNSET = "__unset__";

const COURSE_STYLE_SELECT_ITEMS: Array<{ value: string; label: string }> = [
  { value: COURSE_STYLE_UNSET, label: "未設定" },
  ...COURSE_STYLES.map((style) => ({
    value: style,
    label: COURSE_STYLE_LABELS[style],
  })),
];

type EditMeta = {
  name: string;
  slug: string;
  catchCopy: string;
  description: string;
  target: string;
  /** 空文字は「未設定」 */
  style: CourseStyle | "";
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  /** カリキュラムの入口・到達点の宣言。リンク配列とは独立 */
  isStart: boolean;
  isGoal: boolean;
};

type Props = {
  series: Series[];
  course: Course;
  onSave: (
    courseId: string,
    meta: Pick<
      Course,
      | "name"
      | "target"
      | "style"
      | "cross_series_prev"
      | "cross_series_next"
      | "is_start"
      | "is_goal"
    > &
      Partial<Pick<Course, "slug" | "catch" | "description">>,
  ) => void;
  /** ミニ曼陀羅のノードクリックでコースを切り替える */
  onSelectCourse: (courseId: string) => void;
  /**
   * ミニ曼陀羅モーダルの開閉（Workspace が持つ）。
   * このビューは `key={course.id}` で遷移のたび再マウントされるため、
   * ここより下に state を置くとモーダルが遷移で閉じてしまう
   */
  mandalaModalOpen: boolean;
  onMandalaModalOpenChange: (open: boolean) => void;
  editLanguage: EditLanguage;
  translationNotice: TranslationNoticeState;
  onTranslationChanged?: () => void;
  /** シリーズ名（英語ビューの対象解決に使う） */
  seriesName: string;
};

/** コース選択時のペイン2: コースメタの編集ビュー＋ミニ曼陀羅 */
export function CourseMetaView({
  series,
  course,
  onSave,
  onSelectCourse,
  mandalaModalOpen,
  onMandalaModalOpenChange,
  editLanguage,
  translationNotice,
  onTranslationChanged,
  seriesName,
}: Props) {
  const [cycleWarning, setCycleWarning] = useState(false);
  const [slugError, setSlugError] = useState(false);
  /** 英語ビューのボタン列を見出し行へ持ち上げるための操作口 */
  const [enControls, setEnControls] = useState<EnMetaControls | null>(null);
  const [editMeta, setEditMeta] = useState<EditMeta>(() => ({
    name: course.name,
    slug: course.slug ?? "",
    catchCopy: course.catch ?? "",
    description: course.description ?? "",
    target: course.target ?? "",
    style: course.style ?? "",
    crossSeriesPrev: filterCrossSeriesIds(
      series,
      course.id,
      course.cross_series_prev,
    ),
    crossSeriesNext: filterCrossSeriesIds(
      series,
      course.id,
      course.cross_series_next,
    ),
    isStart: course.is_start ?? false,
    isGoal: course.is_goal ?? false,
  }));

  const intraNeighbors = useMemo(
    () => getIntraSeriesNeighbors(series, course.id),
    [series, course.id],
  );

  const crossSeriesCandidates = useMemo(
    () => listCrossSeriesCourseCandidates(series, course.id),
    [series, course.id],
  );

  const handleSave = () => {
    const trimmedSlug = editMeta.slug.trim();
    if (trimmedSlug && !SLUG_PATTERN.test(trimmedSlug)) {
      setSlugError(true);
      return;
    }
    setSlugError(false);
    const crossSeriesPrev = filterCrossSeriesIds(
      series,
      course.id,
      editMeta.crossSeriesPrev,
    );
    const crossSeriesNext = filterCrossSeriesIds(
      series,
      course.id,
      editMeta.crossSeriesNext,
    );
    if (
      wouldCourseMetaEditCreateCycle(
        series,
        course.id,
        crossSeriesPrev,
        crossSeriesNext,
      )
    ) {
      setCycleWarning(true);
      return;
    }
    setCycleWarning(false);
    onSave(course.id, {
      name: editMeta.name.trim() || course.name,
      slug: trimmedSlug,
      catch: editMeta.catchCopy,
      description: editMeta.description,
      target: editMeta.target || undefined,
      style: editMeta.style || undefined,
      cross_series_prev: crossSeriesPrev,
      cross_series_next: crossSeriesNext,
      is_start: editMeta.isStart,
      is_goal: editMeta.isGoal,
    });
  };

  return (
    <MetaViewShell
      title={courseDisplayName(course, editLanguage)}
      kindLabel={paneKindLabel("course", editLanguage)}
      heading={metaViewHeading("course", editLanguage)}
      actionBar={
        editLanguage === "en" ? (
          <EnMetaActionBar controls={enControls} />
        ) : (
          <PaneActionBar saveSlot={<SaveButton onSave={handleSave} />} />
        )
      }
    >
      {editLanguage === "en" ? (
        <>
          {/* ボタン列は見出し行（親）が持つ。赤字1行もここで出す */}
          <TranslationNotice state={translationNotice} />
          <EnMetaSection
            level="course"
            names={{ series: seriesName, course: course.name }}
            translationNotice={translationNotice}
            onTranslationChanged={onTranslationChanged}
            onControlsReady={setEnControls}
            hideActionBar
          />
        </>
      ) : (
        <>
      {/* ⚠ 左列は行を明示指定する（`col-start-1 row-start-N`）。ミニ曼陀羅が右列の
          3行目から4行分を占めるので、auto 配置だと左列の項目がその手前で
          右列へ回り込む。行を固定して左列4行と曼陀羅を確実に噛み合わせる。 */}
      <div className={META_DIALOG_GRID}>
        <MetaDialogField className="col-span-2">
          <Label htmlFor="course-meta-name">コース名</Label>
          <Input
            id="course-meta-name"
            value={editMeta.name}
            onChange={(e) =>
              setEditMeta((prev) => ({ ...prev, name: e.target.value }))
            }
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField className="col-span-2 row-start-2">
          <Label htmlFor="course-meta-description">説明</Label>
          <textarea
            id="course-meta-description"
            value={editMeta.description}
            onChange={(e) =>
              setEditMeta((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={3}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            placeholder="コースの説明（公開サイトのコーストップに表示）"
          />
        </MetaDialogField>
        <MetaDialogField className="col-start-1 row-start-3">
          <Label htmlFor="course-meta-catch">キャッチ</Label>
          <Input
            id="course-meta-catch"
            value={editMeta.catchCopy}
            onChange={(e) =>
              setEditMeta((prev) => ({ ...prev, catchCopy: e.target.value }))
            }
            placeholder="例: 地図を手に入れる"
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField className="col-start-1 row-start-4">
          <Label htmlFor="course-meta-slug">スラッグ（公開 URL 用）</Label>
          <Input
            id="course-meta-slug"
            value={editMeta.slug}
            onChange={(e) => {
              setSlugError(false);
              setEditMeta((prev) => ({ ...prev, slug: e.target.value }));
            }}
            placeholder="例: intro"
            className={META_DIALOG_CONTROL}
          />
          {slugError ? (
            <p className="text-xs text-destructive">
              slug は小文字英数とハイフンのみで構成してください
            </p>
          ) : null}
        </MetaDialogField>
        <MetaDialogField className="col-start-1 row-start-5">
          <Label>受講対象者</Label>
          <Input
            value={editMeta.target}
            onChange={(e) =>
              setEditMeta((prev) => ({ ...prev, target: e.target.value }))
            }
            placeholder="例: Git未経験の開発者"
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField className="col-start-1 row-start-6">
          <Label htmlFor="course-meta-style">受講形態</Label>
          <Select
            items={COURSE_STYLE_SELECT_ITEMS}
            value={editMeta.style || COURSE_STYLE_UNSET}
            onValueChange={(v) => {
              if (!v) return;
              setEditMeta((prev) => ({
                ...prev,
                style: v === COURSE_STYLE_UNSET ? "" : (v as CourseStyle),
              }));
            }}
          >
            <SelectTrigger
              id="course-meta-style"
              className={cn(META_DIALOG_CONTROL, "w-full")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COURSE_STYLE_SELECT_ITEMS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MetaDialogField>
        {/* ミニ曼陀羅は右列に固定配置（3行目から4行分＝左列のキャッチ〜受講形態の隣。
            2行目は説明が左列1マスで占めるので、そのぶん1行下から始まる）。
            DOM 順は最後に置いてタブ順を自然に保ち、位置はグリッド座標で与える。
            枠はサムネイル自身の1枚だけ——ここで囲うと二重になる。
            ⚠ 中身は absolute で行の高さ計算から外す——グラフの実寸が行の
            高さに参加すると、左列4行が引き伸ばされて間延びする。
            セルの高さは左列だけで決まり、曼陀羅はそこへ縮んで収まる */}
        <MetaDialogField className="relative col-start-2 row-span-4 row-start-3">
          <div className="absolute inset-0 flex min-h-0 flex-col gap-1.5">
            <Label>ミニ曼陀羅</Label>
            <div className="min-h-0 flex-1">
              <MiniMandalaSection
                series={series}
                course={course}
                editLanguage={editLanguage}
                onSelectCourse={onSelectCourse}
                modalOpen={mandalaModalOpen}
                onModalOpenChange={onMandalaModalOpenChange}
              />
            </div>
          </div>
        </MetaDialogField>
        {/* 曼陀羅フローは 7行目から。ここまでで1〜6行目が埋まっているので
            auto 配置がそのまま続きに流れる（穴が無いので吸い込まれ先も無い） */}
        <MetaDialogField>
          <Label>前のコース（同シリーズ）</Label>
          <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
            {intraNeighbors.prev?.name ?? "なし"}
          </p>
        </MetaDialogField>
        <MetaDialogField>
          <Label>次のコース（同シリーズ）</Label>
          <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
            {intraNeighbors.next?.name ?? "なし"}
          </p>
        </MetaDialogField>
        <MetaDialogField className="min-w-0">
          <Label>前のコース（別シリーズ）</Label>
          <CrossSeriesCourseTreePicker
            candidates={crossSeriesCandidates}
            selectedIds={editMeta.crossSeriesPrev}
            onChange={(ids) => {
              setCycleWarning(false);
              setEditMeta((prev) => ({ ...prev, crossSeriesPrev: ids }));
            }}
            marker={{
              label: "Start",
              checked: editMeta.isStart,
              onToggle: (checked) =>
                setEditMeta((prev) => ({ ...prev, isStart: checked })),
            }}
          />
        </MetaDialogField>
        <MetaDialogField className="min-w-0">
          <Label>次のコース（別シリーズ）</Label>
          <CrossSeriesCourseTreePicker
            candidates={crossSeriesCandidates}
            selectedIds={editMeta.crossSeriesNext}
            onChange={(ids) => {
              setCycleWarning(false);
              setEditMeta((prev) => ({ ...prev, crossSeriesNext: ids }));
            }}
            marker={{
              label: "Goal",
              checked: editMeta.isGoal,
              onToggle: (checked) =>
                setEditMeta((prev) => ({ ...prev, isGoal: checked })),
            }}
          />
        </MetaDialogField>
      </div>
      {cycleWarning && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            曼陀羅全体に循環する経路が生じます。別シリーズの前/次コースの設定を見直してください。
          </p>
        </div>
      )}
        </>
      )}
    </MetaViewShell>
  );
}
