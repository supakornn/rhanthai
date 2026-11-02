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

it("serves preview photos from the same origin as the real HTTP request", async () => {
  const origin = `http://${server.address}:${server.port}`;
  const response = await fetch(`${origin}/api/v1/foods`);
  expect(response.status).toBe(200);

  const { data } = (await response.json()) as { data: Food[] };
  const photos = data.flatMap((food) => food.photos);
  expect(photos.length).toBeGreaterThan(0);

  for (const photo of photos) {
    expect(new URL(photo.url).origin).toBe(origin);

    const image = await fetch(photo.url);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/webp");
    expect(imageSize(new Uint8Array(await image.arrayBuffer()))).toMatchObject({
      width: photo.width,
      height: photo.height,
    });
  }
});
