---
"@apollo/client": patch
---

Ensures that GraphQL errors returned in subscription payloads adhere to the `errorPolicy`. NOTE: Protocol errors returned in subscriptions are still thrown as before, otherwise there would be no way to access these errors.
