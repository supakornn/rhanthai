import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Food } from "../../src/schemas";

const api = (env as unknown as { API: Fetcher }).API;
const get = (path: string, init?: RequestInit) =>
  api.fetch(`https://example.test${path}`, init);

describe("food API", () => {
  it("lists the catalogue with defaults and exact public field names", async () => {
    const response = await get("/api/v1/foods");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Record<string, unknown>[];
      pagination: unknown;
    };
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      totalItems: 3,
      totalPages: 1,
    });
    expect(body.data.map((food) => food.id)).toEqual([
      "khao-soi",
      "pad-thai",
      "som-tam",
    ]);
    expect(Object.keys(body.data[0] ?? {}).toSorted()).toEqual([
      "description",
      "id",
      "name",
      "photos",
    ]);
  });
  it("returns localized detail and the same shape in lists", async () => {
    const en = (await (await get("/api/v1/foods/khao-soi")).json()) as {
      data: Food;
    };
    const th = (await (
      await get("/api/v1/foods/khao-soi?lang=th")
    ).json()) as typeof en;
    expect(en.data.name).toBe("Khao soi");
    expect(th.data.name).toBe("ข้าวซอย");
    expect(th.data.id).toBe(en.data.id);
    expect(th.data.photos).toHaveLength(1);
    expect(th.data.photos[0]?.alt).not.toBe(en.data.photos[0]?.alt);
    const list = (await (
      await get("/api/v1/foods?lang=th&limit=1")
    ).json()) as { data: unknown[] };
    expect(list.data[0]).toEqual(th.data);
  });
  it.each(["khao-soi", "pad-thai", "som-tam"])(
    "includes a credited, localized photo for %s",
    async (id) => {
      const en = (await (await get(`/api/v1/foods/${id}`)).json()) as {
        data: Food;
      };
      const th = (await (
        await get(`/api/v1/foods/${id}?lang=th`)
      ).json()) as typeof en;

      expect(en.data.photos).toHaveLength(1);
      expect(th.data.photos).toHaveLength(1);

      const photo = en.data.photos[0];
      const translated = th.data.photos[0];

      expect(photo).toMatchObject({
        url: `https://rhanthai.supakorn.me/photos/${id}.webp`,
        width: 1280,
        height: 960,
        credit: {
          name: expect.any(String),
          url: expect.stringMatching(/^https:\/\//),
        },
        sourceUrl: expect.stringMatching(/^https:\/\/commons.wikimedia.org\//),
        license: {
          name: expect.stringMatching(/^CC BY /),
          url: expect.stringMatching(
            /^https:\/\/creativecommons.org\/licenses\/by\//,
          ),
        },
      });
      expect(photo?.alt).toMatch(/[A-Za-z]/);
      expect(translated?.alt).toMatch(/[ก-๙]/);
      expect(translated).toEqual({ ...photo, alt: translated?.alt });
    },
  );

  it("paginates and returns an empty beyond-end page", async () => {
    const response = await get("/api/v1/foods?page=2&limit=2");
    expect(await response.json()).toMatchObject({
      data: [{ id: "som-tam" }],
      pagination: { totalPages: 2 },
    });
    const beyond = await get("/api/v1/foods?page=9007199254740991&limit=100");
    expect(await beyond.json()).toMatchObject({
      data: [],
      pagination: { totalItems: 3 },
    });
  });
  it.each([
    "lang=jp",
    "lang=",
    "lang=en&lang=th",
    "region=north",
    "page=0",
    "limit=101",
    "page=1&page=2",
    "page=1e2",
  ])("rejects query %s", async (query) => {
    const response = await get(`/api/v1/foods?${query}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_QUERY_PARAMETER" },
    });
  });
  it("validates detail queries before checking existence", async () => {
    const response = await get("/api/v1/foods/absent?page=1");
    expect(response.status).toBe(400);
  });
  it.each([
    ["/api/v1/foods/absent", 404, "FOOD_NOT_FOUND"],
    ["/api/v1/unknown", 404, "NOT_FOUND"],
    ["/api/v1/foods/", 404, "NOT_FOUND"],
    ["/api/v1/foods/khao-soi/", 404, "NOT_FOUND"],
    ["/api/v2/foods", 404, "NOT_FOUND"],
  ])("returns documented errors for %s", async (path, status, code) => {
    const response = await get(path);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects methods before queries and does not parse posted bodies", async () => {
    const response = await get("/api/v1/foods?lang=jp", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(await response.json()).toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
    expect((await get("/unknown", { method: "POST" })).status).toBe(404);
  });
  it("handles HEAD with GET status and headers but no body", async () => {
    for (const path of [
      "/api/v1/foods",
      "/api/v1/foods?lang=jp",
      "/api/v1/foods/absent",
      "/unknown",
    ]) {
      const head = await get(path, { method: "HEAD" });
      const normal = await get(path);
      expect(head.status).toBe(normal.status);
      expect(head.headers.get("content-type")).toBe(
        normal.headers.get("content-type"),
      );
      expect(await head.text()).toBe("");
    }
  });
  it("supports noncredentialed CORS preflight and JSON headers", async () => {
    const preflight = await get("/api/v1/foods", {
      method: "OPTIONS",
      headers: {
        Origin: "https://client.test",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe("");
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD, OPTIONS",
    );
    expect(
      preflight.headers.get("access-control-allow-credentials"),
    ).toBeNull();
    const response = await get("/api/v1/foods");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
