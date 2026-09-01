import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // tsconfig の paths（`@/*`）に合わせる
    alias: { "@": root },
  },
  test: {
    include: ["__tests__/**/*.test.mts", "__tests__/**/*.test.ts"],
    environment: "node",
  },
});
