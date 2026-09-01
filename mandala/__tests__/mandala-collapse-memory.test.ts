/**
 * 全体曼陀羅の開閉記憶（セッション内・面ごと・展開側を保存）の検証。
 *
 * ⚠ 「記録が無い＝全折りたたみ」が既定であることを、ここで固定している。極性を
 * 畳んだ側へ戻すとこのファイルが落ちる。
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  readExpandedSeries,
  resetMandalaMemory,
  resolveInitialExpanded,
  writeExpandedSeries,
} from "../lib/mandala/collapse-memory";

beforeEach(() => {
  resetMandalaMemory();
});

describe("記憶のスロット", () => {
  it("記録が無ければ空を返す（＝全折りたたみ）", () => {
    expect([...readExpandedSeries("site-home")]).toEqual([]);
    expect([...readExpandedSeries("site-modal")]).toEqual([]);
  });

  it("書いた内容を読み戻せる", () => {
    writeExpandedSeries("site-modal", new Set(["git"]));
    expect([...readExpandedSeries("site-modal")]).toEqual(["git"]);
  });

  it("ホームとモーダルは互いに影響しない", () => {
    writeExpandedSeries("site-modal", new Set(["git", "python"]));
    expect([...readExpandedSeries("site-home")]).toEqual([]);

    writeExpandedSeries("site-home", new Set(["ai"]));
    expect([...readExpandedSeries("site-modal")].sort()).toEqual([
      "git",
      "python",
    ]);
  });

  it("渡した集合を後から変えても記憶は変わらない（複製して持つ）", () => {
    const set = new Set(["git"]);
    writeExpandedSeries("site-home", set);
    set.add("python");
    expect([...readExpandedSeries("site-home")]).toEqual(["git"]);
  });
});

describe("resolveInitialExpanded", () => {
  it("記録をそのまま引き継ぐ", () => {
    const result = resolveInitialExpanded(new Set(["git", "python"]), null);
    expect([...result].sort()).toEqual(["git", "python"]);
  });

  it("現在地のシリーズは記録に無くても展開する", () => {
    const result = resolveInitialExpanded(new Set(["git"]), "python");
    expect([...result].sort()).toEqual(["git", "python"]);
  });

  it("現在地が無ければ記録だけになる", () => {
    expect([...resolveInitialExpanded(new Set(), null)]).toEqual([]);
  });

  it("実在しない slug は掃除しなくてよい（展開側なので自然に無視される）", () => {
    // 消えたシリーズの記録が残っていても、どのシリーズとも一致しないので
    // 描画には影響しない。掃除の責務を持たないことをここで固定する
    const result = resolveInitialExpanded(new Set(["deleted-series"]), null);
    expect([...result]).toEqual(["deleted-series"]);
  });
});
