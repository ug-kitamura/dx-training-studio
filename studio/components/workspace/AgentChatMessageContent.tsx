"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import type { AgentFileAttachment } from "@/lib/agent-chat-storage";

// @ 参照は書込ルートの 2 系統（正本ツリーと作業ツリー）
const FILE_REF_RE = /(@(?:contents|contents-work)\/[^\s@]+)/g;
const FILE_REF_PREFIXES = ["@contents/", "@contents-work/"];

function isFileRef(part: string): boolean {
  return FILE_REF_PREFIXES.some((prefix) => part.startsWith(prefix));
}
const remarkPlugins = [remarkGfm];

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  ),
};

function FileRefChip({ path, name }: { path: string; name?: string }) {
  const fileName = name ?? path.split("/").pop() ?? path;
  return (
    <span className="mx-0.5 inline-flex rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-700 dark:text-violet-300">
      {fileName}
    </span>
  );
}

function MarkdownSegment({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}

function PlainTextContent({ content }: { content: string }) {
  const parts = content.split(FILE_REF_RE);
  return (
    <>
      {parts.map((part, index) => {
        if (isFileRef(part)) {
          return <FileRefChip key={`ref-${index}`} path={part.slice(1)} />;
        }
        if (!part) return null;
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </>
  );
}

function AttachmentChips({
  attachments,
}: {
  attachments: AgentFileAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {attachments.map((file) => (
        <FileRefChip
          key={file.path}
          path={file.path}
          name={file.name || file.path.split("/").pop()}
        />
      ))}
    </div>
  );
}

type Props = {
  content: string;
  variant?: "user" | "assistant";
  /** false のとき Markdown パースを省略（Agent タブ非表示時の負荷軽減） */
  richMarkdown?: boolean;
  attachments?: AgentFileAttachment[];
};

/** Agent チャットメッセージをプレビューに近い Markdown 表示で描画する */
export const AgentChatMessageContent = memo(function AgentChatMessageContent({
  content,
  variant = "assistant",
  richMarkdown = true,
  attachments,
}: Props) {
  const segments = useMemo(
    () => (richMarkdown ? content.split(FILE_REF_RE) : null),
    [content, richMarkdown],
  );
  const structured = attachments ?? [];

  if (!richMarkdown) {
    return (
      <div
        className={cn(
          "whitespace-pre-wrap break-words font-sans text-sm",
          variant === "user" && "agent-chat-message--user",
        )}
      >
        <AttachmentChips attachments={structured} />
        <PlainTextContent content={content} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "lesson-preview agent-chat-message break-words",
        variant === "user" && "agent-chat-message--user",
      )}
    >
      <AttachmentChips attachments={structured} />
      {segments?.map((part, index) => {
        if (isFileRef(part)) {
          return <FileRefChip key={`ref-${index}`} path={part.slice(1)} />;
        }
        if (!part) return null;
        return <MarkdownSegment key={`md-${index}`} content={part} />;
      })}
    </div>
  );
});
