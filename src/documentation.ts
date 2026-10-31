export const headResponses = {
  200: { description: "GET status and headers without a body" },
  400: { description: "Invalid query; no body" },
  404: { description: "Unknown food; no body" },
  500: { description: "Unexpected error; no body" },
};

export const preflightResponse = {
  204: {
    description: "No body; wildcard CORS without credentials",
    headers: {
      "Access-Control-Allow-Origin": {
        schema: { type: "string" as const, enum: ["*"] },
      },
      "Access-Control-Allow-Methods": {
        schema: { type: "string" as const, enum: ["GET, HEAD, OPTIONS"] },
      },
    },
  },
};
