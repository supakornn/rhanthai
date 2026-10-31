import { openapi } from "@elysia/openapi";
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
import { headResponses, preflightResponse, queryRules } from "./documentation";
import {
  detailQuerySchema,
  errorSchema,
  listQuerySchema,
  foodDetailSchema,
  foodListSchema,
  foodSchema,
  photoSchema,
  type StoredFood,
} from "./schemas";

export function createApp(
  loadFoods: () => readonly StoredFood[],
  publicOrigin: () => string,
) {
  const respond = (request: Request, id?: string) => {
    const method = methodResponse(request.method);

    if (method) {
      return method;
    }

    const query = parseQuery(
      new URL(request.url).searchParams,
      id === undefined,
    );
    const foods = loadFoods();

    if (id === undefined) {
      return json(listFoods(foods, query, publicOrigin()));
    }

    const food = findFood(foods, id);

    return food
      ? json({ data: localizeFood(food, query.lang, publicOrigin()) })
      : errorResponse(404, "FOOD_NOT_FOUND", "Food not found.");
  };

  const app = new Elysia({ adapter: CloudflareAdapter, strictPath: true })
    .model({
      Food: foodSchema,
      Photo: photoSchema,
      FoodList: foodListSchema,
      FoodDetail: foodDetailSchema,
      Error: errorSchema,
    })
    .use(
      openapi({
        provider: "scalar",
        exclude: { methods: ["head", "options"] },
        path: "/openapi",
        specPath: "/openapi/json",
        openapiVersion: "3.1.2",
        documentation: {
          info: {
            title: "RhanThai API",
            version: "1.0.0",
            description:
              "A public, read-only Thai food catalogue with Thai and English descriptions and credited photos. No API key required.",
          },
          servers: [{ url: "/" }],
          security: [],
        },
        scalar: {
          version: "1.76.4",
          url: "/openapi/json",
          withDefaultFonts: false,
          proxyUrl: "",
          showDeveloperTools: "never",
          agent: { disabled: true },
        },
      }),
    )
    .onError(({ code, error }) => {
      if (
        error instanceof QueryError ||
        (code === "VALIDATION" && error.type !== "response")
      ) {
        return errorResponse(
          400,
          "INVALID_QUERY_PARAMETER",
          error instanceof QueryError
            ? error.message
            : "Invalid query parameter.",
        );
      }

      if (code === "NOT_FOUND") {
        return errorResponse(404, "NOT_FOUND", "Endpoint not found.");
      }

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
    .get(
      "/",
      () =>
        new Response(null, { status: 302, headers: { Location: "/openapi" } }),
      {
        detail: { hide: true },
      },
    )
    .get("/favicon.ico", () => new Response(null, { status: 204 }), {
      detail: { hide: true },
    })
    .get("/api/v1/foods", ({ request }) => respond(request), {
      detail: {
        operationId: "listFoods",
        summary: "List Thai foods",
        description: `Sorted by ASCII ID ascending. Pages beyond the end return an empty data array. ${queryRules}`,
      },
      query: listQuerySchema,
      response: { 200: "FoodList", 400: "Error", 405: "Error", 500: "Error" },
    })
    .get(
      "/api/v1/foods/:id",
      ({ request, params }) => respond(request, params.id),
      {
        detail: {
          operationId: "getFood",
          summary: "Get a Thai food",
          description: `IDs stay the same across languages. Query validation happens before lookup. ${queryRules}`,
        },
        query: detailQuerySchema,
        response: {
          200: "FoodDetail",
          400: "Error",
          404: "Error",
          405: "Error",
          500: "Error",
        },
      },
    )
    .head("/api/v1/foods", ({ request }) => respond(request), {
      query: listQuerySchema,
      detail: {
        operationId: "headFoods",
        summary: "List headers without a body",
        responses: headResponses,
      },
    })
    .head(
      "/api/v1/foods/:id",
      ({ request, params }) => respond(request, params.id),
      {
        query: detailQuerySchema,
        detail: {
          operationId: "headFood",
          summary: "Food headers without a body",
          responses: headResponses,
        },
      },
    )
    .options("/api/v1/foods", ({ request }) => respond(request), {
      detail: {
        operationId: "optionsFoods",
        summary: "CORS preflight",
        responses: preflightResponse,
      },
    })
    .options(
      "/api/v1/foods/:id",
      ({ request, params }) => respond(request, params.id),
      {
        detail: {
          operationId: "optionsFood",
          summary: "CORS preflight",
          responses: preflightResponse,
        },
      },
    )
    .all("/api/v1/foods", ({ request }) => respond(request), {
      parse: "none",
      detail: { hide: true },
    })
    .all(
      "/api/v1/foods/:id",
      ({ request, params }) => respond(request, params.id),
      {
        parse: "none",
        detail: { hide: true },
      },
    )
    .compile();

  return {
    async fetch(request: Request): Promise<Response> {
      const response = await app.fetch(request);

      return request.method === "HEAD" ? withoutBody(response) : response;
    },
  };
}
