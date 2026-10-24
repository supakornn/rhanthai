import { describe, expect, it } from "vitest";
import { findFood, listFoods, localizeFood, parseQuery } from "../../src/foods";
import type { StoredFood } from "../../src/schemas";

const food: StoredFood = {
  id: "khao-soi",
  name: { en: "Khao soi", th: "ข้าวซอย" },
  description: { en: "Noodle soup.", th: "บะหมี่ในน้ำแกง" },
  photos: [
    {
      path: "/photos/soup.webp",
      width: 10,
      height: 20,
      alt: { en: "Soup", th: "น้ำแกง" },
      credit: { name: "Creator", url: null },
      sourceUrl: "https://example.com/source",
      license: { name: "CC0", url: "https://example.com/license" },
    },
  ],
};

describe("localization", () => {
  it("localizes only text, keeps metadata and IDs, and never mutates the source", () => {
    const original = structuredClone(food);
    const en = localizeFood(food, "en", "https://rhanthai.supakorn.me");
    const th = localizeFood(food, "th", "https://rhanthai.supakorn.me");
    expect(th).toMatchObject({
      id: en.id,
      name: "ข้าวซอย",
      description: food.description.th,
    });
    expect(th.photos[0]).toEqual({ ...en.photos[0], alt: "น้ำแกง" });
    expect(en.photos[0]?.url).toBe(
      "https://rhanthai.supakorn.me/photos/soup.webp",
    );
    const photo = th.photos[0];
    if (!photo) throw new Error("Expected fixture photo");
    photo.credit.name = "Changed";
    expect(food).toEqual(original);
  });
  it("finds existing foods and returns undefined for missing IDs", () => {
    expect(findFood([food], "khao-soi")).toEqual(food);
    expect(findFood([food], "absent")).toBeUndefined();
  });
});

describe("query boundary", () => {
  it("provides defaults and allows digit strings with leading zeroes", () => {
    expect(parseQuery(new URLSearchParams(), true)).toEqual({
      lang: "en",
      page: 1,
      limit: 20,
    });
    expect(
      parseQuery(new URLSearchParams("lang=th&page=02&limit=01"), true),
    ).toEqual({ lang: "th", page: 2, limit: 1 });
  });
  it.each([
    "lang=",
    "lang=EN",
    "lang=jp",
    "lang=en&lang=th",
    "page=1&page=2",
    "region=north",
    "page=0",
    "page=-1",
    "page=+1",
    "page=1.5",
    "page=1e2",
    "page=Infinity",
    "page=9007199254740992",
    "limit=101",
    "limit=0",
    "limit=",
    "page=%201",
    "=x",
  ])("rejects invalid input: %s", (query) => {
    expect(() => parseQuery(new URLSearchParams(query), true)).toThrow();
  });
  it("rejects list-only parameters on detail requests", () => {
    expect(() => parseQuery(new URLSearchParams("page=1"), false)).toThrow();
    expect(() => parseQuery(new URLSearchParams("limit=1"), false)).toThrow();
  });
});

describe("pagination", () => {
  const foods = [food, { ...food, id: "aaa" }, { ...food, id: "zzz" }];
  it("sorts by ASCII ID before slicing without mutating input", () => {
    const result = listFoods(
      foods,
      { lang: "en", page: 2, limit: 1 },
      "https://example.com",
    );
    expect(result.data.map((f) => f.id)).toEqual(["khao-soi"]);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 1,
      totalItems: 3,
      totalPages: 3,
    });
    expect(foods[0]?.id).toBe("khao-soi");
  });
  it("returns empty pages with real totals including huge safe page values", () => {
    const result = listFoods(
      foods,
      { lang: "th", page: Number.MAX_SAFE_INTEGER, limit: 100 },
      "https://example.com",
    );
    expect(result.data).toEqual([]);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.totalItems).toBe(3);
  });
  it("handles empty catalogues and the last page", () => {
    expect(
      listFoods([], { lang: "en", page: 1, limit: 20 }, "https://example.com"),
    ).toMatchObject({ data: [], pagination: { totalPages: 0, totalItems: 0 } });
    expect(
      listFoods(
        foods,
        { lang: "en", page: 2, limit: 2 },
        "https://example.com",
      ).data.map((f) => f.id),
    ).toEqual(["zzz"]);
  });
});
