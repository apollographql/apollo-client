---
'@apollo/client': patch
---

Log a warning to the console when a mock passed to `MockedProvider` or `MockLink` cannot be matched to a query during a test. This makes it easier to debug user errors in the mock setup, such as typos, especially if the query under test is using an `errorPolicy` set to `ignore`, which makes it difficult to know that a match did not occur.
