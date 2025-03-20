---
"@apollo/client": major
---

Network errors triggered by queries now adhere to the `errorPolicy`. This means that GraphQL errors and network errors now behave the same way. Previously promise-based APIs, such as `client.query`, would reject the promise with the network error even if `errorPolicy` was set to `ignore`. The promise is now resolved with the `error` property set to the network error instead.
