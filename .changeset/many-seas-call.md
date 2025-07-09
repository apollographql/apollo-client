---
"@apollo/client": major
_tags:
  - useQuery
---

Changing most options when rerendering `useQuery` will no longer trigger a `reobserve` which may cause network fetches. Instead, the changed options will be applied to the next cache update or fetch.

Options that now trigger a `reobserve` when changed between renders are:
- `query`
- `variables`
- `skip`
- Changing `fetchPolicy` to or from `standby`
