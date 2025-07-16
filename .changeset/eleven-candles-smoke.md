---
"@apollo/client": patch
---

Change the `unsafePreviousData` argument on `UpdateQueryMapFn` and `SubscribeToMoreQueryFn` to a `DeepPartial` since the result may contain partial data.
