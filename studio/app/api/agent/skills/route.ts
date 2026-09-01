import {
  getSkillCatalogRoots,
  listVisibleSkills,
  type SkillSummary,
} from "@/lib/agent/skill-loader";
import { getProjectRoot } from "@/lib/project-root";
// ビルド時に生成される焼き込みカタログ（scripts/generate-skill-catalog.mjs）。
// 静的 import にすることで outputFileTracing が関数へ確実に同梱する
import bakedCatalog from "@/lib/agent/skill-catalog.generated.json";

export async function GET() {
  const roots = getSkillCatalogRoots(getProjectRoot());
  const skills = listVisibleSkills(roots);
  if (skills.length > 0) {
    return Response.json({ skills });
  }
  // ランタイムのファイルシステムに `.claude/skills` が無い環境（Vercel の
  // 読み取り専用デモ）では、ビルド時の焼き込みへフォールバックする
  return Response.json({ skills: bakedCatalog as SkillSummary[] });
}
