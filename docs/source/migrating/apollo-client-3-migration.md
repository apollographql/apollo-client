---
title: Migrating to Apollo Client 3.0
---

This article walks you through migrating your application to Apollo Client 3.0 from previous versions of Apollo Client. 

To illustrate the migration process, we've also made this video that uses the example app from our [full-stack tutorial](https://www.apollographql.com/docs/tutorial/introduction/) as a starting point, updating it from Apollo client 2.6 to 3.0: 
<iframe width="560" height="315" src="https://www.youtube.com/embed/dlKzlksOUtU" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## What’s new in 3.0

* Apollo Client is now distributed as the `@apollo/client` package (previous versions are distributed as `apollo-client`).
* The `@apollo/client` package includes both React hooks and GraphQL request handling, which previously required installing separate packages.
* Apollo Client’s cache (`InMemoryCache`) is more flexible and performant. It now supports garbage collection, storage of both normalized and non-normalized data, and the customization of cached data with new `TypePolicy` and `FieldPolicy` APIs.
* The update also includes numerous bug fixes and optimizations, as described in the [changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

## Installation

> **WARNING:** Apollo Client 3.0 is a major-version release that includes **breaking changes**. If you are updating an existing application to use Apollo Client 3.0, please see the [changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md) for details about these changes.

Install Apollo Client 3.0 with the following command:

```
npm install @apollo/client
```

If you’re installing Apollo Client 3.0 in a project that already uses an earlier version, follow the instructions in each section of [Updating imports](#updating-imports) that applies to a library you are currently using.

## Updating imports

The `@apollo/client` library includes functionality that previously required installing additional packages. As part of migrating to Apollo Client 3.0, follow the instructions below for each library your application currently uses.

> To simplify the process of converting your `import` declarations from older packages to `@apollo/client`, we provide an automated [transform](https://github.com/apollographql/apollo-client/tree/main/codemods/ac2-to-ac3) based on [`jscodeshift`](https://www.npmjs.com/package/jscodeshift). Note that this transform merely moves `import` specifiers between `import` declarations, without checking for proper usage of the imported values. Since the transform cannot take care of everything, pay close attention to any errors produced by TypeScript or your bundling tools, and be sure to verify all changes made by the transform. A more detailed list of caveats can be found in the [`README.md`](https://github.com/apollographql/apollo-client/tree/main/codemods/ac2-to-ac3#known-limitations).

### @apollo/react-hoc and @apollo/react-components

React Apollo HOC and component functionality is now included in the `@apollo/client` package:

```js
import { Query, Mutation, Subscription } from '@apollo/client/react/components';
import { graphql } from '@apollo/client/react/hoc';
```

As part of migrating, we recommend removing all `@apollo/react-hoc` and `@apollo/react-components` dependencies.

### @apollo/react-hooks

All `@apollo/react-hooks` functionality is included in the `@apollo/client` package. For example:

```js
import { ApolloProvider, useQuery, useApolloClient } from '@apollo/client'
```

As part of migrating, we recommend removing all `@apollo/react-hooks` dependencies.

### @apollo/react-ssr

React Apollo’s SSR utilities (like `getDataFromTree`, `getMarkupFromTree`, and `renderToStringWithData`) are included in the `@apollo/client` package. Access them via `@apollo/client/react/ssr`:

```js
import { renderToStringWithData } from '@apollo/client/react/ssr';
```

As part of migrating, we recommend removing all `@apollo/react-ssr` dependencies.

### @apollo/react-testing

React Apollo’s testing utilities (like `MockedProvider`) are included in the `@apollo/client` package. Access them via `@apollo/client/testing`:

```js
import { MockedProvider } from '@apollo/client/testing';
```

As part of migrating, we recommend removing all `@apollo/react-testing` dependencies.

### apollo-boost

The Apollo Boost project is now retired, because Apollo Client 3.0 provides a similarly straightforward setup. We recommend removing all `apollo-boost` dependencies and modifying your `ApolloClient` constructor as needed.

### apollo-client

With Apollo Client 3.0, the `apollo-client` package is retired in favor of `@apollo/client`. As part of migrating, remove all `apollo-client` dependencies.

### apollo-link and apollo-link-http

All `apollo-link`, `apollo-link-http`, and `apollo-link-http-common` functionality is included in the `@apollo/client` package. For example:

```js
import { ApolloLink, HttpLink, from, split, execute } from '@apollo/client';
```

As part of migrating, we recommend removing all `apollo-link`, `apollo-link-http`, and `apollo-link-http-common` dependencies.

If you want to configure your own link chain, the `ApolloClient` constructor still accepts a link option. Otherwise, the `ApolloClient` constructor now also supports `uri`, `headers`, and `credentials` options. For example:

```js
const client = new ApolloClient({
  cache,
  uri: 'http://localhost:4000/graphql',
  headers: {
    authorization: localStorage.getItem('token') || '',
    'client-name': 'Space Explorer [web]',
    'client-version': '1.0.0',
  },
  ...
});
```

These options are passed into a new `HttpLink` instance behind the scenes, which `ApolloClient` is then configured to use.

### apollo-link-*

The separate `apollo-link-*` packages, that were previously maintained in the https://github.com/apollographql/apollo-link repo, have been merged into the Apollo Client project. These links now have their own nested `@apollo/client` entry points. Imports should be updated as follows:

* `apollo-link-batch` is now `@apollo/client/link/batch`
* `apollo-link-batch-http` is now `@apollo/client/link/batch-http`
* `apollo-link-context` is now `@apollo/client/link/context`
* `apollo-link-error` is now `@apollo/client/link/error`
* `apollo-link-retry` is now `@apollo/client/link/retry`
* `apollo-link-schema` is now `@apollo/client/link/schema`
* `apollo-link-ws` is now `@apollo/client/link/ws`

It is important to note that Apollo Client 3 no longer allows `@client` fields to be passed through a Link chain. While Apollo Client 2 made it possible to intercept `@client` fields in Link's like `apollo-link-state` and `apollo-link-schema`, Apollo Client 3 enforces that `@client` fields are local only. This helps ensure Apollo Client's local state story is easier to understand, and prevents unwanted fields from accidentally ending up in network requests ([PR #5982](https://github.com/apollographql/apollo-client/pull/5982)).

### graphql-anywhere

The `graphql-anywhere` package’s functionality is no longer included with Apollo Client. You can continue to use the `graphql-anywhere` package, but Apollo no longer uses it and will not actively support it moving forward.

### graphql-tag

The `@apollo/client` package includes `graphql-tag` as a dependency and re-exports `gql`. To simplify your dependencies, we recommend importing gql from `@apollo/client` and removing all `graphql-tag` dependencies.

### react-apollo

`react-apollo` v3 is an umbrella package that re-exports the following packages:

- `@apollo/react-common`
- `@apollo/react-hooks`
- `@apollo/react-components`
- `@apollo/react-hoc`
- `@apollo/react-ssr`
- `@apollo/react-testing`

The `react-apollo` package has been deprecated, and the functionality offered by each of the above packages can now be accessed from `@apollo/client` directly:

- `@apollo/react-hooks` -> now available directly from `@apollo/client`
- `@apollo/react-components` -> now available from `@apollo/client/react/components`
- `@apollo/react-hoc` -> now available from `@apollo/client/react/hoc`
- `@apollo/react-ssr` -> now available from `@apollo/client/react/ssr`
- `@apollo/react-testing` -> now available from `@apollo/client/testing`

## Using individual components of Apollo Client 3

Apollo Client 3.0 provides multiple entry points for you to import from. If you only use a particular part of Apollo Client’s functionality, you can import that functionality from its corresponding entry point. By doing so, modern bundlers can omit the remainder of the `@apollo/client` package from your bundle and reduce its size considerably.

### Using Apollo Client without React

Apollo Client 3.0 includes built-in support for React hooks, but it absolutely still supports non-React view layers. To use Apollo Client 3.0 with Vue, Angular, or another view layer of your choosing, import `ApolloClient` from the `@apollo/client/core` entry point:

```js
import { ApolloClient } from '@apollo/client/core';
```

### Using apollo-utilities without the rest of Apollo Client

The `apollo-utilities` package has been removed, but you can access the utilities themselves from the `@apollo/client/utilities` entry point:

```js
import { isReference, isInlineFragment } from '@apollo/client/utilities';
```

### Using apollo-cache and/or apollo-cache-inmemory without the rest of Apollo Client

The `apollo-cache` and `apollo-cache-inmemory` packages have been removed, but if you're interested in using Apollo Client's cache by itself, you can access their contents with the `@apollo/client/cache` entry point:

```js
import { ApolloCache, InMemoryCache } from '@apollo/client/cache';
```

## Cache improvements

Apollo Client 3.0 introduces powerful improvements to its caching system. Most of these improvements are backward compatible, so most applications will continue to work without any changes to caching logic. However, we highly recommend learning more about the capabilities of the Apollo Client 3.0 cache.

* [Configuring the cache](../caching/cache-configuration/)
* [Interacting with cached data](../caching/cache-interaction/)

### Breaking cache changes

The following cache changes are **not** backward compatible. Take them into consideration before you upgrade to Apollo Client 3.0.

* By default, the `InMemoryCache` no longer merges the fields of two objects unless those objects have the same unique identifier and that identifier is present in both objects. Additionally, the values of fields with the same name are no longer merged recursively by default. You can define a custom `merge`  function for a field to handle both of these changes for a particular field. You can read more about these changes in [Merging non-normalized objects](../caching/cache-field-behavior/#merging-non-normalized-objects). ([PR #5603](https://github.com/apollographql/apollo-client/pull/5603)).
* All cache results are now frozen/immutable, as promised in the [Apollo Client 2.6 blog post](https://blog.apollographql.com/whats-new-in-apollo-client-2-6-b3acf28ecad1) ([PR #5153](https://github.com/apollographql/apollo-client/pull/5153)).
* `FragmentMatcher`, `HeuristicFragmentMatcher`, and `IntrospectionFragmentMatcher` have all been removed. We recommend using the `InMemoryCache`’s `possibleTypes` option instead. For more information, see [Defining possibleTypes manually](../data/fragments/#defining-possibletypes-manually) ([PR #5073](https://github.com/apollographql/apollo-client/pull/5073)).
* The internal representation of normalized data in the cache has changed. If you’re using `apollo-cache-inmemory`’s public API, then these changes shouldn’t impact you. If you are manipulating cached data directly instead, review [PR #5146](https://github.com/apollographql/apollo-client/pull/5146) for details.
* `client|cache.writeData` have been fully removed. `client|cache.writeQuery`, `client|cache.writeFragment`, and/or `cache.modify` can be used to update the cache. For example:

  ```js
    client.writeData({
      data: {
        cartItems: []
      }
    });
  ```

  can be converted to:

  ```js
    client.writeQuery({
      query: gql`
        query GetCartItems {
          cartItems
        }
      `,
      data: {
        cartItems: []
      }
    });
  ```

  For more details around why `writeData` has been removed, see [PR #5923](https://github.com/apollographql/apollo-client/pull/5923).
