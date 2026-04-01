import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@mihari/logger-types": path.resolve(__dirname, "packages/types/src/index.ts"),
      "@mihari/logger-core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@mihari/logger-node": path.resolve(__dirname, "packages/node/src/index.ts"),
      "@mihari/logger-browser": path.resolve(__dirname, "packages/browser/src/index.ts"),
      "@mihari/logger-js": path.resolve(__dirname, "packages/js/src/index.ts"),
      "@mihari/logger-pino": path.resolve(__dirname, "packages/pino/src/index.ts"),
      "@mihari/logger-winston": path.resolve(__dirname, "packages/winston/src/index.ts"),
      "@mihari/logger-bunyan": path.resolve(__dirname, "packages/bunyan/src/index.ts"),
      "@mihari/logger-koa": path.resolve(__dirname, "packages/koa/src/index.ts"),
      "@mihari/logger-tool": path.resolve(__dirname, "packages/tool/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
    },
  },
});
