---
"@apollo/client": patch
---

Fix an issue where switching from options with `variables` to `skipToken` with `useSuspenseQuery` and `useBackgroundQuery` would create a new `ObservableQuery`. This could cause unintended refetches where `variables` were absent in the request when the query was referenced with `refetchQueries`.
