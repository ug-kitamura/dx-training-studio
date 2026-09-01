import fs from "node:fs";
import path from "node:path";
import {
  LARGE_FILE_WRITE_GUIDANCE,
  type ToolDefinition,
} from "@/lib/agent/llm/types";
import {
  executeSearchCompanyContext,
  SEARCH_COMPANY_CONTEXT_SCHEMA,
  type SearchCompanyContextInput,
} from "@/lib/agent/tools/search-company-context";
import {
  executeSelectCompanyContext,
  SELECT_COMPANY_CONTEXT_SCHEMA,
  type SelectCompanyContextInput,
} from "@/lib/agent/tools/select-company-context";
import {
  CONTENTS_DIR_NAME,
  CONTENTS_PLAN_DIR_NAME,
  isLessonMetaWritePath,
  resolveToolTargetPath,
} from "@/lib/agent/tools/fs-guard";
import { prepareLessonMetaWrite } from "@/lib/agent/tools/lesson-meta-write-guard";
import {
  framedWriteDivertOutcome,
  resolveFramedWriteTarget,
} from "@/lib/agent/tools/framed-write-guard";
import { executeGenerateAndWrite } from "@/lib/agent/tools/generate-write";
import { executeRunIsolatedTask } from "@/lib/agent/tools/run-isolated-task";
import { inlineHtmlAssets } from "@/lib/agent/tools/inline-html-assets";
import { isLikelySubagentToolName } from "@/lib/agent/subagent-fallback";
import {
  checkScriptSyntax,
  detectNetworkAccessHint,
  runScriptInSandbox,
} from "@/lib/agent/tools/script-sandbox";
import {
  SEARCH_UNAVAILABLE_NOTICE,
  SEARCH_UNCONFIGURED_NOTICE,
} from "@/lib/agent/tools/search-provider";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";
import {
  formatNotFoundError,
  scanTemplateResiduals,
  templateResidualCount,
  templateResidualMessage,
} from "@/lib/agent/tools/replace-feedback";

export type {
  ToolExecutionDisplay,
  ToolExecutionOutcome,
  ToolExecutionContext,
} from "@/lib/agent/tools/execution-types";
import type {
  ToolExecutionContext,
  ToolExecutionDisplay,
  ToolExecutionOutcome,
} from "@/lib/agent/tools/execution-types";

/** 書込ツール用。正本ツリーの構造を壊す書込を拒否させる。 */
function writePathOptions(context: ToolExecutionContext) {
  return { ...skillPathOptions(context, false), forWrite: true };
}

function skillPathOptions(
  context: ToolExecutionContext,
  preferSkillIfExists: boolean,
) {
  return {
    skillId: context.skillId,
    skillDirAbsolute: context.skillDirAbsolute,
    preferSkillIfExists,
  };
}

const SEARCH_RESULT_LIMIT = 50;
export const READ_CHAR_LIMIT = 100_000;
/**
 * write_file の content 文字数上限。
 * 正当な用途（Markdown ドラフト等、実測 5〜15KB）を妨げず、
 * 成果物本文全体を 1 引数に載せる事故（数十 KB の HTML 全文投棄）を弾く水準。
 * 超過時は書き込まず、経路対応を含む recoverable エラーを返す。
 */
export const WRITE_FILE_CHAR_LIMIT = 30_000;
const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

