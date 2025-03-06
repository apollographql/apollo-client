---
"@apollo/client": patch
---

To mitigate problems when Apollo Client ends up more than once in the bundle, some unique symbols were converted into `Symbol.for` calls.
