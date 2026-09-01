import { STORAGE_KEYS } from "@/lib/storage-keys";

export type Pane4View = "agent" | "images";

const STORAGE_KEY = STORAGE_KEYS.pane4View;
const LEGACY_PANE3_MODE_KEY = STORAGE_KEYS.pane3ModeLegacy;

export type Pane4ViewMigration = {
  pane4View: Pane4View;
  openPane4: boolean;
};

export function loadPane4ViewMigration(): Pane4ViewMigration | null {
  if (typeof window === "undefined") return null;
  try {
    const legacy = localStorage.getItem(LEGACY_PANE3_MODE_KEY);
    if (legacy === "agent") {
      localStorage.removeItem(LEGACY_PANE3_MODE_KEY);
      return { pane4View: "agent", openPane4: true };
    }
  } catch {
    // ignore
  }
  return null;
}

export function loadPane4View(): Pane4View {
  if (typeof window === "undefined") return "agent";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "agent" || raw === "images") return raw;
  } catch {
    // ignore
  }
  return "agent";
}

export function savePane4View(view: Pane4View) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // ignore quota errors
  }
}
