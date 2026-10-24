import { describe, expect, it } from "vitest";
import { createContractValidators } from "../../scripts/api-contract";
import { catalogue } from "../../src/catalogue";
import { listFoods, localizeFood } from "../../src/foods";

const validators = await createContractValidators();
describe("OpenAPI response contract", () => {
  it("accepts real catalogue responses in both languages", () => {
    for (const lang of ["en", "th"] as const) {
      expect(
        validators.FoodList(
          listFoods(
            catalogue,
            { lang, page: 1, limit: 20 },
            "https://example.com",
          ),
        ),
      ).toBe(true);
      for (const food of catalogue)
        expect(
          validators.FoodDetail({
            data: localizeFood(food, lang, "https://example.com"),
          }),
        ).toBe(true);
    }
  });
  it("rejects missing fields, invalid photos, and undocumented errors", () => {
    expect(
      validators.FoodDetail({ data: { id: "khao-soi", name: "Food" } }),
    ).toBe(false);
    expect(
      validators.Error({ error: { code: "SOMETHING_ELSE", message: "error" } }),
    ).toBe(false);
    expect(
      validators.FoodDetail({
        data: {
          id: "food",
          name: "Food",
          description: "Dish",
          photos: [{ url: "bad" }],
        },
      }),
    ).toBe(false);
  });
});
