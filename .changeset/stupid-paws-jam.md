---
"@apollo/client": major
---

The `response` property in `onError` link has been renamed to `result`.

```diff
- onError(({ response }) => {
+ onError(({ result }) => {
    // ...
});
```
