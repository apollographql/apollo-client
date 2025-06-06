---
"@apollo/client": major
---

Changing most options in `useQuery` when rerendering will no longer automatically trigger a `reobserve` which may cause network fetches. Instead, the changed options will be applied for the next fetch.

The only options that now trigger a `reobserve` when changed between renders are:
- `query`
- `variables`
- `skip`
- Changing `fetchPolicy` from `standby` to a different `fetchPolicy`