const TOOL_SCHEMAS = {
  list_files: {
    name: "list_files",
    description:
      "プロジェクトフォルダ、または実行中スキル配下のディレクトリ内のファイル・サブフォルダを一覧する。path 省略時はプロジェクト直下を対象とする。path がファイルのときはその 1 エントリだけを返す。スキル相対（例: references）はスキル側を優先する。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "一覧する scope のパス（ディレクトリまたはファイル。プロジェクト相対またはスキル相対。省略時はプロジェクト直下。ファイル時はその 1 件のみ返る）",
        },
      },
    },
  },
  glob_files: {
    name: "glob_files",
    description:
      "プロジェクトフォルダ配下、および実行中スキル配下でファイル名パターン（*, **, ? を含む glob）に一致するファイルを検索する。path 省略時の既定はプロジェクト直下。references/* などスキル側に実体があるパターンはスキルゾーンも検索する。",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "glob パターン（例: '**/*.md', 'references/*'）",
        },
        path: {
          type: "string",
          description:
            "検索基点の scope（ディレクトリまたはファイル。プロジェクト相対またはスキル相対、省略時はプロジェクト直下。ファイル時はそのパス／ファイル名が pattern に一致するかの 0/1 判定）",
        },
      },
      required: ["pattern"],
    },
  },
  search_content: {
    name: "search_content",
    description:
      "プロジェクトフォルダ配下、および実行中スキル配下のテキストファイル内容を検索する（grep 相当）。ヒット件数には上限がある。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索する文字列" },
        path: {
          type: "string",
          description:
            "検索基点の scope（ディレクトリまたはファイル。プロジェクト相対またはスキル相対、省略時はプロジェクト直下。ファイル時はそのファイルだけを検索する）",
        },
      },
      required: ["query"],
    },
  },
  read_file: {
    name: "read_file",
    description:
      "指定パスのファイル内容を読み取る。文字数上限を超える場合は切り詰められる。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "読み取るファイルのパス（プロジェクト相対）",
        },
      },
      required: ["path"],
    },
  },
  write_file: {
    name: "write_file",
    description:
      "指定パスにファイルを書き込む。既存ファイルへの上書きはユーザー確認を経てから実行される。content には上限（30,000 文字）があり、超えると書き込まれず経路案内が返る。大きな成果物の一発書き込みには使わない（額縁テンプレートがあれば copy_file → replace_in_file / replace_between（大きな本文は from_path）/ append_file で組み立て、モデルが創作する長文は generate_and_write を使う）。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "書き込み先パス（プロジェクト相対）",
        },
        content: { type: "string", description: "書き込む内容" },
      },
      required: ["path", "content"],
    },
  },
  copy_file: {
    name: "copy_file",
    description:
      "ファイルをコピーする。スキルの references/base.html など大きなテンプレートを成果物先へ置くときに write_file での再生成より優先する。コピー元はプロジェクトまたは実行中スキル配下、コピー先はプロジェクト配下のみ。既存先への上書きはユーザー確認を経る。",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description:
            "コピー元パス（プロジェクト相対、または skill/<id>/... / references/...）",
        },
        to: {
          type: "string",
          description: "コピー先パス（プロジェクト相対）",
        },
      },
      required: ["from", "to"],
    },
  },
  replace_in_file: {
    name: "replace_in_file",
    description:
      "プロジェクト内ファイルの文字列を置換する。copy_file 後に {{PLACEHOLDER}} を埋める用途を想定。replacements（プレースホルダ map）または old_string/new_string を指定する。大きな本文を write_file で書き直す代わりにこれを使う。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "対象ファイルのパス（プロジェクト相対）",
        },
        replacements: {
          type: "object",
          description:
            "プレースホルダ名（MEETING_TITLE または {{MEETING_TITLE}}）から置換文字列への map",
          additionalProperties: { type: "string" },
        },
        old_string: {
          type: "string",
          description:
            "置換前の文字列（replacements の代わりに単発置換する場合）",
        },
        new_string: {
          type: "string",
          description: "置換後の文字列（old_string とセット）",
        },
      },
      required: ["path"],
    },
  },
  replace_between: {
    name: "replace_between",
    description:
      "プロジェクト内ファイルで start_marker と end_marker の最初の組の間だけを差し替える（マーカー自体は残す）。差し込み本文は content または from_path のいずれか一方。大きなブロックは from_path（＋ append_file で積んだ partial）を優先する。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "対象ファイルのパス（プロジェクト相対）",
        },
        start_marker: {
          type: "string",
          description: "区間開始マーカー（残す）",
        },
        end_marker: { type: "string", description: "区間終了マーカー（残す）" },
        content: {
          type: "string",
          description: "差し込み本文（from_path と排他）",
        },
        from_path: {
          type: "string",
          description:
            "差し込み本文の元ファイル（プロジェクトまたは実行中スキル。content と排他）",
        },
      },
      required: ["path", "start_marker", "end_marker"],
    },
  },
  append_file: {
    name: "append_file",
    description:
      "プロジェクト内ファイルの末尾に追記する。存在しない場合は新規作成する。大きな本文を複数ターンで partial に積み、最後に replace_between の from_path で差し込む用途を想定。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "追記先パス（プロジェクト相対）" },
        content: { type: "string", description: "追記する内容" },
      },
      required: ["path", "content"],
    },
  },
  mkdir: {
    name: "mkdir",
    description: "指定パスのディレクトリを作成する（再帰的に作成する）。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "作成するディレクトリのパス（プロジェクト相対）",
        },
      },
      required: ["path"],
    },
  },
  run_script: {
    name: "run_script",
    description:
      'Node.js（CommonJS）スクリプトをサンドボックスで実行する。大量レコードの機械変換・整形など、ディスク上のデータからロジック（ループ等）で機械的に膨らむ成果物に使う: 本文を tool 引数に書かず、ディスク上のデータ（md ドラフト・テンプレート等）を読んで変換・書込するロジックだけをコードにする。額縁テンプレートへの断片差し込みは copy_file → replace_in_file / replace_between が主経路。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみ。スキルの参照ファイルは、ツール結果に表示される論理パス（skill/<id>/...）ではなく path.join(process.env.DX_STUDIO_SKILL_DIR, "references", "...") で読むこと（スキル実行中のみ設定される）。ネットワークアクセスは禁止。実行前にユーザー確認が入る。',
    input_schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          description:
            "何のために実行するかの一文（ユーザー確認ダイアログに表示される）",
        },
        code: {
          type: "string",
          description:
            'CommonJS スクリプト本文。1行目は const fs = require("fs"); で始め、相対パスで読み書きする。成果物の本文を文字列リテラルで埋め込まず、ディスクから読んで組み立てること',
        },
        writes: {
          type: "array",
          items: { type: "string" },
          description: "書き込み予定のファイルパス（プロジェクト相対）の一覧",
        },
      },
      required: ["purpose", "code", "writes"],
    },
  },
  run_skill_script: {
    name: "run_skill_script",
    description:
      "実行中スキルに同梱されたスクリプト（scripts/ 配下）をサンドボックスで実行する。スキルに scripts/ がある場合は run_script より優先する。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみ。スキル側ファイルの読取は __dirname（または process.env.DX_STUDIO_SKILL_DIR）基準、成果物の書込はプロジェクト相対（または process.env.DX_STUDIO_PROJECT_DIR）基準で行うこと。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        script_path: {
          type: "string",
          description:
            "実行するスクリプトのスキル相対パス（例: scripts/build-html.cjs）",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "スクリプトへ渡す引数（任意）",
        },
        purpose: {
          type: "string",
          description:
            "何のために実行するかの一文（ユーザー確認ダイアログに表示される）",
        },
      },
      required: ["script_path", "purpose"],
    },
  },
  generate_and_write: {
    name: "generate_and_write",
    description:
      "モデルが新たに創作する大きな成果物（図解 HTML の本文・長文ドキュメント等）を、サーバ内の別 LLM 呼び出しで生成してファイルへ直接書き込む。本文を tool 引数に載せないため出力上限で切れない。本文がディスク上のデータから機械的に作れる場合はこれではなく run_script を使うこと。材料（アウトライン・収集メモ・模範例）は先にファイルへ書き出して context_paths で渡し、大きな成果物は sections で分割を指定すること。額縁テンプレートへ差し込む場合は path に額縁を指定し marker で区間を指定すると、生成と差し込みが 1 回で済む。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          description:
            "何のために生成するかの一文（ユーザー確認ダイアログに表示される）",
        },
        path: {
          type: "string",
          description: "書き込み先パス（プロジェクト相対）",
        },
        instruction: {
          type: "string",
          description:
            "生成指示（成果物の内容・構成・トーン・形式）。成果物の本文そのものを書かないこと",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description:
            "セクション分割の指示。順に生成して連結される。大きな成果物では必ず指定する",
        },
        context_paths: {
          type: "array",
          items: { type: "string" },
          description:
            "生成時に内容を参照させるファイル（プロジェクト相対、または実行中スキルの references/... 等）",
        },
        marker: {
          type: "string",
          description:
            "path の額縁テンプレート内で差し込む区間。区間名（例: CONTENT, AGENDA_DETAILS）でも完全形（例: <!-- CONTENT_START -->）でも受ける。指定するとその区間だけが置き換わり、額縁は保持される。sections（生成の分割指示）とは別物",
        },
      },
      required: ["purpose", "path", "instruction"],
    },
  },
  run_isolated_task: {
    name: "run_isolated_task",
    description:
      "サブエージェント起動の代替。親の会話履歴を引き継がない独立したコンテキストでタスクを実行する。スキルが「サブエージェントを起動」等を指示している場面で、その役割をこのツールで代替すること。通常のファイル操作・生成には使わない（それらは write_file 等・generate_and_write を使う）。path を指定すればサーバが結果をそのままファイルへ書き込み、tool_result には要約のみが残る。path を省略すれば結果テキストをそのまま tool_result として返す（上限あり）。材料は context_paths で渡し、その内容自体は tool_result に戻らない。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          description:
            "何のために実行するかの一文（ユーザー確認ダイアログに表示される）",
        },
        instruction: {
          type: "string",
          description: "実行させるタスクの指示",
        },
        path: {
          type: "string",
          description:
            "結果の書き込み先パス（プロジェクト相対、任意）。省略時は結果テキストがそのまま返る",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description:
            "結果が大きい場合のセクション分割指示。順に生成して連結される",
        },
        context_paths: {
          type: "array",
          items: { type: "string" },
          description:
            "タスク実行時に内容を参照させるファイル（プロジェクト相対、または実行中スキルの references/... 等）",
        },
      },
      required: ["purpose", "instruction"],
    },
  },
  inline_html_assets: {
    name: "inline_html_assets",
    description:
      "生成済み HTML を単体で開けるようにする。CDN 読み込み（Tailwind・Lucide）を取り除き、その HTML が実際に使っているスタイルをその場でコンパイルして埋め込み、アイコンを inline SVG へ展開する。対象ファイルは上書きされる。複数ファイルをまとめて渡すこと（1 回の呼び出しと 1 回の確認で完了する）。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "対象 HTML のパス（プロジェクト相対）。複数まとめて渡す",
        },
      },
      required: ["paths"],
    },
  },
  web_search: {
    name: "web_search",
    description:
      "web 検索を実行し、タイトル・URL・スニペットの一覧を返す。実行前にユーザー確認が入る。検索が利用できない環境では、その旨の案内が返る（再試行しないこと）。",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索クエリ（ユーザー確認ダイアログに全文表示される）",
        },
        purpose: {
          type: "string",
          description:
            "何のために検索するかの一文（ユーザー確認ダイアログに表示される）",
        },
      },
      required: ["query", "purpose"],
    },
  },
  // dx 固有ツール: 社内コンテキスト検索・選択
  search_company_context: SEARCH_COMPANY_CONTEXT_SCHEMA,
  select_company_context: SELECT_COMPANY_CONTEXT_SCHEMA,
} as const satisfies Record<string, ToolDefinition>;

export type RegisteredToolName = keyof typeof TOOL_SCHEMAS;

export function isRegisteredToolName(name: string): name is RegisteredToolName {
  return name in TOOL_SCHEMAS;
}

