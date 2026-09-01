import { getContentsFingerprint, getContentsLatestMtime } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  const cwd = getProjectRoot();
  return Response.json({
    mtime: getContentsLatestMtime(cwd),
    fingerprint: getContentsFingerprint(cwd),
  });
}
