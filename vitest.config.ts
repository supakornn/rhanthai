import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Elysia AoT must execute at isolate startup, not via Vite's dynamic imports.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-10-01",
        serviceBindings: { API: "api-under-test" },
        workers: [
          {
            name: "api-under-test",
            modules: true,
            scriptPath: "./dist/index.js",
            compatibilityDate: "2026-10-01",
            bindings: { PUBLIC_ORIGIN: "https://rhanthai.supakorn.me" },
          },
        ],
      },
    }),
  ],
  test: { include: ["tests/integration/**/*.test.ts"] },
});
