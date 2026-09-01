import type { LucideIcon } from "lucide-react";
import {
  Code,
  File,
  FileText,
  Image,
  KeyRound,
  Mic,
  Package,
  Table,
  Video,
} from "lucide-react";

export type FileIconCategory =
  | "text"
  | "code"
  | "table"
  | "image"
  | "video"
  | "audio"
  | "secret"
  | "zip"
  | "other";

const TEXT_EXTENSIONS = new Set([".md", ".txt"]);
const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".go",
  ".rs",
  ".groovy",
  ".bat",
  ".sh",
  ".ps1",
  ".json",
  ".yml",
  ".yaml",
  ".xml",
  ".html",
  ".htm",
  ".css",
]);
const TABLE_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".gif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".vtt"]);
const SECRET_EXTENSIONS = new Set([".pem", ".key", ".crt"]);
const ZIP_EXTENSIONS = new Set([".zip", ".rar", ".7z"]);

export const FILE_ICON_COMPONENTS: Record<FileIconCategory, LucideIcon> = {
  text: FileText,
  code: Code,
  table: Table,
  image: Image,
  video: Video,
  audio: Mic,
  secret: KeyRound,
  zip: Package,
  other: File,
};

export function getFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return "";
  return lower.slice(dot);
}

export function resolveFileIconCategory(fileName: string): FileIconCategory {
  if (fileName === ".env" || fileName.startsWith(".env.")) {
    return "secret";
  }

  const ext = getFileExtension(fileName);
  if (!ext) return "other";

  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (TABLE_EXTENSIONS.has(ext)) return "table";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (SECRET_EXTENSIONS.has(ext)) return "secret";
  if (ZIP_EXTENSIONS.has(ext) || ext === ".tar.gz") return "zip";

  return "other";
}

export function getFileIconColorClass(category: FileIconCategory): string {
  void category;
  return "text-chart-1/60 dark:text-chart-1";
}
