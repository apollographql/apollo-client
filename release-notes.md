# Apollo Client v4.0 Release Notes

Apollo Client v4 contains comprehensive improvements to error handling, TypeScript support, and developer experience. This release modernizes the codebase and reduces bundle size while maintaining the powerful GraphQL client capabilities you rely on.

## Major Themes

### Enhanced Error Handling

Apollo Client v4 introduces more precise error abstractions that replace the monolithic `ApolloError` class.

**Key Changes:**
- **Specialized Error Classes**: Errors are now categorized into distinct types:
  - `CombinedGraphQLErrors` for GraphQL errors (replacing `graphqlErrors`)
  - Network errors are passed through directly as-is (no wrapper class)
  - `CombinedProtocolErrors` for transport-level errors
- **Type-Safe Error Handling**: Use `instanceof` checks to handle specific error types
- **Improved Error Wrapping**: String errors are automatically wrapped in `Error` instances, and non-error objects are wrapped in `UnconventionalError` with a `cause` property

**Migration Example:**
```typescript
// Apollo Client v3
if (error instanceof ApolloError) {
  console.log(error.graphQLErrors);
  console.log(error.networkError);
}

// Apollo Client v4
if (error instanceof CombinedGraphQLErrors) {
  console.log(error.graphQLErrors);
} else if (error instanceof CombinedProtocolErrors) {
  console.log(error.protocolErrors);
} else {
  // Network errors and other errors are passed through as-is
  console.log(error.message);
}
```

### TypeScript Improvements

Apollo Client v4 improves type safety and developer experience through its type definitions.

**dataState Type System Overhaul:**
- The `TData` generic is no longer modified by the `DataState` generic
- Type narrowing is now more precise and predictable
- New type signature pattern: `QueryRef<TData, TVariables, 'partial'>` instead of `QueryRef<DeepPartial<TData>, TVariables>`

**Context Type Extensions:**
- Define types for `context` passed to the link chain using declaration merging
- Built-in support for `HttpLink.ContextOptions` and `BatchHttpLink.ContextOptions`

**Namespace Organization:**
- Link types now live on the `ApolloLink` namespace
- MockLink types moved to the `MockLink` namespace
- Cleaner, more discoverable API surface

**Type Override System:**
- New `DataValue` namespace with `Complete`, `Streaming`, and `Partial` types
- Support for data masking type overrides
- Extensible type system for custom implementations

### The New `dataState` Property

The `dataState` property provides clear visibility into the completeness of your query results.

**Values:**
- `empty`: No data available (`data` is `undefined`)
- `partial`: Incomplete data from cache when `returnPartialData` is `true`
- `streaming`: Incomplete data from a deferred query still streaming
- `complete`: Fully satisfied query result

**Benefits:**
- **Type Narrowing**: The `dataState` property helps TypeScript narrow the type of the `data` property
- **Clear Data Status**: No more guessing about whether your data is complete or partial
- **Better Developer Experience**: Available on `ObservableQuery` and all React hooks returning `data`

**Example:**
```typescript
const { data, dataState } = useQuery(MY_QUERY);

if (dataState === 'complete') {
  // TypeScript knows data is fully typed here
  console.log(data.allFields);
} else if (dataState === 'partial') {
  // TypeScript knows data might be missing fields
  console.log(data?.someField);
}
```

### `@defer` Support Evolution

Apollo Client v4 introduces a pluggable incremental delivery system for the `@defer` directive. This gives developers the flexibility to define which incremental delivery protocol to use without sacrificing compatibility with any further specification changes. Please note that Apollo Client 4.0 intentionally does not specifcy a default implementation since incremental delivery is still not merged into the draft GraphQL specification. Users must opt into a specific protocol version.

**Pluggable Implementation:**
- Configure incremental delivery through the `incrementalHandler` option
- Available handlers:
  - `NotImplementedHandler` (default)
  - `Defer20220824Handler` (Apollo Router format)
  - `GraphQL17Alpha2Handler` (alias for Defer20220824Handler, for GraphQL 17.0.0-alpha.2 compatibility)

**HTTP Multipart Improvements:**
- Stricter error handling for connection issues
- Better handling of non-WhatWG response bodies
- Improved reliability for long-running deferred queries

### Local State Management Enhancements

Local state management in Apollo Client v4 has been revamped for modularity, reliability and type safety.

**Resolver System Overhaul:**
- Resolvers have been moved from `ApolloClient` to a new `LocalState` class
- The `resolvers` option on `ApolloClient` has been replaced with a `localState` option
- Errors thrown in resolvers now set the field to `null` and add to the `errors` array
- Remote results are dealiased before being passed to resolvers
- New `context` function for customizing `requestContext`
- `Resolvers` generic provides autocompletion and type checking

**Breaking Change - Resolver Migration:**
Resolvers must now be configured through the `LocalState` class:
```typescript
// Apollo Client v3
const client = new ApolloClient({
  cache,
  resolvers: { /* ... */ }
});

// Apollo Client v4
import { LocalState } from '@apollo/client/local-state';

const client = new ApolloClient({
  cache,
  localState: new LocalState({
    resolvers: { /* ... */ }
  })
});
```

