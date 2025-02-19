---
"@apollo/client": major
---

Rework package publish format (#12329, #12382)

We have reworked the way Apollo Client is packaged.

* shipping ESM and CJS
* fixing up source maps
* the build targets a modern runtime environment (browserslist query: `"since 2023, node >= 20, not dead"`)
* removed the "proxy directory" `package.json` files, e.g. `cache/core/package.json` and `react/package.json`. While these helped with older build tools, modern build tooling uses the `exports` field in the root `package.json` instead and the presence of these files can confuse modern build tooling. If your build tooling still relies on those, please update your imports to import from e.g. `@apollo/client/cache/core/index.js` instead of `@apollo/client/cache/core` - but generally, this should not be necessary.
* added an `exports` field to `package.json` to expose entry points
