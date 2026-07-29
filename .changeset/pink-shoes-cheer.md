---
"@apollo/client": patch
---

Fix a bug where GraphQL variable default values were not applied when `undefined` was passed explicitly in `variables`. This caused `@include`/`@skip` directives to throw "Invalid variable referenced" errors when the variable was passed as `undefined` instead of being omitted entirely.
