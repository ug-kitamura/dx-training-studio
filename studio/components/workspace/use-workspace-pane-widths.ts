"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  clampPaneWidth,
  fitPaneLayout,
  loadPaneWidths,
  PANE_RESIZE_INVERT_DELTA,
  PANE_WIDTH_DEFAULTS,
  savePaneWidths,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";

type DragSession = {
  pane: keyof WorkspacePaneWidths;
  startX: number;
  startWidth: number;
};

export function useWorkspacePaneWidths(
  totalWidth: number | null,
  pane4Open: boolean,
) {
  const [paneWidths, setPaneWidths] =
    useState<WorkspacePaneWidths>(PANE_WIDTH_DEFAULTS);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<DragSession | null>(null);
  const initializedRef = useRef(false);

  const applyFit = useCallback(
    (
      widths: WorkspacePaneWidths,
      expandPane: keyof WorkspacePaneWidths | null = null,
    ): WorkspacePaneWidths => {
      if (totalWidth == null) return widths;
      return fitPaneLayout({
        requested: widths,
        totalWidth,
        pane4Open,
        expandPane,
      });
    },
    [totalWidth, pane4Open],
  );

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setPaneWidths(applyFit(loadPaneWidths()));
      return;
    }
    setPaneWidths((prev) => applyFit(prev));
  }, [applyFit]);

  const beginResize = useCallback(
    (pane: keyof WorkspacePaneWidths, clientX: number) => {
      setIsResizing(true);
      setPaneWidths((prev) => {
        dragRef.current = {
          pane,
          startX: clientX,
          startWidth: prev[pane],
        };
        return prev;
      });
    },
    [],
  );

  const moveResize = useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = clientX - drag.startX;
      const signed = PANE_RESIZE_INVERT_DELTA[drag.pane] ? -delta : delta;
      const nextWidth = clampPaneWidth(drag.pane, drag.startWidth + signed);
      setPaneWidths((prev) => {
        const dragged = { ...prev, [drag.pane]: nextWidth };
        const fitted = applyFit(dragged, drag.pane);
        if (prev.tree === fitted.tree && prev.pane4 === fitted.pane4) {
          return prev;
        }
        return fitted;
      });
    },
    [applyFit],
  );

  const endResize = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
    setPaneWidths((prev) => {
      const fitted = applyFit(prev);
      savePaneWidths(fitted);
      return fitted;
    });
  }, [applyFit]);

  const resizeHandleProps = useCallback(
    (pane: keyof WorkspacePaneWidths) => ({
      onResizeStart: (clientX: number) => beginResize(pane, clientX),
      onResize: moveResize,
      onResizeEnd: endResize,
    }),
    [beginResize, moveResize, endResize],
  );

  const applyPaneWidths = useCallback(
    (widths: WorkspacePaneWidths) => {
      const fitted = applyFit(widths);
      setPaneWidths(fitted);
      savePaneWidths(fitted);
    },
    [applyFit],
  );

  return {
    paneWidths,
    isResizing,
    resizeHandleProps,
    applyPaneWidths,
  };
}
