---
'@apollo/client': patch
---

Fix the compatibility between `useSuspenseQuery` and React's `useDeferredValue` and `startTransition` APIs to allow React to show stale UI while the changes to the variable cause the component to suspend.
