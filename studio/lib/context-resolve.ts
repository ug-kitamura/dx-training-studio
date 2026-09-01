import { contextStorageModeSchema, type ContextStorageMode } from "@/lib/schema";
import { createContextDbRepository } from "@/lib/context-db/repository";
import { createContextLocalRepository } from "@/lib/context-local/repository";
import type { ContextRepository } from "@/lib/context-db/repository";
import { getProjectRoot } from "@/lib/project-root";

export function parseContextMode(
  raw: string | null | undefined,
): ContextStorageMode {
  const parsed = contextStorageModeSchema.safeParse(raw ?? "database");
  return parsed.success ? parsed.data : "database";
}

export function parseContextModeFromRequest(req: Request): ContextStorageMode {
  const { searchParams } = new URL(req.url);
  return parseContextMode(searchParams.get("contextMode"));
}

const repositoryCache = new Map<ContextStorageMode, ContextRepository>();

export function getContextRepository(
  mode: ContextStorageMode = "database",
  projectRoot: string = getProjectRoot(),
): ContextRepository {
  const cached = repositoryCache.get(mode);
  if (cached) return cached;

  const repo =
    mode === "local"
      ? createContextLocalRepository(projectRoot)
      : createContextDbRepository();
  repositoryCache.set(mode, repo);
  return repo;
}

export function resetContextRepositoryForTests(): void {
  repositoryCache.clear();
}
