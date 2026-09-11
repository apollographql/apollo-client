---
"@apollo/client": patch
---

Fixed a bug where `streamFieldInfo` might not have been passed into custom merge functions for
`@stream` directives that had an aliased field in the path.
