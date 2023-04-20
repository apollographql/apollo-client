---
"@apollo/client": patch
---

Delay Concast subscription teardown slightly in `useSubscription` to prevent unexpected Concast teardown when one `useSubscription` hook tears down its in-flight Concast subscription immediately followed by another `useSubscription` hook reusing and subscribing to that same Concast
