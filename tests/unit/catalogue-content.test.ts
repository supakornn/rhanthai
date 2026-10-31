import { existsSync } from "node:fs";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { catalogue } from "../../src/catalogue";
import { storedFoodSchema } from "../../src/schemas";

describe("production catalogue editorial invariants", () => {
  it("contains exactly 100 unique dishes in stable ID order and preserves existing IDs", () => {
    const ids = catalogue.map((food) => food.id);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
    expect(ids).toEqual(ids.toSorted());
    expect(ids).toEqual(
      expect.arrayContaining(["khao-soi", "pad-thai", "som-tam"]),
    );
    for (const lang of ["en", "th"] as const) {
      expect(new Set(catalogue.map((food) => food.name[lang])).size).toBe(100);
    }
  });

  it("has complete bilingual text and photo alt text with no extra public fields", () => {
    for (const food of catalogue) {
      expect(Value.Check(storedFoodSchema, food), food.id).toBe(true);
      for (const field of [food.name, food.description]) {
        expect(field.en, food.id).toMatch(/[A-Za-z]/);
        expect(field.th, food.id).toMatch(/[ก-๙]/);
        expect(field.en, food.id).not.toBe(field.th);
        expect(field.en.trim(), food.id).toBe(field.en);
        expect(field.th.trim(), food.id).toBe(field.th);
      }
      expect(food.photos.length, food.id).toBeLessThanOrEqual(1);
      for (const photo of food.photos) {
        expect(photo.alt.en, food.id).toMatch(/[A-Za-z]/);
        expect(photo.alt.th, food.id).toMatch(/[ก-๙]/);
        expect(photo.alt.en, food.id).not.toBe(photo.alt.th);
      }
    }
  });

  it("does not include the retired internal research directory", () => {
    expect(existsSync("research")).toBe(false);
  });
});
