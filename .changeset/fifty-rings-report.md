---
"@apollo/client": patch
---

Prevent passing `nextFetchPolicy` into `preloadQuery`

This was already prevented in the TypeScript types, but unlike `useBackgroundQuery` and other suspenseful hooks, if called with an `option` object that included `nextFetchPolicy`, `preloadQuery` would still pass it along to `watchQuery` internally. This change ensures that `nextFetchPolicy` is always removed from the options passed to `watchQuery` inside `preloadQuery`.
