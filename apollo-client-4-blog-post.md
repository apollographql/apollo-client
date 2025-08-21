# Apollo Client 4.0: a leaner and cleaner GraphQL client with no compromises

Today, we're thrilled to announce the release of Apollo Client 4.0, a milestone release that delivers significant improvements in bundle size, TypeScript support, and developer experience. After extensive community feedback and months of iteration through release candidates, version 4.0 represents our most refined and performant Apollo Client yet.

The JavaScript ecosystem has evolved dramatically since Apollo Client 3.0's release. Modern build tools offer sophisticated tree-shaking, the state of the art of TypeScript has significantly improved, and applications demand smaller bundles to meet Core Web Vitals targets. Apollo Client 4.0 embraces these changes while maintaining the developer experience you love.

## Dramatically Smaller Bundles

Bundle size has been a top concern in community feedback, and we've taken it seriously. Apollo Client 4.0 introduces opt-in architecture for features that not everyone needs. The most impactful change is making local state management opt-in. If you're not using `@client` directives for local state, you no longer carry that code in your bundle. This same principle extends to other commonly-unused features like `HttpLink`, which is no longer bundled by default when you're using custom terminating links. When you do need these features, importing them explicitly gives you the same powerful functionality, but only when you actually use it.

We've also modernized our build targets. Apollo Client 4.0 ships JavaScript transpiled for browsers from 2023 and Node.js 20+, taking advantage of native language features instead of polyfills. Combined with proper ESM support and improved tree-shaking, most applications will see a **20-30%** reduction in Apollo Client's bundle size contribution. For teams fighting to stay under performance budgets, this improvement alone makes upgrading worthwhile.

## TypeScript That Helps

We've completely reimagined our TypeScript architecture based on a simple principle: types should be discoverable where you use them. Instead of hunting through documentation for type names, types now live alongside their APIs through namespaces. When you import `useQuery`, you get `useQuery.Options` and `useQuery.Result` right there. It's a small change that makes a big difference in day-to-day development.

But the improvements go deeper. Apollo Client 4.0 now enforces required variables at the type level — if your query has required variables, TypeScript won't let you forget them. The fragile `TContext` generic has been replaced with module augmentation for defining custom context types across your link chain. And with the new `TypeOverrides` interface, you can customize how Apollo Client handles partial data, streaming responses, and more, all while maintaining type safety.

```typescript
import { useQuery } from "@apollo/client/react";

// Variables are now required when the query needs them
function UserProfile({ userId }: { userId: string }) {
  // TypeScript error if variables are missing when required!
  const { data, dataState } = useQuery(USER_QUERY, {
    variables: { id: userId } // Required by TypeScript
  });
  
  if (dataState === 'complete') {
    // TypeScript knows data is fully populated
    return <Profile user={data.user} />;
  }
  // ...
}

// Define context types once for your entire app
declare module "@apollo/client" {
  interface DefaultContext {
    authToken?: string;
    requestId?: number;
  }
}
```

Speaking of `dataState`, this new property solves one of the most common TypeScript frustrations with Apollo Client. Previously, determining whether `data` was partial, complete, or missing required checking multiple flags. Now, `dataState` gives you a single source of truth with four clear states: `empty`, `partial`, `streaming`, and `complete`. TypeScript can narrow types based on these states, eliminating runtime errors from accessing undefined data.

## More Intuitive Error Handling

Error handling in Apollo Client 3 often required developers to dig through nested properties in order to grasp what went wrong. Apollo Client 4.0 replaces the monolithic `ApolloError` with specific error classes that tell you exactly what happened. GraphQL errors from your server are now clearly distinguished from network failures or parsing errors. Each error type has static methods for type checking, making error handling both more intuitive and more type-safe.

```typescript
import { CombinedGraphQLErrors } from "@apollo/client";

// Clear, specific error handling
if (CombinedGraphQLErrors.is(error)) {
  error.errors.forEach(e => console.log(e.message));
} else if (error) {
  console.error("Network error:", error.message);
}
```

This clarity extends throughout the API. Hooks like `useLazyQuery` now have clearer boundaries about what options go where—initial options on the hook, execution options on the execute function. The `loading` state actually means loading now, with `notifyOnNetworkStatusChange` defaulting to `true` so refetches are properly reflected in your UI.

## Built for Modern JavaScript

Apollo Client 4.0 fully embraces modern JavaScript standards. We've migrated from `zen-observable` to RxJS, giving you access to a massive ecosystem of operators and debugging tools. RxJS is now a peer dependency, so you control the version and can share a single instance across your entire application.

The move to ESM-first packaging isn't just about following trends, it delivers real benefits. Your bundler can now analyze and optimize Apollo Client code just like your own application code. Dead code elimination works properly, dynamic imports are supported, and you get better debugging with proper source maps. For teams using Vite, Webpack 5, or other modern bundlers, the improvement in build times and bundle optimization is immediately noticeable.

React has never been required to use Apollo Client, but in prior versions our exported modules could sometimes muddy the waters in a way that confused non-React users. Apollo Client 4.0 addresses this friction point by making all top-level exported members completely free of React dependencies. React remains a first-class citizen with all the hooks and patterns you're familiar with, they just live in `@apollo/client/react` now.

## A Smooth Migration Path

We know that major version upgrades can be daunting, especially for large codebases. That's why we've invested heavily in migration tooling. Our comprehensive codemod handles the mechanical changes automatically—updating imports, converting link creator functions to classes, and migrating deprecated APIs. For most applications, you can run the codemod and be 90% done with your migration in minutes.

```bash
npx apollo-client-codemod-migrate-3-to-4 src
```

The remaining changes are typically intentional breaking changes that require human judgment, like updating error handling or choosing whether to adopt new features like the `LocalState` class. Our migration guide walks through each change with clear examples and explanations.

## Looking Forward

Apollo Client 4.0 is more than a bundle size reduction or API cleanup—it's a foundation for the next generation of GraphQL development. We're already seeing significant performance improvements from teams using the React Compiler-optimized hooks. The framework-agnostic core opens possibilities for deeper framework integrations. And the cleaner TypeScript architecture makes it easier for us to add new features without breaking existing code.

This release wouldn't have been possible without extensive community feedback and contributions. Thank you to everyone who tested release candidates, reported issues, and helped shape Apollo Client 4.0 into what it is today.

Ready to upgrade? Install Apollo Client 4.0 today:

```bash
npm install @apollo/client@latest graphql rxjs
```

For detailed upgrade instructions, check out our [migration guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration). For the complete list of changes, see the [changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

Happy querying!
