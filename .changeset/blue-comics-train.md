---
"@apollo/client": minor
---

Add a new `useSuspenseFragment` hook.

`useSuspenseFragment` suspends until `data` is complete. It is a drop-in
replacement for `useFragment` when you prefer to use Suspense to control the
loading state of a fragment.
