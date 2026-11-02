import { env } from "cloudflare:workers";
import { createApp } from "./app";
import { catalogue } from "./catalogue";

const bindings = env as unknown as {
  PUBLIC_ORIGIN: string;
  APP_REVISION?: string;
};

const app = createApp(
  () => catalogue,
  (request) => {
    // Only previews opt in; production keeps its configured canonical origin.
    if (bindings.PUBLIC_ORIGIN === "request") {
      return new URL(request.url).origin;
    }

    if (!bindings.PUBLIC_ORIGIN) {
      throw new Error("PUBLIC_ORIGIN must be configured");
    }

    return bindings.PUBLIC_ORIGIN;
  },
);

export default {
  async fetch(request: Request): Promise<Response> {
    const response = await app.fetch(request);
    response.headers.set(
      "X-RhanThai-Revision",
      bindings.APP_REVISION ?? "local",
    );

    return response;
  },
};
