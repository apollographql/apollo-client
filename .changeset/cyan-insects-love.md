---
'@apollo/client': patch
---

Automatically strips `__typename` fields from `variables` sent to the server. This allows data returned from a query to subsequently be used as an argument to a mutation without the need to strip the `__typename` in user-space.
