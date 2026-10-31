import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { imageSize } from "image-size";
import { describe, expect, it } from "vitest";
import { catalogue } from "../../src/catalogue";
import photoHashes from "../fixtures/photo-integrity.json";

const licenses = new Map([
  ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  ["CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"],
  ["CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"],
  ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"],
  ["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"],
  ["CC0", "https://creativecommons.org/publicdomain/zero/1.0/"],
]);

const integrity: Record<string, string> = photoHashes;

describe("published catalogue photography", () => {
  it("publishes credited, licensed photos with matching bytes and bilingual alt text", async () => {
    const published = catalogue.flatMap((food) =>
      food.photos.map((photo) => ({ food, photo })),
    );
    expect(published).toHaveLength(85);
    expect(Object.keys(integrity)).toEqual(
      published.map(({ photo }) => photo.path),
    );
    expect(new Set(published.map(({ photo }) => photo.sourceUrl)).size).toBe(
      85,
    );
    expect(new Set(Object.values(integrity)).size).toBe(85);
    const credits = await readFile("public/photo-credits.txt", "utf8");
    for (const { food, photo } of published) {
      const type = photo.path.endsWith(".webp") ? "webp" : "jpg";
      expect(photo.path).toBe(`/photos/${food.id}.${type}`);
      expect(licenses.get(photo.license.name)).toBe(photo.license.url);
      expect(photo.credit.name.length).toBeGreaterThan(20);
      expect(photo.credit.name).toMatch(/resized/i);
      expect(photo.credit.url).toMatch(/^https:\/\//);
      expect(credits).toContain(`${food.id} | ${photo.path}`);
      expect(credits).toContain(photo.credit.name);
      expect(credits).toContain(photo.sourceUrl);
      expect(credits).toContain(photo.credit.url);
      expect(credits).toContain(`${photo.license.name} — ${photo.license.url}`);
      expect(photo.sourceUrl).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      expect(photo.alt.en).toMatch(/[A-Za-z]/);
      expect(photo.alt.th).toMatch(/[ก-๙]/);
      expect(photo.alt.en).not.toBe(photo.alt.th);
      expect(photo.credit.name + photo.alt.en + photo.alt.th).not.toMatch(
        /<[^>]+>/,
      );
      const bytes = await readFile(`public${photo.path}`);
      expect(integrity[photo.path]).toMatch(/^[a-f0-9]{64}$/);
      expect(createHash("sha256").update(bytes).digest("hex"), photo.path).toBe(
        integrity[photo.path],
      );
      expect(bytes.length).toBeLessThanOrEqual(512 * 1024);
      expect(imageSize(bytes)).toMatchObject({
        width: photo.width,
        height: photo.height,
        type,
      });
      expect(Math.min(photo.width, photo.height)).toBeGreaterThanOrEqual(320);
      expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(1280);
    }
  });

  it("keeps the 82 JPEG additions metadata-free and optimized with modification notices", async () => {
    const photos = catalogue
      .flatMap((food) => food.photos)
      .filter((photo) => photo.path.endsWith(".jpg"));
    expect(photos).toHaveLength(82);
    for (const photo of photos) {
      const bytes = await readFile(`public${photo.path}`);
      expect(photo.credit.name).toContain(
        "Resized and JPEG re-encoded; no crop.",
      );
      expect(bytes.includes(Buffer.from("Exif\u0000\u0000"))).toBe(false);
      expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(960);
    }
  });

  it("keeps the 15 unresolved foods photo-free instead of publishing placeholders", () => {
    expect(
      catalogue
        .filter((food) => food.photos.length === 0)
        .map((food) => food.id),
    ).toEqual([
      "bai-liang-pad-khai",
      "khanom-chak",
      "khanom-kluai",
      "khanom-ko",
      "khanom-pang-na-mu",
      "khanom-rang-phueng",
      "khao-niao-dam-piak",
      "khao-tang-na-tang",
      "kui-chai-tod",
      "pla-pao",
      "po-pia-tod",
      "sup-no-mai",
      "tom-chap-chai",
      "wun-kathi",
      "yam-makhuea-yao",
    ]);
  });
});
