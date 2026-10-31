import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type { ValidateFunction } from "ajv";
import { createContractValidators } from "./api-contract";

type SmokeOptions = {
  fetchImpl?: typeof fetch;
  attempts?: number;
  delayMs?: number;
  revision?: string;
};

export async function runSmoke(baseUrl: string, options: SmokeOptions = {}) {
  const base = new URL(baseUrl);

  if (
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
      ))
  ) {
    throw new Error(
      "Smoke base must be an HTTPS origin (HTTP allowed only on localhost)",
    );
  }

  const attempts = options.attempts ?? 3;

  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    throw new Error("Smoke attempts must be 1–5");
  }

  const validators = await createContractValidators();
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = (path: string) =>
    fetchImpl(new URL(path, base), {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  async function read<T>(
    path: string,
    status: number,
    validate: ValidateFunction<T>,
  ): Promise<T> {
    const response = await request(path);

    if (response.status !== status) {
      throw new Error(
        `Smoke HTTP status: expected ${status}, received ${response.status}`,
      );
    }

    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Smoke: expected JSON");
    }

    if (response.headers.get("access-control-allow-origin") !== "*") {
      throw new Error("Smoke: missing CORS");
    }

    if (response.headers.get("cache-control") !== "no-store") {
      throw new Error("Smoke: unexpected API cache policy");
    }

    if (
      options.revision &&
      response.headers.get("x-rhanthai-revision") !== options.revision
    ) {
      throw new Error("Smoke: deployed revision mismatch");
    }

    const body: unknown = await response.json();

    if (!validate(body)) {
      throw new Error("Smoke: response does not match OpenAPI");
    }

    return body;
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const list = await read(
        "/api/v1/foods?lang=en&page=1&limit=1",
        200,
        validators.FoodList,
      );
      const first = list.data[0];

      if (
        !first ||
        list.data.length !== 1 ||
        list.pagination.page !== 1 ||
        list.pagination.limit !== 1
      ) {
        throw new Error("Smoke: expected a nonempty one-item page");
      }

      const path = `/api/v1/foods/${encodeURIComponent(first.id)}`;
      const en = await read(`${path}?lang=en`, 200, validators.FoodDetail);
      const th = await read(`${path}?lang=th`, 200, validators.FoodDetail);

      if (
        en.data.id !== first.id ||
        th.data.id !== first.id ||
        th.data.name === en.data.name
      ) {
        throw new Error("Smoke: inconsistent localization or ID");
      }

      const missing = await read(
        "/api/v1/foods/__smoke_missing__",
        404,
        validators.Error,
      );
      const invalid = await read(
        "/api/v1/foods?lang=invalid",
        400,
        validators.Error,
      );

      if (
        missing.error.code !== "FOOD_NOT_FOUND" ||
        invalid.error.code !== "INVALID_QUERY_PARAMETER"
      ) {
        throw new Error("Smoke: unexpected error code");
      }

      let photo = first.photos[0];

      if (!photo && list.pagination.totalItems > 1) {
        const pages = Math.ceil(list.pagination.totalItems / 100);

        if (pages > 100) {
          throw new Error(
            "Smoke: catalogue exceeds bounded photo scan (10,000 foods)",
          );
        }

        for (let page = 1; page <= pages && !photo; page++) {
          const batch = await read(
            `/api/v1/foods?lang=en&page=${page}&limit=100`,
            200,
            validators.FoodList,
          );

          if (
            batch.pagination.page !== page ||
            batch.pagination.limit !== 100
          ) {
            throw new Error("Smoke: inconsistent pagination");
          }
          photo = batch.data.flatMap((food) => food.photos)[0];
        }
      }

      if (photo) {
        const url = new URL(photo.url);

        if (url.origin !== base.origin) {
          throw new Error("Smoke: photo outside API origin");
        }

        const image = await request(url.pathname);

        if (
          image.status !== 200 ||
          !image.headers.get("content-type")?.startsWith("image/")
        ) {
          throw new Error("Smoke: photo unavailable");
        }
        await image.body?.cancel();
      }

      return { photoChecked: Boolean(photo) };
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await setTimeout(options.delayMs ?? 2_000);
    }
  }
  throw new Error("Smoke failed");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const baseUrl = process.argv[2];

  if (!baseUrl) {
    throw new Error("Usage: bun run smoke <origin> [revision]");
  }

  const result = await runSmoke(baseUrl, { revision: process.argv[3] });
  console.log(
    `Smoke passed. Photo check: ${result.photoChecked ? "passed" : "not applicable (catalogue has no photos)"}.`,
  );
}
