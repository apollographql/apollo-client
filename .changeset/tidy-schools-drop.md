---
"@apollo/client": patch
---

Remove the `boundary=graphql` parameter from the `accept` header sent with multipart subscription requests. The `boundary` parameter describes a multipart body and belongs on the server's response `Content-Type`, not on the client's request `accept` header. Dropping it aligns with Apollo's multipart-protocol docs and improves interop with stricter GraphQL routers that reject the parameter. The `accept` header is now `multipart/mixed;subscriptionSpec=1.0,...`.
