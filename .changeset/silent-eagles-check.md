---
'@apollo/client': minor
---

Introduce the new `removeTypenameFromVariables` link. This link will automatically remove `__typename` fields from `variables` for all operations. This link can be configured to exclude JSON-scalars for scalars that utilize `__typename`. 

This change undoes some work from #10724 where `__typename` was automatically stripped for all operations with no configuration. This was determined to be a breaking change and therefore moved into this link.
