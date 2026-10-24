import { env } from "cloudflare:workers";
import { createApp } from "./app";
import { catalogue } from "./catalogue";

export default createApp(
  () => catalogue,
  () => {
    const origin = (env as unknown as { PUBLIC_ORIGIN: string }).PUBLIC_ORIGIN;
    if (!origin) throw new Error("PUBLIC_ORIGIN must be configured");
    return origin;
  },
);
