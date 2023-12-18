---
"@apollo/client": minor
---

Deprecates `canonizeResults`.

Using `canonizeResults` can result in memory leaks so we generally do not recommend using this option anymore.
A future version of Apollo Client will contain a similar feature without the risk of memory leaks.
