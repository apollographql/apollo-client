---
"@apollo/client": major
---

### Changes for users of `InMemoryCache`

`cache.diff` no longer throws when `returnPartialData` is set to `false` without a complete result. Instead, `cache.diff` will return `null` when it is unable to read a full cache result.

If you use `cache.diff` directly with `returnPartialData: false`, remove the `try`/`catch` block and replace with a check for `null`.

### Changes for third-party cache implementations

The client now expects `cache.diff` to return `null` instead of throwing when the cache returns an incomplete result and `returnPartialData` is `false`. The internal `try`/`catch` blocks have been removed around `cache.diff`. If your cache implementation throws for incomplete results, please update this to return `null`.
