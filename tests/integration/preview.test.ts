import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Food } from "../../src/schemas";

const {
  API: production,
  PREVIEW_API: preview,
  UNCONFIGURED_API: unconfigured,
} = env as unknown as {
  API: Fetcher;
  PREVIEW_API: Fetcher;
  UNCONFIGURED_API: Fetcher;
};

async function photoUrls(response: Response) {
  expect(response.status).toBe(200);

  const { data } = (await response.json()) as { data: Food | Food[] };
  const foods = Array.isArray(data) ? data : [data];
  const urls = foods.flatMap((food) => food.photos.map((photo) => photo.url));
  expect(urls.length).toBeGreaterThan(0);

  return urls;
}

describe("Worker preview origins", () => {
  it.each(["/api/v1/foods", "/api/v1/foods/khao-soi?lang=th"])(
    "uses each request origin for %s without cross-request leakage",
    async (path) => {
      const origins = [
        "https://first-preview.example.test",
        "https://second-preview.example.test",
        "https://first-preview.example.test",
      ];
      const responses = await Promise.all(
        origins.map((origin) =>
          preview.fetch(`${origin}${path}`, {
            headers: {
              host: "spoofed.example.test",
              "x-forwarded-host": "spoofed.example.test",
              "x-forwarded-proto": "http",
              forwarded: "host=spoofed.example.test;proto=http",
            },
          }),
        ),
      );

      for (const [index, response] of responses.entries()) {
        const urls = await photoUrls(response);

        for (const url of urls) {
          expect(new URL(url).origin).toBe(origins[index]);
        }
      }
    },
  );

  it("keeps the configured production origin regardless of request host", async () => {
    const response = await production.fetch(
      "https://not-production.example.test/api/v1/foods",
      { headers: { "x-forwarded-host": "spoofed.example.test" } },
    );

    for (const url of await photoUrls(response)) {
      expect(new URL(url).origin).toBe("https://rhanthai.supakorn.me");
    }
  });

  it("does not fall back to the request origin when production is unconfigured", async () => {
    const response = await unconfigured.fetch(
      "https://not-production.example.test/api/v1/foods",
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  it("keeps Scalar and its OpenAPI server relative to the preview", async () => {
    const origin = "https://first-preview.example.test";
    const docs = await preview.fetch(`${origin}/openapi`);
    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain("/openapi/json");

    const spec = await preview.fetch(`${origin}/openapi/json`);
    expect(spec.status).toBe(200);
    expect(await spec.json()).toMatchObject({ servers: [{ url: "/" }] });
  });
});
