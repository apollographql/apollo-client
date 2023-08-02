---
'@apollo/client': patch
---

Fixed the ability to use `refetch` and `fetchMore` with React's `startTransition`. The hook will now behave correctly by allowing React to avoid showing the Suspense fallback when these functions are wrapped by `startTransition`. This change deprecates the `suspensePolicy` option in favor of `startTransition`.
