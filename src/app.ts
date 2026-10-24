import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import {
  findFood,
  listFoods,
  localizeFood,
  parseQuery,
  QueryError,
} from "./foods";
import { errorResponse, json, methodResponse, withoutBody } from "./http";
import type { StoredFood } from "./schemas";

export function createApp(
  loadFoods: () => readonly StoredFood[],
  publicOrigin: () => string,
) {
  const respond = (request: Request, id?: string) => {
    const method = methodResponse(request.method);
    if (method) return method;
    const query = parseQuery(
      new URL(request.url).searchParams,
      id === undefined,
    );
    const foods = loadFoods();
    if (id === undefined) return json(listFoods(foods, query, publicOrigin()));
    const food = findFood(foods, id);
    return food
      ? json({ data: localizeFood(food, query.lang, publicOrigin()) })
      : errorResponse(404, "FOOD_NOT_FOUND", "Food not found.");
  };
  const app = new Elysia({ adapter: CloudflareAdapter, strictPath: true })
    .onError(({ code, error }) => {
      if (error instanceof QueryError)
        return errorResponse(400, "INVALID_QUERY_PARAMETER", error.message);
      if (code === "NOT_FOUND")
        return errorResponse(404, "NOT_FOUND", "Endpoint not found.");
      // No raw URLs, headers, error messages, or stack traces in public logs.
      console.error(
        JSON.stringify({
          event: "unexpected_error",
          requestId: crypto.randomUUID(),
        }),
      );
      return errorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred.",
      );
    })
    .all("/api/v1/foods", ({ request }) => respond(request), { parse: "none" })
    .all(
      "/api/v1/foods/:id",
      ({ request, params }) => respond(request, params.id),
      { parse: "none" },
    )
    .compile();

  return {
    async fetch(request: Request): Promise<Response> {
      const response = await app.fetch(request);
      return request.method === "HEAD" ? withoutBody(response) : response;
    },
  };
}
