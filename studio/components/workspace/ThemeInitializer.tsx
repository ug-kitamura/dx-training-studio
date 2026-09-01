"use client";

import { useEffect } from "react";
import { migrateLocalStorageIfNeeded } from "@/lib/storage-migration";
import {
  applyThemeToDocument,
  loadWorkspaceSettings,
} from "@/lib/workspace-settings";

export function ThemeInitializer() {
  useEffect(() => {
    migrateLocalStorageIfNeeded();
    const settings = loadWorkspaceSettings();
    applyThemeToDocument(settings.theme);

    if (settings.theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
