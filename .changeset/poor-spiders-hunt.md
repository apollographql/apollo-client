---
"@apollo/client": minor
---

Move `MockLink` types to `MockLink` namespace. This affects the `MockedResponse`, `MockLinkOptions`, and `ResultFunction` types. These types are still exported but are deprecated in favor of the namespace. To migrate, use the types on the `MockLink` namespace instead.

```diff
import {
- MockedResponse,
- MockLinkOptions,
- ResultFunction,
+ MockLink
} from "@apollo/client/testing";

- const mocks: MockedResponse = [];
+ const mocks: MockLink.MockedResponse = [];

- const result: ResultFunction = () => {/* ... */ }
+ const result: MockLink.ResultFunction = () => {/* ... */ }

- const options: MockLinkOptions = {}
+ const options: MockLink.Options = {}
```
