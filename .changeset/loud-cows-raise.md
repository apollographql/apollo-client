---
"@apollo/client": patch
---

`useQuery` with `ssr: false` - previously, `skip` had a higher priortity than `ssr: false` while `ssr: false` had a higher priority than `fetchPolicy: "standby"` (which is roughly equivalent to `skip`).

This priority has been adjusted so now both `skip` and `fetchPolicy: "standby"` have a higher priority than `ssr: false` and will return `loading: false`, while `ssr: false` will only come after those and will return `loading: true` if those are not set.
