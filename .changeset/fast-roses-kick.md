---
"@apollo/client": patch
---

Immediately dispose of the `queryRef` if `useBackgroundQuery` unmounts before the auto dispose timeout kicks in.
