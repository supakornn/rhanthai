const methods = "GET, HEAD, OPTIONS";

export const apiHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...apiHeaders, ...headers },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return json({ error: { code, message } }, status, headers);
}

export function methodResponse(method: string): Response | undefined {
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...apiHeaders,
        "Access-Control-Allow-Methods": methods,
      },
    });
  }

  if (method !== "GET" && method !== "HEAD") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed.", {
      Allow: methods,
    });
  }
}

export function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
