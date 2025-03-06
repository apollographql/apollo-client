---
"@apollo/client": major
---

Removes the `addTypename` option from `InMemoryCache` and `MockedProvider`. `__typename` is now always added to the outgoing query document when using `InMemoryCache` and cannot be disabled.

If you are using `<MockedProvider />` with `addTypename={false}`, ensure that your mocked responses include a `__typename` field. This will ensure cache normalization kicks in and behaves more like production.
