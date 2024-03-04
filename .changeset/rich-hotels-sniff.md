---
"@apollo/client": patch
---

Fix issue where calling `fetchMore` inside a `startTransition` from `useSuspenseQuery` causes an additional rerender.
