---
"@apollo/client": major
_tags:
  - links
---

The `response` property in `onError` link has been renamed to `result`.

```diff
- onError(({ response }) => {
+ onError(({ result }) => {
    // ...
});
```
