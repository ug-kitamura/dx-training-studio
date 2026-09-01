"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  paths: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function OutsideProjectPathDialog({
  open,
  paths,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>プロジェクト外のパスがあります</AlertDialogTitle>
          <AlertDialogDescription>
            開いているプロジェクトフォルダの外を指すパスが含まれています。続行しますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        {paths.length > 0 ? (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
            {paths.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>続行する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
