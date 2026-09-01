import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ContextItem } from "@/lib/context-db/types";

export const LOCAL_DB_DIR = "local-db";
export const CONTEXT_STORE_FILE = "context-items.json";

/** @deprecated legacy split-file layout */
const LEGACY_META_FILE = "context-meta.json";
/** @deprecated legacy split-file layout */
const LEGACY_ITEMS_DIR = "context-items";

export type ContextStore = {
  nextId: number;
  items: ContextItem[];
};

const contextItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  source_url: z.string(),
  source_last_updated_at: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const contextStoreSchema = z.object({
  nextId: z.number().int().min(1),
  items: z.array(contextItemSchema),
});

export function getLocalDbRoot(projectRoot: string): string {
  return path.join(projectRoot, LOCAL_DB_DIR);
}

export function getStorePath(projectRoot: string): string {
  return path.join(getLocalDbRoot(projectRoot), CONTEXT_STORE_FILE);
}

export async function atomicWriteJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

const EMPTY_STORE: ContextStore = { nextId: 1, items: [] };

async function readLegacySplitStore(projectRoot: string): Promise<ContextStore | null> {
  const metaPath = path.join(getLocalDbRoot(projectRoot), LEGACY_META_FILE);
  const itemsDir = path.join(getLocalDbRoot(projectRoot), LEGACY_ITEMS_DIR);

  let nextId = 1;
  try {
    const metaRaw = await fs.readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { nextId?: number };
    if (typeof meta.nextId === "number" && meta.nextId >= 1) {
      nextId = meta.nextId;
    }
  } catch {
    // no legacy meta
  }

  let entries: string[];
  try {
    entries = await fs.readdir(itemsDir);
  } catch {
    return null;
  }

  const jsonFiles = entries.filter((name) => name.endsWith(".json"));
  if (jsonFiles.length === 0 && nextId === 1) {
    try {
      await fs.access(metaPath);
    } catch {
      return null;
    }
  }

  const items: ContextItem[] = [];
  for (const name of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(itemsDir, name), "utf8");
      items.push(contextItemSchema.parse(JSON.parse(raw)));
    } catch {
      // skip invalid legacy files
    }
  }

  if (items.length === 0 && nextId === 1) {
    return null;
  }

  const maxId = items.reduce((max, item) => Math.max(max, item.id), 0);
  return {
    nextId: Math.max(nextId, maxId + 1),
    items,
  };
}

async function migrateLegacyStoreIfNeeded(projectRoot: string): Promise<void> {
  const storePath = getStorePath(projectRoot);
  try {
    await fs.access(storePath);
    return;
  } catch {
    // continue
  }

  const legacy = await readLegacySplitStore(projectRoot);
  if (!legacy) return;

  await atomicWriteJson(storePath, legacy);
}

export async function ensureLocalContextStore(projectRoot: string): Promise<void> {
  await fs.mkdir(getLocalDbRoot(projectRoot), { recursive: true });
  await migrateLegacyStoreIfNeeded(projectRoot);

  const storePath = getStorePath(projectRoot);
  try {
    await fs.access(storePath);
  } catch {
    await atomicWriteJson(storePath, EMPTY_STORE);
  }
}

export async function readStore(projectRoot: string): Promise<ContextStore> {
  await ensureLocalContextStore(projectRoot);
  const raw = await fs.readFile(getStorePath(projectRoot), "utf8");
  return contextStoreSchema.parse(JSON.parse(raw));
}

export async function writeStore(
  projectRoot: string,
  store: ContextStore,
): Promise<void> {
  await atomicWriteJson(getStorePath(projectRoot), store);
}

export function sortItems(items: ContextItem[]): ContextItem[] {
  return [...items].sort((a, b) => {
    const updatedDiff =
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (updatedDiff !== 0) return updatedDiff;
    return b.id - a.id;
  });
}
