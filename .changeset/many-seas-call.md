---
"@apollo/client": major
---

Changing most options in `useQuery` when rerendering will no longer automatically trigger a `reobserve` which may cause network fetches. Instead, the changed options will be applied for the next fetch.

Options that now trigger a `reobserve` when changed between renders are:
- `query`
- `variables`
- `skip`
- Changing `fetchPolicy` to or from `standby`