export type ResolveToolDefinitionsOptions = {
  /**
   * 実行中スキルに `scripts/` ディレクトリが実在するか。
   * false（スキル未実行を含む）のとき `run_skill_script` を定義から除外し、
   * 存在しないスクリプトの推測実行という失敗クラスを構造的に排除する。
   */
  hasSkillScripts?: boolean;
};

/** 実行中スキルの `scripts/` ディレクトリが実在するかを判定する（run_skill_script の公開条件） */
export function skillHasScriptsDir(skillDirAbsolute?: string): boolean {
  const dir = skillDirAbsolute?.trim();
  if (!dir) return false;
  const scriptsDir = path.join(dir, "scripts");
  return fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory();
}

/**
 * dx は宣言制（EBEX の「実ファイル I/O ツールは常時提示」からの意図的逸脱・差分台帳 #8）:
 * スキル frontmatter の `tools:` に宣言されたツールのみ LLM へ渡す。
 * 実装済みでも未宣言のツールは提示されない（コピー＝解禁ではない）。
 * `run_skill_script` はさらに、実行中スキルに `scripts/` が実在する場合のみ渡す。
 */
export function resolveToolDefinitions(
  names: string[],
  options: ResolveToolDefinitionsOptions = {},
): ToolDefinition[] {
  const requested = new Set(names);
  return Object.values(TOOL_SCHEMAS).filter((definition) => {
    if (definition.name === "run_skill_script" && !options.hasSkillScripts) {
      return false;
    }
    return requested.has(definition.name);
  });
}

function display(
  summary: string,
  text: string,
  tags?: string[],
): ToolExecutionDisplay {
  return { summary, display: text, tags };
}

function errorOutcome(message: string): ToolExecutionOutcome {
  const firstLine = message.split("\n")[0] ?? message;
  return {
    result: { error: message },
    display: display("error", `✗ ${firstLine}`),
  };
}

/**
 * テンプレート規約準拠ファイルの残作業（未置換 {{XXX}}・未充填の
 * <!-- XXX_START/END --> 区間）をスキャンし、tool_result に完了ゲート情報を
 * 付加する。残作業ゼロの場合も `templateStatus.complete: true` を返し、
 * モデルが完了を判断なしで確認できるようにする。規約外ファイルでは
 * 検出ゼロとなり従来と同じ結果になる。
 */
function withResidualFillWarning(
  content: string,
  outcome: ToolExecutionOutcome,
): ToolExecutionOutcome {
  const scan = scanTemplateResiduals(content);
  const templateStatus = {
    complete: templateResidualCount(scan) === 0,
    remainingPlaceholders: scan.fillTokens,
    emptySections: scan.emptySections,
  };
  const baseResult =
    outcome.result &&
    typeof outcome.result === "object" &&
    !Array.isArray(outcome.result)
      ? (outcome.result as Record<string, unknown>)
      : {};

  const warning = templateResidualMessage(scan);
  if (!warning) {
    return {
      result: { ...baseResult, templateStatus },
      display: outcome.display,
    };
  }

  const tags = [...(outcome.display.tags ?? []), "warning"];
  return {
    result: {
      ...baseResult,
      warning,
      residualFillTokens: scan.fillTokens,
      templateStatus,
    },
    display: display(
      outcome.display.summary,
      `${outcome.display.display}\n⚠ ${warning}`,
      tags,
    ),
  };
}

/** copy_file 後スキャンの対象拡張子（テンプレート規約が想定するテキスト系のみ） */
const TEMPLATE_SCAN_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".md",
  ".txt",
  ".svg",
  ".css",
]);

function isTemplateScanTarget(filePath: string): boolean {
  return TEMPLATE_SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
        if (pattern[i + 1] === "/") i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

function walkFiles(
  rootAbsolute: string,
  baseAbsolute: string,
  onFile: (relativePath: string, absolutePath: string) => boolean,
): void {
  // path がファイルに解決された場合は単一 scope として 1 件だけ通知する（readdir しない）
  if (fs.existsSync(baseAbsolute) && fs.statSync(baseAbsolute).isFile()) {
    const relative = path
      .relative(rootAbsolute, baseAbsolute)
      .replace(/\\/g, "/");
    onFile(relative, baseAbsolute);
    return;
  }
  const stack: string[] = [baseAbsolute];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir || !fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || IGNORED_DIR_NAMES.has(entry.name))
        continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(rootAbsolute, abs).replace(/\\/g, "/");
      const shouldContinue = onFile(relative, abs);
      if (!shouldContinue) return;
    }
  }
}

function skillDisplayPath(
  skillId: string,
  relativeFromSkillRoot: string,
): string {
  const rel = relativeFromSkillRoot.replace(/\\/g, "/").replace(/^\/+/, "");
  return rel ? `skill/${skillId}/${rel}` : `skill/${skillId}`;
}

type DiscoveryWalkZone = {
  rootAbsolute: string;
  baseAbsolute: string;
  toDisplayPath: (relativeFromRoot: string, absolutePath: string) => string;
};

function isInsideDir(dirAbsolute: string, candidate: string): boolean {
  return (
    candidate === dirAbsolute || candidate.startsWith(dirAbsolute + path.sep)
  );
}

/**
 * リポジトリ内を歩くゾーン。
 * パターン照合の基準は `rootAbsolute`、表示はリポジトリルート相対に揃える。
 */
function buildRepoWalkZone(
  projectRoot: string,
  rootAbsolute: string,
  baseAbsolute: string,
): DiscoveryWalkZone {
  const rootRelative = path
    .relative(projectRoot, rootAbsolute)
    .replace(/\\/g, "/");
  return {
    rootAbsolute,
    baseAbsolute,
    toDisplayPath: (relativeFromRoot) =>
      rootRelative ? `${rootRelative}/${relativeFromRoot}` : relativeFromRoot,
  };
}

function buildSkillWalkZone(
  context: ToolExecutionContext,
  baseAbsolute: string,
): DiscoveryWalkZone | null {
  const skillId = context.skillId?.trim();
  const skillDir = context.skillDirAbsolute?.trim();
  if (!skillId || !skillDir || !fs.existsSync(skillDir)) return null;
  return {
    rootAbsolute: skillDir,
    baseAbsolute,
    toDisplayPath: (relativeFromRoot) =>
      skillDisplayPath(skillId, relativeFromRoot),
  };
}

/**
 * L1 の walk 対象を決める。
 * - path が skill に解決 → skill のみ
 * - path 省略（`.`）→ project のみ（スキル直下で置き換えない）
 *   スキルへのフォールバックは呼び出し側で project 0 件時に行う
 */
function resolveDiscoveryWalkZones(
  context: ToolExecutionContext,
  pathInput: string,
): DiscoveryWalkZone[] | { error: string } {
  const baseResolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    pathInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in baseResolved) return { error: baseResolved.error };

  if (baseResolved.insideSkill) {
    const skillZone = buildSkillWalkZone(context, baseResolved.absolutePath);
    if (!skillZone) return { error: "実行中スキルディレクトリがありません" };
    return [skillZone];
  }

  // 正本ツリー: 作業フォルダ配下ならパターンの基準も作業フォルダにする。
  // モデルは明示プレフィックスのない相対パスを作業フォルダ基準で書くため、
  // contents/ ルートを基準にすると `output/*.html` のようなパターンが外れる。
  if (baseResolved.zone === "contents") {
    const workDir = workDirAbsolute(context);
    const root = isInsideDir(workDir, baseResolved.absolutePath)
      ? workDir
      : path.resolve(context.projectRoot, CONTENTS_DIR_NAME);
    return [
      buildRepoWalkZone(context.projectRoot, root, baseResolved.absolutePath),
    ];
  }

  // 作業ツリー（contents-work/）: 基準は作業ツリーのルート
  return [
    buildRepoWalkZone(
      context.projectRoot,
      path.resolve(context.projectRoot, CONTENTS_PLAN_DIR_NAME),
      baseResolved.absolutePath,
    ),
  ];
}

