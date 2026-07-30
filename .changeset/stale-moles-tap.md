---
"@apollo/client": patch
---

Fix an issue where some `@export` queries would not react to cache updates when the fields keyed by exported variables were updated.
