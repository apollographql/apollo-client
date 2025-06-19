---
"@apollo/client": major
---

Default the `delay` for all mocked responses passed to `MockLink` using `realisticDelay`. This ensures your test handles loading states by default and is not reliant on a specific timing.

If you would like to restore the old behavior, use a global default delay of `0`.

```ts
MockLink.defaultOptions = {
  delay: 0
}
```
