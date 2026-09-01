#!/usr/bin/env node
/**
 * Usage: node scripts/render-diagram.mjs <htmlFile> <outputPng>
 */
import fs from "node:fs/promises";
import path from "node:path";
import { renderDiagramToPng } from "../lib/render-diagram-capture.mjs";

async function main() {
  const htmlPath = process.argv[2];
  const outPath = process.argv[3];
  if (!htmlPath || !outPath) {
    console.error("Usage: node scripts/render-diagram.mjs <htmlFile> <outputPng>");
    process.exit(1);
  }

  const fragment = await fs.readFile(htmlPath, "utf8");
  const { png } = await renderDiagramToPng(fragment);
  await fs.writeFile(path.resolve(outPath), png);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
