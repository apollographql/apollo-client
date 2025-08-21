# Apollo Client 4.0 Release Notes

Apollo Client 4.0 delivers a more modern, efficient, and type-safe GraphQL client experience through various architectural improvements and API refinements. This release focuses on developer experience, bundle size optimization, and framework flexibility.

## Key Improvements

### 🎯 Framework-Agnostic Core

Apollo Client 4.0 separates React functionality from the core library, making `@apollo/client` truly framework-agnostic. React exports now live in `@apollo/client/react`, allowing developers to use Apollo Client with any JavaScript framework without React dependencies.

### 📦 Smaller Bundle Sizes

- **Opt-in Local State Management**: The `@client` directive functionality is now opt-in via the `LocalState` class, reducing bundle size when not using local state
- **Modern Build Target**: Transpiled to target `since 2023, node >= 20, not dead`, leveraging modern JavaScript features for better performance
- **Improved Tree-Shaking**: Proper `exports` field in package.json enables better dead code elimination

### 🔧 Enhanced TypeScript Support

- **Namespaced Types**: Types are now colocated with their APIs (e.g., `useQuery.Options` instead of `QueryHookOptions`)
- **Precise Return Types**: Return types accurately reflect the options passed (e.g., `returnPartialData` makes `data` type `DeepPartial<TData>`)
- **Stricter Type Safety**: Required variables are now enforced more consistently throughout the client
- **New `dataState` Property**: Enables accurate type narrowing of query results
- **Module Augmentation**: Custom context types via declaration merging instead of fragile generics
- **Customizable Type Implementations**: Select types can be customized to provide your own type implementation to seamlessly integrate with external tools such as GraphQL Codegen or `gql.tada`

### ⚡ Modern Observable Implementation

Apollo Client 4.0 migrates from `zen-observable` to **RxJS**, providing:

- Industry-standard Observable implementation
- Rich operator ecosystem
- Better debugging tools
- Improved performance

## Major Features

### Unified Error Handling

Apollo Client 4.0 completely reimagines error handling for better clarity and debugging:

**Key Changes:**

- `ApolloError` removed in favor of specific error classes
- Network errors now respect `errorPolicy` settings
- External errors passed through without wrapping
- New error classes with static `.is()` methods for type checking

**Error Classes:**

- `CombinedGraphQLErrors` - GraphQL errors from the server
- `ServerError` - Non-GraphQL server errors
- `ServerParseError` - Server response parsing errors
- `UnconventionalError` - Wrapper for non-error thrown values
- `LinkError` - Errors from the link chain (via `.is()` check)

**Migration Example:**

```typescript
// Apollo Client 3
if (error instanceof ApolloError) {
  console.log(error.graphQLErrors);
  console.log(error.networkError);
}

// Apollo Client 4
import { CombinedGraphQLErrors } from "@apollo/client";

if (CombinedGraphQLErrors.is(error)) {
  console.log(error.errors); // GraphQL errors
} else if (error) {
  console.log(error.message); // Other errors
}
```

### The `dataState` Property

A new property that clearly indicates the completeness of query results:

**Values:**

- `empty` - No data available (`data` is `undefined`)
- `partial` - Incomplete data from cache when `returnPartialData` is `true`
- `streaming` - Incomplete data from a deferred query still streaming
- `complete` - Fully satisfied query result

**Benefits:**

- Accurate TypeScript type narrowing
- Clear loading state distinction
- Better handling of partial results

```typescript
const { data, dataState } = useQuery(MY_QUERY);

if (dataState === "complete") {
  // TypeScript knows data is fully populated
  console.log(data.allFields);
} else if (dataState === "partial") {
  // TypeScript knows data might be missing fields
  console.log(data?.someField);
}
```

### Pluggable Incremental Delivery (`@defer` Support)

Apollo Client 4.0 makes incremental delivery configurable and future-proof:

```typescript
import { Defer20220824Handler } from "@apollo/client/incremental";

const client = new ApolloClient({
  // ...
  incrementalHandler: new Defer20220824Handler(),
});
```

**Available Handlers:**

- `NotImplementedHandler` - Default, throws if `@defer` is used
- `Defer20220824Handler` - Apollo Router format support (also aliased as `GraphQL17Alpha2Handler`)

### Local State Management Improvements

Local state is now opt-in via the `LocalState` class:

```typescript
import { LocalState } from "@apollo/client/local-state";

const client = new ApolloClient({
  cache,
  localState: new LocalState({
    resolvers: {
      Query: {
        myField: () => "Hello World",
      },
    },
  }),
});
```

**Resolver Context Changes:**

```typescript
// Apollo Client 3
const resolver = (parent, args, context, info) => {
  const { cache } = context;
};

// Apollo Client 4
const resolver = (parent, args, context, info) => {
  const { client, requestContext, phase } = context;
  const cache = client.cache;
};
```

## React-Specific Improvements

### More Predictable Hooks

**`useLazyQuery` Overhaul:**

