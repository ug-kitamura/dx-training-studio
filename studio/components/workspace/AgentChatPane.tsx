"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FilePen,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AgentChatInput,
  type AgentFileOption,
} from "@/components/workspace/AgentChatInput";
import { AgentChatMessageContent } from "@/components/workspace/AgentChatMessageContent";
import { AgentToolCallBlock } from "@/components/workspace/AgentToolCallBlock";
import { BusySpinner } from "@/components/workspace/BusySpinner";
import { aiRequestHeaders, AI_KEY_ERROR } from "@/lib/agent-request-headers";
import {
  buildCreateDraftVariables,
  buildCreateStructureVariables,
} from "@/lib/agent/invoke-context";
import { extractMarkdownBlock } from "@/lib/extract-markdown-block";
import {
  consumeAgentStream,
  type ToolConfirmRequiredEvent,
} from "@/lib/agent/stream-client";
import type { AgentLogicalTurn, AgentToolEvent } from "@/lib/agent/llm/types";
import {
  addSession,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  downloadSessionMarkdown,
  formatMessageTimestamp,
  formatSessionUpdatedAt,
  isPlaceholderSessionTitle,
  getActiveSession,
  listSessionsSorted,
  normalizeStoredSessionTitle,
  SESSION_TITLE_MAX_LENGTH,
  switchSession,
  updateActiveSession,
  updateSessionTitle,
  type AgentChatMessage,
  type AgentChatStorage,
  type AgentFileAttachment,
} from "@/lib/agent-chat-storage";
import {
  AGENT_SUMMARY_PROMPT,
  formatSkillCatalogMessage,
  type AgentBuiltinCommand,
} from "@/lib/agent-chat-suggestions";
import {
  loadAgentSession,
  saveAgentSession,
} from "@/lib/agent-session-client";
import type {
  AgentChatController,
  AgentSessionChrome,
} from "@/lib/agent-chat-controller";
import { resolveModelLabel } from "@/lib/agent/model-labels";
import {
  normalizeDraftForLesson,
  type LessonMetaFields,
} from "@/lib/lesson-meta";
import { collectAllLessonTags } from "@/lib/lesson-tags";
import {
  loadWorkspaceSettings,
  WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/workspace-settings";
import {
  MetaDialogField,
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
} from "@/components/workspace/metaDialogLayout";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { cn } from "@/lib/utils";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { SkillSummary } from "@/lib/agent/skill-loader";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";
import { resolveInvokeSkillId } from "@/lib/agent/resolve-invoke-skill";
import {
  findOutsideProjectPathHints,
  listDefaultOutputDestinations,
  type OutputDestinationChoice,
  type OutputDestinationOption,
} from "@/lib/agent/skill-io-boundary";
import { OutsideProjectPathDialog } from "@/components/workspace/OutsideProjectPathDialog";
import { OutputDestinationDialog } from "@/components/workspace/OutputDestinationDialog";
import { SUBAGENT_FALLBACK_USER_MESSAGE } from "@/lib/agent/subagent-fallback";
import { IMAGE_IO_FALLBACK_USER_MESSAGE } from "@/lib/agent/image-io-fallback";

/** 開いているファイルのパスを作業フォルダ相対にする（範囲外なら undefined） */
function toWorkScopeRelativePath(
  currentFilePath: string | null,
  workScopeKey: string,
): string | undefined {
  if (!currentFilePath) return undefined;
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return undefined;
  const prefix = `${workScopeBaseDir(scope)}/`;
  if (!currentFilePath.startsWith(prefix)) return undefined;
  return currentFilePath.slice(prefix.length);
}

type Props = {
  /**
   * 作業スコープ文字列（`serializeWorkScope` の出力）。書込の基準・`@` 参照候補・
   * invoke の送信値に使う。**会話の保存先は決めない**（保存先は単一）。
   * 空文字はシリーズ 0 件（`contents/` 直下）を表す正当な値。
   */
  scopeKey: string;
  currentFilePath?: string | null;
  series?: Series[];
  lesson?: Lesson;
  course?: Course;
  /** @deprecated use currentFilePath */
  currentLessonPath?: string | null;
  onOpenSettings: () => void;
  onOverwriteEditor?: (
    markdown: string,
    metaPatch?: Partial<LessonMetaFields>,
  ) => void;
  agentChatControllerRef?: React.MutableRefObject<AgentChatController | null>;
  onControllerReady?: () => void;
  className?: string;
  richMarkdown?: boolean;
  /** スキルカタログ。フォルダ非依存なので親が保持する。 */
  skills?: SkillSummary[];
  skillsError?: string | null;
  /** スラッシュ候補を開いたとき一覧が空なら再取得を要求する */
  onEnsureSkills?: () => void;
};

function computeSessionFingerprint(
  nextMessages: AgentChatMessage[],
  nextSkillId: string | null,
): string {
  return JSON.stringify({
    messages: nextMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      toolEvents: message.toolEvents,
      toolTurns: message.toolTurns,
      attachments: message.attachments,
    })),
    activeSkillId: nextSkillId,
  });
}

function collectContextTagsFromMessages(
  messages: AgentChatMessage[],
): string[] {
  const tags: string[] = [];
  for (const message of messages) {
    for (const event of message.toolEvents ?? []) {
      if (
        event.phase === "end" &&
        event.name === "select_company_context" &&
        event.tags
      ) {
        tags.push(...event.tags);
      }
    }
  }
  return tags;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readModelLabelFromSettings(): string {
  return resolveModelLabel(loadWorkspaceSettings().aiModel);
}

async function postToolConfirmDecision(
  toolUseId: string,
  decision: "approve" | "reject",
  manualSearchText?: string,
): Promise<void> {
  try {
    await fetch("/api/agent/tool-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolUseId,
        decision,
        ...(manualSearchText !== undefined ? { manualSearchText } : {}),
      }),
    });
  } catch {
    // ストリーム側は TTL タイムアウトで安全側（拒否）に確定する
  }
}

