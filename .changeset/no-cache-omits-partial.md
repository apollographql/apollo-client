---
"@apollo/client": patch
---

Exclude `"partial"` from the `dataState` union returned from `useQuery`, `useLazyQuery`, `useSuspenseQuery`, `useBackgroundQuery`, `useLoadableQuery`, and `preloadQuery` (`createQueryPreloader`) when `fetchPolicy` is `"no-cache"`. This means that `dataState` is never `"partial"` when `fetchPolicy` is `"no-cache"`, regardless of whether `returnPartialData` is `true` or `false`.