- No longer accepts `variables` or `context` options (pass to `execute` instead)
- `execute` function only accepts `variables` and `context`
- Cannot be called during render or SSR
- Automatic cancellation of in-flight queries when new ones start

**`useMutation` Changes:**

- Removed `ignoreResults` option - use `client.mutate` directly for fire-and-forget mutations

**`useQuery` Changes:**

- `notifyOnNetworkStatusChange` now defaults to `true`
- Removed deprecated `onCompleted` and `onError` callbacks

### New SSR API

The new `prerenderStatic` API replaces deprecated SSR functions:

```typescript
import { prerenderStatic } from "@apollo/client/react/ssr";

// Works with React 19's prerender APIs
const html = await prerenderStatic(<App />, {
  client,
});
```

### React Compiler Support

Pre-compiled React hooks optimized by the React Compiler:

```typescript
// Use compiled hooks for potential performance improvements
import { useQuery } from "@apollo/client/react/compiled";
```

The compiled hooks are built with React Compiler v19.1.0-rc.2 and include a runtime polyfill for compatibility with React 17+.

## Link System Evolution

### All Links Now Classes

Migration from creator functions to classes:

```typescript
// Apollo Client 3
import { createHttpLink, setContext } from "@apollo/client";
const httpLink = createHttpLink({ uri: "/graphql" });
const authLink = setContext((operation, prevContext) => {
  /*...*/
});

// Apollo Client 4
import { HttpLink, SetContextLink } from "@apollo/client";
const httpLink = new HttpLink({ uri: "/graphql" });
const authLink = new SetContextLink((prevContext, operation) => {
  /*...*/
});
```

### ErrorLink Changes

```typescript
// Apollo Client 3
onError(({ graphQLErrors, networkError }) => {
  // Handle errors separately
});

// Apollo Client 4
new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    // Handle GraphQL errors
  } else if (error) {
    // Handle other errors
  }
});
```

## Migration Tools

### Automated Codemod

Apollo Client 4.0 provides a comprehensive codemod to automate migration:

```bash
# Basic usage
npx apollo-client-codemod-migrate-3-to-4 src

# TypeScript projects (run separately)
npx apollo-client-codemod-migrate-3-to-4 --parser ts --extensions ts src
npx apollo-client-codemod-migrate-3-to-4 --parser tsx --extensions tsx src
```

The codemod handles:

1. **Import updates** - Moves React imports to `@apollo/client/react`
2. **Type migrations** - Updates types to new namespaced locations
3. **Link updates** - Converts creator functions to classes
4. **Removed exports** - Moves to `@apollo/client/v4-migration` with migration instructions

## Breaking Changes Summary

### Installation

```bash
# RxJS is now a peer dependency
npm install @apollo/client graphql rxjs
```

### ApolloClient Constructor

- `link` option is now required (no more implicit `HttpLink` creation)
- `uri`, `headers`, `credentials` removed - use `HttpLink` directly
- `name` and `version` moved to `clientAwareness` option
- `resolvers` moved to `LocalState` constructor
- `connectToDevTools` replaced with `devtools.enabled`
- `disableNetworkFetches` renamed to `prioritizeCacheValues`

### Type System

- Removed `TContext` and `TCacheShape` generics
- Types moved to namespaces (see migration guide for full list)
- Custom context via module augmentation

### Observable Changes

- Requires calling `.pipe()` for transformations
- Use RxJS operators instead of method chaining

### Testing

- `MockedProvider` now has realistic delays by default (20-50ms)
- `createMockClient` removed - use `MockLink` directly

## Performance & Build Improvements

- **Modern JavaScript**: No downlevel transpilation for modern features
- **No Polyfills**: Cleaner bundles, bring your own if needed
- **Development Mode**: Controlled via export conditions, not global `__DEV__`
- **ESM Support**: Proper `exports` field for better module resolution
- **Source Maps**: Fixed and improved for better debugging

## Deprecations & Removals

### Removed Packages/Exports

- React render prop components (`@apollo/client/react/components`)
- Higher-order components (`@apollo/client/react/hoc`)
- `@apollo/client/react/parser`
- `@apollo/client/utilities/globals`

### Removed Methods

- `client.writeData` - use `writeQuery`/`writeFragment`
- `ObservableQuery.result()` - use RxJS `firstValueFrom`
- `InMemoryCache.canonizeResults` option

## Upgrade Path

1. **Update to Apollo Client 3.14** first for deprecation warnings
2. **Install peer dependencies**: `npm install rxjs`
3. **Run the codemod** to automate import and type updates
4. **Update ApolloClient initialization** (explicit `HttpLink`, `LocalState` if needed)
5. **Review error handling** - update to use new error classes
6. **Test thoroughly** - especially SSR, error handling, and local state

## Resources

- [Migration Guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration)
- [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md)
- [API Reference](https://www.apollographql.com/docs/react/api)

## Acknowledgments

Apollo Client 4.0 represents years of community feedback and contributions. Thank you to all our contributors, early adopters, and the entire GraphQL community for making this release possible.

