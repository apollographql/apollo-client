---
"@apollo/client": patch
---

Prevent the `setTimeout` in `connectToDevtools` that shows the devtools suggestion from firing when the user agent does not match Chrome or Firefox. This check was previously done inside the `setTimeout` which meant the timer was scheduled for environments where we'd never show the message anyways. For test environments, this could cause flaky tests when that `setTimeout` outlived the tests and ran after any virtual DOM was torn down and removed.
