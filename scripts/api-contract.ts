import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { listFoods } from "../src/foods";
import type { Food } from "../src/schemas";
import { validateApi } from "./validate-api";

export async function createContractValidators() {
  const document = await validateApi();

  if (!("components" in document) || !document.components?.schemas) {
    throw new Error("Missing OpenAPI schemas");
  }

  // OpenAPI annotations (example, description) are not JSON Schema keywords.
  // SwaggerParser validates the document; Ajv checks actual response values.
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const compile = <T>(name: string) => {
    const schema = document.components?.schemas?.[name];

    if (!schema) {
      throw new Error(`Missing OpenAPI schema: ${name}`);
    }

    return ajv.compile<T>(schema);
  };

  return {
    FoodList: compile<ReturnType<typeof listFoods>>("FoodList"),
    FoodDetail: compile<{ data: Food }>("FoodDetail"),
    Error: compile<{ error: { code: string; message: string } }>("Error"),
  };
}
