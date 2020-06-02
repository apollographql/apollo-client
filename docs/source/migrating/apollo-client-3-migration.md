---
title: Migrating to Apollo Client 3.0
---

This article walks you through migrating your application to Apollo Client 3.0 from previous versions of Apollo Client.

## What’s new in 3.0

* Apollo Client is now distributed as the `@apollo/client` package (previous versions are distributed as `apollo-client`).
* The `@apollo/client` package includes both React hooks and GraphQL request handling, which previously required installing separate packages.
* Apollo Client’s cache (`InMemoryCache`) is more flexible and performant. It now supports garbage collection, storage of both normalized and non-normalized data, and the customization of cached data with new `TypePolicy` and `FieldPolicy` APIs.
* The update also includes numerous bug fixes and optimizations, as described in the [changelog](https://github.com/apollographql/apollo-client/blob/master/CHANGELOG.md).

## Installation

> **WARNING:** Apollo Client 3.0 is a major-version release that includes **breaking changes**. If you are updating an existing application to use Apollo Client 3.0, please see the [changelog](https://github.com/apollographql/apollo-client/blob/master/CHANGELOG.md) for details about these changes.

Install Apollo Client 3.0 with the following command:

```
npm install @apollo/client
```

If you’re installing Apollo Client 3.0 in a project that already uses an earlier version, follow the instructions in each section of [Updating imports](#updating-imports) that applies to a library you are currently using.

## Updating imports

The `@apollo/client` library includes functionality that previously required installing additional packages. As part of migrating to Apollo Client 3.0, follow the instructions below for each library your application currently uses.

### @apollo/react-hooks

All `@apollo/react-hooks` functionality is included in the `@apollo/client` package. For example:

```js
import { ApolloProvider, useQuery, useApolloClient } from '@apollo/client'
```

As part of migrating, we recommend removing all `@apollo/react-hooks` dependencies.

### @apollo/react-hoc and @apollo/react-components

These two packages are not included in the `@apollo/client` library. To use them with Apollo Client 3.0, update to their 4.x versions:

```
npm install @apollo/react-hoc@latest
npm install @apollo/react-components@latest
```

```js
import { Query, Mutation, Subscription } from '@apollo/react-components';
import { graphql } from '@apollo/react-hoc';
```

### @apollo/react-testing

React Apollo’s testing utilities (like `MockedProvider`) are included in the `@apollo/client` package. Access them via `@apollo/client/testing`:

```js
import { MockedProvider } from '@apollo/client/testing';
```

As part of migrating, we recommend removing all `@apollo/react-testing` dependencies.

### react-apollo

`react-apollo` v3 is an umbrella package that re-exports the following packages:

- `@apollo/react-common`
- `@apollo/react-hooks`
- `@apollo/react-components`
- `@apollo/react-hoc`
- `@apollo/react-ssr`
- `@apollo/react-testing`

Because `@apollo/client` includes functionality from `@apollo/react-common`, `@apollo/react-hooks` and `@apollo/react-testing`, we've released a v4 version of `react-apollo` that includes only the following:

- `@apollo/react-components`
- `@apollo/react-hoc`
- `@apollo/react-ssr`

This version re-exports the remainder of React functionality directly from `@apollo/client`, so if you upgrade to `react-apollo` v4 you should still have access to everything you had in v3. That being said, we recommend removing all `react-apollo` dependencies and directly installing whichever `@apollo/react-*` packages you need.

### apollo-boost

The Apollo Boost project is now retired, because Apollo Client 3.0 provides a similarly straightforward setup. We recommend removing all `apollo-boost` dependencies and modifying your `ApolloClient` constructor as needed.

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

To continue using `apollo-link` packages besides `apollo-link-http`, replace each existing dependency with the corresponding package under the `@apollo` namespace:

* `@apollo/link-batch-http`
* `@apollo/link-context`
* `@apollo/link-error`
* `@apollo/link-retry`
* `@apollo/link-schema`
* `@apollo/link-ws`

These packages provide the same functionality as their non-`@apollo` counterparts, but they’re updated for compatibility with the `@apollo/client` package.

`apollo-link-rest` has also been updated to use `@apollo/client`, but does not use `@apollo/link-X` naming. It should still be referenced using `apollo-link-rest`, and updated to its `latest` version.

It is important to note that Apollo Client 3 no longer allows `@client` fields to be passed through a Link chain. While Apollo Client 2 made it possible to intercept `@client` fields in Link's like `apollo-link-state` and `@apollo/link-schema`, Apollo Client 3 enforces that `@client` fields are local only. This helps ensure Apollo Client's local state story is easier to understand, and prevents unwanted fields from accidentally ending up in network requests ([PR #5982](https://github.com/apollographql/apollo-client/pull/5982)).

### graphql-anywhere

The `graphql-anywhere` package’s functionality is no longer included with Apollo Client. You can continue to use the `graphql-anywhere` package, but Apollo no longer uses it and will not actively support it moving forward.

### graphql-tag

The `@apollo/client` package includes `graphql-tag` as a dependency and re-exports `gql`. To simplify your dependencies, we recommend importing gql from `@apollo/client` and removing all `graphql-tag` dependencies.

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
