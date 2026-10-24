import { Value } from "@sinclair/typebox/value";
import {
  type Food,
  type Language,
  languageSchema,
  type StoredFood,
} from "./schemas";

export class QueryError extends Error {}
export type FoodQuery = { lang: Language; page: number; limit: number };

export function parseQuery(
  params: URLSearchParams,
  isList: boolean,
): FoodQuery {
  const allowed = isList ? ["lang", "page", "limit"] : ["lang"];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      throw new QueryError("Unknown or repeated query parameter.");
    }
  }
  const lang = params.get("lang") ?? "en";
  if (!Value.Check(languageSchema, lang))
    throw new QueryError("lang must be one of: en, th.");
  const integer = (key: string, fallback: number, maximum: number): number => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (
      !/^[0-9]+$/.test(raw) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > maximum
    ) {
      throw new QueryError(`${key} must be an integer from 1 to ${maximum}.`);
    }
    return value;
  };
  return {
    lang,
    page: integer("page", 1, Number.MAX_SAFE_INTEGER),
    limit: integer("limit", 20, 100),
  };
}

export function localizeFood(
  food: StoredFood,
  lang: Language,
  origin: string,
): Food {
  return {
    id: food.id,
    name: food.name[lang],
    description: food.description[lang],
    photos: food.photos.map(({ path, alt, credit, license, ...rest }) => ({
      ...rest,
      url: new URL(path, origin).href,
      alt: alt[lang],
      credit: { ...credit },
      license: { ...license },
    })),
  };
}

export function findFood(
  foods: readonly StoredFood[],
  id: string,
): StoredFood | undefined {
  return foods.find((food) => food.id === id);
}

export function listFoods(
  foods: readonly StoredFood[],
  query: FoodQuery,
  origin: string,
) {
  const totalItems = foods.length;
  const totalPages = Math.ceil(totalItems / query.limit);
  // Avoid multiplying huge page values before checking against bounded totals.
  const offset =
    query.page > totalPages ? totalItems : (query.page - 1) * query.limit;
  const sorted = foods.toSorted((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return {
    data: sorted
      .slice(offset, offset + query.limit)
      .map((food) => localizeFood(food, query.lang, origin)),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}
