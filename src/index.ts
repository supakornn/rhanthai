import { env } from "cloudflare:workers";
import { createApp } from "./app";
import { catalogue } from "./catalogue";

const bindings = env as unknown as {
  PUBLIC_ORIGIN: string;
  APP_REVISION?: string;
};

const app = createApp(
  () => catalogue,
  () => {
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
