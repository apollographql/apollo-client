---
"@apollo/client": patch
---

Fix an issue where rerendering `useBackgroundQuery` after the `queryRef` had been disposed, either via the auto dispose timeout or by unmounting `useReadQuery`, would cause the `queryRef` to be recreated potentially resulting in another network request.
