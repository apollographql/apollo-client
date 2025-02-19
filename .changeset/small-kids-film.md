---
"@apollo/client": major
---

Rework package publish format (#12329, #12382)

We have reworked the way Apollo Client is packaged.

* shipping ESM and CJS
* fixing up source maps
* the build targets a modern runtime environment (browserslist query: `"since 2023, node >= 20, not dead"`)
