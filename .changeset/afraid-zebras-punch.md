---
"@apollo/client": minor
---

Add generic type parameter for the cache `Modifiers` type. Improves TypeScript
type inference for that type's fields and values of those fields.

Example:

```ts
cache.modify({
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
  } satisfies Modifiers<Book>,
});
```

To take advantage of the type inference, use [the `satisfies Modifiers<...>`
operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html).
