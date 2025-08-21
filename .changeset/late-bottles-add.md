---
"@apollo/client": patch
---

`InMemoryCache`: Fields with an empty argument object are now saved the same way as fields without arguments.

Previously, it was possible that the reponses for these two queries would be stored differently in the cache:

```gql
query PlainAccess {
  myField
}
```
would be stored as `myField`
and
```gql
query AccessWithoutOptionalArgument($optional: String) {
  myField(optional: $optional)
}
```
would be stored as `myField({"optional":"Foo"})` if called with `{optional: "Foo"}` and as `myField({})` if called without the optional argument.

The cases `myField` and `myField({})` are equivalent from the perspective of a GraphQL server, and so in the future both of these will be stored as `myField` in the cache.
