---
"@apollo/client": patch
---

Revert the change introduced in
[3.9.10](https://github.com/apollographql/apollo-client/releases/tag/v3.9.10) via #11738 that disposed of queryRefs synchronously. This change caused too many issues with strict mode.
