import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
} from "@/lib/storage-keys";
import { migrateLocalStorageIfNeeded } from "@/lib/storage-migration";

describe("migrateLocalStorageIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("copies legacy settings to new key when new key is absent", () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEYS.settings,
      JSON.stringify({ theme: "dark" }),
    );

    migrateLocalStorageIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBe(
      localStorage.getItem(LEGACY_STORAGE_KEYS.settings),
    );
    expect(localStorage.getItem(LEGACY_STORAGE_KEYS.settings)).not.toBeNull();
  });

  it("does not overwrite new key when it already exists", () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.settings, '{"theme":"dark"}');
    localStorage.setItem(STORAGE_KEYS.settings, '{"theme":"light"}');

    migrateLocalStorageIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBe('{"theme":"light"}');
  });

  it("migrates all paired keys independently", () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.agentChat, '{"version":1}');
    localStorage.setItem(
      LEGACY_STORAGE_KEYS.selection,
      '{"courseId":"c1","lessonId":"l1"}',
    );

    migrateLocalStorageIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.agentChat)).toBe('{"version":1}');
    expect(localStorage.getItem(STORAGE_KEYS.selection)).toBe(
      '{"courseId":"c1","lessonId":"l1"}',
    );
  });

  it("is idempotent on repeated calls", () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.settings, '{"theme":"system"}');

    migrateLocalStorageIfNeeded();
    migrateLocalStorageIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBe('{"theme":"system"}');
  });
});
