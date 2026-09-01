#!/usr/bin/env node
/**
 * Upload canonical images from images/ root to Vercel Blob.
 * Usage: node scripts/upload-local-images-to-blob.mjs [--dry-run]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const RESERVED_DIRS = new Set(["uploaded", "ai", "web", "trash"]);
const dryRun = process.argv.includes("--dry-run");

async function loadEnvLocalToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return process.env.BLOB_READ_WRITE_TOKEN.trim();
  }
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const text = await fs.readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^BLOB_READ_WRITE_TOKEN=(.+)$/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local
  }
  return null;
}

async function listCanonicalFiles(imagesRoot) {
  let entries;
  try {
    entries = await fs.readdir(imagesRoot);
  } catch {
    return [];
  }

  const files = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    if (RESERVED_DIRS.has(name)) continue;
    const absolute = path.join(imagesRoot, name);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) continue;
    files.push({ name, absolute });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const token = await loadEnvLocalToken();
  if (!token) {
    console.error(
      "BLOB_READ_WRITE_TOKEN が見つかりません。.env.local に設定してください。",
    );
    process.exit(1);
  }

  const imagesRoot = path.join(process.cwd(), "images");
  const files = await listCanonicalFiles(imagesRoot);

  if (files.length === 0) {
    console.log("アップロード対象の正本ファイルがありません。");
    return;
  }

  if (dryRun) {
    console.log("dry-run: 以下を Blob にアップロードします:");
    for (const file of files) {
      console.log(`  images/${file.name}`);
    }
    return;
  }

  for (const file of files) {
    const key = `images/${file.name}`;
    const data = await fs.readFile(file.absolute);
    await put(key, data, {
      access: "private",
      token,
      allowOverwrite: true,
    });
    console.log(`Uploaded ${key}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
