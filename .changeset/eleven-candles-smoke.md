---
"@apollo/client": patch
_tags:
  - types
---

Change the `unsafePreviousData` argument on `UpdateQueryMapFn` and `SubscribeToMoreQueryFn` to a `DeepPartial` since the result may contain partial data.
