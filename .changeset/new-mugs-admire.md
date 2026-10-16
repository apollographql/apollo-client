---
"@apollo/client": patch
---

Fix an issue where custom scalar values that are not JSON-serializable caused errors. These values are properly serialized when used as input for `variables` or when used as a key field value so that cache writes and calls to `cache.identify` succeed.
