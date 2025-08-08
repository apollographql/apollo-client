---
"@apollo/client": major
---

The types mode for data masking has been removed. Adding a types mode to the `DataMasking` interface has no effect. Remove the `mode` key in the module where you declare the `DataMasking` type for the `@apollo/client` module.

As a result, the `Masked` and `MaskedDocumentNode` types have also been removed since these have no effect when types are preserved.
