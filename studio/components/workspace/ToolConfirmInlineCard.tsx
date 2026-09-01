"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ToolConfirmRequiredEvent } from "@/lib/agent/stream-client";

type Props = {
  request: ToolConfirmRequiredEvent;
  onApprove: () => void;
  onReject: () => void;
  onManualSubmit: (manualSearchText: string) => void;
};

const LEVEL_LABELS = {
  series: "シリーズ",
  course: "コース",
  lesson: "レッスン",
} as const;

function describeRequest(request: ToolConfirmRequiredEvent): {
  title: string;
  description: string;
  actionLabel: string;
} {
  switch (request.kind) {
    case "overwrite":
      return {
        title: "既存ファイルを上書きしますか？",
        description: `プロジェクト内の既存ファイルに上書きしようとしています。\n\n対象: ${request.path}\n\nこの操作は元に戻せません。`,
        actionLabel: "上書きする",
      };
    case "create-content-folder": {
      const folders = request.createFolder?.folders ?? [];
      const lines = folders.map((f) => `  ${LEVEL_LABELS[f.level]}「${f.name}」`);
      return {
        title: "新しいフォルダを作成しますか？",
        description: `教材ツリーに次のフォルダが新しく作られます。名前に打ち間違いがないか確認してください。\n\n${lines.join("\n")}\n\n対象: ${request.path}`,
        actionLabel: "作成する",
      };
    }
    case "run-script":
      return {
        title: "スクリプトを実行しますか？",
        description:
          request.script?.purpose?.trim() ||
          "AI が生成したスクリプトを実行しようとしています。",
        actionLabel: "実行を許可",
      };
    case "run-skill-script":
      return {
        title: "スキルのスクリプトを実行しますか？",
        description: `${request.script?.purpose?.trim() || "スキルに同梱されたスクリプトを実行しようとしています。"}\n\nスクリプト: ${request.script?.scriptPath ?? request.path}`,
        actionLabel: "実行を許可",
      };
    case "generate-write":
      return {
        title: "AI 生成でファイルを書き込みますか？",
        description: `${request.generate?.purpose?.trim() || "AI が本文を生成してファイルへ直接書き込もうとしています。"}\n\n対象: ${request.path}\n区別: ${request.isNew ? "新規作成" : "上書き"}\n\nサーバ内で追加の AI 呼び出しを実行し、生成された本文をこのファイルへ書き込みます。`,
        actionLabel: request.isNew ? "生成して作成" : "生成して上書き",
      };
    case "isolated-task": {
      const isFileTarget = request.path !== "(独立実行タスク)";
      return {
        title: "独立した文脈でタスクを実行しますか？",
        description: `${request.generate?.purpose?.trim() || "サブエージェント起動の代替として、親の会話とは独立した文脈でタスクを実行しようとしています。"}${
          isFileTarget
            ? `\n\n対象: ${request.path}\n区別: ${request.isNew ? "新規作成" : "上書き"}`
            : "\n\n結果はファイルに書き込まれず、テキストとして返されます。"
        }\n\nサーバ内で追加の AI 呼び出しを実行します。親の会話履歴は引き継ぎません。`,
        actionLabel: "実行を許可",
      };
    }
    case "inline-assets": {
      const targets: string[] = request.inlineAssets?.targets?.length
        ? request.inlineAssets.targets
        : [request.path];
      return {
        title: "CSS・アイコンを HTML へ埋め込みますか？",
        description: `生成した HTML から CDN 読み込みを取り除き、使用中のスタイルとアイコンをファイル内へ埋め込みます。単体で開いても表示が崩れなくなります。\n\n対象:\n${targets.map((t) => `  ${t}`).join("\n")}\n\n対象のファイルは上書きされ、ファイルサイズが増えます。`,
        actionLabel: "埋め込みを許可",
      };
    }
    case "web-search": {
      const query = request.search?.query ?? request.path;
      const purpose = request.search?.purpose?.trim();
      return {
        title: "web 検索を実行しますか？",
        description: `「${query}」について web 検索しますが、よろしいですか？${purpose ? `\n\n目的: ${purpose}` : ""}\n\nこのクエリは外部の検索サービスへ送信されます。`,
        actionLabel: "検索を許可",
      };
    }
    // 未知の種別でも確認を不可視のまま放置しない（TTL で自動拒否される事故の防止）
    default:
      return {
        title: "ツールの実行を許可しますか？",
        description: `AI が確認の必要な操作を実行しようとしています。\n\n種別: ${request.kind}\n対象: ${request.path}`,
        actionLabel: "実行を許可",
      };
  }
}

