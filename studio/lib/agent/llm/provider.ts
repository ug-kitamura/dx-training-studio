import type {
  LlmMessage,
  ProviderTurnResult,
  StreamEvent,
  ToolDefinition,
} from "@/lib/agent/llm/types";

export type LlmProviderRunOptions = {
  apiKey: string;
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
  signal?: AbortSignal;
  /**
   * モデルプロファイルの通過袋（プロバイダ固有パラメータ）。
   * 中身の語彙はプロバイダ実装が解釈し、未対応キーは黙って無視する契約。
   * anthropic プロバイダは現状すべてのキーを無視する。
   */
  providerParams?: Record<string, unknown>;
};

export interface LlmProvider {
  runTurn(options: LlmProviderRunOptions): Promise<ProviderTurnResult>;
  streamTurn(options: LlmProviderRunOptions): AsyncGenerator<StreamEvent>;
}
