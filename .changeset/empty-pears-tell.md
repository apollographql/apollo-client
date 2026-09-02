---
"@apollo/client": patch
---

Remove the optional from the `variables` property provided to the `update` function in `client.mutate` and `useMutation`. `variables` is always an non-undefined object, even when variables are not provided to the mutation.
