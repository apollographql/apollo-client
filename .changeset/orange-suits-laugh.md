---
"@apollo/client": patch
_tags:
  - types
  - useMutation
---

Adjust `useMutation` types to better handle required variables. When required variables are missing, TypeScript will now complain if they are not provided either to the hook or the returned `mutate` function. Providing required variables to `useMutation` will make them optional in the returned `mutate` function.
