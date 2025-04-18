---
"@apollo/client": patch
---

Update format of the error message for `CombinedGraphQLErrors` and `CombinedProtocolErrors` to be more like v3.x.

```diff
console.log(error.message);
- `The GraphQL server returned with errors:
- - Email not found
- - Username already in use`
+ `Email not found
+ Username already in use`
```
