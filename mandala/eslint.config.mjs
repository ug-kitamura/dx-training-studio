import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// studio と同系の最小構成。設定の import 共有はしない（アプリ独立性の制約）。
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 生成物（build:content が contents/ から生成する）
    "content/**",
    "public/_pagefind/**",
  ]),
]);

export default eslintConfig;
