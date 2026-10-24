import { env } from "cloudflare:workers";

const api = (env as unknown as { API: Fetcher }).API;

import { expect, it } from "vitest";

it("runs the Elysia API in workerd and rejects invalid language", async () => {
  const response = await api.fetch("https://example.test/api/v1/foods");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: expect.any(Array) });
  const invalid = await api.fetch("https://example.test/api/v1/foods?lang=jp");
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: { code: "INVALID_QUERY_PARAMETER" },
  });
});
