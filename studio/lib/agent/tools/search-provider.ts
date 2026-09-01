/**
 * web_search のバックエンドを差し替え可能にするアダプタ層。
 * ツール契約（schema・確認 UX・結果の形）はバックエンドに依存しない。
 * 社内経路が確定した場合は、新しいアダプタ実装と設定値の追加のみで対応する。
 */

export type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchOutcome =
  | { ok: true; results: SearchResultItem[] }
  | { ok: false; error: string };

export type SearchProvider = {
  search(query: string): Promise<SearchOutcome>;
};

/** 返却する検索結果の件数上限（tool_result の肥大防止） */
export const SEARCH_RESULT_MAX = 6;
/** スニペットの文字数上限 */
export const SEARCH_SNIPPET_CHAR_LIMIT = 300;
const SEARCH_TIMEOUT_MS = 15_000;

/**
 * 検索が成立しなかったときに添える出典抑止の行動指示。
 * 検索未成立の 4 ケース（失敗・キー未設定・拒否・スキップ）へ共通で付与する。
 * 人手フォールバックで結果が入力された場合は正当な出典があるため付与しない。
 */
export const SEARCH_NO_CITATION_GUIDANCE =
  "web 検索で確認していない情報には出典 URL や出典表記を付けないでください（作業フォルダ内の資料に基づく記述は除く）。";

/** 検索失敗時にモデルへ返す行動指示（劣化契約） */
export const SEARCH_UNAVAILABLE_NOTICE = `この環境では web 検索が利用できません。再試行せず、検索なしで続行するか、必要な情報をユーザーに尋ねてください。${SEARCH_NO_CITATION_GUIDANCE}`;

/** 検索 API キー未設定時にモデルへ返す行動指示（劣化契約と同型） */
export const SEARCH_UNCONFIGURED_NOTICE = `web 検索が未設定のため利用できません（検索 API キーが設定されていません）。再試行せず、検索なしで続行するか、必要な情報をユーザーに尋ねてください。${SEARCH_NO_CITATION_GUIDANCE}`;

/** 拒否時にモデルへ返す案内 */
export const SEARCH_REJECTED_GUIDANCE = `ユーザーが web 検索を許可しませんでした。同じクエリを再要求せず、検索なしで続行してください。${SEARCH_NO_CITATION_GUIDANCE}`;

/** 人手フォールバックでユーザーがスキップしたときにモデルへ返す案内 */
export const SEARCH_MANUAL_SKIP_GUIDANCE = `ユーザーは web 検索をスキップしました。同じクエリを再要求せず、検索なしで続行してください。${SEARCH_NO_CITATION_GUIDANCE}`;

/** 人手フォールバックでユーザーが検索結果を貼り付けたときにモデルへ添える案内 */
export const SEARCH_MANUAL_RESULT_NOTICE =
  "以下はユーザーが手動で入力した検索結果とソース URL です。これを根拠として続行し、同じクエリを再要求しないでください。";

function normalizeSnippet(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_SNIPPET_CHAR_LIMIT);
}

/**
 * Tavily Search API（https://api.tavily.com/search）のアダプタ。
 */
export function createTavilySearchProvider(apiKey: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchOutcome> {
      let response: Response;
      try {
        response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: SEARCH_RESULT_MAX,
          }),
          signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        });
      } catch (error) {
        const reason =
          error instanceof Error && error.name === "TimeoutError"
            ? "タイムアウト"
            : "ネットワーク到達不可";
        return { ok: false, error: `検索 API に接続できません（${reason}）` };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error: "検索 API の認証に失敗しました（API キーを確認してください）",
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          error: `検索 API がエラーを返しました（HTTP ${response.status}）`,
        };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, error: "検索 API の応答を解釈できませんでした" };
      }

      const rawResults =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { results?: unknown }).results)
          ? (payload as { results: unknown[] }).results
          : [];

      const results: SearchResultItem[] = [];
      for (const entry of rawResults) {
        if (!entry || typeof entry !== "object") continue;
        const record = entry as Record<string, unknown>;
        const title =
          typeof record.title === "string" ? record.title.trim() : "";
        const url = typeof record.url === "string" ? record.url.trim() : "";
        if (!url) continue;
        results.push({
          title: title || url,
          url,
          snippet: normalizeSnippet(record.content ?? record.snippet),
        });
        if (results.length >= SEARCH_RESULT_MAX) break;
      }

      return { ok: true, results };
    },
  };
}

/**
 * リクエストから検索バックエンドを解決する。キー未設定なら null（劣化契約で返す）。
 */
export function resolveSearchProvider(req: Request): SearchProvider | null {
  const header = req.headers.get("x-search-api-key")?.trim();
  const key = header || process.env.SEARCH_API_KEY?.trim() || "";
  if (!key) return null;
  return createTavilySearchProvider(key);
}

/** web_search のセッション内サーキットブレーカー状態 */
export type SearchSessionState = {
  /** 最初の失敗以降 true。以降は確認ダイアログを出さず即座に劣化契約を返す */
  unavailable: boolean;
};
