---
"@apollo/client": minor
---

Ability to dynamically match mocks

Adds support for a new property `MockedResponse.variableMatcher`: a predicate function that accepts a `variables` param.  If `true`, the `variables` will be passed into the `ResultFunction` to help dynamically build a response.
