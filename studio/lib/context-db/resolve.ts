import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { DbConnectionError } from "@/lib/context-db/types";

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new DbConnectionError();
  }
  return url;
}

export function resolveSql(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;
  const url = resolveDatabaseUrl();
  cachedSql = neon(url);
  return cachedSql;
}

export function resetSqlCacheForTests(): void {
  cachedSql = null;
}

export function dbErrorResponse(error: unknown): Response | null {
  if (error instanceof DbConnectionError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }
  return null;
}
