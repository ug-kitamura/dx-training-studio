#!/usr/bin/env node
/**
 * Apply lib/context-db/migrate.sql to Neon.
 * Usage: npm run migrate:context-db
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
  await sql`
    CREATE TABLE IF NOT EXISTS context_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      source_url TEXT NOT NULL,
      source_last_updated_at DATE,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_context_items_tags
    ON context_items USING GIN (tags)
  `;

  console.log("OK: context_items テーブルと GIN インデックスを作成しました。");
} catch (error) {
  console.error("マイグレーションに失敗しました:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
