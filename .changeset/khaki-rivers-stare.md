---
"@apollo/client": patch
---

MockLink: Update the function types returned by the `ResultFunction` & `VariableMatcher` types to define their own generics which extend from and default to the variables (`V`) type.
