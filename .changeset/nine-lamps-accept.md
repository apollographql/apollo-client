---
"@apollo/client": minor
---

`ApolloLink`'s `concat` instance method now accepts multiple links to concatenate together.

```ts
const first = new ApolloLink();

const link = first.concat(second, third, fouth);
```
