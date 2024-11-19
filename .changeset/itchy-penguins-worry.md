---
"@apollo/client": patch
---

Fix issue where masked data would sometimes get returned when the field was part of a child fragment from a fragment unmasked by the parent query.
