---
"@apollo/client": patch
---

Fix a race when chaining `refetch` and `fetchMore` calls with `useSuspenseQuery` inside React transitions.

For example, an app can refresh the first page of a list with `refetch()`, then immediately load the next page with `fetchMore()` from the refetch promise's `.then` callback. A timer from the completed refetch could make `useTransition`'s `isPending` become `false` before the next page arrived, hiding the pending indicator while the list still showed only the first page. Keep the transition pending until the next page is available. This also applies when the first request is another `fetchMore()`.
