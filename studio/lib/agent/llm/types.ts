export type LlmRole = "user" | "assistant";

/** Anthropic prompt caching のブレークポイント指定（現状 ephemeral のみ） */
export type LlmCacheControl = { type: "ephemeral" };

export type LlmTextBlock = {
  type: "text";
  text: string;
  cache_control?: LlmCacheControl;
};

export type LlmToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  cache_control?: LlmCacheControl;
};

export type LlmToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  cache_control?: LlmCacheControl;
};

export type LlmContentBlock =
  | LlmTextBlock
  | LlmToolUseBlock
  | LlmToolResultBlock;

export type LlmMessage = {
  role: LlmRole;
  content: string | LlmContentBlock[];
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** tool_use の input JSON パースに失敗したとき true */
  inputParseError?: boolean;
  /** パース失敗時も残す不完全 JSON（path 抽出用） */
  partialJson?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** プロバイダ層が末尾のツール定義にのみ付与する（呼び出し側は設定しない） */
  cache_control?: LlmCacheControl;
};

export type ProviderTurnResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "unknown";
  /** プロバイダ usage 由来の出力トークン数（診断ログ用。取得できない場合は省略） */
  outputTokens?: number;
};

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "turn_complete"; result: ProviderTurnResult };

export type AgentToolEvent = {
  name: string;
  phase: "start" | "end";
  toolUseId?: string;
  input?: Record<string, unknown>;
  summary?: string;
  display: string;
  result?: string;
  tags?: string[];
};

/** 1 回の LLM turn（text および／または tool_use + tool_result） */
export type AgentLogicalTurn = {
  text?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result: string;
  }>;
};

export const MAX_AGENT_LOOP_TURNS = 24;

export const AGENT_LOOP_LIMIT_ERROR = "Agent loop limit exceeded";

/** ツール呼び出しなしで max_tokens 打ち切りとなったターンの自動継続回数の上限 */
export const MAX_TEXT_CONTINUATIONS_PER_TURN = 4;

/** max_tokens 自動継続時、モデルへ送る内部指示（既出部分を繰り返させない） */
export const AGENT_TEXT_CONTINUATION_PROMPT =
  "出力が上限で途中終了しました。直前の出力の続きだけを、既出部分を一切繰り返さずに出力してください。";

/** 自動継続が上限に達したとき、応答本文へ追記してユーザーへ明示する注記 */
export const AGENT_TEXT_CONTINUATION_LIMIT_NOTICE =
  "\n\n（出力が上限に達したため自動継続を打ち切りました。続きが必要な場合は「つづき」とお伝えください。）";

/**
 * 3値判定で「息切れ」と判定されたターンへ送る自動続行指示。
 * 軽量モデルが max_tokens 到達前に自発的にターンを終えるケースを救済する。
 */
export const AGENT_AUTO_NUDGE_PROMPT =
  "作業がまだ完了していません。確認を待たずに残りの作業を続けてください。成果物に未置換のプレースホルダー（{{XXX}}）や未充填のマーカー区間があれば、該当ツールで埋めてください。";

/** 自動続行が上限または進捗なしで停止したときにユーザーへ明示する注記 */
export const AGENT_AUTO_NUDGE_LIMIT_NOTICE =
  "\n\n（自動続行を打ち切りました。続きが必要な場合は「つづき」とお伝えください。）";

/**
 * 自動続行が停止した時点で成果物に未充填の残作業が残っている場合に、黙って終了せず
 * 未完了を明示するための注記を組み立てる（残作業のあるファイルパスを列挙する）。
 */
export function buildIncompleteArtifactsNotice(paths: string[]): string {
  return `\n\n（自動続行を打ち切りました。未完了です。次のファイルに未充填のプレースホルダー（{{XXX}}）／マーカー区間が残っています: ${paths.join("、")}。続きが必要な場合は「つづき」とお伝えください。）`;
}

/** tool_result および連続失敗時に使う（実行はしない） */
export const AGENT_BROKEN_TOOL_USE_ERROR =
  "tool_use の入力 JSON を解釈できません（出力が途中で切れた可能性があります）";

export const AGENT_MISSING_PATH_ERROR =
  "必須の path（または from/to）が欠落または空です";

export const AGENT_MISSING_SCRIPT_INPUT_ERROR =
  "必須の code（または script_path）が欠落または空です";

export const AGENT_MISSING_GENERATE_INPUT_ERROR =
  "必須の path または instruction が欠落または空です";

/** generate_and_write がユーザーに拒否されたときの案内（本文埋め込みへの退避を防ぐ） */
export const GENERATE_REJECTED_GUIDANCE =
  "ユーザーが生成書込を拒否しました。write_file や run_script の引数に成果物本文を埋め込む代替を行わないでください（出力上限で失敗します）。拒否の理由や希望する進め方をユーザーに確認してください。";

/** generate_and_write の入力不備時にモデルへ返す具体的な修正案内 */
export const GENERATE_WRITE_INPUT_GUIDANCE =
  'generate_and_write の入力は {"purpose": "目的の一文", "path": "書込先パス", "instruction": "生成指示", "sections": ["セクション指示", ...], "context_paths": ["参照ファイル", ...]} です。成果物の本文を instruction や tool 引数に書かないでください。材料（アウトライン・収集メモ・模範例）は先にファイルへ書き出して context_paths で渡し、大きな成果物は sections で分割してください。';

/** run_script / run_skill_script の入力不備時にモデルへ返す具体的な修正案内 */
export const SCRIPT_INPUT_GUIDANCE =
  'run_script の入力は {"purpose": "目的の一文", "code": "CommonJS スクリプト本文", "writes": ["書込先パス"]} です。code フィールドの JSON 文字列としてスクリプト全文を渡してください（テキスト応答やコードフェンスに書いても実行されません）。code を短く保つため、成果物の本文を文字列リテラルで埋め込まず、ディスク上のファイル（md ドラフト・テンプレート等）を fs.readFileSync で読んで組み立ててください。run_skill_script はスキルに scripts/ が同梱されている場合のみ使えます。';

/** 応答が max_tokens で途中終了した場合に付す注記 */
export const MAX_TOKENS_TRUNCATION_NOTE =
  "直前の応答は出力トークン上限で途中終了しました。1 回の tool 引数に本文を載せず（ディスクから読む・断片に分けて差し込む）1 回の応答を短く保ってください。";

/** 巨大 write 失敗時にモデルへ返す汎用案内（スキル固有ロジックではない） */
export const LARGE_FILE_WRITE_GUIDANCE =
  "大きな成果物は本文を 1 つの tool 引数に載せないでください（write_file の content は 30,000 文字まで）。成果物の形で経路を選びます。(1) 額縁テンプレートがスキルにあるなら copy_file でプロジェクト内へコピーし、replace_in_file / replace_between（大きな本文は from_path）で 1 回数 KB の断片を順に差し込みます。必要なら append_file で partial を積みます。(2) モデルが新たに創作する長文（図解 HTML の本文等）なら generate_and_write で partial に生成し、replace_between（from_path）で差し込みます。材料はファイルへ書き出して context_paths で渡します。(3) 大量レコードの機械変換なら run_script。額縁や模範回答など大きな参照ファイルは、差し込み位置の把握に必要な範囲を超えて読み込まないでください。";

export const AGENT_REPEATED_TOOL_ERROR =
  "同一のツールエラーが連続したためエージェントを停止しました";

/** 同一エラー連続の許容回数（この回数まではモデルへ返し、+1 で停止） */
export const MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS = 2;
