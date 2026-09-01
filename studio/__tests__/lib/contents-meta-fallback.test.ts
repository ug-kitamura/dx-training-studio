/**
 * デプロイ先（Vercel の読み取り専用デモ）で `.meta.json` が同梱されない状況の再現。
 *
 * 症状の実測: `contents/` のフォルダと `contents.md` / `contents.en.md` /
 * `changelog.md` は届くのに、**先頭がドットの `.meta.json` だけが全階層で欠ける**。
 * その結果、閲覧系 API が空を返し、`loadContentsFolder` は id 未設定と判断して
 * 書き込みに走り、読み取り専用 fs で 500 になっていた（studio-demo-deployment spec）。
 *
 * ここでは正本ツリーを触らずに同じ状態を作る——`getProjectRoot()` を一時ディレクトリへ
 * 差し替え、`.meta.json` を置かないフォルダだけを並べる。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bakedContentsMeta from "@/lib/contents-meta.generated.json";

/** mock から参照するため hoisted。パス本体は下で実ディレクトリを作って埋める */
const state = vi.hoisted(() => ({ tmpRoot: "" }));

vi.mock("@/lib/project-root", () => ({
  getProjectRoot: () => state.tmpRoot,
}));

state.tmpRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "contents-meta-fallback-"),
);

const { readMetaJson } = await import("@/lib/contents-loader");

const contentsDir = path.join(state.tmpRoot, "contents");
/** 焼き込み済みの実データから、ルート以外の 1 件を借りる（中身に依存しないため） */
const unitKey = Object.keys(bakedContentsMeta).find((key) => key !== "")!;

beforeEach(() => {
  // `.meta.json` を置かないフォルダだけを作る＝デプロイ先の状態
  fs.mkdirSync(path.join(contentsDir, unitKey), { recursive: true });
});

afterEach(() => {
  fs.rmSync(contentsDir, { recursive: true, force: true });
  delete process.env.VERCEL;
});

afterAll(() => {
  fs.rmSync(state.tmpRoot, { recursive: true, force: true });
});

describe("readMetaJson のデプロイ先フォールバック", () => {
  it("デプロイ先では焼き込みから読める（空を返さない）", () => {
    process.env.VERCEL = "1";

    const meta = readMetaJson(path.join(contentsDir, unitKey));

    expect(meta).toEqual(
      (bakedContentsMeta as Record<string, Record<string, unknown>>)[unitKey],
    );
    expect(Object.keys(meta).length).toBeGreaterThan(0);
  });

  it("ルート（contents/.meta.json）も焼き込みから読める", () => {
    process.env.VERCEL = "1";

    expect(readMetaJson(contentsDir)).toEqual(
      (bakedContentsMeta as Record<string, Record<string, unknown>>)[""],
    );
  });

  it("ローカルでは従来どおり空を返す（id 自己修復に委ねる）", () => {
    expect(readMetaJson(path.join(contentsDir, unitKey))).toEqual({});
  });

  it("実ファイルがあればそちらを読む（焼き込みは効かせない）", () => {
    process.env.VERCEL = "1";
    const dir = path.join(contentsDir, unitKey);
    fs.writeFileSync(
      path.join(dir, ".meta.json"),
      JSON.stringify({ id: "実ファイル優先" }),
      "utf-8",
    );

    expect(readMetaJson(dir)).toEqual({ id: "実ファイル優先" });
  });
});
