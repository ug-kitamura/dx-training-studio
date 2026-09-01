import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  checkContentsWritePath,
  resolveToolTargetPath,
} from "@/lib/agent/tools/fs-guard";

const PROJECT_ROOT = path.resolve("C:/tmp/dx-root");
/** フォーカス中のレッスン（作業フォルダ = contents/<S>/<C>/<L>/） */
const SCOPE = "シリーズA/コースB/レッスンC";

describe("resolveToolTargetPath（dx 2 ルート境界）", () => {
  it("素の相対パスは作業フォルダ（フォーカス中のコンテンツフォルダ）配下へ解決される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, "draft.md");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.relativePath).toBe(`contents/${SCOPE}/draft.md`);
    expect(resolved.absolutePath).toBe(
      path.join(PROJECT_ROOT, "contents", ...SCOPE.split("/"), "draft.md"),
    );
  });

  it("フォーカスが無いとき素の相対パスは contents/ 直下へ解決される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, "", "draft.md");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe("contents/draft.md");
  });

  it("contents/ 配下は正本ツリーとして解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents/series-a/course-b/lesson-c.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.insideSkill).toBe(false);
    expect(resolved.relativePath).toBe("contents/series-a/course-b/lesson-c.md");
    expect(resolved.absolutePath).toBe(
      path.join(PROJECT_ROOT, "contents", "series-a", "course-b", "lesson-c.md"),
    );
  });

  it("contents-work/ 配下は作業ツリーとして解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents-work/runs/20260811-demo/design-note.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("project");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.relativePath).toBe(
      "contents-work/runs/20260811-demo/design-note.md",
    );
  });

  it("contents ディレクトリ自体も解決できる（一覧・検索の基点）", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, "contents");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
  });

  it("contents を装った親ディレクトリ脱出は拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents/../data/workspace.json",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("contents- 接頭辞の別ディレクトリは contents ゾーンにならない", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents-backup/file.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    // 素の相対パスとして作業フォルダ配下へ落ちる（リポ直下には届かない）
    expect(resolved.relativePath).toBe(
      `contents/${SCOPE}/contents-backup/file.md`,
    );
  });

  it("絶対パス・チルダ・ドライブレターは拒否される", () => {
    for (const input of ["/etc/hosts", "~/secrets", "C:/windows/system32"]) {
      const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, input);
      expect(resolved).toHaveProperty("error");
    }
  });

  it(".. を含むパスは拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "../../etc/hosts",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("data/ 等の素の相対パスはリポ直下へ届かず作業フォルダ内へ閉じる", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "data/workspace.json",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(
      resolved.absolutePath.startsWith(
        path.join(PROJECT_ROOT, "contents", ...SCOPE.split("/")),
      ),
    ).toBe(true);
  });

  it("workspace/ は特別扱いされず作業フォルダ配下へ閉じる", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "workspace/other/notes.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(
      `contents/${SCOPE}/workspace/other/notes.md`,
    );
  });

  it("不正なスコープは拒否される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, "../escape", "a.md");
    expect(resolved).toHaveProperty("error");
  });
});

/**
 * 正本ツリーへ書けるのは `contents/<S>/<C>/<L>/contents.md` だけ。
 * 判定はパスのみで、ディスク上の存在も内容も見ない（`contents-write-gate`）。
 */