**Breaking Change - Resolver Context:**
The resolver `context` argument (3rd argument) has been restructured:
```typescript
// Apollo Client v3
const resolver = (parent, args, context, info) => {
  const { cache } = context;
};

// Apollo Client v4
const resolver = (parent, args, context, info) => {
  const { client, requestContext, phase } = context;
  const cache = client.cache;
};
```

**New Codegen Plugin:**

This release introduces the `@apollo/client-graphql-codegen` package for creating resolver types for GraphQL Code Generator. It is tailored specifically for `LocalState` usage and allows for type-safe resolver development.

## Additional Improvements

### React Integration Changes

**React Exports Migration:**
All React-related exports have moved to dedicated entrypoints:
- Main exports: `@apollo/client/react`
- Testing utilities: `@apollo/client/testing/react`
- Note: `gql` should be imported from `@apollo/client`, not from `@apollo/client/react`

In previous versions, users sometimes inadvertently imported React modules through seemingly unrelated paths.  In v4 we resolve these footguns to make it more transparent when React-only modules are being imported.

**React Compiler Support (Experimental):**
Apollo Client v4 ships with React Compiler-optimized hooks available at `@apollo/client/react/compiled`. This experimental feature provides:
- Pre-compiled React hooks optimized by the React Compiler
- Drop-in replacement for standard React hooks
- Potential performance improvements in React 19+ applications
- Same API surface as `@apollo/client/react`

To use the compiled hooks:
```typescript
// Instead of importing from @apollo/client/react
import { useQuery, useMutation } from '@apollo/client/react/compiled';

// Use exactly the same as before - the API is identical
const { data, loading } = useQuery(MY_QUERY);
```

Note: This is an experimental optimization. The standard `@apollo/client/react` hooks remain the recommended default for most applications.

### Modern Package Format

- Ships both ESM and CJS formats
- Modern runtime target (browserslist: "since 2023, node >= 20, not dead")
- Improved tree-shaking with proper `exports` field
- Development/production export conditions instead of `globalThis.__DEV__`
- Fixed source maps for better debugging

### RxJS as Observable Implementation

- Migrated from `zen-observable` to RxJS
- RxJS is now a peer dependency
- Full RxJS operator support
- Links using observables must use `.pipe(map())` instead of `.map()`

### Link System Improvements

**Class-Based Links:**
All links are now available as classes, with creator functions deprecated:
```typescript
// Apollo Client v3
const link = createHttpLink({ uri: '/graphql' });

// Apollo Client v4
const link = new HttpLink({ uri: '/graphql' });
```

**Enhanced Client Awareness:**
- `HttpLink` and `BatchHttpLink` automatically send client library information
- New `ClientAwarenessLink` for custom implementations
- Can be disabled with `enhancedClientAwareness: { transport: false }`

### Cache and Query Enhancements

- **ObservableQuery Lifecycle**: Queries only registered while they have subscribers
- **fetchMore Improvements**: Better option inheritance and variable handling
- **InMemoryCache**: Fields with empty argument objects stored same as fields without arguments
- **Promise-based API Cleanup**: Removed `loading` and `networkStatus` from promise resolutions

### Testing Improvements

**MockLink Enhancements:**
- Default `delay` configuration (global and per-instance)
- New `realisticDelay` helper for realistic network simulation
- Improved variable matching with callback support

**Testing Utilities:**
- Internal utilities moved to `@apollo/client/testing/internal`
- Cleaner, more stable testing API

### Network and Fetch Requirements

- Requires WhatWG ReadableStream specification compliance
- No longer supports Node Streams or Async Iterators as `Response.body`
- Better abort signal handling
- WebSocketLink deprecation warning added
- Full support for `application/graphql-response+json` media type with stricter adherence to the GraphQL over HTTP specification

### SSR Improvements

- `disableNetworkFetches` renamed to `prioritizeCacheValues`
- Better handling of fetch policies during SSR
- Improved hydration behavior

## Breaking Changes Summary

Apollo Client v4 includes breaking changes that require migration. The most significant include:

1. **Error System**: Replace `ApolloError` checks with specific error class checks (`CombinedGraphQLErrors`, `CombinedProtocolErrors`, etc.)
2. **React Exports**: Update imports from `@apollo/client` to `@apollo/client/react` (except `gql` which stays in `@apollo/client`)
3. **Link Classes**: Replace creator functions with class constructors
4. **ApolloClient Constructor**: `link` option is now required
5. **Local State**: Move `resolvers` from `ApolloClient` to new `LocalState` class
6. **Resolver Context**: Update resolver signatures to use new context structure
7. **RxJS Migration**: Update observable transformations to use `.pipe()`
8. **Type System**: Update type signatures for `dataState` changes

## Migration Resources

For detailed migration guides and examples, visit our documentation at [apollographql.com/docs/react/migrating/apollo-client-4-migration](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration).

## Acknowledgments

This release represents years of work from the Apollo Client team and our amazing community. Thank you to all our contributors who helped make v4 possible!
