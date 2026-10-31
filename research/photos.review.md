# Catalogue photograph research review

Research and verification date: 2026-10-31 (UTC).

## Outcome

- The catalogue still contains exactly 100 dishes and desserts. This pass adds one
  locally stored, visually reviewed photograph to 85 records, including khao soi,
  pad Thai and som tam. The remaining 15 records retain `photos: []`.
- `photos.sources.json` contains the 85 selected file-page URLs, original image
  URLs, credited creators, selected licenses, access dates, original-file SHA-1
  values reported by Commons, local derivative SHA-256 values, modification
  notices and dish-matching notes. Its order matches the catalogue.
- `photos.gaps.json` accounts for every unillustrated dish, records both search
  passes, and explains notable rejected candidates. These are gaps in this bounded
  research pass, not claims that suitable licensed photos do not exist elsewhere.
- The JPEGs under `public/photos/` total 12,382,640 bytes (about 11.81 MiB). Each is
  at most 960 pixels on its longest side, at least 320 pixels on its shortest side,
  and below 512 KiB. Images were resized and JPEG re-encoded without cropping;
  EXIF metadata was removed. No originals are hotlinked or fetched at runtime.

## Sources and verification method

Discovery used English and Thai dish names, alternative transliterations and a
second, targeted Commons search for unresolved matches. The
[List of Thai dishes](https://en.wikipedia.org/wiki/List_of_Thai_dishes) also
provided exact filenames for several otherwise ambiguous searches; it was used
for discovery, not as proof of image rights.

For each accepted file, the Commons MediaWiki API supplied file-page metadata:
`Artist`, `LicenseShortName`, `LicenseUrl`, `ImageDescription`, credit, categories,
original image URL, dimensions and SHA-1. File-page metadata, not the license of
Wikipedia prose or a search-result snippet, is the basis for each recorded image
license. Returned metadata contained no selected-file deletion or permission
warning categories; the selected Flickr imports carried Commons license-review
categories. These are uploader/license declarations, not independent proof of
ownership or a legal warranty. Future reuse should recheck the linked source.

Downloaded images were visually inspected in labeled contact sheets, with
individual images inspected where needed. Names alone were not accepted as a
match. Examples of rejected or corrected candidates:

- Khao tom initially returned wrapped sticky-rice desserts; the selected photograph
  is identified as fish rice soup.
- Gaeng pa initially returned kaeng phak wan, a different curry. A source explicitly
  identifying fish jungle curry replaced it.
- Nam tok initially returned noodles and unrelated fish photographs. The selected
  image depicts grilled-beef salad.
- Yen ta fo initially returned non-Thai yong tau foo. The selected image identifies
  the pink Thai noodle preparation.
- Khao tang na tang candidates did not establish the Thai dip; kui chai candidates
  showed stuffed dumplings rather than the sliced chive cakes in this record.
  Both remain gaps rather than being filled with visually similar foods.
- The initial thong yip candidate was only 365 by 206 pixels and failed the image
  quality assertion. A 960 by 640 pixel licensed photograph replaced it. Its
  preparation-stage presentation is disclosed in the alt text and ledger.
- Khao kriap pak mo is shown beside tapioca dumplings; nam ya is separately bagged
  with noodles and vegetables. Their bilingual alt text describes these actual
  presentations rather than implying isolated plated dishes.

## Licensing and attribution

All 85 photos retain their source creator credits. Selected licenses are CC BY-SA 2.0 (7),
CC BY-SA 3.0 (51), CC BY-SA 4.0 (15), CC BY 2.0 (4), CC BY 4.0 (2), and CC0 (6).
No noncommercial, no-derivatives, unknown-license or uncredited images are used.
Legacy HTTP license links were normalized to the corresponding official HTTPS
license URLs; the license type and version were not changed.

Reuse guidance and the applicable Creative Commons deeds were consulted:

- <https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia>
- <https://creativecommons.org/licenses/by-sa/2.0/>
- <https://creativecommons.org/licenses/by-sa/3.0/>
- <https://creativecommons.org/licenses/by-sa/4.0/>
- <https://creativecommons.org/licenses/by/2.0/>
- <https://creativecommons.org/licenses/by/4.0/>
- <https://creativecommons.org/publicdomain/zero/1.0/>

The existing public photo schema carries title/creator credit, source URL, license
name/link, and Thai/English alt text. Credit strings disclose resizing and
re-encoding. `public/photo-credits.txt`, served at `/photo-credits.txt`, provides
standalone per-image attribution and modification notices. BY-SA derivatives
retain their source license; these third-party photos are not relicensed under
any repository code license. No author endorsement is implied.

## Verification

All requested commands passed using the installed Bun 1.4.4, with no dependency,
lockfile, framework, API schema, CI or deployment-configuration changes:

| Command                         | Result                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | Passed; 114 installs checked, no changes                             |
| `bun run lint`                  | Passed Oxlint and Oxfmt                                              |
| `bun run typecheck`             | Passed                                                               |
| `bun run validate:data`         | Passed; 100 foods, matching local photo dimensions and formats       |
| `bun run validate:api`          | Passed; unchanged OpenAPI contract                                   |
| `bun run test`                  | Passed; 67 unit/local-runtime tests and 22 Workers integration tests |
| `bun audit --audit-level=high`  | Passed; no vulnerabilities, 247 packages checked                     |
| `bun run build:production`      | Passed; dry run only, 1004.23 KiB upload / 180.68 KiB gzip           |

The photo test first failed because provenance was absent. Subsequent checks caught
non-HTTPS legacy license links and the undersized thong yip candidate; the data was
corrected without relaxing the validators or lowering the image-quality threshold.
A deliberate zeroed SHA-256 mutation failed the byte-integrity assertion; the
original hash was restored and the photo tests passed again.

Tests verify all 85 files, hashes, dimensions, format, EXIF removal, license links,
credit consistency, bilingual alt text, and the exact 15 remaining gaps. Workers
integration tests verify localized photo alt text and unchanged attribution across
languages. Real Wrangler tests serve actual JPEG bytes and the attribution file,
retain the synthetic asset routing test, and run smoke verification with a real
photo. The local test uses a production-like HTTPS public origin with transport
routed to the ephemeral local Worker, preserving the strict HTTPS OpenAPI contract.

No tests were skipped or deleted and no checks were suppressed. The food names,
descriptions, IDs and culinary provenance were left unchanged. No push, MR, merge,
or deployment was performed.
