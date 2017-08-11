# Change log

## vNEXT
- Replace core utils with apollo-utilities
- Move to using lerna for the repo [PR #1984](https://github.com/apollographql/apollo-client/pull/1984)

### v3.1.0
- Add `directives` to the `info` argument, with information about all of the directives on the current field. [PR #52](https://github.com/apollographql/graphql-anywhere/pull/52) by [brysgo](https://github.com/brysgo) and [cesarsolorzano](https://github.com/cesarsolorzano)
- Merging overlapping fragment and inline object fields [PR #67](https://github.com/apollographql/graphql-anywhere/pull/67) by [abergenw](https://github.com/abergenw)

### v3.0.1
- Fix behavior of getMainDefinition to allow fragment definitions to precede the main operation definition

### v3.0.0
- Improve performance of getMainDefinition.
- Breaking: getMainDefiniton now returns first operation definition in document instead of query before mutation.

### v2.2.0
- Fix mishandling of arrays in fragments
- Operation definition can also be a mutation (instead of only query)

### v2.1.0

Tolerate missing variables (to support optional arguments)
Remove a circular dependency

### v2.0.0

Change typings from `typed-graphql` to `@types/graphql`.

### v1.1.2

Remove dependency on lodash completely, so this package now has zero runtime dependencies. Nice!

### v1.1.1

Roll back failed update in 1.1.0

### v1.0.0

Releasing 0.3.0 as 1.0.0 in order to be explicit about Semantic Versioning.

### v0.3.0

Add a set of utilities for easily filtering objects with fragments and queries.

This is essentially the code that lived in https://www.npmjs.com/package/graphql-fragments

### v0.2.4

- Added support for fragments. If there are multiple fragments in the provided document, the first one is used as the query.

### v0.2.3

- Remove dep on lodash.isarray

### v0.2.2

- Add enum support

### v0.2.1

- Add context arg to `fragmentMatcher`.

### v0.2.0

- Change the last argument to `options`, move `resultMapper` there, and add `fragmentMatcher`.

### v0.1.x

- Changes were not tracker before this version.
