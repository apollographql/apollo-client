---
"@apollo/client": patch
---

Remove the optional modifier from the `variables` property provided to the `update` function in `client.mutate` and `useMutation`. `variables` is always a defined object, even when variables are not provided to the mutation.
