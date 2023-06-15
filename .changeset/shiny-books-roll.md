---
"@apollo/client": patch
---

Update `relayStylePagination` to not populate `startCursor` when only a single cursor is present under the edges. Use that cursor only as the `endCursor`
