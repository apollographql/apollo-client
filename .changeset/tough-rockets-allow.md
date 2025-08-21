---
"@apollo/client": patch
_tags:
  - client.mutate
  - bugfix
---

Fix an issue where additional response properties were returned on the result returned from `client.mutate`, such as `@defer` payload fields. These properties are now stripped out to correspond to the TypeScript type.
