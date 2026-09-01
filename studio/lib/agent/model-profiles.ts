/**
 * モデルプロファイル: モデルごとの継続・出力制御値の一元管理。
 *
 * 2 層構造:
 * - EBEX 解釈層（maxOutputTokens・continuations）… EBEX 本体が読んで動作を変える
 * - 通過袋（providerParams）… プロバイダへ無解釈で渡す。中身の語彙はモデル系統
 *   ごとに異なる（OpenAI: reasoning_effort/verbosity、Gemini: thinkingBudget 等）。
 *   プロバイダは未対応キーを無視する契約（anthropic は全キーを無視）。
 *
 * 値は環境変数 DX_STUDIO_MODEL_PROFILES（JSON 文字列）で slug 単位に部分上書きできる。
 * 例: DX_STUDIO_MODEL_PROFILES={"gpt-5-nano":{"continuations":{"nudgeMax":15}}}
 */

export type ModelContinuations = {
  /** generate_and_write の 1 セクションあたり max_tokens 継続上限 */
  generatePerSection: number;
  /** ツール呼び出しなしターンの max_tokens 自動継続上限 */
  textPerTurn: number;
  /** ターン終了3値判定による自動続行（nudge）の総回数上限 */
  nudgeMax: number;
};

export type ModelProviderParams = {
  /** agent ループ本体（ツール選択を伴う）向け */
  agent?: Record<string, unknown>;
  /** generate_and_write の子生成（考えるより書く）向け */
  generate?: Record<string, unknown>;
};

export type ModelProfile = {
  maxOutputTokens: number;
  continuations: ModelContinuations;
  providerParams: ModelProviderParams;
};

/**
 * 未知モデルの既定: 締め側に倒した保守的プロファイル（EBEX とは逆向き）。
 * 接続先には従量課金の上位モデルが含まれるため、プロファイル未登録モデルが
 * 最も粘り強い設定で走る逆転を防ぐ。登録モデルには明示値を必ず持たせること。
 */
export const UNKNOWN_MODEL_PROFILE: ModelProfile = {
  maxOutputTokens: 32000,
  continuations: { generatePerSection: 4, textPerTurn: 4, nudgeMax: 2 },
  providerParams: {},
};

/**
 * Sonnet/Opus/Fable 系。非ストリーミング・社内ゲートウェイ運用のため、
 * Claude API の実上限（128,000）までは上げず、まず倍増した 64,000 で運用する。
 */
const CLAUDE_LARGE: ModelProfile = {
  maxOutputTokens: 64000,
  continuations: { generatePerSection: 4, textPerTurn: 4, nudgeMax: 2 },
  providerParams: {},
};

/**
 * Haiku 専用（軽量モデル）。gpt-5-nano と同じ 32,000 に揃えている。値そのものを
 * 上げる必然性より、社内ゲートウェイを経由しない環境（家PC等）で gpt-5-nano と
 * 同じ max_tokens を使って比較検証できるようにする目的が大きい
 * （token 数を揃えないと、タイムアウトの原因が「ゲートウェイ経由」なのか
 * 「単に生成量が多いから」なのかを切り分けられない）。
 */
const CLAUDE_SMALL: ModelProfile = {
  maxOutputTokens: 32000,
  continuations: { generatePerSection: 4, textPerTurn: 4, nudgeMax: 3 },
  providerParams: {},
};

/**
 * 初期値。Claude 系は従来定数の追認（挙動不変）。
 * gpt-5-nano は実測（1/3 サイズ入力で手動継続 4 回）からの余裕込み仮説値で、
 * 社内ゲートウェイの実効上限確認後に DX_STUDIO_MODEL_PROFILES で調整する想定。
 * gpt-5-nano は 32,000 上限・非ストリーミングで社内ゲートウェイ経由の間欠的
 * タイムアウトが実測されているため、上限を上げる方向の変更は行わない。
 */
const BASE_MODEL_PROFILES: Record<string, ModelProfile> = {
  "claude-sonnet-5": CLAUDE_LARGE,
  "claude-opus-5": CLAUDE_LARGE,
  "claude-fable-5": CLAUDE_LARGE,
  "claude-haiku-4-5": CLAUDE_SMALL,
  "gpt-5-nano": {
    maxOutputTokens: 32000,
    continuations: { generatePerSection: 8, textPerTurn: 8, nudgeMax: 10 },
    providerParams: {
      agent: { reasoning_effort: "medium", verbosity: "medium" },
      generate: { reasoning_effort: "minimal", verbosity: "high" },
    },
  },
};

type PartialProfile = {
  maxOutputTokens?: unknown;
  continuations?: Partial<Record<keyof ModelContinuations, unknown>>;
  providerParams?: {
    agent?: unknown;
    generate?: unknown;
  };
};

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mergeProfile(
  base: ModelProfile,
  override: PartialProfile,
): ModelProfile {
  const merged: ModelProfile = {
    maxOutputTokens:
      positiveInt(override.maxOutputTokens) ?? base.maxOutputTokens,
    continuations: { ...base.continuations },
    providerParams: {
      ...(base.providerParams.agent
        ? { agent: { ...base.providerParams.agent } }
        : {}),
      ...(base.providerParams.generate
        ? { generate: { ...base.providerParams.generate } }
        : {}),
    },
  };

  const cont = plainObject(override.continuations);
  if (cont) {
    for (const key of [
      "generatePerSection",
      "textPerTurn",
      "nudgeMax",
    ] as const) {
      const value = positiveInt(cont[key]);
      if (value !== null) merged.continuations[key] = value;
    }
  }

  const params = plainObject(override.providerParams);
  if (params) {
    for (const slot of ["agent", "generate"] as const) {
      const slotValue = plainObject(params[slot]);
      if (slotValue) {
        merged.providerParams[slot] = {
          ...(merged.providerParams[slot] ?? {}),
          ...slotValue,
        };
      }
    }
  }

  return merged;
}

let cachedOverridesRaw: string | undefined;
let cachedOverrides: Record<string, PartialProfile> = {};
let warnedInvalidOverrides = false;

function readOverrides(): Record<string, PartialProfile> {
  const raw =
    typeof process !== "undefined"
      ? process.env?.DX_STUDIO_MODEL_PROFILES
      : undefined;
  if (raw === cachedOverridesRaw) return cachedOverrides;
  cachedOverridesRaw = raw;
  cachedOverrides = {};
  if (!raw?.trim()) return cachedOverrides;
  try {
    const parsed = plainObject(JSON.parse(raw));
    if (parsed) {
      const result: Record<string, PartialProfile> = {};
      for (const [slug, value] of Object.entries(parsed)) {
        const profile = plainObject(value);
        if (profile) result[slug] = profile as PartialProfile;
      }
      cachedOverrides = result;
    }
  } catch {
    if (!warnedInvalidOverrides) {
      warnedInvalidOverrides = true;
      console.warn(
        "[model-profiles] DX_STUDIO_MODEL_PROFILES の JSON が不正なため無視します",
      );
    }
  }
  return cachedOverrides;
}

/** モデルのプロファイルを解決する（既定 → env 上書きの deep merge）。 */
export function resolveModelProfile(model: string): ModelProfile {
  const base = BASE_MODEL_PROFILES[model] ?? UNKNOWN_MODEL_PROFILE;
  const override = readOverrides()[model];
  return override ? mergeProfile(base, override) : mergeProfile(base, {});
}

/** 自動続行（3値判定 nudge）の無効化スイッチ。 */
export function isAutoNudgeDisabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.DX_STUDIO_AUTO_NUDGE === "disabled"
  );
}
