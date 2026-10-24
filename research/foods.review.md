# Thai food catalogue research review

Research and verification date: 2026-10-24 (UTC).

## Scope and method

- Exactly 100 distinct prepared dishes, snacks and desserts, including the existing
  `khao-soi`, `pad-thai` and `som-tam` IDs. No drinks or restaurant records.
- English names use recognizable transliterations; Thai names and both descriptions
  were written independently as concise dish explanations, not copied source prose.
- Protein substitutions and spelling alternatives are not separate records. The three
  gold egg-yolk sweets are separately named preparations with distinct forms, not
  spelling variants. Likewise, nam ya and nam ngiao are different noodle preparations.
- `foods.sources.json` is the per-food provenance ledger: ID, actually consulted source
  URL, UTC access date and factual support notes. Its records follow catalogue ID order.
  It is not imported by the Worker or added to public response schemas.
- All 94 distinct cited URLs were successfully fetched and their relevant content
  consulted. Overview pages are reused only for foods they actually describe.
- Sources include Tourism Authority of Thailand, Pacific Asia Travel Association,
  Chef Cares Foundation's Roschaad Thai, Time Out Bangkok, Eating Thai Food and
  Hot Thai Kitchen. Hot Thai Kitchen supplies 85 dish-specific culinary references;
  the other 15 records use the other publishers. Michelin and some government/library
  pages were explored but failed readable retrieval, so are not cited as evidence.
- No source photographs were downloaded or published. Every `photos` array is empty;
  no licensing or credit claims are made.

## Editorial boundaries

Descriptions explain recognizable preparations, not exhaustive ingredient lists or
recipes. They make no nutrition, allergen, dietary-safety, mandatory-ingredient or
historical-origin claims. Regional fields and filters were not added.

Recipes vary between cooks and communities. These summaries are not a declaration
of one definitive recipe. The source mix is deliberately transparent: most detailed
preparation references come from one Thai culinary educator, not 100 independent
cultural authorities. Broader cultural sourcing and a second native-Thai editorial
review would be useful future improvements.

Some consulted recipes explicitly adapt a classic dish. The provenance notes flag
shortcut curry puffs, baked pork toast, reversed-layer tako and hybrid shrimp cakes;
the catalogue describes the general/traditional dish rather than presenting those
adaptations as universal. Nam ngiao flower cores are described as an optional
textural addition, not an aromatic requirement.

## Verification

All requested commands completed successfully using Bun 1.4.3, without dependency,
framework, CI, deployment configuration or lockfile changes:

| Command                         | Result                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| `bun install --frozen-lockfile` | Passed; 114 packages installed                                     |
| `bun run lint`                  | Passed Oxlint and Oxfmt checks                                     |
| `bun run typecheck`             | Passed                                                             |
| `bun run validate:data`         | Passed; validated 100 foods                                        |
| `bun run validate:api`          | Passed; OpenAPI contract valid                                     |
| `bun run test`                  | Passed; 63 unit and 22 real Workers integration tests              |
| `bun audit --audit-level=high`  | Passed; no vulnerabilities found, 247 packages checked             |
| `bun run build:production`      | Passed; Wrangler dry run only, 935.25 KiB upload / 172.20 KiB gzip |

New editorial tests were first run against the original three-food catalogue and
failed on the expected count and absent provenance file. A deliberate mutation of
one provenance ID also failed its coverage assertion; the ID was restored and the
full suite rerun successfully. Fixed-size unit pagination
cases retain their synthetic fixtures. Integration tests now verify the full paginated
catalogue, localized detail/list equivalence and exact public field names on every
returned food, including the partial final page and immediately beyond-end page.

No tests were skipped or deleted and no checks were disabled. No push, MR, merge or
deployment was performed.
