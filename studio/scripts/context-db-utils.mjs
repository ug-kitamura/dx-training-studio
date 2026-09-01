import fs from "node:fs/promises";
import path from "node:path";

export async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const text = await fs.readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^DATABASE_URL=(.+)$/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local
  }

  return null;
}

export function printDatabaseUrlHelp() {
  console.error(`
DATABASE_URL が未設定です。

1. https://console.neon.tech/ でプロジェクトを作成
2. Dashboard → Connection details → 「Connection string」をコピー
3. dx-training-studio/.env.local に次を追加:

DATABASE_URL=postgresql://...

4. 再度実行:
   npm run check:context-db
   npm run migrate:context-db
`.trim());
}
