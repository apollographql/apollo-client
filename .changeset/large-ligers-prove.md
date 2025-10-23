---
"@apollo/client": minor
---

Add support for `from: null` in `client.watchFragment` and `cache.watchFragment`. When `from` is `null`, the emitted result will be:

```ts
{
  data: null,
  dataState: "complete",
  complete: true,
}
```
