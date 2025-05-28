---
"@apollo/client": patch
---

Fix a situation where a passed-in `AbortSignal` would override internal unsubscription cancellation behaviour.
