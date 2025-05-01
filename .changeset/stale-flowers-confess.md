---
"@apollo/client": major
---

Remove support for `@client(always: true)`. With the removal of local resolvers in Apollo Client core, there is mechanism to reliably rerun `@client` fields without sending the query back through the link chain. If you need to rerun a resolver to get the latest `@client` field value, perform a `refetch`.
