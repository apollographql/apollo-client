---
'@apollo/client': patch
---

Fix the compatibility between `useSuspenseQuery` and React's `useDeferredValue` and `startTransition` APIs to allow React to show stale UI while the changes to the variable cause the component to suspend.

# Breaking change

`nextFetchPolicy` support has been removed from `useSuspenseQuery`. If you are using this option, remove it, otherwise it will be ignored.
