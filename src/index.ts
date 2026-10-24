import { Elysia, t } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export default new Elysia({ adapter: CloudflareAdapter, strictPath: true })
  .onError(({ code, set }) => {
    set.status = code === "VALIDATION" ? 400 : 500;
    return {
      error: { code: "INVALID_QUERY_PARAMETER", message: "Invalid query." },
    };
  })
  .get("/api/v1/foods", () => ({ data: [] }), {
    query: t.Object({
      lang: t.Optional(t.Union([t.Literal("en"), t.Literal("th")])),
    }),
  })
  .compile();
