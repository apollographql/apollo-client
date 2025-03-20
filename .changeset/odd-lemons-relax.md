---
"@apollo/client": major
---

Rename all React hook result types and options. These types have all moved under a namespace that matches the hook name. For example, `useQuery` exports `useQuery.Options` and `useQuery.Result` types. As such, the old hook types have been deprecated and will be removed in v5.
