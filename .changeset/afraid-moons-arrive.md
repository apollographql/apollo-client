---
"@apollo/client": minor
---

Allow mocked responses passed to `MockLink` to accept a callback for the `delay` option. The `delay` callback will be given the current operation which can be used to determine what delay should be used for the mock.
