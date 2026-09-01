import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LessonStatus } from "@/lib/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 配下レッスンのステータス一覧からコース/シリーズのステータスを自動計算する。
 * - すべて open → open
 * - すべて done → done
 * - それ以外 → in_progress
 */
export function computeStatus(statuses: LessonStatus[]): LessonStatus {
  if (statuses.length === 0) return "open";
  if (statuses.every((s) => s === "open")) return "open";
  if (statuses.every((s) => s === "done")) return "done";
  return "in_progress";
}