describe("checkContentsWritePath（正本ツリーの書込規約）", () => {
  /** ディスクに触れずに contents ゾーンの解決結果を組み立てる */
  function writeTarget(relativePath: string) {
    return resolveToolTargetPath(PROJECT_ROOT, SCOPE, relativePath, {
      forWrite: true,
    });
  }

  it("レッスン本文への書込は許可される", () => {
    const resolved = writeTarget("contents/シリーズA/コースB/レッスンC/contents.md");
    expect(resolved).not.toHaveProperty("error");
  });

  it("素の相対パス contents.md はフォーカス中のレッスンへ解決され許可される", () => {
    const resolved = writeTarget("contents.md");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(`contents/${SCOPE}/contents.md`);
  });

  it("いずれの階層も未作成でもパス規約では止めない（確認ゲートの担当）", () => {
    const resolved = writeTarget("contents/新S/新C/新L/contents.md");
    expect(resolved).not.toHaveProperty("error");
  });

  it("予約名以外のファイルはどの階層でも許可される", () => {
    for (const p of [
      "contents/memo.md",
      "contents/シリーズA/memo.md",
      "contents/シリーズA/コースB/memo.md",
      "contents/シリーズA/コースB/レッスンC/memo.md",
      "contents/シリーズA/コースB/レッスンC/assets/diagram.svg",
      "contents/シリーズA/コースB/レッスンC/_work/report.html",
    ]) {
      expect(writeTarget(p)).not.toHaveProperty("error");
    }
  });

  it(".meta.json はレッスン階層以外で拒否される（アプリ管理）", () => {
    for (const p of [
      "contents/.meta.json",
      "contents/シリーズA/.meta.json",
      "contents/シリーズA/コースB/.meta.json",
      "contents/シリーズA/コースB/レッスンC/assets/.meta.json",
    ]) {
      expect(writeTarget(p)).toHaveProperty("error");
    }
  });

  it("レッスン階層の .meta.json はパス規約では許可される（検査は書込ツール側）", () => {
    expect(
      writeTarget("contents/シリーズA/コースB/レッスンC/.meta.json"),
    ).not.toHaveProperty("error");
  });

  it("session.json はどの階層でも拒否される（アプリ管理）", () => {
    for (const p of [
      "contents/シリーズA/コースB/レッスンC/session.json",
      "contents/シリーズA/session.json",
    ]) {
      expect(writeTarget(p)).toHaveProperty("error");
    }
  });

  it("contents.md はレッスン階層以外では拒否される", () => {
    for (const p of [
      "contents/contents.md",
      "contents/シリーズA/contents.md",
      "contents/シリーズA/コースB/contents.md",
      "contents/シリーズA/コースB/レッスンC/assets/contents.md",
    ]) {
      expect(writeTarget(p)).toHaveProperty("error");
    }
  });

  it("アプリ管理ファイルの拒否メッセージに理由と実際のパスが含まれる", () => {
    const resolved = writeTarget("contents/シリーズA/.meta.json");
    expect(resolved).toHaveProperty("error");
    if (!("error" in resolved)) return;
    expect(resolved.error).toContain(".meta.json");
    expect(resolved.error).toContain("contents/シリーズA/.meta.json");
  });

  it("contents.md 誤配置の拒否メッセージに置ける場所と実際のパスが含まれる", () => {
    const resolved = writeTarget("contents/シリーズA/contents.md");
    expect(resolved).toHaveProperty("error");
    if (!("error" in resolved)) return;
    expect(resolved.error).toContain("<シリーズ>/<コース>/<レッスン>/");
    expect(resolved.error).toContain("contents/シリーズA/contents.md");
  });

  it("読取（forWrite なし）では規約を適用しない", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents/シリーズA/.meta.json",
    );
    expect(resolved).not.toHaveProperty("error");
  });

  it("contents-work/ 配下は規約の対象外", () => {
    const resolved = writeTarget("contents-work/runs/20260811-demo/note.md");
    expect(resolved).not.toHaveProperty("error");
  });

  it("contents-work/sessions/ への書込は拒否される", () => {
    const resolved = writeTarget("contents-work/sessions/agent-chat.json");
    expect(resolved).toHaveProperty("error");
  });

  it("contents-work/sessions/ 配下は名前によらず拒否される", () => {
    const resolved = writeTarget("contents-work/sessions/any-other-name.json");
    expect(resolved).toHaveProperty("error");
  });

  it("contents-work/plans/ は sessions と紛らわしくても許可される", () => {
    const resolved = writeTarget("contents-work/plans/sessions-memo.md");
    expect(resolved).not.toHaveProperty("error");
  });

  it("contents ゾーン以外は素通しする", () => {
    const outcome = checkContentsWritePath({
      absolutePath: path.join(PROJECT_ROOT, "contents-work", "a.md"),
      relativePath: "contents-work/a.md",
      insideProject: true,
      insideSkill: false,
      zone: "project",
    });
    expect(outcome).toBeNull();
  });
});