function ScriptConfirmDetails({
  script,
}: {
  script: NonNullable<ToolConfirmRequiredEvent["script"]>;
}) {
  return (
    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
      {script.networkWarning ? (
        <Badge variant="destructive">
          ネットワークアクセスの可能性があるコードを含みます
        </Badge>
      ) : null}
      {script.writes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">書き込み予定</span>
          <ul className="flex flex-col gap-1">
            {script.writes.map((write) => (
              <li key={write.path} className="flex items-center gap-2">
                <span className="truncate font-mono text-xs">{write.path}</span>
                {write.exists ? (
                  <Badge variant="destructive">上書き</Badge>
                ) : (
                  <Badge variant="secondary">新規</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {script.args && script.args.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">引数</span>
          <span className="font-mono text-xs">{script.args.join(" ")}</span>
        </div>
      ) : null}
      {script.code ? (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-xs select-none">
            コード全文を表示
          </summary>
          <pre className="bg-muted mt-2 max-h-60 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
            {script.code}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function GenerateConfirmDetails({
  generate,
}: {
  generate: NonNullable<ToolConfirmRequiredEvent["generate"]>;
}) {
  return (
    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
      {generate.marker ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            差し込み先の区間
          </span>
          <span className="font-mono text-xs">{generate.marker}</span>
          <span className="text-muted-foreground text-xs">
            ファイル全体は上書きされず、この区間だけが置き換わります
          </span>
        </div>
      ) : null}
      {generate.sections.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">セクション構成</span>
          <ol className="flex list-inside list-decimal flex-col gap-1">
            {generate.sections.map((section) => (
              <li key={section} className="truncate text-xs">
                {section}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {generate.contextPaths.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">参照ファイル</span>
          <ul className="flex flex-col gap-1">
            {generate.contextPaths.map((contextPath) => (
              <li key={contextPath} className="truncate font-mono text-xs">
                {contextPath}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {generate.instruction ? (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-xs select-none">
            生成指示の全文を表示
          </summary>
          <pre className="bg-muted mt-2 max-h-60 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
            {generate.instruction}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function ManualSearchInlineDetails({
  request,
  onSubmit,
  onSkip,
}: {
  request: ToolConfirmRequiredEvent;
  onSubmit: (manualSearchText: string) => void;
  onSkip: () => void;
}) {
  const query = request.search?.query ?? request.path;
  const purpose = request.search?.purpose?.trim();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const buildSubmitText = (): string => {
    const trimmedUrl = url.trim();
    const trimmedText = text.trim();
    if (!trimmedUrl) return trimmedText;
    return `ソース URL: ${trimmedUrl}\n\n${trimmedText}`;
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <span className="font-medium">web 検索は自分で行ってください</span>
      <p className="text-xs text-muted-foreground">
        この環境では web
        検索を自動実行できません。下記のワードでご自身で検索し、結果とソース URL
        を貼り付けてください。検索が不要ならスキップできます。
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">検索ワード</span>
        <span className="font-mono text-xs">{query}</span>
      </div>
      {purpose ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">目的</span>
          <span className="text-xs">{purpose}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          ソース URL（任意・空でも可）
        </span>
        <Input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">検索結果</span>
        <textarea
          className="min-h-32 w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
          placeholder="検索結果の要点を貼り付けてください"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onSkip}>
          スキップして続行
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!text.trim()}
          onClick={() => onSubmit(buildSubmitText())}
        >
          貼り付けて続行
        </Button>
      </div>
    </div>
  );
}

/**
 * ターン実行中に割り込む確認要求（overwrite / run-script / run-skill-script /
 * generate-write / inline-assets / web-search / web-search-manual）を、
 * Radix のポータル型モーダルではなくチャット欄内のカードとして表示する。
 * 応答があるまでチャット欄に残り続け、スクロールしても見返せる。
 */
export function ToolConfirmInlineCard({
  request,
  onApprove,
  onReject,
  onManualSubmit,
}: Props) {
  if (request.kind === "web-search-manual") {
    return (
      <ManualSearchInlineDetails
        request={request}
        onSubmit={onManualSubmit}
        onSkip={onReject}
      />
    );
  }

  const info = describeRequest(request);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <span className="font-medium">{info.title}</span>
      <p className="whitespace-pre-line text-xs text-muted-foreground">
        {info.description}
      </p>
      {request.script ? <ScriptConfirmDetails script={request.script} /> : null}
      {request.generate ? (
        <GenerateConfirmDetails generate={request.generate} />
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onReject}>
          拒否する
        </Button>
        <Button type="button" size="sm" onClick={onApprove}>
          {info.actionLabel}
        </Button>
      </div>
    </div>
  );
}
