---
"@apollo/client": patch
---

Fix `Missing field` errors being logged when writing `@defer` results where a field is selected both inside and outside of a deferred fragment. Fields whose `@defer` boundary has not been delivered from the network are no longer reported as missing.
