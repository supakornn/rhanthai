import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { unstable_readConfig } from "wrangler";

const config = unstable_readConfig(
  { config: "wrangler.jsonc" },
  { hideWarnings: true },
);

// Elysia AoT must execute at isolate startup, not via Vite's dynamic imports.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-10-01",
        serviceBindings: {
          API: "api-under-test",
          PREVIEW_API: "preview-under-test",
          UNCONFIGURED_API: "unconfigured-under-test",
        },
        workers: [
          {
            name: "api-under-test",
            modules: true,
            scriptPath: "./dist/index.js",
            compatibilityDate: "2026-10-01",
            bindings: { PUBLIC_ORIGIN: "https://rhanthai.supakorn.me" },
          },
          {
            name: "preview-under-test",
            modules: true,
            scriptPath: "./dist/index.js",
            compatibilityDate: "2026-10-01",
            bindings: config.previews?.vars,
          },
          {
            name: "unconfigured-under-test",
            modules: true,
            scriptPath: "./dist/index.js",
            compatibilityDate: "2026-10-01",
          },
        ],
      },
    }),
  ],
  test: { include: ["tests/integration/**/*.test.ts"] },
});
