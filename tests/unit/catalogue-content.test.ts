import { readFile } from "node:fs/promises";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { catalogue } from "../../src/catalogue";
import { storedFoodSchema } from "../../src/schemas";

const provenanceSchema = Type.Array(
  Type.Object(
    {
      id: Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
      sources: Type.Array(
        Type.Object(
          {
            url: Type.String({ pattern: "^https://[^\\s]+$" }),
            accessed: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
            notes: Type.String({ pattern: "\\S" }),
          },
          { additionalProperties: false },
        ),
        { minItems: 1 },
      ),
    },
    { additionalProperties: false },
  ),
);

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

  it("has complete bilingual text, no unverified photos, and no extra public fields", () => {
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

  it("has exactly one provenance record per food with consulted HTTPS sources and valid access dates", async () => {
    const provenance: unknown = JSON.parse(
      await readFile("research/foods.sources.json", "utf8"),
    );
    expect(Value.Check(provenanceSchema, provenance)).toBe(true);
    if (!Value.Check(provenanceSchema, provenance)) {
      throw new Error("Invalid provenance structure");
    }
    expect(provenance.map((entry) => entry.id)).toEqual(
      catalogue.map((food) => food.id),
    );
    for (const entry of provenance) {
      expect(new Set(entry.sources.map((source) => source.url)).size).toBe(
        entry.sources.length,
      );
      for (const source of entry.sources) {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(url.hostname).not.toBe("");
        expect(url.username + url.password).toBe("");
        const accessed = new Date(source.accessed);
        expect(accessed.toISOString().slice(0, 10)).toBe(source.accessed);
        expect(accessed.getTime()).toBeLessThanOrEqual(Date.now());
        expect(source.notes.trim().length).toBeGreaterThan(20);
      }
    }
  });
});
