import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3_1 } from "openapi-types";
import { createApp } from "../src/app";

export async function generateApi(): Promise<OpenAPIV3_1.Document> {
  // Generate from the same Elysia routes/schemas served by the Worker.
  // No catalogue contents, network calls, or Cloudflare bindings are needed.
  const app = createApp(
    () => [],
    () => "http://localhost",
  );
  const response = await app.fetch(
    new Request("http://localhost/openapi/json"),
  );

  if (response.status !== 200) {
    throw new Error("OpenAPI generation failed");
  }

  return (await response.json()) as OpenAPIV3_1.Document;
}

export async function validateApi() {
  return SwaggerParser.validate(await generateApi());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const document = await validateApi();

  if (process.argv.includes("--export")) {
    await mkdir("dist", { recursive: true });
    await writeFile(
      "dist/openapi.json",
      `${JSON.stringify(document, null, 2)}\n`,
    );
    console.log("Generated dist/openapi.json from Elysia routes.");
  } else {
    console.log("Generated OpenAPI contract is valid.");
  }
}
