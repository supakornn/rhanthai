# RhanThai

A public Thai food API with English and Thai names, descriptions, and photos. No API key required.

Built with [Elysia](https://elysiajs.com/) and TypeScript on [Cloudflare Workers](https://workers.cloudflare.com/).

## Getting started

Requires Bun 1.4.3 and Node.js 24.

```bash
bun install --frozen-lockfile
bun run dev
```

Open [localhost:8787](http://localhost:8787) for the interactive API documentation powered by Scalar.

## Usage

```bash
# List foods
curl 'http://localhost:8787/api/v1/foods'

# Get a food in Thai
curl 'http://localhost:8787/api/v1/foods/khao-soi?lang=th'
```

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/foods` | List foods with pagination |
| `GET /api/v1/foods/{id}` | Get a food by ID |

Use `lang=en` or `lang=th` to select a language. Lists support `page` and `limit` (up to 100 items). English is the default.

The OpenAPI specification is available at `/openapi/json`.

## Development

```bash
bun run lint
bun run typecheck
bun run validate:data
bun run validate:api
bun run test
```

Food records are stored in `data/foods/`; photos are served from `public/photos/`.

## Deployment

Cloudflare Workers Builds runs the configured build checks and deploys `main`. Use `bun run deploy` as the deploy command; it deploys the production configuration and smoke-checks the released revision. GitHub Actions runs quality checks only and needs no Cloudflare credentials.

## Contributing

Contributions are welcome. Include English and Thai translations for new foods, verify photo reuse rights, and run the checks above before submitting a pull request.

## Photo credits

Photos retain their original Creative Commons licenses. Attribution, source links, and license details are included in API responses. Preserve this information when reusing images.
