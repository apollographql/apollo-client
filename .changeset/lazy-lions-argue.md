---
"@apollo/client": patch
---

`useLazyQuery`'s `execute` function now threads the hook-level `errorPolicy` through its return type. When `errorPolicy: "none"` is set (the default), the resolved promise's `data` is typed as defined rather than possibly `undefined`, since GraphQL errors reject the promise instead of resolving with partial data.
