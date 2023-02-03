---
'@apollo/client': minor
---

Add the ability to specify custom GraphQL document transforms. These transforms are run before local state is resolved and before the document is sent through the link chain. 

To register a custom transform, use the `documentTransforms` and `documentTransformsForLink` config option on `InMemoryCache`.

```ts
const cache = new InMemoryCache({
  documentTransforms: [customTransform],
  documentTransformsForLink: [customTransformForLink]
});
```

These two differ in the frequency at which they are called. 

* `documentTransforms` will be called once per unique query document and subsequently cached. These are useful to provide a transform that occurs for every query document.
* `documentTransformsForLink` will be called for every request. These are useful if you need to conditionally transform the document.

These transforms can also be dynamically added after the creation of the cache. Use the `add` method on each property to add these transforms after the creation of the cache.


```ts
const cache = new InMemoryCache();

cache.documentTransforms.add(customTransform, customTransform2);
cache.documentTransformsForLink.add(customTransformForLink, customTransformForLink2);
```
