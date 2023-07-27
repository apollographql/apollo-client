---
"@apollo/client": minor
---

Add generic type parameter for the entity modified in `cache.modify`. Improves
TypeScript type inference for that type's fields and values of those fields.

Example:

```ts
cache.modify<Book>({
  id: cache.identify(someBook),
  fields: {
    title: (title) => {
      // title has type `string`.
      // It used to be `any`.
    },
    author: (author) => {
      // author has type `Reference | Book["author"]`.
      // It used to be `any`.
    },
  },
});
```
