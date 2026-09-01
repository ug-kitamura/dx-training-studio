#!/usr/bin/env node
/**
 * Verify Neon connection and context_items table.
 * Usage: npm run check:context-db
 */
import { neon } from "@neondatabase/serverless";
import { loadDatabaseUrl, printDatabaseUrlHelp } from "./context-db-utils.mjs";

const url = await loadDatabaseUrl();
if (!url) {
  printDatabaseUrlHelp();
  process.exit(1);
}

const sql = neon(url);

try {
  const ping = await sql`SELECT 1 AS ok`;
  if (ping[0]?.ok !== 1) {
    throw new Error("SELECT 1 が期待どおり返りませんでした");
  }

  const tables = await sql`
    SELECT to_regclass('public.context_items') AS table_name
  `;
  const tableName = tables[0]?.table_name;

  console.log("OK: Neon に接続できました。");
  if (tableName) {
    const counts = await sql`SELECT COUNT(*)::int AS count FROM context_items`;
    console.log(`OK: context_items テーブルあり（${counts[0]?.count ?? 0} 件）`);
  } else {
    console.log("注意: context_items テーブルがありません。次を実行してください:");
    console.log("  npm run migrate:context-db");
    process.exit(2);
  }
} catch (error) {
  console.error("接続確認に失敗しました:");
  console.error(error instanceof Error ? error.message : error);
  console.error("\n接続文字列を確認してください（Neon Dashboard → Connection string）。");
  process.exit(1);
}
