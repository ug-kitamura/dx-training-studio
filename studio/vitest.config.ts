import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, ".") }],
  },
});
