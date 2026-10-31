import { describe, expect, it } from "vitest";
import { runSmoke } from "../../scripts/smoke";

function fakeApi(
  options: {
    broken?: boolean;
    malformed?: boolean;
    photo?: string;
    revision?: string;
  } = {},
) {
  return (async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const food = {
      id: "test-food",
      name: url.searchParams.get("lang") === "th" ? "อาหาร" : "Food",
      description: "Description",
      photos: options.photo
        ? [
            {
              url: options.photo,
              width: 1,
              height: 1,
              alt: "Image",
              credit: { name: "Test", url: null },
              sourceUrl: "https://example.com/source",
              license: { name: "CC0", url: "https://example.com/license" },
            },
          ]
        : [],
    };
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-RhanThai-Revision": options.revision ?? "test",
    };
    if (url.pathname.startsWith("/photos/")) {
      return new Response("image", {
        headers: { "Content-Type": "image/png" },
      });
    }
    if (options.broken) {
      return new Response("broken", { status: 503 });
    }
    if (options.malformed) {
      return Response.json({ data: "bad" }, { headers });
    }
    if (url.searchParams.get("lang") === "invalid") {
      return Response.json(
        {
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid language.",
          },
        },
        { status: 400, headers },
      );
    }
    if (url.pathname.endsWith("/__smoke_missing__")) {
      return Response.json(
        { error: { code: "FOOD_NOT_FOUND", message: "Food not found." } },
        { status: 404, headers },
      );
    }
    if (url.pathname === "/api/v1/foods") {
      return Response.json(
        {
          data: [food],
          pagination: { page: 1, limit: 1, totalItems: 1, totalPages: 1 },
        },
        { headers },
      );
    }
    return Response.json({ data: food }, { headers });
  }) as typeof fetch;
}

describe("deployment smoke checker", () => {
  it("finds a photo even when the first food has no photos", async () => {
    const fetchImpl = (async (...args: Parameters<typeof fetch>) => {
      const response = await fakeApi()(...args);
      const url = new URL(String(args[0]));
      if (response.status !== 200 || url.pathname !== "/api/v1/foods") {
        return response;
      }
      const body = (await response.json()) as {
        data: Record<string, unknown>[];
        pagination: Record<string, number>;
      };
      body.pagination.totalItems = 2;
      body.pagination.totalPages =
        url.searchParams.get("limit") === "100" ? 1 : 2;
      if (url.searchParams.get("limit") === "100") {
        body.pagination.limit = 100;
        const withPhoto = (await (
          await fakeApi({ photo: "https://api.test/photos/test.png" })(
            "https://api.test/api/v1/foods/test-food",
          )
        ).json()) as { data: Record<string, unknown> };
        body.data.push({ ...withPhoto.data, id: "with-photo" });
      }
      return Response.json(body, { headers: response.headers });
    }) as typeof fetch;
    await expect(
      runSmoke("https://api.test", { fetchImpl, attempts: 1 }),
    ).resolves.toEqual({ photoChecked: true });
  });
  it("checks catalogue, languages, errors, and an optional photo", async () => {
    await expect(
      runSmoke("https://api.test", { fetchImpl: fakeApi(), attempts: 1 }),
    ).resolves.toMatchObject({ photoChecked: false });
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: fakeApi({ photo: "https://api.test/photos/test.png" }),
        attempts: 1,
      }),
    ).resolves.toMatchObject({ photoChecked: true });
  });
  it("fails on malformed responses and revision mismatch", async () => {
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: fakeApi({ malformed: true }),
        attempts: 1,
      }),
    ).rejects.toThrow(Error);
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: fakeApi(),
        attempts: 1,
        revision: "other",
      }),
    ).rejects.toThrow(Error);
  });
  it("bounds retries and can recover from propagation failures", async () => {
    let calls = 0;
    const recover = (async (...args: Parameters<typeof fetch>) => {
      calls++;
      return calls === 1
        ? new Response("pending", { status: 503 })
        : fakeApi()(...args);
    }) as typeof fetch;
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: recover,
        attempts: 2,
        delayMs: 0,
      }),
    ).resolves.toMatchObject({ photoChecked: false });
    let failures = 0;
    const fail = (async () => {
      failures++;
      return new Response("bad", { status: 503 });
    }) as typeof fetch;
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: fail,
        attempts: 2,
        delayMs: 0,
      }),
    ).rejects.toThrow(Error);
    expect(failures).toBe(2);
  });
  it("does not follow photo URLs to another origin", async () => {
    await expect(
      runSmoke("https://api.test", {
        fetchImpl: fakeApi({ photo: "https://other.test/photo.png" }),
        attempts: 1,
      }),
    ).rejects.toThrow(Error);
  });
  it("rejects insecure nonlocal base URLs", async () => {
    await expect(runSmoke("http://api.test", { attempts: 1 })).rejects.toThrow(
      Error,
    );
  });
});
