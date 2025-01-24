---
"@apollo/client": major
---

`cache.diff` no longer throws when `returnPartialData` is set to `false` without a complete result. Instead, `cache.diff` will return `null` when it is unable to read a full cache result.

If you use `cache.diff` directly with `returnPartialData: false`, remove the `try`/`catch` block and replace with a check for `null`.
