---
"@apollo/client": minor
---

Improve the accuracy of `client.query` return type to better detect the current `errorPolicy`. The `data` property is no longer nullable when the `errorPolicy` is `none`. This makes it possible to remove the `undefined` checks or optional chaining in most cases.
