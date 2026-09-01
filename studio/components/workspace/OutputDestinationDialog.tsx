"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OutputDestinationOption } from "@/lib/agent/skill-io-boundary";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  options: OutputDestinationOption[];
  selectedId: OutputDestinationOption["id"] | null;
  onSelect: (id: OutputDestinationOption["id"]) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function OutputDestinationDialog({
  open,
  options,
  selectedId,
  onSelect,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>出力先を選んでください</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selectedId === option.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60",
              )}
              onClick={() => onSelect(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" disabled={!selectedId} onClick={onConfirm}>
            この出力先で続行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
