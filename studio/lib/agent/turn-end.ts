/**
 * ターン終了の3値判定（純関数）。
 * ツール呼び出しなしで max_tokens 以外の理由によりターンが終了したとき、
 * 「ユーザー待ち / 完了 / 息切れ」を判定する。判定に迷う場合は停止側
 * （user-wait / complete）へ倒し、スキルの確認フローを侵さない。
 */

export type TurnEndKind = "user-wait" | "complete" | "stalled";

/** 末尾が疑問符（全角・半角）で終わる */
const QUESTION_TAIL_RE = /[？?][\s)）」』]*$/;

/** ユーザーへの確認・入力依頼の定型表現（広めにマッチさせて停止側に倒す） */
const CONFIRM_RE =
  /(ご確認|確認してください|確認をお願い|よろしいでしょうか|よろしければ|問題なければ|お知らせください|教えてください|お伝えください|お聞かせください|選んでください|指定してください|入力してください|どうしますか|いかがでしょうか|いかがですか|お待ちしています|待機します|返信をお待ち)/;

/** 作業途中で切り上げたことを示す継続予告の表現 */
const CONTINUATION_CUE_RE =
  /(続きを|つづきを|続けます|続行します|継続します|残りの?(セクション|部分|作業|項目)|次の(ターン|ステップ|応答)で|後ほど(作成|生成|追加)|以降を(作成|生成|追加)|ここまでで一旦)/;

export type TurnEndInput = {
  /** ターンの最終テキスト */
  text: string;
  /** この invoke 内でツール呼び出しが 1 回以上あったか（作業中の証跡） */
  hadAnyToolCalls: boolean;
  /** 書込済み成果物に残る未置換プレースホルダー・未充填区間の総数 */
  leftoverArtifactCount: number;
};

export function classifyTurnEnd(input: TurnEndInput): TurnEndKind {
  const text = input.text.trim();

  // 1. 質問・確認依頼は必ずユーザー待ち（自動続行で確認フローを侵さない）
  if (text && (QUESTION_TAIL_RE.test(text) || CONFIRM_RE.test(text))) {
    return "user-wait";
  }

  // 2. 成果物に埋め残しがあれば作業未完（決定的シグナル）
  if (input.leftoverArtifactCount > 0) {
    return "stalled";
  }

  // 3. 作業中（ツール実行実績あり）かつ継続予告で終わっていれば息切れ
  if (input.hadAnyToolCalls && text && CONTINUATION_CUE_RE.test(text)) {
    return "stalled";
  }

  return "complete";
}

/**
 * 進捗判定: 直前の nudge 後テキストと比較して新しい内容が出ているか。
 * ツール呼び出しがあったターンは呼び出し側で無条件に進捗ありとして扱うこと。
 */
export function hasTextProgress(
  previousText: string,
  currentText: string,
): boolean {
  const prev = previousText.trim();
  const cur = currentText.trim();
  if (!cur) return false;
  if (!prev) return true;
  if (cur === prev) return false;
  // 直前出力の反復（部分一致）は進捗なしとみなす
  if (prev.includes(cur)) return false;
  return true;
}
