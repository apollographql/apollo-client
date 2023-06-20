---
"@apollo/client": patch
---

Update `relayStylePagination` to avoid populating `startCursor` when only a single cursor is present under the `edges` field. Use that cursor only as the `endCursor`.
