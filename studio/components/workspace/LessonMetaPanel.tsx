"use client";

import {
  CircleCheck,
  CircleDashed,
  Loader,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_GRID,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { LessonTagsInput } from "@/components/workspace/LessonTagsInput";
import { isValidTag } from "@/lib/lesson-tags";
import { normalizeTags, type LessonMetaFields } from "@/lib/lesson-meta";
import {
  SLUG_PATTERN,
  STATUS_LABELS,
  type Lesson,
  type LessonStatus,
} from "@/lib/schema";

/** 状態はアイコンの形で区別する。色はペイン1 のステータスボタンと同じグレーに揃える */
const STATUS_ICONS: Record<LessonStatus, React.ReactNode> = {
  open: <CircleDashed className="size-3.5 text-muted-foreground" />,
  in_progress: <Loader className="size-3.5 text-muted-foreground" />,
  done: <CircleCheck className="size-3.5 text-muted-foreground" />,
};

/** 未設定 */
const ESTIMATED_MINUTES_UNSET = "-";

const ESTIMATED_MINUTE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ESTIMATED_MINUTES_UNSET, label: ESTIMATED_MINUTES_UNSET },
  ...Array.from({ length: 12 }, (_, i) => {
    const minutes = (i + 1) * 5;
    return { value: String(minutes), label: `${minutes} min` };
  }),
];

const STATUS_SELECT_ITEMS = (["open", "in_progress", "done"] as const).map(
  (s) => ({
    value: s,
    label: (
      <span className="flex items-center gap-2">
        {STATUS_ICONS[s]}
        {STATUS_LABELS[s]}
      </span>
    ),
  }),
);

function minutesToSelectValue(minutes: number): string {
  if (minutes === 0) return ESTIMATED_MINUTES_UNSET;
  if (minutes >= 5 && minutes <= 60 && minutes % 5 === 0) {
    return String(minutes);
  }
  if (minutes < 5) return ESTIMATED_MINUTES_UNSET;
  const snapped = Math.min(60, Math.round(minutes / 5) * 5);
  return snapped === 0 ? ESTIMATED_MINUTES_UNSET : String(snapped);
}

export type LessonMetaDraft = {
  lesson: string;
  slug: string;
  status: LessonStatus;
  description: string;
  tags: string[];
  estimatedMinutes: string;
  author: string;
};

export function lessonToMetaDraft(lesson: Lesson): LessonMetaDraft {
  return {
    lesson: lesson.lesson,
    slug: lesson.slug ?? "",
    status: lesson.status,
    description: lesson.description,
    tags: [...lesson.tags],
    estimatedMinutes: minutesToSelectValue(lesson.estimated_minutes),
    author: lesson.author,
  };
}

export function draftToMetaPatch(
  draft: LessonMetaDraft,
  fallbackLesson: Lesson,
): {
  patch: Partial<LessonMetaFields>;
  tagError: string | null;
  slugError: string | null;
} {
  const invalid = draft.tags.filter((t) => !isValidTag(t));
  if (invalid.length > 0) {
    return {
      patch: {},
      tagError: `タグは小文字英字・数字・ハイフンのみ: ${invalid.join(", ")}`,
      slugError: null,
    };
  }
  const trimmedSlug = draft.slug.trim();
  if (trimmedSlug && !SLUG_PATTERN.test(trimmedSlug)) {
    return {
      patch: {},
      tagError: null,
      slugError: "slug は小文字英数とハイフンのみで構成してください",
    };
  }
  const rawTags = draft.tags;
  const estimated_minutes =
    draft.estimatedMinutes === ESTIMATED_MINUTES_UNSET
      ? 0
      : Number.parseInt(draft.estimatedMinutes, 10) || 0;
  return {
    patch: {
      lesson: draft.lesson.trim() || fallbackLesson.lesson,
      // 空文字は「未設定」= .meta.json からキーを外す（applyLessonMetaPatch が空文字を落とす）
      slug: trimmedSlug,
      status: draft.status,
      description: draft.description,
      tags: normalizeTags(rawTags),
      estimated_minutes,
      author: draft.author,
    },
    tagError: null,
    slugError: null,
  };
}

type Props = {
  draft: LessonMetaDraft;
  onDraftChange: (draft: LessonMetaDraft) => void;
  className?: string;
  tagError?: string | null;
  slugError?: string | null;
  tagSuggestions?: readonly string[];
  onFlushTagsReady?: (flush: () => string[]) => void;
};

export function LessonMetaPanel({
  className,
  draft,
  onDraftChange,
  tagError,
  slugError,
  tagSuggestions = [],
  onFlushTagsReady,
}: Props) {
  const patchDraft = (partial: Partial<LessonMetaDraft>) => {
    onDraftChange({ ...draft, ...partial });
  };

  return (
    <div className={cn(META_DIALOG_GRID, className)}>
      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-name">レッスン名</Label>
        <Input
          id="lesson-meta-name"
          value={draft.lesson}
          onChange={(e) => patchDraft({ lesson: e.target.value })}
          className={META_DIALOG_CONTROL}
        />
      </MetaDialogField>

      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-description">講義内容</Label>
        <textarea
          id="lesson-meta-description"
          value={draft.description}
          onChange={(e) => patchDraft({ description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </MetaDialogField>

      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-slug">スラッグ（公開 URL 用）</Label>
        <Input
          id="lesson-meta-slug"
          value={draft.slug}
          onChange={(e) => patchDraft({ slug: e.target.value })}
          placeholder="例: how-to-learn"
          aria-invalid={Boolean(slugError)}
          className={META_DIALOG_CONTROL}
        />
        {slugError ? (
          <p className="text-xs text-destructive" role="alert">
            {slugError}
          </p>
        ) : null}
      </MetaDialogField>

      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-tags" id="lesson-meta-tags-label">
          タグ
        </Label>
        <LessonTagsInput
          id="lesson-meta-tags"
          tags={draft.tags}
          onChange={(tags) => patchDraft({ tags })}
          suggestions={tagSuggestions}
          aria-invalid={Boolean(tagError)}
          aria-describedby={tagError ? "lesson-meta-tags-error" : undefined}
          onFlushReady={(flush) => onFlushTagsReady?.(flush)}
        />
        {tagError ? (
          <p
            id="lesson-meta-tags-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {tagError}
          </p>
        ) : null}
      </MetaDialogField>

      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-author">著者</Label>
        <Input
          id="lesson-meta-author"
          value={draft.author}
          onChange={(e) => patchDraft({ author: e.target.value })}
          className={META_DIALOG_CONTROL}
        />
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-minutes">所要時間</Label>
        <Select
          items={ESTIMATED_MINUTE_OPTIONS}
          value={draft.estimatedMinutes}
          onValueChange={(v) => {
            if (!v) return;
            patchDraft({ estimatedMinutes: v });
          }}
        >
          <SelectTrigger
            id="lesson-meta-minutes"
            className={cn(META_DIALOG_CONTROL, "w-full")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTIMATED_MINUTE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-status">進捗</Label>
        <Select
          items={STATUS_SELECT_ITEMS}
          value={draft.status}
          onValueChange={(v) => {
            if (!v) return;
            patchDraft({ status: v as LessonStatus });
          }}
        >
          <SelectTrigger
            id="lesson-meta-status"
            className={cn(META_DIALOG_CONTROL, "w-full")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["open", "in_progress", "done"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  {STATUS_ICONS[s]}
                  {STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaDialogField>
    </div>
  );
}
