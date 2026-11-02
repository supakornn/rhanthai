import { afterAll, beforeAll, expect, it } from "vitest";
import { imageSize } from "image-size";
import {
  type Unstable_DevWorker,
  unstable_dev,
  unstable_readConfig,
} from "wrangler";
import type { Food } from "../../src/schemas";

const config = unstable_readConfig(
  { config: "wrangler.jsonc" },
  { hideWarnings: true },
);
let server: Unstable_DevWorker;

beforeAll(async () => {
  server = await unstable_dev("src/index.ts", {
    config: "wrangler.jsonc",
    env: "",
    port: 0,
    inspectorPort: 0,
    assets: "public",
    vars: config.previews?.vars,
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
});

it.each(["/api/v1/foods", "/api/v1/foods/khao-soi"])(
  "serves preview photos from %s at the real request origin",
  async (path) => {
    const origin = `http://${server.address}:${server.port}`;
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as { data: Food | Food[] };
    const foods = Array.isArray(data) ? data : [data];
    const photos = foods.flatMap((food) => food.photos);
    expect(photos.length).toBeGreaterThan(0);

    for (const photo of photos) {
      expect(new URL(photo.url).origin).toBe(origin);

      const image = await fetch(photo.url);
      expect(image.status).toBe(200);
      const type = new URL(photo.url).pathname.split(".").at(-1);
      expect(["jpg", "webp"]).toContain(type);
      const contentType = type === "webp" ? "image/webp" : "image/jpeg";
      expect(image.headers.get("content-type")).toContain(contentType);
      expect(
        imageSize(new Uint8Array(await image.arrayBuffer())),
      ).toMatchObject({
        width: photo.width,
        height: photo.height,
        type,
      });
    }
  },
);
