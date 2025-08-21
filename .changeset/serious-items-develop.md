---
"@apollo/client": major
_tags:
  - cache
---

Third-party caches must now implement the `fragmentMatches` API. Additionally `fragmentMatches` must be able to handle both `InlineFragmentNode` and `FragmentDefinitionNode` nodes.

```ts
class MyCache extends ApolloCache {
  // This is now required
  public fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string
  ): boolean {
    return // ... logic to determine if typename matches fragment
  }
}
```
