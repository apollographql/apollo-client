---
"@apollo/client": minor
---

Allow the `@unmask` directive on fragment definitions. This unmasks fragment data for every fragment spread that uses the fragment.

```graphql
query GetPosts {
  posts {
    id
    # PostDetails data is unmasked
    ...PostDetails
  }
}

fragment PostDetails on Post @unmask {
  title
}
```

An `@unmask` directive on a fragment spread takes precedence over an `@unmask` directive on the fragment definition. `@unmask(mode: "migrate")` is also supported on fragment definitions.

This change also adds a `--target` option to decide where the `@unmask` directive is added.
