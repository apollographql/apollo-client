---
"@apollo/client": minor
---

Use the default stream merge function for `@stream` fields only if stream info is present. This change means that using the older `Defer20220824Handler` will not use the default stream function and will instead truncate the streamed array on the first chunk.
