import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { env: loadEnv(mode, process.cwd(), ""), fileParallelism: false },
}));
