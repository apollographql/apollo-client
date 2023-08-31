---
"@apollo/client": patch
---

Fixes an issue where refetching from `useBackgroundQuery` via `refetch` with an error after an error was already fetched would get stuck in a loading state.
