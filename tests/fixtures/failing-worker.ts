import { createApp } from "../../src/app";

// Fault injection is isolated to tests; no production route can trigger this.
export default createApp(
  () => {
    throw new Error("sensitive internal detail");
  },
  () => "https://example.test",
);
