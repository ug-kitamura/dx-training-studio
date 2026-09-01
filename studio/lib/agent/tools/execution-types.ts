import type { LlmProvider } from "@/lib/agent/llm/provider";
import type { ContextStorageMode } from "@/lib/schema";
import type {
  SearchProvider,
  SearchSessionState,
} from "@/lib/agent/tools/search-provider";

// ツール実行の共有型。registry と各ツール実装（framed-write-guard /
// generate-write / run-isolated-task）の双方が参照するため、循環を避けて
// leaf モジュールに置く。

export type ToolExecutionDisplay = {
  summary: string;
  display: string;
  tags?: string[];
};

export type ToolExecutionOutcome = {
  result: unknown;
  display: ToolExecutionDisplay;
};

export type ToolExecutionContext = {
  projectRoot: string;
  workScopeKey: string;
  skillId?: string;
  skillDirAbsolute?: string;
  /** ユーザー中断シグナル。スクリプト実行の子プロセスを abort で即 kill する */
  signal?: AbortSignal;
  /** web_search のバックエンドとサーキットブレーカー状態（agent loop が構築） */
  search?: {
    provider: SearchProvider | null;
    session: SearchSessionState;
  };
  /** generate_and_write の子 LLM 呼び出し設定（agent loop が構築） */
  generate?: {
    provider: LlmProvider;
    apiKey: string;
    model: string;
    maxTokens: number;
    signal?: AbortSignal;
    /** モデルプロファイルの通過袋（generate スロット）。プロバイダが解釈する */
    providerParams?: Record<string, unknown>;
  };
  /** dx 固有: 社内コンテキストの保存先モード（search/select_company_context が参照。差分台帳 #6） */
  contextMode?: ContextStorageMode;
};
