import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateCatalogue } from "../../scripts/validate-data";
import type { StoredFood } from "../../src/schemas";

let root: string;
let food: StoredFood;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "rhanthai-data-"));
  await mkdir(join(root, "data/foods"), { recursive: true });
  await mkdir(join(root, "public/photos"), { recursive: true });
  food = {
    id: "test-food",
    name: { en: "Food", th: "อาหาร" },
    description: { en: "Description", th: "คำอธิบาย" },
    photos: [],
  };
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const save = async (value: unknown = food, filename = "test-food.json") =>
  writeFile(join(root, "data/foods", filename), JSON.stringify(value));
const check = () => validateCatalogue(root, [food]);

describe("catalogue validation", () => {
  it("accepts complete bilingual content with no photos", async () => {
    await save();
    await expect(check()).resolves.toBe(1);
  });
  it.each([
    ["missing Thai", (f: StoredFood) => ({ ...f, name: { en: "Food" } })],
    [
      "blank content",
      (f: StoredFood) => ({ ...f, description: { en: "  ", th: "ไทย" } }),
    ],
    ["unknown field", (f: StoredFood) => ({ ...f, region: "north" })],
    ["invalid slug", (f: StoredFood) => ({ ...f, id: "BAD_ID" })],
    [
      "extra language",
      (f: StoredFood) => ({ ...f, name: { ...f.name, jp: "food" } }),
    ],
  ])("rejects %s", async (_name, mutate) => {
    await save(mutate(food));
    await expect(check()).rejects.toThrow(Error);
  });
  it("rejects filename mismatch and duplicate IDs", async () => {
    await save(food, "different.json");
    await expect(check()).rejects.toThrow(Error);
    await save();
    await expect(check()).rejects.toThrow(Error);
  });
  it("rejects missing imports and stale bundled contents", async () => {
    await save();
    await expect(validateCatalogue(root, [])).rejects.toThrow(Error);
    await expect(
      validateCatalogue(root, [{ ...food, name: { en: "Stale", th: "เก่า" } }]),
    ).rejects.toThrow(Error);
  });
  it("rejects unreferenced publication images", async () => {
    await save();
    await writeFile(join(root, "public/photos/orphan.png"), "bad");
    await expect(check()).rejects.toThrow(Error);
  });
});

describe("photo validation", () => {
  beforeEach(async () => {
    food.photos = [
      {
        path: "/photos/test.png",
        width: 1,
        height: 1,
        alt: { en: "Test image", th: "ภาพทดสอบ" },
        credit: { name: "Test", url: null },
        sourceUrl: "https://example.com/source",
        license: { name: "CC0", url: "https://example.com/license" },
      },
    ];
    await writeFile(
      join(root, "public/photos/test.png"),
      await readFile("tests/fixtures/public/photos/pixel.png"),
    );
  });
  it("accepts measured dimensions and complete attribution", async () => {
    await save();
    await expect(check()).resolves.toBe(1);
  });
  it.each([
    ["wrong dimensions", { width: 2 }],
    ["zero dimensions", { height: 0 }],
    ["traversal", { path: "/photos/../secret.png" }],
    ["missing file", { path: "/photos/absent.png" }],
    ["insecure source", { sourceUrl: "http://example.com" }],
    ["invalid URL", { sourceUrl: "https://???" }],
    [
      "embedded credentials",
      { sourceUrl: "https://user:password@example.com" },
    ],
    ["missing credit", { credit: null }],
    ["incomplete alt", { alt: { en: "Only English" } }],
    ["incomplete license", { license: { name: "CC0" } }],
  ])("rejects %s", async (_name, patch) => {
    food.photos[0] = {
      ...food.photos[0],
      ...patch,
    } as StoredFood["photos"][number];
    await save();
    await expect(check()).rejects.toThrow(Error);
  });
});
