---
"@apollo/client": major
---

`@client` fields are now sent to the link chain. This allows `LocalResolversLink` to access any `@client` fields in the query.

NOTE: If you don't use `LocalResolversLink`, but use `@client` fields using cache type policies, you may need to remove `@client` fields from the query before the query is sent to the terminating link. `HttpLink` and `BatchHttpLink` already remove `@client` fields for you.