/** path 省略かつ project 0 件のとき、スキルゾーンを追加検索するか */
function shouldFallbackToSkillZone(
  pathOmitted: boolean,
  matchCount: number,
  context: ToolExecutionContext,
): boolean {
  if (!pathOmitted || matchCount > 0) return false;
  return Boolean(context.skillDirAbsolute?.trim() && context.skillId?.trim());
}

function executeListFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const targetInput =
    typeof input.path === "string" && input.path.trim() ? input.path : "";
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    targetInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(
      `ディレクトリが見つかりません: ${resolved.relativePath}`,
    );
  }
  // stat / readdir の fs 例外（TOCTOU 等）で agent ターンを abort させない薄い containment
  try {
    const stat = fs.statSync(resolved.absolutePath);
    if (stat.isFile()) {
      // ファイル scope: その 1 エントリだけを返す（親ディレクトリの一覧にフォールバックしない）
      const entry = {
        name: path.basename(resolved.absolutePath),
        type: "file" as const,
      };
      return {
        result: { path: resolved.relativePath, entries: [entry] },
        display: display(
          "1 件",
          `📁 ${resolved.relativePath} — 1 件（ファイル）`,
        ),
      };
    }
    if (!stat.isDirectory()) {
      return errorOutcome(
        `ディレクトリではありません: ${resolved.relativePath}`,
      );
    }

    const entries = fs
      .readdirSync(resolved.absolutePath, { withFileTypes: true })
      .filter(
        (entry) =>
          !entry.name.startsWith(".") && !IGNORED_DIR_NAMES.has(entry.name),
      )
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? ("dir" as const) : ("file" as const),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    return {
      result: { path: resolved.relativePath, entries },
      display: display(
        `${entries.length} 件`,
        `📁 ${resolved.relativePath} — ${entries.length} 件`,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOutcome(`発見ツールの実行に失敗しました: ${message}`);
  }
}

function matchGlobPath(
  regex: RegExp,
  relativeFromRoot: string,
  absolutePath: string,
  baseAbsolute: string,
  displayPath: string,
): boolean {
  const fromBase = path
    .relative(baseAbsolute, absolutePath)
    .replace(/\\/g, "/");
  if (fromBase === "") {
    // ファイル scope（base がファイル自身）: * は / を跨がないため basename も照合候補に加える。
    // ディレクトリ walk では fromBase が空にならないので既存判定には影響しない
    return (
      regex.test(relativeFromRoot) ||
      regex.test(displayPath) ||
      regex.test(path.basename(absolutePath))
    );
  }
  return (
    regex.test(relativeFromRoot) ||
    regex.test(fromBase) ||
    regex.test(displayPath)
  );
}

function executeGlobFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const pattern = typeof input.pattern === "string" ? input.pattern.trim() : "";
  if (!pattern) return errorOutcome("pattern が空です");
  const pathProvided = typeof input.path === "string" && input.path.trim();
  const baseInput = pathProvided ? String(input.path).trim() : "";
  const pathOmitted = !baseInput || baseInput === ".";

  const zones = resolveDiscoveryWalkZones(context, baseInput || ".");
  if ("error" in zones) return errorOutcome(zones.error);

  const regex = globToRegExp(pattern);
  const matches: string[] = [];
  let truncated = false;

  const collectFromZones = (walkZones: DiscoveryWalkZone[]) => {
    for (const zone of walkZones) {
      walkFiles(zone.rootAbsolute, zone.baseAbsolute, (relative, absolute) => {
        const displayPath = zone.toDisplayPath(relative, absolute);
        if (
          matchGlobPath(
            regex,
            relative,
            absolute,
            zone.baseAbsolute,
            displayPath,
          )
        ) {
          matches.push(displayPath);
          if (matches.length >= SEARCH_RESULT_LIMIT) {
            truncated = true;
            return false;
          }
        }
        return true;
      });
      if (truncated) return;
    }
  };

  // walk 中の fs 例外（TOCTOU 等）で agent ターンを abort させない薄い containment
  try {
    collectFromZones(zones);

    if (
      shouldFallbackToSkillZone(pathOmitted, matches.length, context) &&
      !zones.some((z) => z.rootAbsolute === context.skillDirAbsolute)
    ) {
      const skillZone = buildSkillWalkZone(context, context.skillDirAbsolute!);
      if (skillZone) {
        collectFromZones([skillZone]);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOutcome(`発見ツールの実行に失敗しました: ${message}`);
  }

  return {
    result: { pattern, matches, truncated },
    display: display(
      `${matches.length} 件${truncated ? "（上限あり）" : ""}`,
      `🔍 glob: ${pattern} — ${matches.length} 件${truncated ? `（上限 ${SEARCH_RESULT_LIMIT} 件で切り詰め）` : ""}`,
    ),
  };
}

function executeSearchContent(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim()) return errorOutcome("query が空です");
  const pathProvided = typeof input.path === "string" && input.path.trim();
  const baseInput = pathProvided ? String(input.path).trim() : "";
  const pathOmitted = !baseInput || baseInput === ".";

  const zones = resolveDiscoveryWalkZones(context, baseInput || ".");
  if ("error" in zones) return errorOutcome(zones.error);

  const needle = query.toLowerCase();
  const hits: Array<{ path: string; line: number; text: string }> = [];
  let truncated = false;

  const searchZones = (walkZones: DiscoveryWalkZone[]) => {
    for (const zone of walkZones) {
      walkFiles(zone.rootAbsolute, zone.baseAbsolute, (relative, absolute) => {
        let content: string;
        try {
          content = fs.readFileSync(absolute, "utf-8");
        } catch {
          return true;
        }
        const displayPath = zone.toDisplayPath(relative, absolute);
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            hits.push({
              path: displayPath,
              line: i + 1,
              text: lines[i].trim().slice(0, 300),
            });
            if (hits.length >= SEARCH_RESULT_LIMIT) {
              truncated = true;
              return false;
            }
          }
        }
        return true;
      });
      if (truncated) return;
    }
  };

  // walk 中の fs 例外（TOCTOU 等）で agent ターンを abort させない薄い containment
  try {
    searchZones(zones);

    if (
      shouldFallbackToSkillZone(pathOmitted, hits.length, context) &&
      !zones.some((z) => z.rootAbsolute === context.skillDirAbsolute)
    ) {
      const skillZone = buildSkillWalkZone(context, context.skillDirAbsolute!);
      if (skillZone) {
        searchZones([skillZone]);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOutcome(`発見ツールの実行に失敗しました: ${message}`);
  }

  return {
    result: { query, hits, truncated },
    display: display(
      `${hits.length} 件${truncated ? "（上限あり）" : ""}`,
      `🔎 検索: ${query} — ${hits.length} 件${truncated ? `（上限 ${SEARCH_RESULT_LIMIT} 件で切り詰め）` : ""}`,
    ),
  };
}

function executeReadFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  const stat = fs.statSync(resolved.absolutePath);
  if (!stat.isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  const raw = fs.readFileSync(resolved.absolutePath, "utf-8");
  const truncated = raw.length > READ_CHAR_LIMIT;
  const content = truncated ? raw.slice(0, READ_CHAR_LIMIT) : raw;

  return {
    result: {
      path: resolved.relativePath,
      content,
      truncated,
      ...(truncated ? { totalChars: raw.length } : {}),
    },
    display: display(
      `${content.length} 文字${truncated ? "（切り詰め）" : ""}`,
      `📄 読取: ${resolved.relativePath}${truncated ? `（先頭 ${READ_CHAR_LIMIT} 文字に切り詰め）` : ""}`,
    ),
  };
}

function executeWriteFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  const content = typeof input.content === "string" ? input.content : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");

  if (content.length > WRITE_FILE_CHAR_LIMIT) {
    return {
      result: {
        error: `content が write_file の上限（${WRITE_FILE_CHAR_LIMIT} 文字）を超えています（${content.length} 文字）。成果物本文を tool 引数に載せずに組み立ててください`,
        recoverable: true,
        guidance: LARGE_FILE_WRITE_GUIDANCE,
      },
      display: display(
        "error",
        `✗ write_file 上限超過（${content.length} 文字 > ${WRITE_FILE_CHAR_LIMIT}）`,
      ),
    };
  }

  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    writePathOptions(context),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの書込はできません: ${resolved.relativePath}`,
    );
  }

  // レッスン `.meta.json` は検査つき書込（スキーマ適合・id の既存値保護）
  if (isLessonMetaWritePath(resolved)) {
    const prepared = prepareLessonMetaWrite(
      resolved.absolutePath,
      resolved.relativePath,
      content,
    );
    if (!prepared.ok) return errorOutcome(prepared.error);
    fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
    fs.writeFileSync(resolved.absolutePath, prepared.content, "utf-8");
    const metaBytes = Buffer.byteLength(prepared.content, "utf-8");
    return {
      result: { path: resolved.relativePath, bytes: metaBytes },
      display: display(
        `${metaBytes} bytes`,
        `💾 書込: ${resolved.relativePath}（${metaBytes} bytes・検査済み）`,
      ),
    };
  }

  // 額縁テンプレートを丸ごと上書きしそうな場合は中間ファイル置き場へ退避する
  const decision = resolveFramedWriteTarget({
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    workScopeKey: context.workScopeKey,
    projectRoot: context.projectRoot,
  });

  fs.mkdirSync(path.dirname(decision.absolutePath), { recursive: true });
  fs.writeFileSync(decision.absolutePath, content, "utf-8");
  const bytes = Buffer.byteLength(content, "utf-8");

  if (decision.kind === "divert") {
    return framedWriteDivertOutcome(decision, { label: "💾 書込", bytes });
  }

  return {
    result: { path: decision.relativePath, bytes },
    display: display(
      `${bytes} bytes`,
      `💾 書込: ${decision.relativePath}（${bytes} bytes）`,
    ),
  };
}

/**
 * 生成済み HTML から CDN 依存を取り除き、単体で開ける形へ書き換える。
 * 複数ファイルを 1 回の呼び出しで処理する（確認も 1 回で済ませるため）。
 */
async function executeInlineHtmlAssets(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const raw = Array.isArray(input.paths) ? input.paths : [];
  const requested = raw.filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  if (requested.length === 0) return errorOutcome("paths が空です");

  const resolvedTargets: Array<{ absolutePath: string; relativePath: string }> =
    [];
  for (const inputPath of requested) {
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.workScopeKey,
      inputPath,
      writePathOptions(context),
    );
    if ("error" in resolved) return errorOutcome(resolved.error);
    if (resolved.insideSkill) {
      return errorOutcome(
        `スキルディレクトリのファイルは書き換えられません: ${resolved.relativePath}`,
      );
    }
    if (!fs.existsSync(resolved.absolutePath)) {
      return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
    }
    if (!fs.statSync(resolved.absolutePath).isFile()) {
      return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
    }
    resolvedTargets.push(resolved);
  }

  const lines: string[] = [];
  const summaries: Array<{
    path: string;
    bytesBefore: number;
    bytesAfter: number;
    cssBytes: number;
    iconsExpanded: number;
    iconsFallback: string[];
  }> = [];

  for (const target of resolvedTargets) {
    const before = fs.readFileSync(target.absolutePath, "utf-8");
    const { html, report } = await inlineHtmlAssets(before);
    fs.writeFileSync(target.absolutePath, html, "utf-8");

    const bytesBefore = Buffer.byteLength(before, "utf-8");
    const bytesAfter = Buffer.byteLength(html, "utf-8");
    summaries.push({
      path: target.relativePath,
      bytesBefore,
      bytesAfter,
      cssBytes: report.cssBytes,
      iconsExpanded: report.iconsExpanded,
      iconsFallback: report.iconsFallback,
    });

    const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;
    lines.push(
      `${target.relativePath}: ${kb(bytesBefore)} → ${kb(bytesAfter)}` +
        `（CSS ${kb(report.cssBytes)} / アイコン ${report.iconsExpanded} 個` +
        (report.iconsFallback.length
          ? ` / 代替 ${report.iconsFallback.length} 件: ${report.iconsFallback.join("・")}`
          : "") +
        "）",
    );
  }

  return {
    result: { files: summaries },
    display: display(
      `${summaries.length} ファイル`,
      `🎨 インライン化\n${lines.join("\n")}`,
    ),
  };
}

function executeCopyFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const fromPath = typeof input.from === "string" ? input.from : "";
  const toPath = typeof input.to === "string" ? input.to : "";
  if (!fromPath.trim() || !toPath.trim()) {
    return errorOutcome("from / to が空です");
  }

  const fromResolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    fromPath,
    skillPathOptions(context, true),
  );
  if ("error" in fromResolved) return errorOutcome(fromResolved.error);

  const toResolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    toPath,
    writePathOptions(context),
  );
  if ("error" in toResolved) return errorOutcome(toResolved.error);
  if (toResolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへのコピーはできません: ${toResolved.relativePath}`,
    );
  }

  if (!fs.existsSync(fromResolved.absolutePath)) {
    return errorOutcome(
      `ファイルが見つかりません: ${fromResolved.relativePath}`,
    );
  }
  const fromStat = fs.statSync(fromResolved.absolutePath);
  if (!fromStat.isFile()) {
    return errorOutcome(`ファイルではありません: ${fromResolved.relativePath}`);
  }

  // レッスン `.meta.json` へのコピーも検査を通す（コピー元の内容がスキーマ適合であること）
  if (isLessonMetaWritePath(toResolved)) {
    const prepared = prepareLessonMetaWrite(
      toResolved.absolutePath,
      toResolved.relativePath,
      fs.readFileSync(fromResolved.absolutePath, "utf-8"),
    );
    if (!prepared.ok) return errorOutcome(prepared.error);
    fs.mkdirSync(path.dirname(toResolved.absolutePath), { recursive: true });
    fs.writeFileSync(toResolved.absolutePath, prepared.content, "utf-8");
    const metaBytes = Buffer.byteLength(prepared.content, "utf-8");
    return {
      result: {
        from: fromResolved.relativePath,
        to: toResolved.relativePath,
        path: toResolved.relativePath,
        bytes: metaBytes,
      },
      display: display(
        `${metaBytes} bytes`,
        `📋 コピー: ${fromResolved.relativePath} → ${toResolved.relativePath}（${metaBytes} bytes・検査済み）`,
      ),
    };
  }

  fs.mkdirSync(path.dirname(toResolved.absolutePath), { recursive: true });
  fs.copyFileSync(fromResolved.absolutePath, toResolved.absolutePath);
  const bytes = fromStat.size;

  const outcome: ToolExecutionOutcome = {
    result: {
      from: fromResolved.relativePath,
      to: toResolved.relativePath,
      path: toResolved.relativePath,
      bytes,
    },
    display: display(
      `${bytes} bytes`,
      `📋 コピー: ${fromResolved.relativePath} → ${toResolved.relativePath}（${bytes} bytes）`,
    ),
  };

  // テンプレートのコピー直後に残作業一覧を返し、次に埋めるべき箇所を明示する
  if (isTemplateScanTarget(toResolved.absolutePath)) {
    return withResidualFillWarning(
      fs.readFileSync(toResolved.absolutePath, "utf-8"),
      outcome,
    );
  }
  return outcome;
}

function executeReplaceInFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");

  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    writePathOptions(context),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの置換はできません: ${resolved.relativePath}`,
    );
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  let content = fs.readFileSync(resolved.absolutePath, "utf-8");
  let replacementsCount = 0;

  const map =
    input.replacements &&
    typeof input.replacements === "object" &&
    !Array.isArray(input.replacements)
      ? (input.replacements as Record<string, unknown>)
      : null;

  if (map) {
    for (const [key, value] of Object.entries(map)) {
      if (typeof value !== "string") continue;
      const placeholder =
        key.includes("{{") || key.includes("}}") ? key : `{{${key}}}`;
      if (!content.includes(placeholder)) continue;
      const parts = content.split(placeholder);
      replacementsCount += parts.length - 1;
      content = parts.join(value);
    }
  } else {
    const oldString =
      typeof input.old_string === "string" ? input.old_string : "";
    const newString =
      typeof input.new_string === "string" ? input.new_string : "";
    if (!oldString) {
      return errorOutcome("replacements または old_string が必要です");
    }
    if (!content.includes(oldString)) {
      return errorOutcome(
        formatNotFoundError("置換対象が見つかりません", oldString, content),
      );
    }
    const parts = content.split(oldString);
    replacementsCount = parts.length - 1;
    content = parts.join(newString);
  }

  if (replacementsCount === 0) {
    const firstKey =
      map &&
      Object.keys(map).find((key) => {
        const placeholder =
          key.includes("{{") || key.includes("}}") ? key : `{{${key}}}`;
        return !content.includes(placeholder);
      });
    if (firstKey) {
      const placeholder =
        firstKey.includes("{{") || firstKey.includes("}}")
          ? firstKey
          : `{{${firstKey}}}`;
      return errorOutcome(
        formatNotFoundError("置換対象が見つかりません", placeholder, content),
      );
    }
    return errorOutcome("置換対象が見つかりません（0 件）");
  }

  // レッスン `.meta.json` は置換結果にもスキーマ検査を通す
  if (isLessonMetaWritePath(resolved)) {
    const prepared = prepareLessonMetaWrite(
      resolved.absolutePath,
      resolved.relativePath,
      content,
    );
    if (!prepared.ok) return errorOutcome(prepared.error);
    content = prepared.content;
  }

  fs.writeFileSync(resolved.absolutePath, content, "utf-8");

  return withResidualFillWarning(content, {
    result: {
      path: resolved.relativePath,
      replacements: replacementsCount,
    },
    display: display(
      `${replacementsCount} 件`,
      `✏️ 置換: ${resolved.relativePath}（${replacementsCount} 件）`,
    ),
  });
}

function executeReplaceBetween(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  const startMarker =
    typeof input.start_marker === "string" ? input.start_marker : "";
  const endMarker =
    typeof input.end_marker === "string" ? input.end_marker : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  if (!startMarker) return errorOutcome("start_marker が空です");
  if (!endMarker) return errorOutcome("end_marker が空です");

  const hasContent = typeof input.content === "string";
  const hasFromPath =
    typeof input.from_path === "string" && input.from_path.trim();
  if (hasContent && hasFromPath) {
    return errorOutcome("content と from_path は同時に指定できません");
  }
  if (!hasContent && !hasFromPath) {
    return errorOutcome("content または from_path のいずれか一方が必要です");
  }

  let insertContent: string;
  if (hasFromPath) {
    const fromResolved = resolveToolTargetPath(
      context.projectRoot,
      context.workScopeKey,
      String(input.from_path).trim(),
      skillPathOptions(context, true),
    );
    if ("error" in fromResolved) return errorOutcome(fromResolved.error);
    if (!fs.existsSync(fromResolved.absolutePath)) {
      return errorOutcome(
        `ファイルが見つかりません: ${fromResolved.relativePath}`,
      );
    }
    if (!fs.statSync(fromResolved.absolutePath).isFile()) {
      return errorOutcome(
        `ファイルではありません: ${fromResolved.relativePath}`,
      );
    }
    const raw = fs.readFileSync(fromResolved.absolutePath, "utf-8");
    if (raw.length > READ_CHAR_LIMIT) {
      return errorOutcome(
        `from_path のファイルが大きすぎます（上限 ${READ_CHAR_LIMIT} 文字）: ${fromResolved.relativePath}`,
      );
    }
    insertContent = raw;
  } else {
    insertContent = input.content as string;
  }

  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    writePathOptions(context),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの置換はできません: ${resolved.relativePath}`,
    );
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  const original = fs.readFileSync(resolved.absolutePath, "utf-8");
  const startIndex = original.indexOf(startMarker);
  if (startIndex < 0) {
    return errorOutcome(
      formatNotFoundError(
        "start_marker が見つかりません",
        startMarker,
        original,
      ),
    );
  }
  const afterStart = startIndex + startMarker.length;
  const endIndex = original.indexOf(endMarker, afterStart);
  if (endIndex < 0) {
    return errorOutcome(
      formatNotFoundError("end_marker が見つかりません", endMarker, original),
    );
  }

  let next =
    original.slice(0, afterStart) + insertContent + original.slice(endIndex);
  // レッスン `.meta.json` は置換結果にもスキーマ検査を通す
  if (isLessonMetaWritePath(resolved)) {
    const prepared = prepareLessonMetaWrite(
      resolved.absolutePath,
      resolved.relativePath,
      next,
    );
    if (!prepared.ok) return errorOutcome(prepared.error);
    next = prepared.content;
  }
  fs.writeFileSync(resolved.absolutePath, next, "utf-8");
  const replacedChars = endIndex - afterStart;
  const insertedChars = insertContent.length;

  return withResidualFillWarning(next, {
    result: {
      path: resolved.relativePath,
      replacedChars,
      insertedChars,
      bytes: Buffer.byteLength(next, "utf-8"),
    },
    display: display(
      `${insertedChars} 文字`,
      `✏️ 区間置換: ${resolved.relativePath}（${replacedChars} → ${insertedChars} 文字）`,
    ),
  });
}

function executeAppendFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  const content = typeof input.content === "string" ? input.content : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");

  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    writePathOptions(context),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの追記はできません: ${resolved.relativePath}`,
    );
  }

  const exists = fs.existsSync(resolved.absolutePath);
  if (exists && !fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  // 追記では JSON の妥当性を保てないため、レッスン `.meta.json` は write_file で書く
  if (isLessonMetaWritePath(resolved)) {
    return errorOutcome(
      `.meta.json への追記はできません。write_file で全体を書いてください: ${resolved.relativePath}`,
    );
  }

  fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
  fs.appendFileSync(resolved.absolutePath, content, "utf-8");
  const bytes = Buffer.byteLength(content, "utf-8");

  return {
    result: {
      path: resolved.relativePath,
      bytes,
      created: !exists,
    },
    display: display(
      `${bytes} bytes`,
      `📎 追記: ${resolved.relativePath}（${bytes} bytes${exists ? "" : "・新規"}）`,
    ),
  };
}

function executeMkdir(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    inputPath,
    writePathOptions(context),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの作成はできません: ${resolved.relativePath}`,
    );
  }

  fs.mkdirSync(resolved.absolutePath, { recursive: true });

  return {
    result: { path: resolved.relativePath },
    display: display("作成済み", `📁 作成: ${resolved.relativePath}`),
  };
}

/**
 * スクリプトサンドボックスの cwd。作業フォルダ（フォーカス中のコンテンツフォルダ）。
 * 明示プレフィックスのない相対パスの解決基準（`resolveToolTargetPath`）と同じ場所にする。
 */
