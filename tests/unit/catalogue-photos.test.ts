import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { imageSize } from "image-size";
import { describe, expect, it } from "vitest";
import { catalogue } from "../../src/catalogue";

const text = Type.String({ pattern: "\\S" });
const evidenceSchema = Type.Array(
  Type.Object(
    {
      foodId: text,
      path: text,
      title: text,
      sourceUrl: text,
      originalUrl: text,
      author: text,
      license: Type.Object(
        { name: text, url: text },
        { additionalProperties: false },
      ),
      accessed: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
      sourceSha1: Type.String({ pattern: "^[a-f0-9]{40}$" }),
      sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
      changes: text,
      verificationNotes: text,
    },
    { additionalProperties: false },
  ),
);

const gapsSchema = Type.Array(
  Type.Object(
    {
      foodId: text,
      status: Type.Literal("not-verified"),
      accessed: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
      queries: Type.Array(text, { minItems: 1 }),
      reason: text,
      rejectedCandidates: Type.Array(text),
    },
    { additionalProperties: false },
  ),
);

const licenses = new Map([
  ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  ["CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"],
  ["CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"],
  ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"],
  ["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"],
  ["CC0", "https://creativecommons.org/publicdomain/zero/1.0/"],
]);

describe("researched catalogue photography", () => {
  it("publishes photos with matching source, credit, license, and byte-level evidence", async () => {
    const evidence: unknown = JSON.parse(
      await readFile("research/photos.sources.json", "utf8"),
    );
    expect(Value.Check(evidenceSchema, evidence)).toBe(true);
    if (!Value.Check(evidenceSchema, evidence))
      throw new Error("Invalid photo evidence");
    const published = catalogue.flatMap((food) =>
      food.photos.map((photo) => ({ food, photo })),
    );
    expect(published).toHaveLength(85);
    const credits = await readFile("public/photo-credits.txt", "utf8");
    expect(evidence.map((entry) => entry.path)).toEqual(
      published.map(({ photo }) => photo.path),
    );
    expect(new Set(evidence.map((entry) => entry.sourceUrl)).size).toBe(
      evidence.length,
    );
    expect(new Set(evidence.map((entry) => entry.sha256)).size).toBe(
      evidence.length,
    );
    for (const { food, photo } of published) {
      const entry = evidence.find((item) => item.path === photo.path);
      expect(entry, food.id).toBeDefined();
      if (!entry) throw new Error(`Missing evidence for ${food.id}`);
      expect(entry.foodId).toBe(food.id);
      expect(photo.path).toBe(`/photos/${food.id}.jpg`);
      expect(entry.sourceUrl).toBe(photo.sourceUrl);
      expect(entry.license).toEqual(photo.license);
      expect(licenses.get(photo.license.name)).toBe(photo.license.url);
      expect(photo.credit.name).toContain(entry.author);
      expect(photo.credit.name).toContain(entry.title);
      expect(photo.credit.url).toBe(entry.sourceUrl);
      expect(photo.credit.name).toContain(
        "Resized and JPEG re-encoded; no crop.",
      );
      expect(entry.changes).toContain("EXIF metadata removed");
      expect(entry.changes).toContain("derivative retains the source license");
      expect(credits).toContain(photo.credit.name);
      expect(credits).toContain(entry.sourceUrl);
      expect(credits).toContain(`${photo.license.name} — ${photo.license.url}`);
      expect(new URL(entry.sourceUrl).hostname).toBe("commons.wikimedia.org");
      expect(entry.sourceUrl).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      expect(new URL(entry.originalUrl).hostname).toBe("upload.wikimedia.org");
      expect(entry.originalUrl).toMatch(/^https:\/\//);
      expect(new Date(entry.accessed).toISOString().slice(0, 10)).toBe(
        entry.accessed,
      );
      expect(new Date(entry.accessed).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(entry.verificationNotes.length).toBeGreaterThan(20);
      expect(photo.alt.en).toMatch(/[A-Za-z]/);
      expect(photo.alt.th).toMatch(/[ก-๙]/);
      expect(photo.alt.en).not.toBe(photo.alt.th);
      expect(photo.credit.name + photo.alt.en + photo.alt.th).not.toMatch(
        /<[^>]+>/,
      );
      const bytes = await readFile(`public${photo.path}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        entry.sha256,
      );
      expect(bytes.length).toBeLessThanOrEqual(512 * 1024);
      expect(bytes.includes(Buffer.from("Exif\u0000\u0000"))).toBe(false);
      expect(imageSize(bytes)).toMatchObject({
        width: photo.width,
        height: photo.height,
        type: "jpg",
      });
      expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(960);
      expect(Math.min(photo.width, photo.height)).toBeGreaterThanOrEqual(320);
    }
  });

  it("accounts for every remaining photo gap without placeholders or unverified photos", async () => {
    const gaps: unknown = JSON.parse(
      await readFile("research/photos.gaps.json", "utf8"),
    );
    expect(Value.Check(gapsSchema, gaps)).toBe(true);
    if (!Value.Check(gapsSchema, gaps)) throw new Error("Invalid photo gaps");
    const missing = catalogue.filter((food) => food.photos.length === 0);
    expect(gaps).toHaveLength(15);
    expect(gaps.map((gap) => gap.foodId)).toEqual(
      missing.map((food) => food.id),
    );
    expect(new Set(gaps.map((gap) => gap.foodId)).size).toBe(gaps.length);
    for (const gap of gaps) {
      expect(gap.reason.length).toBeGreaterThan(40);
      expect(new Date(gap.accessed).toISOString().slice(0, 10)).toBe(
        gap.accessed,
      );
      expect(new Date(gap.accessed).getTime()).toBeLessThanOrEqual(Date.now());
      for (const url of gap.rejectedCandidates) {
        expect(url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
    }
  });
});
