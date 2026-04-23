---
"@apollo/client": patch
---

Remove the `workspaces` field from the published `package.json` in `dist` to avoid Yarn v1 warnings about workspaces requiring private packages.
