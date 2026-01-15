---
"@apollo/client": patch
---

Handle an edge case with the `Defer20220824Handler` where an error for a `@stream` item that bubbles to the `@stream` boundary (such as an item returning `null` for a non-null array item) would write items from future chunks to the wrong array index. In these cases, the `@stream` field is no longer processed and future updates to the field are ignored. This prevents runtime errors that TypeScript would otherwise not be able to catch.
