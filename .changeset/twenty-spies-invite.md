---
"@apollo/client": patch
---

Update the return type of `refetch`, `fetchMore` and `useLazyQuery`'s `execute` function on the provided `errorPolicy`. Previously these APIs all used the default type which typed `data` as `TData | undefined` and `error` as `ErrorLike | undefined`.
