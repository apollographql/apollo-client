---
'@apollo/client': patch
---

Fix an issue when using a link that relied on `operation.getContext` and `operation.setContext` would error out when it was declared after the `removeTypenameFromVariables` link.
