---
"@apollo/client": major
---

Unify error behavior on subscriptions for GraphQL errors and network errors by ensuring network errors are subject to the `errorPolicy`. Network errors that terminate the connection will now be emitted on the `error` property passed to the `next` callback followed by a call to the `complete` callback.
