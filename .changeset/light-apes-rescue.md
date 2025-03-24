---
"@apollo/client": major
---

`useQuery` no longer returns `reobserve` as part of its result. It was possible to use `reobserve` to set new options on the underlying `ObservableQuery` instance which differed from the options passed to the hook. This could result in unexpected results. Instead prefer to rerender the hook with new options.
