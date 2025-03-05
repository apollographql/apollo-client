---
"@apollo/client": patch
---

Fixes an issue where the DeepOmit type would turn optional properties into required properties. This should only affect you if you were using the omitDeep or stripTypename utilities exported by Apollo Client.
