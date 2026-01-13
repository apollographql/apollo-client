---
"@apollo/client": patch
---

Ensure that `compact` and `mergeOptions` preserve symbol keys.

This fixes an issue where the change introduced in 4.0.11 via #13049 would not
be applied if `defaultOptions` for `watchQuery` were declared.

Please note that `compact` and `mergeOptions` are considered internal utilities
and they might have similar behavior changes in future releases.
Do not use them in your application code - a change like this is not considered
breaking and will not be announced as such.
