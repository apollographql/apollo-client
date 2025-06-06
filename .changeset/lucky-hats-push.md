---
"@apollo/client": major
---

The execute function returned from `useLazyQuery` now only supports the `context` and `variables` options. This means that passing options supported by the hook no longer override the hook value.

To change options, rerender the component with new options. These options will take effect with the next query execution.
