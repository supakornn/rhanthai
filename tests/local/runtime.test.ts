import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imageSize } from "image-size";
import { type Unstable_DevWorker, unstable_dev } from "wrangler";

import { createContractValidators } from "../../scripts/api-contract";
import { runSmoke } from "../../scripts/smoke";
import { catalogue } from "../../src/catalogue";

const validators = await createContractValidators();
const publicOrigin = "https://catalogue.test";
let server: Unstable_DevWorker;
let assets: string;
beforeAll(async () => {
  assets = await mkdtemp(join(tmpdir(), "rhanthai-photo-assets-"));
  await cp("public", assets, { recursive: true });
  await cp("tests/fixtures/public", assets, { recursive: true });
  server = await unstable_dev("src/index.ts", {
    config: "wrangler.jsonc",
    env: "",
    port: 0,
    inspectorPort: 0,
    assets,
    vars: { PUBLIC_ORIGIN: publicOrigin },
    local: true,
    persist: false,
    logLevel: "error",
    experimental: {
      disableExperimentalWarning: true,
      disableDevRegistry: true,
      watch: false,
    },
  });
}, 30_000);
afterAll(async () => {
  await server?.stop();
  if (assets) {
    await rm(assets, { recursive: true, force: true });
  }
});

describe("real Wrangler routing", () => {
  it("passes the deployment smoke checker against a real local Worker", async () => {
    const result = await runSmoke(publicOrigin, {
      attempts: 1,
      revision: "local",
      // Route the configured public origin through the real local HTTP server.
      fetchImpl: (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        const local = new URL(
          `${url.pathname}${url.search}`,
          `http://${server.address}:${server.port}`,
        );

        return fetch(local, init);
      },
    });
    expect(result).toEqual({ photoChecked: true });
  });
  it("serves synthetic photo bytes directly rather than through the API", async () => {
    const response = await server.fetch("/photos/pixel.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(20);
    expect(response.headers.get("cache-control")).not.toBe("no-store");
  });
  it("serves a catalogue photo byte-for-byte from Static Assets", async () => {
    const photo = catalogue.flatMap((food) => food.photos)[0];
    if (!photo) {
      throw new Error("Expected a published catalogue photo");
    }
    const response = await server.fetch(photo.path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    const expected = await readFile(`public${photo.path}`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(expected),
    );
  });
  it("serves the public attribution file alongside the photographs", async () => {
    const response = await server.fetch("/photo-credits.txt");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe(
      await readFile("public/photo-credits.txt", "utf8"),
    );
  });
  it.each(["khao-soi", "pad-thai", "som-tam"])(
    "serves the published %s photo as a static asset",
    async (id) => {
      const response = await server.fetch(`/photos/${id}.webp`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/webp");
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(imageSize(bytes)).toMatchObject({
        width: 1280,
        height: 960,
        type: "webp",
      });
      expect(bytes.byteLength).toBeLessThan(250_000);
      expect(response.headers.get("cache-control")).not.toBe("no-store");
    },
  );
  it("serves the API alongside assets without SPA fallback", async () => {
    const response = await server.fetch("/api/v1/foods");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      validators.FoodList(body),
      JSON.stringify(validators.FoodList.errors),
    ).toBe(true);
    const detail = await server.fetch("/api/v1/foods/khao-soi?lang=th");
    expect(validators.FoodDetail(await detail.json())).toBe(true);
    const missing = await server.fetch("/photos/missing.png");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).not.toContain("text/html");
  });
});

it("contains unexpected runtime failures without disclosing internals", async () => {
  const failing = await unstable_dev("tests/fixtures/failing-worker.ts", {
    config: "wrangler.jsonc",
    env: "",
    port: 0,
    inspectorPort: 0,
    local: true,
    persist: false,
    logLevel: "error",
    experimental: {
      disableExperimentalWarning: true,
      disableDevRegistry: true,
      watch: false,
    },
  });
  try {
    const response = await failing.fetch("/api/v1/foods");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
  } finally {
    await failing.stop();
  }
}, 30_000);