function workDirAbsolute(context: ToolExecutionContext): string {
  const scope = parseWorkScope(context.workScopeKey) ?? {};
  return path.resolve(context.projectRoot, workScopeBaseDir(scope));
}

/** サンドボックスの共通オプション（cwd = 作業フォルダ、作業ツリーへの書込も許可） */
function scriptSandboxOptions(context: ToolExecutionContext) {
  return {
    projectDirAbsolute: workDirAbsolute(context),
    extraWriteDirsAbsolute: [
      path.resolve(context.projectRoot, CONTENTS_PLAN_DIR_NAME),
    ],
    skillDirAbsolute: context.skillDirAbsolute,
    ...(context.signal ? { signal: context.signal } : {}),
  };
}

export const SCRIPT_TOOL_NAMES = new Set(["run_script", "run_skill_script"]);

export function isScriptToolName(name: string): boolean {
  return SCRIPT_TOOL_NAMES.has(name);
}

/** run_script の code として受理する別名キー（モデルの入力ゆらぎ救済） */
const RUN_SCRIPT_CODE_ALIASES = ["script", "content", "source", "js"] as const;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type NormalizedScriptToolCall = {
  name: string;
  input: Record<string, unknown>;
};

/**
 * スクリプト系ツール呼び出しの入力ゆらぎを救済する（broken 判定・確認・実行より前に適用）。
 * - run_script: code が別名キー（script / content / source / js）にある場合は code へ移す
 * - run_script: code が無く script_path だけがある場合は run_skill_script として扱う
 * - run_skill_script: script_path が無く code 相当がある場合は run_script として扱う
 */
export function normalizeScriptToolCall(
  name: string,
  input: Record<string, unknown>,
): NormalizedScriptToolCall {
  if (!isScriptToolName(name)) return { name, input };

  const code =
    nonEmptyString(input.code) ??
    RUN_SCRIPT_CODE_ALIASES.reduce<string | null>(
      (found, alias) => found ?? nonEmptyString(input[alias]),
      null,
    );
  const scriptPath = nonEmptyString(input.script_path);

  if (name === "run_script") {
    if (code) {
      return code === input.code
        ? { name, input }
        : { name, input: { ...input, code } };
    }
    if (scriptPath) {
      return { name: "run_skill_script", input };
    }
    return { name, input };
  }

  // run_skill_script
  if (scriptPath) return { name, input };
  if (code) {
    return { name: "run_script", input: { ...input, code } };
  }
  return { name, input };
}

const SKILL_SCRIPT_ZONE_ERROR =
  "run_skill_script は実行中スキルの scripts/ 配下のスクリプトのみ実行できます";

type ResolvedSkillScript = {
  absolutePath: string;
  relativePath: string;
};

/** run_skill_script の script_path を検証・解決する（実行中スキルの scripts/ 配下のみ） */
export function resolveSkillScriptPath(
  context: ToolExecutionContext,
  scriptPathInput: string,
): ResolvedSkillScript | { error: string } {
  const skillId = context.skillId?.trim();
  if (!skillId || !context.skillDirAbsolute?.trim()) {
    return {
      error: "実行中スキルがないため run_skill_script は使用できません",
    };
  }
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    scriptPathInput,
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return { error: resolved.error };
  if (
    !resolved.insideSkill ||
    !resolved.relativePath.startsWith(`skill/${skillId}/scripts/`)
  ) {
    // scripts/ 相対で指定されたがスキル側に実在しない場合は「見つからない」として返す
    const normalizedInput = scriptPathInput
      .replace(/\\/g, "/")
      .replace(/^\.\//, "");
    if (!resolved.insideSkill && normalizedInput.startsWith("scripts/")) {
      return {
        error: `ファイルが見つかりません: skill/${skillId}/${normalizedInput}`,
      };
    }
    return { error: `${SKILL_SCRIPT_ZONE_ERROR}: ${resolved.relativePath}` };
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: `ファイルが見つかりません: ${resolved.relativePath}` };
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return { error: `ファイルではありません: ${resolved.relativePath}` };
  }
  return {
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
  };
}

function scriptFailureOutcome(result: {
  error: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  aborted?: boolean;
}): ToolExecutionOutcome {
  return {
    result: {
      error: result.error,
      ...(result.stderr ? { stderr: result.stderr } : {}),
      ...(typeof result.exitCode === "number"
        ? { exitCode: result.exitCode }
        : {}),
      ...(result.timedOut ? { timedOut: true } : {}),
      ...(result.aborted ? { aborted: true } : {}),
      recoverable: true,
      guidance:
        "エラー内容をもとにスクリプトを修正して再実行してください。成果物の本文を文字列リテラルで埋め込まず、ディスク上のファイルを読んで組み立てること。",
    },
    display: display("error", `✗ ${result.error}`),
  };
}

function executeRunScriptWritesTargets(
  context: ToolExecutionContext,
  writesInput: unknown,
): { writes: string[] } | { error: string } {
  const raw = Array.isArray(writesInput) ? writesInput : [];
  const writes: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.workScopeKey,
      entry,
      writePathOptions(context),
    );
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.insideProject) {
      return {
        error: `writes はプロジェクト内のパスのみ宣言できます: ${resolved.relativePath}`,
      };
    }
    writes.push(resolved.relativePath);
  }
  return { writes };
}

async function executeRunScript(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const code = typeof input.code === "string" ? input.code : "";
  if (!code.trim()) return errorOutcome("code が空です");

  const writesResult = executeRunScriptWritesTargets(context, input.writes);
  if ("error" in writesResult) return errorOutcome(writesResult.error);

  const runResult = await runScriptInSandbox(
    { kind: "code", code },
    scriptSandboxOptions(context),
  );
  if (!runResult.ok) return scriptFailureOutcome(runResult);

  return {
    result: {
      writes: writesResult.writes,
      stdout: runResult.stdout,
      durationMs: runResult.durationMs,
    },
    display: display(
      `${runResult.durationMs}ms`,
      `🧩 スクリプト実行: ${writesResult.writes.join(", ") || "(書込宣言なし)"}（${runResult.durationMs}ms）`,
    ),
  };
}

async function executeRunSkillScript(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const scriptPathInput =
    typeof input.script_path === "string" ? input.script_path : "";
  if (!scriptPathInput.trim()) return errorOutcome("script_path が空です");

  const resolved = resolveSkillScriptPath(context, scriptPathInput);
  if ("error" in resolved) return errorOutcome(resolved.error);

  const args = Array.isArray(input.args)
    ? input.args.filter((arg): arg is string => typeof arg === "string")
    : [];

  const runResult = await runScriptInSandbox(
    { kind: "file", scriptPathAbsolute: resolved.absolutePath, args },
    scriptSandboxOptions(context),
  );
  if (!runResult.ok) return scriptFailureOutcome(runResult);

  return {
    result: {
      script: resolved.relativePath,
      stdout: runResult.stdout,
      durationMs: runResult.durationMs,
    },
    display: display(
      `${runResult.durationMs}ms`,
      `🧩 スキルスクリプト実行: ${resolved.relativePath}（${runResult.durationMs}ms）`,
    ),
  };
}

/** 劣化契約の返却（error キーを持たせず、安全停止カウンタに乗せない） */
function searchUnavailableOutcome(
  notice: string,
  reason: string,
): ToolExecutionOutcome {
  return {
    result: { unavailable: true, notice },
    display: display(
      "スキップ",
      `✗ ${reason}のためweb検索できません。web検索をスキップします。`,
    ),
  };
}

