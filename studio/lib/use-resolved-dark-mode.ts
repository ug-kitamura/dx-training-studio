"use client";

import { useEffect, useState } from "react";
import {
  loadWorkspaceSettings,
  resolveThemeClass,
} from "@/lib/workspace-settings";

/** `<html>` に実際に載っているテーマ種別。`system` は解決済みの値になる */
export type ThemeKind = "light" | "dark" | "pink";

function readKindFromDocument(): ThemeKind {
  if (typeof document === "undefined") return "light";
  const classes = document.documentElement.classList;
  if (classes.contains("dark")) return "dark";
  if (classes.contains("pink")) return "pink";
  return "light";
}

function readInitialKind(): ThemeKind {
  if (typeof window === "undefined") return "light";
  return resolveThemeClass(loadWorkspaceSettings().theme);
}

/** 設定テーマ + html の class に追従してテーマ種別を返す */
export function useThemeKind(): ThemeKind {
  const [kind, setKind] = useState<ThemeKind>(() =>
    typeof window === "undefined" ? "light" : readInitialKind(),
  );

  useEffect(() => {
    const sync = () => setKind(readKindFromDocument());

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const settings = loadWorkspaceSettings();
    if (settings.theme !== "system") {
      return () => obs.disconnect();
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => sync();
    mq.addEventListener("change", onMq);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, []);

  return kind;
}

/** 設定テーマ + html.dark クラスに追従する。ピンクはライト扱いで false */
export function useResolvedDarkMode(): boolean {
  return useThemeKind() === "dark";
}
