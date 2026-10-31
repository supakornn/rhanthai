import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const api = (env as unknown as { API: Fetcher }).API;

describe("Scalar API documentation", () => {
  it("redirects the root to Scalar without following the redirect", async () => {
    const response = await api.fetch("https://example.test/", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/openapi");
  });

  it("handles the browser favicon request without a 404", async () => {
    const response = await api.fetch("https://example.test/favicon.ico");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("serves Scalar HTML configured to load the same-origin specification", async () => {
    const response = await api.fetch("https://example.test/openapi");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();

    expect(html).toContain("RhanThai API");
    expect(html).toContain("@scalar/api-reference@1.76.4");
    expect(html).toContain("/openapi/json");
    expect(html).not.toContain("@latest");
  });

  it("generates schemas, queries, and statuses with only GET operations", async () => {
    const response = await api.fetch("https://example.test/openapi/json");
    const spec = (await response.json()) as {
      openapi: string;
      paths: Record<
        string,
        Record<
          string,
          { parameters: { name: string }[]; responses: Record<string, unknown> }
        >
      >;
      components: { schemas: Record<string, unknown> };
    };

    expect(response.status).toBe(200);
    expect(spec.openapi).toMatch(/^3\.1\./);
    expect(Object.keys(spec.paths).toSorted()).toEqual([
      "/api/v1/foods",
      "/api/v1/foods/{id}",
    ]);

    const list = spec.paths["/api/v1/foods"];
    const detail = spec.paths["/api/v1/foods/{id}"];

    expect(Object.keys(list ?? {})).toEqual(["get"]);
    expect(Object.keys(detail ?? {})).toEqual(["get"]);
    expect(list?.get?.parameters.map((parameter) => parameter.name)).toEqual([
      "lang",
      "page",
      "limit",
    ]);
    expect(list?.get?.responses).toHaveProperty("400");
    expect(list?.get?.responses).toHaveProperty("405");
    expect(detail?.get?.responses).toHaveProperty("404");

    for (const name of ["Food", "Photo", "FoodList", "FoodDetail", "Error"]) {
      expect(spec.components.schemas).toHaveProperty(name);
    }
  });
});
