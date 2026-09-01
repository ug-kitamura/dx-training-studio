import {
  MetaJsonParseError,
  reconcileOrderFiles,
  loadContentsFolder,
} from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  try {
    reconcileOrderFiles(getProjectRoot());
    const series = loadContentsFolder(getProjectRoot());
    return Response.json(series);
  } catch (err) {
    if (err instanceof MetaJsonParseError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}