export function AgentChatPane({
  scopeKey,
  currentFilePath,
  series = [],
  lesson,
  course,
  currentLessonPath,
  onOpenSettings,
  onOverwriteEditor,
  agentChatControllerRef,
  onControllerReady,
  className,
  richMarkdown = true,
  skills = [],
  skillsError = null,
  onEnsureSkills,
}: Props) {
  // フォーカスが変わると scopeId も変わる（リマウントはしない）。会話の保存先には
  // 使わず、invoke の送信値・`@` 参照候補・相対パスの基準としてだけ使う。
  // 空文字（シリーズ 0 件）も正当なスコープなので、未設定と区別しない。
  const scopeId = scopeKey;
  const filePath = currentFilePath ?? currentLessonPath ?? null;
  const [chatStorage, setChatStorage] = useState<AgentChatStorage | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AgentFileAttachment[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [subagentNoticeVisible, setSubagentNoticeVisible] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteSessionTargetId, setDeleteSessionTargetId] = useState<
    string | null
  >(null);
  const [editSessionTargetId, setEditSessionTargetId] = useState<string | null>(
    null,
  );
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    userMessage: AgentChatMessage;
    history: AgentChatMessage[];
  } | null>(null);

  const [overwriteTarget, setOverwriteTarget] = useState<{
    messageId: string;
    content: string;
  } | null>(null);

  const [pendingToolConfirm, setPendingToolConfirm] =
    useState<ToolConfirmRequiredEvent | null>(null);

  const [outsidePaths, setOutsidePaths] = useState<string[]>([]);
  const [outsideDialogOpen, setOutsideDialogOpen] = useState(false);
  const [outputOptions, setOutputOptions] = useState<OutputDestinationOption[]>(
    [],
  );
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);
  const [selectedOutputId, setSelectedOutputId] =
    useState<OutputDestinationChoice | null>(null);
  const [imageIoDialogOpen, setImageIoDialogOpen] = useState(false);
  const [lastTurnTokens, setLastTurnTokens] = useState<number | null>(null);
  const [sessionTokenTotal, setSessionTokenTotal] = useState(0);
  const pendingInvokeRef = useRef<{
    userMessage: AgentChatMessage;
    history: AgentChatMessage[];
    skillId: string;
    outsideConfirmed?: boolean;
    imageIoConfirmed?: boolean;
    preferredOutputDir?: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const addAttachmentRef = useRef<
    ((attachment: AgentFileAttachment) => void) | null
  >(null);
  const stopContextRef = useRef<{
    userMessage: AgentChatMessage;
    assistantId: string;
  } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const llmTitleGeneratedSessionIdRef = useRef<string | null>(null);
  const titleGenerationInFlightRef = useRef(false);
  const controllerListenersRef = useRef(new Set<() => void>());
  const sessionChromeRef = useRef<AgentSessionChrome | null>(null);
  const stickToBottomRef = useRef(true);
  const sessionSwitchRef = useRef<string | null>(null);
  const chatStorageRef = useRef<AgentChatStorage | null>(null);
  const messagesRef = useRef<AgentChatMessage[]>([]);
  const activeSkillIdRef = useRef<string | null>(null);
  // トークン表示はセッションに永続化して、フォルダ往復後も残す
  const lastTurnTokensRef = useRef<number | null>(null);
  const sessionTokenTotalRef = useRef(0);
  // 切替中断時に保留中の tool 確認を解決するため、最新値を ref で参照する
  const pendingToolConfirmRef = useRef<ToolConfirmRequiredEvent | null>(null);
  const lastPersistedFingerprintRef = useRef("");
  const persistTimerRef = useRef<number | null>(null);
  // 未送信の入力（本文＋添付）。フォーカス変更でリマウントしないため、
  // 退避の仕組みは要らず state のまま保持される。
  const inputRef = useRef("");
  const attachmentsRef = useRef<AgentFileAttachment[]>([]);

  useEffect(() => {
    chatStorageRef.current = chatStorage;
  }, [chatStorage]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeSkillIdRef.current = activeSkillId;
  }, [activeSkillId]);

  useEffect(() => {
    lastTurnTokensRef.current = lastTurnTokens;
  }, [lastTurnTokens]);

  useEffect(() => {
    sessionTokenTotalRef.current = sessionTokenTotal;
  }, [sessionTokenTotal]);

  useEffect(() => {
    pendingToolConfirmRef.current = pendingToolConfirm;
  }, [pendingToolConfirm]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const buildStorageSnapshot = useCallback((): AgentChatStorage | null => {
    const storage = chatStorageRef.current;
    if (!storage) return null;
    return updateActiveSession(storage, {
      messages: messagesRef.current,
      activeSkillId: activeSkillIdRef.current,
      lastTurnTokens: lastTurnTokensRef.current,
      sessionTokenTotal: sessionTokenTotalRef.current,
    });
  }, []);

  const flushSessionToStorage = useCallback(
    async (): Promise<boolean> => {
      const snapshot = buildStorageSnapshot();
      if (!snapshot) return true;
      const ok = await saveAgentSession(snapshot);
      if (!ok) {
        setStorageWarning(
          "セッションの保存に失敗しました。容量不足の可能性があります。会話を続けると履歴が失われることがあります。",
        );
      } else {
        setStorageWarning(null);
      }
      return ok;
    },
    [buildStorageSnapshot],
  );

  const scheduleDebouncedPersist = useCallback(() => {
    if (sessionSwitchRef.current === null) return;

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;

      const fingerprint = computeSessionFingerprint(
        messagesRef.current,
        activeSkillIdRef.current,
      );
      if (fingerprint === lastPersistedFingerprintRef.current) return;

      void flushSessionToStorage().then(() => {
        lastPersistedFingerprintRef.current = fingerprint;
      });
    }, 800);
  }, [flushSessionToStorage]);

  const scrollChatToBottom = useCallback(() => {
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollChatToBottom();
  }, [messages, isStreaming, streamingAssistantId, scrollChatToBottom]);

  useEffect(() => {
    const syncModelLabel = () => {
      setModelLabel(readModelLabelFromSettings());
    };
    syncModelLabel();
    window.addEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, syncModelLabel);
    return () => {
      window.removeEventListener(
        WORKSPACE_SETTINGS_CHANGED_EVENT,
        syncModelLabel,
      );
    };
  }, []);

  const activeSession = useMemo(
    () => (chatStorage ? getActiveSession(chatStorage) : undefined),
    [chatStorage],
  );

  const sortedSessions = useMemo(
    () => (chatStorage ? listSessionsSorted(chatStorage) : []),
    [chatStorage],
  );

  const activeSkill = useMemo(
    () => skills.find((skill) => skill.id === activeSkillId) ?? null,
    [skills, activeSkillId],
  );

  const persistSession = useCallback(
    (
      nextMessages: AgentChatMessage[],
      nextSkillId: string | null,
      titleOverride?: string,
    ) => {
      setChatStorage((prev) => {
        if (!prev) return prev;
        const current = getActiveSession(prev);
        const title =
          titleOverride ??
          (current?.title === DEFAULT_SESSION_TITLE &&
          nextMessages.some((message) => message.role === "user")
            ? deriveSessionTitle(
                nextMessages.find((message) => message.role === "user")
                  ?.content ?? "",
              )
            : (current?.title ?? DEFAULT_SESSION_TITLE));
        return updateActiveSession(prev, {
          messages: nextMessages,
          activeSkillId: nextSkillId,
          title,
          lastTurnTokens: lastTurnTokensRef.current,
          sessionTokenTotal: sessionTokenTotalRef.current,
        });
      });
      scheduleDebouncedPersist();
    },
    [scheduleDebouncedPersist],
  );

  const maybeGenerateSessionTitle = useCallback(async () => {
    const storage = chatStorageRef.current;
    if (!storage || titleGenerationInFlightRef.current) return;

    const sessionId = storage.activeSessionId;
    if (llmTitleGeneratedSessionIdRef.current === sessionId) return;

    const currentMessages = messagesRef.current;
    const firstUserMessage = currentMessages.find(
      (message) => message.role === "user",
    );
    const hasAssistantReply = currentMessages.some(
      (message) => message.role === "assistant" && message.content.trim(),
    );
    if (!firstUserMessage || !hasAssistantReply) return;

    const currentSession = getActiveSession(storage);
    if (!currentSession) return;
    if (
      !isPlaceholderSessionTitle(currentSession.title, firstUserMessage.content)
    ) {
      llmTitleGeneratedSessionIdRef.current = sessionId;
      return;
    }

    titleGenerationInFlightRef.current = true;
    try {
      const settings = loadWorkspaceSettings();
      const res = await fetch("/api/agent/session/title", {
        method: "POST",
        headers: aiRequestHeaders(settings),
        body: JSON.stringify({
          messages: currentMessages
            .filter(
              (message) =>
                message.role === "user" || message.role === "assistant",
            )
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        }),
      });
      if (!res.ok) return;

      const data = (await res.json()) as { title?: string };
      const title = data.title?.trim();
      if (!title) return;

      llmTitleGeneratedSessionIdRef.current = sessionId;
      persistSession(currentMessages, activeSkillIdRef.current, title);
    } catch {
      // タイトル生成失敗はサイレントにフォールバック
    } finally {
      titleGenerationInFlightRef.current = false;
    }
  }, [persistSession]);

  useEffect(() => {
    if (sessionSwitchRef.current === null) return;
    if (!chatStorageRef.current) return;
    persistSession(messages, activeSkillId);
  }, [messages, activeSkillId, persistSession]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const snapshot = buildStorageSnapshot();
      if (!snapshot) return;
      void saveAgentSession(snapshot);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [buildStorageSnapshot]);

  // アンマウント時の後始末。フォーカス変更ではリマウントしないため、ここが走るのは
  // 本当にペインが消えるときだけ。未送信入力は state のまま保持されるので退避しない。
  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      void flushSessionToStorage();
    };
  }, [flushSessionToStorage]);

  const loadContentFiles = useCallback(async () => {
    const params = new URLSearchParams({ scope: scopeId });
    if (filePath) params.set("current", filePath);
    const res = await fetch(`/api/agent/files?${params.toString()}`);
    const data = (await res.json()) as { files?: AgentFileOption[] };
    return data.files ?? [];
  }, [scopeId, filePath]);

  const buildVariables = useCallback(
    (skillId: string): Record<string, string> | { error: string } => {
      if (skillId === "create-structure") {
        return buildCreateStructureVariables(series);
      }
      if (skillId === "create-draft") {
        if (!lesson) {
          return { error: "create-draft スキルはレッスン選択が必要です" };
        }
        return buildCreateDraftVariables({
          lesson,
          lessonBody: lesson.content,
          courseMeta: {
            name: course?.name ?? lesson.course,
            target: course?.target ?? "",
            cross_series_prev: course?.cross_series_prev ?? [],
            cross_series_next: course?.cross_series_next ?? [],
          },
          availableTags: collectAllLessonTags(series),
        });
      }
      return {};
    },
    [series, lesson, course],
  );

  const handleStop = useCallback(() => {
    const stopContext = stopContextRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingAssistantId(null);
    setSubagentNoticeVisible(false);
    setRetryPayload(null);
    setError(null);

    if (stopContext) {
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== stopContext.userMessage.id &&
            message.id !== stopContext.assistantId,
        ),
      );
      setInput(stopContext.userMessage.content);
      stopContextRef.current = null;
    }
  }, []);

  /**
   * フォルダ切替に伴う中断（A 案）。進行中ストリームを abort するが、停止ボタンと違い
   * 入力欄への復元はしない。partial な assistant 応答（本文あり）は残して永続化する。
   * 本文が空の assistant プレースホルダのみ取り除く。
   */
  const interruptForSwitch = useCallback(() => {
    if (!abortRef.current) return;
    const stopContext = stopContextRef.current;
    abortRef.current.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingAssistantId(null);
    setSubagentNoticeVisible(false);
    // 開いている tool 確認は宙吊りにせず拒否で閉じる（サーバ側は abort signal でも
    // 解決されるが、クライアント表示を確実に閉じ、明示的に reject を送る）
    const pending = pendingToolConfirmRef.current;
    if (pending) {
      void postToolConfirmDecision(pending.toolUseId, "reject");
      setPendingToolConfirm(null);
    }
    if (stopContext) {
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== stopContext.assistantId || message.content,
        ),
      );
      stopContextRef.current = null;
    }
  }, []);

  const invokeSkill = useCallback(
    async (options: {
      userMessage: AgentChatMessage;
      history: AgentChatMessage[];
      skillId: string;
      preferredOutputDir?: string;
    }) => {
      const variablesResult = buildVariables(options.skillId);
      if ("error" in variablesResult) {
        setError(variablesResult.error);
        return;
      }

      const assistantId = createMessageId();
      const assistantCreatedAt = new Date().toISOString();

      // 再送時は同じ userMessage が既に残っている（失敗時に assistant のみ削除するため）。
      // 同じ id を再追加すると React の key 重複になるので、未追加のときだけ足す。
      setMessages((prev) => {
        const hasUser = prev.some(
          (message) => message.id === options.userMessage.id,
        );
        return [
          ...(hasUser ? prev : [...prev, options.userMessage]),
          {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: assistantCreatedAt,
            toolEvents: [],
          },
        ];
      });
      setIsStreaming(true);
      setStreamingAssistantId(assistantId);
      setSubagentNoticeVisible(
        Boolean(
          skills.find((skill) => skill.id === options.skillId)
            ?.mentionsSubagent,
        ),
      );
      setError(null);
      setRetryPayload({
        userMessage: options.userMessage,
        history: options.history,
      });
      stopContextRef.current = {
        userMessage: options.userMessage,
        assistantId,
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const settings = loadWorkspaceSettings();
      const currentRelative = toWorkScopeRelativePath(filePath, scopeId);
      const payload = {
        skillId: options.skillId,
        variables: variablesResult,
        messages: [...options.history, options.userMessage].map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.toolEvents ? { toolEvents: message.toolEvents } : {}),
          ...(message.toolTurns ? { toolTurns: message.toolTurns } : {}),
          ...(message.attachments ? { attachments: message.attachments } : {}),
        })),
        runtimeFocus: {
          workScopeKey: scopeId,
          currentFileRelativePath: currentRelative ?? null,
          ...(options.preferredOutputDir !== undefined
            ? { preferredOutputDir: options.preferredOutputDir }
            : {}),
        },
      };

      const toolEvents: AgentToolEvent[] = [];
      const toolTurns: AgentLogicalTurn[] = [];

      try {
        const res = await fetch("/api/agent/invoke", {
          method: "POST",
          headers: aiRequestHeaders(settings),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = "スキル実行に失敗しました";
          try {
            const data = (await res.json()) as { error?: string };
            message = data.error ?? message;
          } catch {
            // ignore
          }
          // キー未設定の 401 はサーバーが AI_KEY_ERROR（共有定数）をそのまま返す
          throw new Error(message);
        }

        await consumeAgentStream(
          res,
          {
            onDelta: (delta) => {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + delta }
                    : message,
                ),
              );
            },
            onToolStart: (event) => {
              toolEvents.push(event);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, toolEvents: [...toolEvents] }
                    : message,
                ),
              );
            },
            onToolEnd: (event) => {
              toolEvents.push(event);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, toolEvents: [...toolEvents] }
                    : message,
                ),
              );
            },
            onLogicalTurn: (turn) => {
              toolTurns.push(turn);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, toolTurns: [...toolTurns] }
                    : message,
                ),
              );
            },
            onTokenUsage: (event) => {
              setLastTurnTokens(event.outputTokens);
              setSessionTokenTotal((prev) => prev + event.outputTokens);
            },
            onConfirmRequired: (event) => {
              setPendingToolConfirm(event);
            },
            onUnknownConfirmKind: (event) => {
              // クライアントが表示できない確認種別。ダイアログを出せないまま
              // サーバ側の確認待ち（5 分 TTL）を無言で待たせないよう即時拒否する。
              void postToolConfirmDecision(event.toolUseId, "reject");
            },
          },
          controller.signal,
        );
        stopContextRef.current = null;
        await maybeGenerateSessionTitle();
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "スキル実行に失敗しました";
        setError(message);
        setMessages((prev) =>
          prev.filter((message) => message.id !== assistantId),
        );
        stopContextRef.current = null;
        if (message === AI_KEY_ERROR) {
          onOpenSettings();
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
        setStreamingAssistantId(null);
        setSubagentNoticeVisible(false);
      }
    },
    [
      buildVariables,
      filePath,
      scopeId,
      maybeGenerateSessionTitle,
      onOpenSettings,
      skills,
    ],
  );

  const beginInvokeWithGuards = useCallback(
    async (options: {
      userMessage: AgentChatMessage;
      history: AgentChatMessage[];
      skillId: string;
      outsideConfirmed?: boolean;
      imageIoConfirmed?: boolean;
      preferredOutputDir?: string;
    }) => {
      if (
        !options.imageIoConfirmed &&
        skills.find((skill) => skill.id === options.skillId)?.mentionsImageIO
      ) {
        pendingInvokeRef.current = options;
        setImageIoDialogOpen(true);
        return;
      }

      if (!options.outsideConfirmed) {
        const hints = findOutsideProjectPathHints(
          options.userMessage.content,
        );
        if (hints.length > 0) {
          pendingInvokeRef.current = options;
          setOutsidePaths(hints);
          setOutsideDialogOpen(true);
          return;
        }
      }

      if (
        options.preferredOutputDir === undefined &&
        options.skillId !== "general-chat" &&
        /出力|export|書き込|保存先|ファイルに|output/i.test(
          options.userMessage.content,
        )
      ) {
        const currentRelative = toWorkScopeRelativePath(filePath, scopeId);
        const destinations = listDefaultOutputDestinations(
          scopeId,
          currentRelative,
        );
        if (destinations.length > 1) {
          pendingInvokeRef.current = options;
          setOutputOptions(destinations);
          setSelectedOutputId(destinations[0]?.id ?? null);
          setOutputDialogOpen(true);
          return;
        }
        if (destinations.length === 1) {
          await invokeSkill({
            ...options,
            preferredOutputDir: destinations[0].relativeDir,
          });
          return;
        }
      }

      await invokeSkill(options);
    },
    [filePath, scopeId, invokeSkill, skills],
  );

  const handleSend = useCallback(
    async (attachments: AgentFileAttachment[] = []) => {
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;

      const skillId = resolveInvokeSkillId(activeSkillId);

      if (skillId === "create-draft" && !lesson) {
        setError("create-draft スキルはレッスン選択が必要です");
        return;
      }

      const userMessage: AgentChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        ...(attachments.length > 0 ? { attachments } : {}),
      };
      stickToBottomRef.current = true;
      // 入力を空にすれば、アンマウント時の後始末が下書きを破棄する。
      // 下書き Map への書き込み口はそこ 1 箇所に集約する。
      setInput("");
      setAttachments([]);
      await beginInvokeWithGuards({
        userMessage,
        history: messages,
        skillId,
      });
    },
    [
      activeSkillId,
      beginInvokeWithGuards,
      input,
      isStreaming,
      lesson,
      messages,
    ],
  );

  const handleRetry = useCallback(async () => {
    if (!retryPayload || isStreaming) return;
    await beginInvokeWithGuards({
      userMessage: retryPayload.userMessage,
      history: retryPayload.history,
      skillId: resolveInvokeSkillId(activeSkillId),
    });
  }, [activeSkillId, beginInvokeWithGuards, isStreaming, retryPayload]);

  const applySessionState = useCallback(
    (sessionId: string, storage: AgentChatStorage) => {
      const session = storage.sessions.find((item) => item.id === sessionId);
      if (!session) return;
      sessionSwitchRef.current = session.id;
      // 過去の再送バグ等で同 id が残っていても描画キーが衝突しないよう、先勝ちで重複を落とす
      const seen = new Set<string>();
      const deduped = session.messages.filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      });
      setMessages(deduped);
      setActiveSkillId(session.activeSkillId);
      setInput("");
      setAttachments([]);
      setError(null);
      setRetryPayload(null);
      // トークン表示は無条件リセットせず、保存値から復元する（往復しても残す）
      setLastTurnTokens(session.lastTurnTokens ?? null);
      setSessionTokenTotal(session.sessionTokenTotal ?? 0);
    },
    [],
  );

  // 保存先は単一なので、読み込むのはマウント時の 1 度だけ。
  // **フォーカス変更で読み直さない** — 内容は同じで、実行中の会話の表示を失うだけになる。
  // そのため scopeId を依存に入れてはいけない。
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storage = await loadAgentSession();
      if (cancelled) return;

      setChatStorage(storage);
      applySessionState(storage.activeSessionId, storage);
      sessionSwitchRef.current = storage.activeSessionId;
    })();

    return () => {
      cancelled = true;
    };
  }, [applySessionState]);

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (!chatStorage || sessionId === chatStorage.activeSessionId) {
        setHistoryOpen(false);
        return;
      }
      if (
        input.trim() &&
        !window.confirm("入力中の内容は失われます。切り替えますか？")
      ) {
        return;
      }
      persistSession(messages, activeSkillId);
      const next = switchSession(chatStorage, sessionId);
      void saveAgentSession(next);
      setChatStorage(next);
      applySessionState(sessionId, next);
      setHistoryOpen(false);
    },
    [
      activeSkillId,
      applySessionState,
      chatStorage,
      input,
      messages,
      persistSession,
    ],
  );

  const handleNewSession = useCallback(() => {
    if (!chatStorage) return;
    if (
      input.trim() &&
      !window.confirm("入力中の内容は失われます。新規会話を開始しますか？")
    ) {
      return;
    }
    persistSession(messages, activeSkillId);
    const next = addSession(chatStorage);
    void saveAgentSession(next);
    setChatStorage(next);
    applySessionState(next.activeSessionId, next);
    setHistoryOpen(false);
  }, [
    activeSkillId,
    applySessionState,
    chatStorage,
    input,
    messages,
    persistSession,
  ]);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (!chatStorage) return;
      const wasActive = sessionId === chatStorage.activeSessionId;
      const next = deleteSession(chatStorage, sessionId);
      void saveAgentSession(next);
      setChatStorage(next);
      if (wasActive) {
        applySessionState(next.activeSessionId, next);
      }
      setDeleteSessionTargetId(null);
      setHistoryOpen(false);
    },
    [applySessionState, chatStorage],
  );

  const requestDeleteSession = useCallback((sessionId: string) => {
    setDeleteSessionTargetId(sessionId);
  }, []);

  const openEditSessionTitle = useCallback((sessionId: string) => {
    const session = chatStorageRef.current?.sessions.find(
      (item) => item.id === sessionId,
    );
    if (!session) return;
    setEditSessionTargetId(sessionId);
    setEditTitleDraft(session.title);
  }, []);

  const handleSaveSessionTitle = useCallback(() => {
    if (!chatStorage || !editSessionTargetId) return;
    const normalized = normalizeStoredSessionTitle(editTitleDraft);
    if (!normalized) return;

    const next = updateSessionTitle(
      chatStorage,
      editSessionTargetId,
      normalized,
    );
    void saveAgentSession(next);
    setChatStorage(next);
    llmTitleGeneratedSessionIdRef.current = editSessionTargetId;
    setEditSessionTargetId(null);
    setEditTitleDraft("");
  }, [chatStorage, editSessionTargetId, editTitleDraft]);

  const canSaveEditTitle =
    normalizeStoredSessionTitle(editTitleDraft).length > 0;

  const sessionTitle = activeSession?.title ?? DEFAULT_SESSION_TITLE;

  // スキル取得の失敗は親が持つため、state へ複製せず表示時に合流させる
  const displayError = error ?? skillsError;

  const notifyControllerListeners = useCallback(() => {
    for (const listener of controllerListenersRef.current) {
      listener();
    }
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [historyOpen]);

  useEffect(() => {
    sessionChromeRef.current = {
      sessionTitle,
      isStreaming,
      workScopeKey: scopeId,
    };
    notifyControllerListeners();
  }, [sessionTitle, isStreaming, scopeId, notifyControllerListeners]);

  useEffect(() => {
    if (!agentChatControllerRef) return;
    agentChatControllerRef.current = {
      isStreaming: () => isStreaming,
      getSessionChrome: () => sessionChromeRef.current,
      subscribe: (listener) => {
        controllerListenersRef.current.add(listener);
        return () => {
          controllerListenersRef.current.delete(listener);
        };
      },
      addFileAttachment: (attachment) => {
        addAttachmentRef.current?.(attachment);
      },
      interruptForSwitch: () => {
        interruptForSwitch();
      },
    };
    onControllerReady?.();
    return () => {
      agentChatControllerRef.current = null;
    };
  }, [
    agentChatControllerRef,
    isStreaming,
    interruptForSwitch,
    onControllerReady,
  ]);

  const handleBuiltinCommand = useCallback(
    (command: AgentBuiltinCommand["id"]) => {
      if (command === "clear") {
        if (chatStorage) {
          setDeleteSessionTargetId(chatStorage.activeSessionId);
        }
        return;
      }
      if (command === "export") {
        if (activeSession) {
          downloadSessionMarkdown({
            ...activeSession,
            messages,
            activeSkillId,
          });
        }
        return;
      }
      if (command === "skill") {
        const catalogMessage: AgentChatMessage = {
          id: createMessageId(),
          role: "assistant",
          content: formatSkillCatalogMessage(skills),
          createdAt: new Date().toISOString(),
        };
        stickToBottomRef.current = true;
        setMessages((prev) => [...prev, catalogMessage]);
        setError(null);
        setRetryPayload(null);
        requestAnimationFrame(() => scrollChatToBottom());
        return;
      }
      if (command === "summary") {
        if (isStreaming) return;
        const userMessage: AgentChatMessage = {
          id: createMessageId(),
          role: "user",
          content: AGENT_SUMMARY_PROMPT,
          createdAt: new Date().toISOString(),
        };
        stickToBottomRef.current = true;
        setInput("");
        void beginInvokeWithGuards({
          userMessage,
          history: messages,
          skillId: resolveInvokeSkillId(null),
        });
      }
    },
    [
      activeSession,
      activeSkillId,
      beginInvokeWithGuards,
      chatStorage,
      isStreaming,
      messages,
      scrollChatToBottom,
      skills,
    ],
  );

  const deleteSessionTarget = useMemo(
    () =>
      deleteSessionTargetId
        ? sortedSessions.find((session) => session.id === deleteSessionTargetId)
        : undefined,
    [deleteSessionTargetId, sortedSessions],
  );

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  }, []);

  const handleToolConfirmDecision = useCallback(
    async (decision: "approve" | "reject", manualSearchText?: string) => {
      const request = pendingToolConfirm;
      if (!request) return;
      setPendingToolConfirm(null);
      await postToolConfirmDecision(
        request.toolUseId,
        decision,
        manualSearchText,
      );
    },
    [pendingToolConfirm],
  );

  const handleConfirmOverwrite = useCallback(() => {
    if (!overwriteTarget || !onOverwriteEditor || !lesson) return;
    const extracted = extractMarkdownBlock(overwriteTarget.content);
    const contextItemTags = collectContextTagsFromMessages(messages);
    // 草稿は本文のみ。tags / estimated_minutes の補完はアプリが `.meta.json` へ書く
    const { body, metaPatch } = normalizeDraftForLesson(extracted, lesson, {
      availableTags: collectAllLessonTags(series),
      contextItemTags,
    });
    onOverwriteEditor(body, metaPatch);
    setOverwriteTarget(null);
  }, [lesson, messages, onOverwriteEditor, overwriteTarget, series]);

  return (
    <div
      className={cn("agent-chat-pane flex h-full min-h-0 flex-col", className)}
    >
      <div
        ref={historyRef}
        className="relative z-10 shrink-0 bg-[var(--agent-chat-pane-bg)] px-3 pt-3 pb-2"
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History className="size-3" />
            履歴
            <ChevronDown className="size-3" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-auto gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
            onClick={handleNewSession}
          >
            <Plus className="size-3" />
            新規
          </Button>
        </div>
        {historyOpen ? (
          <div className="absolute left-3 top-full z-30 mt-1 max-h-64 w-max max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex w-fit min-w-0 max-w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60",
                  session.id === chatStorage?.activeSessionId && "bg-muted",
                )}
              >
                <button
                  type="button"
                  className="block max-w-full truncate whitespace-nowrap text-left font-medium text-foreground"
                  title={session.title}
                  onClick={() => handleSwitchSession(session.id)}
                >
                  {session.title}
                </button>
                <div className="flex w-full min-w-0 items-center gap-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-muted-foreground"
                    onClick={() => handleSwitchSession(session.id)}
                  >
                    {session.activeSkillId ?? "スキル未選択"} ·{" "}
                    {session.messages.length} 件 ·{" "}
                    {formatSessionUpdatedAt(session.updatedAt)}
                  </button>
                  <WorkspaceTooltip
                    label="タイトルを編集"
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted-foreground"
                        aria-label="タイトルを編集"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditSessionTitle(session.id);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <WorkspaceTooltip
                    label="会話を削除"
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="会話を削除"
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDeleteSession(session.id);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {subagentNoticeVisible ? (
          <div
            className="shrink-0 border-b bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
            role="status"
          >
            {SUBAGENT_FALLBACK_USER_MESSAGE}
          </div>
        ) : null}
        {/* 背景色は祖先と同値だが、スクロール領域自身を不透明レイヤにするために
            ここへ置く。透明なままだと上に重なるフェードとの兼ね合いでスクロール
            時にテキストが重ね描きされ、太字でにじんで見えることがある。 */}
        <div
          ref={chatScrollRef}
          className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[var(--agent-chat-pane-bg)]"
          onScroll={(event) => {
            const element = event.currentTarget;
            const distanceFromBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            stickToBottomRef.current = distanceFromBottom < 80;
          }}
        >
          <div className="px-3 py-4">
            {richMarkdown ? (
              messages.length === 0 ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center">
                  <div className="flex max-w-md flex-col gap-3 text-sm text-muted-foreground">
                    <div className="text-center text-sm">
                      ── 注意とお願い ──
                    </div>
                    <p>
                      スキルに書かれた処理をすべてそのまま実行できるとは限りません。できないことは、代わりの進め方でお手伝いします。
                    </p>
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-status-done">
                            ✓
                          </td>
                          <td className="py-1">
                            この作業フォルダの中で、読む・書く・変換する
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-status-done">
                            ✓
                          </td>
                          <td className="py-1">
                            大きな成果物も分割して着実に仕上げる
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-status-done">
                            ✓
                          </td>
                          <td className="py-1">
                            スクリプトは確認のうえ実行します（外部への通信は原則しません）
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-destructive">
                            ✗
                          </td>
                          <td className="py-1">
                            スキルは自動で始まりません → / で選んでください
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-destructive">
                            ✗
                          </td>
                          <td className="py-1">
                            サブエージェントには対応していません →
                            同じセッション内で順に処理します
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-destructive">
                            ✗
                          </td>
                          <td className="py-1">
                            Web 検索は原則しません →
                            検索ワードをお渡しするので、結果と URL
                            を貼ってください
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-destructive">
                            ✗
                          </td>
                          <td className="py-1">
                            フォルダの外は触りません／ファイルは削除しません
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="w-6 py-1 pr-2 font-bold text-destructive">
                            ✗
                          </td>
                          <td className="py-1">
                            画像の生成・読み取りには対応していません
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {messages.map((message) => {
                    const isStreamingMessage =
                      isStreaming && message.id === streamingAssistantId;
                    const showActions =
                      message.role === "assistant" &&
                      !isStreamingMessage &&
                      Boolean(message.content);
                    const copied = copiedMessageId === message.id;

                    if (message.role === "user") {
                      return (
                        <div
                          key={message.id}
                          className="flex w-full justify-end"
                        >
                          <div className="max-w-[min(70%,28rem)] rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">
                            <AgentChatMessageContent
                              content={message.content}
                              variant="user"
                              richMarkdown={richMarkdown}
                              attachments={message.attachments}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className="flex w-full flex-col gap-2 text-sm"
                      >
                        {(message.toolEvents &&
                          message.toolEvents.length > 0) ||
                        (isStreamingMessage && pendingToolConfirm) ? (
                          <AgentToolCallBlock
                            events={message.toolEvents ?? []}
                            pendingConfirm={
                              isStreamingMessage ? pendingToolConfirm : null
                            }
                            onConfirmApprove={() =>
                              void handleToolConfirmDecision("approve")
                            }
                            onConfirmReject={() =>
                              void handleToolConfirmDecision("reject")
                            }
                            onConfirmManualSubmit={(text) =>
                              void handleToolConfirmDecision("approve", text)
                            }
                          />
                        ) : null}
                        {message.content ? (
                          <AgentChatMessageContent
                            content={message.content}
                            richMarkdown={richMarkdown}
                          />
                        ) : isStreamingMessage ? null : (
                          <span className="text-muted-foreground">...</span>
                        )}
                        {isStreamingMessage ? (
                          <BusySpinner
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-label="応答生成中"
                          />
                        ) : null}
                        {showActions ? (
                          <div className="flex items-center gap-2">
                            <WorkspaceTooltip
                              label={copied ? "コピー済み" : "コピー"}
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  aria-label={copied ? "コピー済み" : "コピー"}
                                  onClick={() =>
                                    void handleCopy(message.id, message.content)
                                  }
                                >
                                  {copied ? (
                                    <Check className="size-3.5" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                </Button>
                              }
                            />
                            {onOverwriteEditor && lesson ? (
                              <WorkspaceTooltip
                                label="エディタに上書き"
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    aria-label="エディタに上書き"
                                    onClick={() =>
                                      setOverwriteTarget({
                                        messageId: message.id,
                                        content: message.content,
                                      })
                                    }
                                  >
                                    <FilePen className="size-3.5" />
                                  </Button>
                                }
                              />
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTimestamp(message)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        </div>
        <div
          aria-hidden
          className="agent-chat-pane__scroll-fade agent-chat-pane__scroll-fade-top"
        />
        <div
          aria-hidden
          className="agent-chat-pane__scroll-fade agent-chat-pane__scroll-fade-bottom"
        />
      </div>

      {lastTurnTokens !== null ? (
        <div className="flex items-center justify-end gap-3 px-3 py-1 text-[11px] text-muted-foreground">
          <span>直近ターン: {lastTurnTokens.toLocaleString()} tokens</span>
          <span>
            セッション累計: {sessionTokenTotal.toLocaleString()} tokens
          </span>
        </div>
      ) : null}

      {storageWarning ? (
        <div className="flex items-center justify-between gap-2 bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <span>{storageWarning}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStorageWarning(null)}
          >
            閉じる
          </Button>
        </div>
      ) : null}

      {displayError ? (
        <div className="flex items-center justify-between gap-2 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{displayError}</span>
          {retryPayload ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleRetry()}
            >
              <RotateCcw className="size-3" />
              再送
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="relative z-10 shrink-0 bg-[var(--agent-chat-pane-bg)] px-3">
        <AgentChatInput
          value={input}
          onChange={setInput}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSend={(attachments) => void handleSend(attachments)}
          onAfterSend={() => {
            stickToBottomRef.current = true;
            requestAnimationFrame(() => scrollChatToBottom());
          }}
          onStop={handleStop}
          disabled={pendingToolConfirm !== null}
          isLoading={isStreaming}
          modelLabel={modelLabel}
          skills={skills}
          onEnsureSkills={onEnsureSkills}
          activeSkillId={activeSkillId}
          activeSkillName={activeSkill?.name ?? null}
          onActiveSkillChange={setActiveSkillId}
          onLoadContentFiles={loadContentFiles}
          onBuiltinCommand={handleBuiltinCommand}
          onRegisterAddAttachment={(fn) => {
            addAttachmentRef.current = fn;
          }}
        />
      </div>

      <AlertDialog
        open={deleteSessionTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSessionTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>会話を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSessionTarget
                ? `「${deleteSessionTarget.title}」を履歴から削除します。この操作は取り消せません。`
                : "この会話を履歴から削除します。この操作は取り消せません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSessionTargetId) {
                  handleDeleteSession(deleteSessionTargetId);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editSessionTargetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditSessionTargetId(null);
            setEditTitleDraft("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>会話タイトルを編集</DialogTitle>
          </DialogHeader>
          <div className={META_DIALOG_FORM}>
            <MetaDialogField>
              <Label htmlFor="session-title-edit">タイトル</Label>
              <Input
                id="session-title-edit"
                className={META_DIALOG_CONTROL}
                value={editTitleDraft}
                maxLength={SESSION_TITLE_MAX_LENGTH}
                onChange={(event) => setEditTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSaveEditTitle) {
                    event.preventDefault();
                    handleSaveSessionTitle();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                {editTitleDraft.trim().length}/{SESSION_TITLE_MAX_LENGTH} 文字
              </p>
            </MetaDialogField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditSessionTargetId(null);
                setEditTitleDraft("");
              }}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              disabled={!canSaveEditTitle}
              onClick={handleSaveSessionTitle}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={overwriteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOverwriteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>レッスン本文を上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              AI 応答の Markdown
              内容で現在のレッスン本文を置き換えます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              上書き
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ターン実行中の確認要求（overwrite / run-script / run-skill-script /
          generate-write / inline-assets / web-search / web-search-manual）は
          モーダルではなく、ペイン3のチャット欄に AgentToolCallBlock 経由で
          インライン表示する（ToolConfirmInlineCard）。Radix のポータル型
          モーダルを経由しないため、連続確認での状態残留は構造的に生じない。 */}

      <AlertDialog
        open={imageIoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            const pending = pendingInvokeRef.current;
            if (pending) {
              setInput(pending.userMessage.content);
              pendingInvokeRef.current = null;
            }
            setImageIoDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              画像・マルチモーダルには対応していません
            </AlertDialogTitle>
            <AlertDialogDescription>
              {IMAGE_IO_FALLBACK_USER_MESSAGE}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const pending = pendingInvokeRef.current;
                if (pending) {
                  setInput(pending.userMessage.content);
                  pendingInvokeRef.current = null;
                }
                setImageIoDialogOpen(false);
              }}
            >
              中止
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingInvokeRef.current;
                setImageIoDialogOpen(false);
                if (!pending) return;
                pendingInvokeRef.current = null;
                void beginInvokeWithGuards({
                  ...pending,
                  imageIoConfirmed: true,
                });
              }}
            >
              スキップして続行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OutsideProjectPathDialog
        open={outsideDialogOpen}
        paths={outsidePaths}
        onCancel={() => {
          const pending = pendingInvokeRef.current;
          if (pending) {
            setInput(pending.userMessage.content);
            pendingInvokeRef.current = null;
          }
          setOutsideDialogOpen(false);
          setOutsidePaths([]);
        }}
        onConfirm={() => {
          const pending = pendingInvokeRef.current;
          setOutsideDialogOpen(false);
          setOutsidePaths([]);
          if (!pending) return;
          pendingInvokeRef.current = null;
          void beginInvokeWithGuards({
            ...pending,
            outsideConfirmed: true,
          });
        }}
      />

      <OutputDestinationDialog
        open={outputDialogOpen}
        options={outputOptions}
        selectedId={selectedOutputId}
        onSelect={setSelectedOutputId}
        onCancel={() => {
          const pending = pendingInvokeRef.current;
          if (pending) {
            setInput(pending.userMessage.content);
            pendingInvokeRef.current = null;
          }
          setOutputDialogOpen(false);
          setOutputOptions([]);
          setSelectedOutputId(null);
        }}
        onConfirm={() => {
          const pending = pendingInvokeRef.current;
          const selected = outputOptions.find(
            (option) => option.id === selectedOutputId,
          );
          setOutputDialogOpen(false);
          setOutputOptions([]);
          setSelectedOutputId(null);
          if (!pending || !selected) return;
          pendingInvokeRef.current = null;
          void invokeSkill({
            ...pending,
            preferredOutputDir: selected.relativeDir,
          });
        }}
      />
    </div>
  );
}
