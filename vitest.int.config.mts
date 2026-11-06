import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: the real lib/ data code against a throw-away in-memory MongoDB (never the .env database).
// Run: npm run test:int
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
