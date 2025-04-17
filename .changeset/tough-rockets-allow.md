---
"@apollo/client": patch
---

Fix an issue where additional response properties were returned on the result returned from `client.mutate`, such as `@defer` payload fields. These properties are now stripped out to correspond to the TypeScript type.
