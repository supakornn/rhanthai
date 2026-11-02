# RhanThai 🥘

A free Thai food API with English and Thai names, descriptions, and photos. No API key required.

```js
fetch("https://rhanthai.supakorn.me/api/v1/foods/pad-thai")
  .then((response) => response.json())
  .then(({ data }) => console.log(data.name));
```

Use `?lang=th` for Thai. [API docs](https://rhanthai.supakorn.me/openapi).

Food data and photos are maintained here. Photo credits and licenses are included in API responses.
