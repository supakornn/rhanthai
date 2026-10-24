import { type Static, Type as t } from "@sinclair/typebox";

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
export type Food = {
  id: string;
  name: string;
  description: string;
  photos: (Omit<Static<typeof storedPhotoSchema>, "path" | "alt"> & {
    url: string;
    alt: string;
  })[];
};
