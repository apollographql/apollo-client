---
"@apollo/client-codemod-migrate-3-to-4": patch
---

Add a new `legacyEntryPoints` transformation step that moves imports from old legacy entry points like `@apollo/client/main.cjs` or `@apollo/client/react/react.cjs` to the new entry points like `@apollo/client` or `@apollo/client/react`.
