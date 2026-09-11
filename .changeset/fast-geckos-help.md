---
"@apollo/client": patch
---

Fix an issue where field `read` functions were not applied to intermediate results while streaming `@defer` responses. `cache.diff` ran the `read` functions, but the transformed values were only applied to the emitted result when the updated cache result was considered complete. Intermediate chunks whose only holes were at `@defer` boundaries now correctly return the result of field `read` functions.

```ts
new InMemoryCache({
  typePolicies: {
    Greeting: {
      fields: {
        message: {
          read: (message) => message.toUpperCase(),
        },
      },
    },
  },
});

// query GreetingQuery {
//   greeting {
//     message
//     ... @defer {
//       recipient { name }
//     }
//   }
// }

// First chunk previously returned:
// { greeting: { message: "Hello world" } }
//
// Now correctly returns while still streaming:
// { greeting: { message: "HELLO WORLD" } }
```