async function executeWebSearch(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return errorOutcome("query が空です");

  const search = context.search;
  if (!search || !search.provider) {
    if (search) search.session.unavailable = true;
    return searchUnavailableOutcome(
      SEARCH_UNCONFIGURED_NOTICE,
      "検索APIキーが未設定",
    );
  }
  if (search.session.unavailable) {
    return searchUnavailableOutcome(
      SEARCH_UNAVAILABLE_NOTICE,
      "直前の検索が失敗した",
    );
  }

  const outcome = await search.provider.search(query);
  if (!outcome.ok) {
    // 最初の失敗でセッション内の検索を閉じる（サーキットブレーカー）
    search.session.unavailable = true;
    return {
      result: {
        unavailable: true,
        notice: `${SEARCH_UNAVAILABLE_NOTICE}（詳細: ${outcome.error}）`,
      },
      display: display(
        "スキップ",
        `✗ ${outcome.error}のためweb検索できません。web検索をスキップします。`,
      ),
    };
  }

  return {
    result: { query, results: outcome.results },
    display: display(
      `${outcome.results.length} 件`,
      `🔎 web 検索: ${query} — ${outcome.results.length} 件`,
    ),
  };
}

/**
 * スクリプト系ツールの事前検査（ユーザー確認ダイアログより先に行う）。
 * - run_script: 構文チェック。壊れたコードの承認をユーザーに求めない
 * - run_skill_script: スクリプトの存在・ゾーン検査。存在しないスクリプトの承認を求めない
 * 問題がなければ null を返し、確認ゲートへ進む。
 */
export async function preflightScriptToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionOutcome | null> {
  if (name === "run_script") {
    const code = typeof input.code === "string" ? input.code : "";
    if (!code.trim()) return null; // broken tool_use 経路で処理される
    // run_script（モデル即興生成）からの外部通信は provenance でブロックする。
    // 審査済みのスキル同梱スクリプト（run_skill_script）は通信を許可する。
    if (detectNetworkAccessHint(code)) {
      return {
        result: {
          blocked: true,
          reason: "run_script からの外部ネットワーク通信はできません",
          recoverable: true,
          guidance:
            "外部データ取得が必要なら、審査済みのスキル同梱スクリプト（scripts/ 配下、run_skill_script）を使うか、web 検索の人手フォールバックでユーザーに取得を依頼してください。通信を使わないローカルのファイル変換なら、ネットワーク処理を除いて再実行してください。",
        },
        display: display(
          "blocked",
          "🚫 run_script のネットワーク通信をブロック",
        ),
      };
    }
    const syntax = await checkScriptSyntax(code);
    if (!syntax.ok) {
      return {
        result: {
          error: `スクリプトの構文エラー: ${syntax.error}`,
          recoverable: true,
          guidance: "構文エラーを修正したスクリプトで再実行してください。",
        },
        display: display("error", "✗ スクリプトの構文エラー"),
      };
    }
    return null;
  }
  if (name === "run_skill_script") {
    const scriptPathInput =
      typeof input.script_path === "string" ? input.script_path : "";
    if (!scriptPathInput.trim()) return null;
    const resolved = resolveSkillScriptPath(context, scriptPathInput);
    if ("error" in resolved) return errorOutcome(resolved.error);
    return null;
  }
  return null;
}

/**
 * 削除・コマンド実行はツールとして存在させない（安全境界）。
 * モデルがこれらの名前でツール呼び出しを試みた場合のフォールバック案内。
 */
function buildBlockedOutcome(
  name: string,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  if (isLikelySubagentToolName(name)) {
    return {
      result: {
        blocked: true,
        reason: "このワークスペースはサブエージェントの起動に対応していません",
        guidance:
          "同一セッション内で自ら役割を順に実行してください。サブエージェントは起動しません。",
      },
      display: display("blocked", `🚫 サブエージェント起動をブロック: ${name}`),
    };
  }

  if (isLikelyExternalConnectorToolName(name)) {
    return {
      result: {
        blocked: true,
        reason: "このワークスペースは MCP・外部コネクタに対応していません",
        guidance:
          "作業フォルダ内で完結する手段（read_file / write_file / run_script 等）に置き換えてください。外部コネクタは利用しません。",
      },
      display: display("blocked", `🚫 外部コネクタをブロック: ${name}`),
    };
  }

  const target = typeof input.path === "string" ? input.path : undefined;
  const command =
    typeof input.command === "string"
      ? input.command
      : typeof input.script === "string"
        ? input.script
        : undefined;

  if (command) {
    return {
      result: {
        blocked: true,
        command,
        reason:
          "このワークスペースはセキュリティ上の理由から任意のシェルコマンド実行を許可していません（許可されるのはサンドボックス化された Node スクリプト実行のみ）",
        guidance:
          "ファイルの変換・生成が目的なら run_script（Node.js / CommonJS）を使用してください。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみです。",
      },
      display: display("blocked", `🚫 コマンド実行をブロック: ${command}`),
    };
  }

  return {
    result: {
      blocked: true,
      path: target,
      reason: "このワークスペースは自動的にファイルを削除しません",
      guidance: "対象ファイルはご自身で手動削除してください。",
    },
    display: display(
      "blocked",
      `🚫 削除をブロック${target ? `: ${target}` : ""}`,
    ),
  };
}

const BLOCKED_TOOL_NAME_HINTS = [
  "delete",
  "remove",
  "rm",
  "unlink",
  "exec",
  "run_command",
  "shell",
  "script",
];

/** MCP サーバ・外部コネクタ系のツール名（`mcp__server__tool` 規約 / connector）。 */
export function isLikelyExternalConnectorToolName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith("mcp__") || lower.includes("connector");
}

export function isLikelyBlockedToolName(name: string): boolean {
  // run_script / run_skill_script は登録済みツール（"script" ヒントに先行して除外）
  if (isRegisteredToolName(name)) return false;
  if (isLikelySubagentToolName(name)) return true;
  if (isLikelyExternalConnectorToolName(name)) return true;
  const lower = name.toLowerCase();
  return BLOCKED_TOOL_NAME_HINTS.some((hint) => lower.includes(hint));
}

export async function executeRegisteredTool(
  name: string,
  input: Record<string, unknown> = {},
  context?: ToolExecutionContext,
): Promise<ToolExecutionOutcome> {
  // dx 固有ツールは案件フォルダ文脈を要さない（contextMode のみ参照）ため、
  // フォルダ未選択ガードより先に処理する
  if (name === "search_company_context") {
    return executeSearchCompanyContext(
      input as SearchCompanyContextInput,
      context?.contextMode ?? "database",
    );
  }
  if (name === "select_company_context") {
    return executeSelectCompanyContext(
      input as SelectCompanyContextInput,
      context?.contextMode ?? "database",
    );
  }

  if (!context) {
    return errorOutcome(
      `案件フォルダが未選択のため tool を実行できません: ${name}`,
    );
  }

  switch (name) {
    case "list_files":
      return executeListFiles(context, input);
    case "glob_files":
      return executeGlobFiles(context, input);
    case "search_content":
      return executeSearchContent(context, input);
    case "read_file":
      return executeReadFile(context, input);
    case "write_file":
      return executeWriteFile(context, input);
    case "copy_file":
      return executeCopyFile(context, input);
    case "replace_in_file":
      return executeReplaceInFile(context, input);
    case "replace_between":
      return executeReplaceBetween(context, input);
    case "append_file":
      return executeAppendFile(context, input);
    case "mkdir":
      return executeMkdir(context, input);
    case "run_script":
      return executeRunScript(context, input);
    case "run_skill_script":
      return executeRunSkillScript(context, input);
    case "generate_and_write":
      return executeGenerateAndWrite(context, input);
    case "run_isolated_task":
      return executeRunIsolatedTask(context, input);
    case "inline_html_assets":
      return executeInlineHtmlAssets(context, input);
    case "web_search":
      return executeWebSearch(context, input);
    default:
      if (isLikelyBlockedToolName(name)) {
        return buildBlockedOutcome(name, input);
      }
      return errorOutcome(`未知の tool: ${name}`);
  }
}
