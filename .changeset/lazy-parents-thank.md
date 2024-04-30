---
"@apollo/client": patch
---

Fix a regression where rerendering a component with `useBackgroundQuery` would recreate the `queryRef` instance when used with React's strict mode.
