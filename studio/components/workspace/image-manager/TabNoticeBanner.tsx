import { cn } from "@/lib/utils";
import type { TabNotice } from "@/components/workspace/image-manager/types";

export function TabNoticeBanner({ notice }: { notice: TabNotice | undefined }) {
  if (!notice) return null;
  return (
    <div
      className={cn(
        "border-b px-3 py-1.5 text-[10px]",
        notice.tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : notice.tone === "warning"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {notice.message}
    </div>
  );
}
