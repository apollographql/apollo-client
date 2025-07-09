---
"@apollo/client": major
_tags:
  - links
---

`ApolloLink.execute` now requires a third argument which provides the `client` that initiated the request to the link chain. If you use `execute` directly, add a third argument with a `client` property:

```ts
ApolloLink.execute(link, operation, { client });

// or if you import the `execute` function directly:
execute(link, operation, { client });
```
