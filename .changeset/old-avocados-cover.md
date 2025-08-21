---
"@apollo/client": minor
_tags:
  - graphql_over_http
---

Adjusted the accept header for multipart requests according to the new GraphQL over HTTP spec with these changes:

```diff
-multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json
+multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/graphql-response+json,application/json;q=0.9
```

```diff
-multipart/mixed;deferSpec=20220824,application/json
+multipart/mixed;deferSpec=20220824,application/graphql-response+json,application/json;q=0.9
```
