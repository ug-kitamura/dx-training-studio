import { afterEach, describe, expect, it } from "vitest";
import {
  DB_CONNECTION_ERROR_MESSAGE,
  DbConnectionError,
} from "@/lib/context-db/types";
import {
  resetSqlCacheForTests,
  resolveDatabaseUrl,
} from "@/lib/context-db/resolve";

describe("context-db resolve", () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    resetSqlCacheForTests();
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it("throws DbConnectionError when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => resolveDatabaseUrl()).toThrow(DbConnectionError);
    try {
      resolveDatabaseUrl();
    } catch (error) {
      expect(error).toBeInstanceOf(DbConnectionError);
      expect((error as DbConnectionError).message).toBe(DB_CONNECTION_ERROR_MESSAGE);
      expect((error as DbConnectionError).statusCode).toBe(503);
    }
  });

  it("returns trimmed DATABASE_URL when set", () => {
    process.env.DATABASE_URL = "  postgresql://example  ";
    expect(resolveDatabaseUrl()).toBe("postgresql://example");
  });
});
