import { readdir, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Value } from "@sinclair/typebox/value";
import { imageSize } from "image-size";
import { catalogue } from "../src/catalogue";
import { type StoredFood, storedFoodSchema } from "../src/schemas";

function checkHttps(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error("Photo URLs must be HTTPS without embedded credentials");
  }
}

export async function validateCatalogue(
  root: string,
  bundled: readonly StoredFood[],
): Promise<number> {
  const directory = resolve(root, "data/foods");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const seen = new Set<string>();
  const photos = new Set<string>();
  for (const filename of files) {
    const value: unknown = JSON.parse(
      await readFile(resolve(directory, filename), "utf8"),
    );
    if (!Value.Check(storedFoodSchema, value)) {
      throw new Error(
        `Invalid food data in ${filename}: ${JSON.stringify([...Value.Errors(storedFoodSchema, value)])}`,
      );
    }
    if (filename !== `${value.id}.json` || seen.has(value.id))
      throw new Error(`Duplicate/mismatched food ID: ${filename}`);
    seen.add(value.id);
    const imported = bundled.find((food) => food.id === value.id);
    if (!imported || !Value.Equal(imported, value))
      throw new Error(`Missing or stale catalogue import: ${filename}`);
    for (const photo of value.photos) {
      for (const url of [
        photo.sourceUrl,
        photo.license.url,
        photo.credit.url,
      ]) {
        if (url !== null) checkHttps(url);
      }
      const path = resolve(root, "public", photo.path.slice(1));
      const photoRoot = await realpath(resolve(root, "public/photos"));
      if (!(await realpath(path)).startsWith(`${photoRoot}/`))
        throw new Error("Photo resolves outside public/photos");
      const bytes = await readFile(path);
      // Cloudflare Static Assets accepts individual files up to 25 MiB.
      if (bytes.length > 25 * 1024 * 1024)
        throw new Error(`Photo too large: ${photo.path}`);
      const measured = imageSize(bytes);
      if (measured.width !== photo.width || measured.height !== photo.height)
        throw new Error(`Photo dimension mismatch: ${photo.path}`);
      const extension = photo.path.split(".").at(-1);
      if (
        measured.type !==
        (extension === "jpg" ? "jpg" : extension === "jpeg" ? "jpg" : extension)
      ) {
        throw new Error(`Photo format mismatch: ${photo.path}`);
      }
      photos.add(photo.path.slice("/photos/".length));
    }
  }
  if (seen.size !== bundled.length)
    throw new Error("Catalogue imports contain duplicate or missing files");
  for (const file of await readdir(resolve(root, "public/photos"))) {
    if (file === ".gitkeep") continue;
    if (!photos.has(file))
      throw new Error(`Unreferenced publication photo: ${file}`);
  }
  return files.length;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    `Validated ${await validateCatalogue(process.cwd(), catalogue)} foods.`,
  );
}
