import { type Static, Type as t } from "@sinclair/typebox";
import { t as elysiaType } from "elysia";

const text = t.String({ pattern: "\\S" });
const httpsUrl = t.String({ pattern: "^https://[^\\s]+$" });
const localized = t.Object(
  { en: text, th: text },
  { additionalProperties: false },
);
const credit = t.Object(
  { name: text, url: t.Union([httpsUrl, t.Null()]) },
  { additionalProperties: false },
);
const license = t.Object(
  { name: text, url: httpsUrl },
  { additionalProperties: false },
);

export const languageSchema = t.Union([t.Literal("en"), t.Literal("th")]);

export type Language = Static<typeof languageSchema>;

export const detailQuerySchema = t.Object({
  lang: t.Optional(
    t.Union([t.Literal("en"), t.Literal("th")], {
      default: "en",
      description:
        "Localizes name, description, and photo alt. Case-sensitive.",
    }),
  ),
});

export const listQuerySchema = t.Object({
  ...detailQuerySchema.properties,
  page: t.Optional(
    elysiaType.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
      default: 1,
      description:
        "Digits only; leading zeros allowed. No signs, decimals, whitespace, or exponents.",
    }),
  ),
  limit: t.Optional(
    elysiaType.Integer({ minimum: 1, maximum: 100, default: 20 }),
  ),
});

export const storedPhotoSchema = t.Object(
  {
    path: t.String({
      pattern: "^/photos/[a-z0-9][a-z0-9._-]*\\.(?:webp|jpg|jpeg|png)$",
    }),
    width: t.Integer({ minimum: 1 }),
    height: t.Integer({ minimum: 1 }),
    alt: localized,
    credit,
    sourceUrl: httpsUrl,
    license,
  },
  { additionalProperties: false },
);

export const storedFoodSchema = t.Object(
  {
    id: t.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
    name: localized,
    description: localized,
    photos: t.Array(storedPhotoSchema),
  },
  { additionalProperties: false },
);

export type StoredFood = Static<typeof storedFoodSchema>;

export const photoSchema = t.Object({
  url: httpsUrl,
  width: storedPhotoSchema.properties.width,
  height: storedPhotoSchema.properties.height,
  alt: text,
  credit,
  sourceUrl: httpsUrl,
  license,
});

export const foodSchema = t.Object({
  id: storedFoodSchema.properties.id,
  name: text,
  description: text,
  photos: t.Array(photoSchema),
});

export type Food = Static<typeof foodSchema>;

export const foodDetailSchema = t.Object({ data: foodSchema });

export const foodListSchema = t.Object({
  data: t.Array(foodSchema),
  pagination: t.Object({
    page: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    limit: t.Integer({ minimum: 1, maximum: 100 }),
    totalItems: t.Integer({ minimum: 0 }),
    totalPages: t.Integer({ minimum: 0 }),
  }),
});

export const errorSchema = t.Object({
  error: t.Object({
    code: t.Union([
      t.Literal("INVALID_QUERY_PARAMETER"),
      t.Literal("FOOD_NOT_FOUND"),
      t.Literal("NOT_FOUND"),
      t.Literal("METHOD_NOT_ALLOWED"),
      t.Literal("INTERNAL_SERVER_ERROR"),
    ]),
    message: text,
  }),
});
