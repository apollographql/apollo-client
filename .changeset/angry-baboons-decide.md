---
"@apollo/client": minor
---

Fix the accuracy of `dataState` in complex incremental streaming scenarios with
partial data.

As such, some cases where you'd previously see `dataState` as `"streaming"`, you'll now see as `partial` or `complete`.

For this reason, please rely on `networkStatus === networkStatus.streamin` to determine whether a result is still streaming its result or not.
