---
"@apollo/client": major
_tags:
  - links
---

The `includeExtensions` option of `HttpLink` and `BatchHttpLink` now defaults
to `true`.

If `includeExtensions` is `true`, but `extensions` is not set or empty, extensions
will not be included in outgoing requests.
