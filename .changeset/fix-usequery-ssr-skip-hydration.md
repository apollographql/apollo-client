---
"@apollo/client": patch
---

Fix `useQuery` hydration mismatch when `ssr: false` and `skip: true` are used together

When both options were combined, the server would return `loading: false` (because `useSSRQuery` checks `skip` first), but the client's `getServerSnapshot` was returning `ssrDisabledResult` with `loading: true`, causing a hydration mismatch. This fix updates `getServerSnapshot` to check `isSkipped` before the `ssr` option to match server behavior.
