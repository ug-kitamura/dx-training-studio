import fs from "node:fs/promises";
import path from "node:path";
import type { ImageSource } from "@/lib/image-path";
import {
  listPromotedImages,
  moveImageToTrash,
  resolveAbsoluteImagePath,
} from "@/lib/image-store";
import type { CanonicalBackend } from "@/lib/image-storage/types";

export function createLocalCanonicalBackend(projectRoot: string): CanonicalBackend {
  return {
    listCanonical: () => listPromotedImages(projectRoot),

    async readCanonical(logicalPath) {
      const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
      if (!absolute) return null;
      try {
        return await fs.readFile(absolute);
      } catch {
        return null;
      }
    },

    async putCanonical(logicalPath, data, source: ImageSource) {
      const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
      if (!absolute) throw new Error("invalid path");
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, data);
      const stat = await fs.stat(absolute);
      return {
        path: logicalPath,
        name: path.basename(logicalPath),
        source,
        uploadedAt: stat.mtime.toISOString(),
        size: stat.size,
      };
    },

    async deleteCanonical(logicalPath) {
      await moveImageToTrash(projectRoot, logicalPath);
    },
  };
}
