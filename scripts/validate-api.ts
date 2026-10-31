import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";

export async function validateApi(path = "openapi.yaml") {
  return SwaggerParser.validate(path);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await validateApi();
  console.log("OpenAPI contract is valid.");
}
