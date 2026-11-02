import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";

const config = unstable_readConfig(
  { config: "wrangler.jsonc" },
  { hideWarnings: true },
);

describe("Cloudflare preview configuration", () => {
  it("explicitly enables request-based origins for previews", () => {
    expect(config.previews).toMatchObject({
      vars: { PUBLIC_ORIGIN: "request" },
    });
  });

  it("keeps assets shared at the top level without production routes in previews", () => {
    expect(config.assets?.directory).toBeDefined();
    expect(config.previews).toBeDefined();
    expect(config.previews).not.toHaveProperty("routes");
    expect(config.previews).not.toHaveProperty("assets");
  });

  it("preserves fixed local and production origins", () => {
    expect(config.vars.PUBLIC_ORIGIN).toBe("http://localhost:8787");

    const production = unstable_readConfig(
      { config: "wrangler.jsonc", env: "production" },
      { hideWarnings: true },
    );
    expect(production.vars.PUBLIC_ORIGIN).toBe("https://rhanthai.supakorn.me");
    expect(production.routes).toEqual([
      { pattern: "rhanthai.supakorn.me", custom_domain: true },
    ]);
  });
});
