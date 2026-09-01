"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Network as NetworkIcon } from "lucide-react";
import { LazyMandala } from "@/components/mandala/LazyMandala";
import { findCurrentLocation } from "@/lib/current-course";
import { data as siteData } from "@/lib/site-data";
import { localeOf } from "@/lib/locale-path";

const TEXT = {
  ja: { open: "曼陀羅を開く", title: "DXトレーニング曼陀羅", close: "閉じる" },
  en: { open: "Open the mandala", title: "DX Training Mandala", close: "Close" },
} as const;

export function MandalaModal() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const locale = localeOf(pathname);
  const text = TEXT[locale];

  // 「いまここ」はパスから解く。レッスンページは素の MDX で
  // ページ側から現在地を渡す経路が無いため、これが唯一の道。
  // シリーズトップも拾う——畳まれていれば集約ノードが現在地になる。
  // useMemo なのは参照を安定させるため。毎回新しいオブジェクトを渡すと
  // 曼陀羅側でノード一式を組み直す useMemo が効かなくなる
  const currentLocation = useMemo(
    () => findCurrentLocation(siteData.series, pathname),
    [pathname],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className="dxm-mandala-button"
        onClick={() => setOpen(true)}
        aria-label={text.open}
      >
        {/* 箱ではなく見た目を揃えた寸法。理由は globals.css の
            `.dxm-mandala-button` に書いてある */}
        <NetworkIcon size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="dxm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={text.title}
          onClick={close}
        >
          {/* 中身のクリックで閉じない。曼陀羅はクリックでパン・ズームが始まる */}
          <div className="dxm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="dxm-modal-head">
              <span className="dxm-modal-title">{text.title}</span>
              <button
                type="button"
                className="dxm-modal-close"
                onClick={close}
                aria-label={text.close}
              >
                ✕
              </button>
            </div>
            <LazyMandala
              scope={{ kind: "global" }}
              locale={locale}
              currentLocation={currentLocation}
              height="min(72vh, 720px)"
              modal
            />
          </div>
        </div>
      )}
    </>
  );
}
