# RhanThai 🥘

A free API for exploring Thai food, with names, descriptions, and photos in English and Thai. No API key required.

Use it to try out API requests, build a food picker, or add Thai dishes to your next project.

```js
fetch("https://rhanthai.supakorn.me/api/v1/foods/pad-thai")
  .then((response) => response.json())
  .then(({ data }) => console.log(data.name)); // Pad Thai
```

Browse all dishes at `/api/v1/foods`, or add `?lang=th` for Thai.

**[Explore the API docs →](https://rhanthai.supakorn.me/openapi)**

This repository contains the API source, food data, and photos. Photo credits and licenses are included in API responses.

Built with Elysia, TypeScript, and Cloudflare Workers.
