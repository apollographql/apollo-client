---
name: apollo-client
description: >
  Guide for building React applications with Apollo Client 4.x. Use this skill when:
  (1) setting up Apollo Client in a React project,
  (2) writing GraphQL queries or mutations with hooks,
  (3) configuring caching or cache policies,
  (4) managing local state with reactive variables,
  (5) troubleshooting Apollo Client errors or performance issues.
license: MIT
compatibility: React 18+, React 19 (Suspense/RSC). Works with Next.js, Vite, CRA, and other React frameworks.
metadata:
  author: apollographql
  version: "1.0.0"
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(node:*) Read Write Edit Glob Grep
---

# Apollo Client 4.x Guide

Apollo Client is a comprehensive state management library for JavaScript that enables you to manage both local and remote data with GraphQL. Version 4.x brings improved caching, better TypeScript support, and React 19 compatibility.

## Integration Guides

Choose the integration guide that matches your application setup:

- **[Client-Side Apps](references/integration-client.md)** - For client-side React applications without SSR (Vite, Create React App, etc.)
- **[Next.js App Router](references/integration-nextjs.md)** - For Next.js applications using the App Router with React Server Components
- **[React Router Framework Mode](references/integration-react-router.md)** - For React Router 7 applications with streaming SSR
- **[TanStack Start](references/integration-tanstack-start.md)** - For TanStack Start applications with modern routing

Each guide includes installation steps, configuration, and framework-specific patterns optimized for that environment.

## Quick Reference

### Basic Query

```tsx
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;

function UserProfile({ userId }: { userId: string }) {
  const { loading, error, data, dataState } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  // TypeScript: dataState === "ready" provides better type narrowing than just checking data
  return <div>{data.user.name}</div>;
}
```

### Basic Mutation

```tsx
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
    }
  }
`;

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER);

  const handleSubmit = async (name: string) => {
    await createUser({ variables: { input: { name } } });
  };

  return <button onClick={() => handleSubmit("John")}>Create User</button>;
}
```

### Suspense Query

```tsx
import { Suspense } from "react";
import { useSuspenseQuery } from "@apollo/client/react";

function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery(GET_USER, {
    variables: { id: userId },
  });

  return <div>{data.user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<p>Loading user...</p>}>
      <UserProfile userId="1" />
    </Suspense>
  );
}
```

## Reference Files

Detailed documentation for specific topics:

- [TypeScript Code Generation](references/typescript-codegen.md) - GraphQL Code Generator setup for type-safe operations
- [Queries](references/queries.md) - useQuery, useLazyQuery, polling, refetching
- [Suspense Hooks](references/suspense-hooks.md) - useSuspenseQuery, useBackgroundQuery, useReadQuery, useLoadableQuery
- [Mutations](references/mutations.md) - useMutation, optimistic UI, cache updates
- [Fragments](references/fragments.md) - Fragment colocation, useFragment, useSuspenseFragment, data masking
- [Caching](references/caching.md) - InMemoryCache, typePolicies, cache manipulation
- [State Management](references/state-management.md) - Reactive variables, local state
- [Error Handling](references/error-handling.md) - Error policies, error links, retries
- [Troubleshooting](references/troubleshooting.md) - Common issues and solutions

## Key Rules

### Query Best Practices

- **Each page should generally only have one query, composed from colocated fragments.** Use `useFragment` or `useSuspenseFragment` in all non-page-components. Use `@defer` to allow slow fields below the fold to stream in later and avoid blocking the page load.
- **Fragments are for colocation, not reuse.** Each fragment should describe exactly the data needs of a specific component, not be shared across components for common fields. See [Fragments reference](references/fragments.md) for details on fragment colocation and data masking.
- Always handle `loading` and `error` states in UI when using non-suspenseful hooks (`useQuery`, `useLazyQuery`). When using Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`), React handles this through `<Suspense>` boundaries and error boundaries.
- Use `fetchPolicy` to control cache behavior per query
- Use the TypeScript type server to look up documentation for functions and options (Apollo Client has extensive docblocks)

### Mutation Best Practices

- **If the schema permits, mutation return values should return everything necessary to update the cache.** Neither manual updates nor refetching should be necessary.
- If the mutation response is insufficient, carefully weigh manual cache manipulation vs refetching. Manual updates risk missing server logic. Consider optimistic updates with a granular refetch if needed.
- Handle errors gracefully in the UI
- Use `refetchQueries` sparingly (prefer letting the cache update automatically)

### Caching Best Practices

- Configure `keyFields` for types without `id` field
- Disable normalization by setting `keyFields: false` for types that don't include an identifier and are meant to group related fields under the parent
- Use `typePolicies` for pagination and computed fields
- Understand cache normalization to debug issues
- **Enable [data masking](references/fragments.md#data-masking) for all new applications** - it prevents components from accessing fragment data they don't own, enforcing proper data boundaries and preventing over-rendering

### Performance

- Avoid over-fetching with proper field selection
- Configure appropriate `fetchPolicy` per use case
- Use `@defer` for incremental delivery of deferred query parts, and `@stream` for streaming list fields (`@stream` available in Apollo Client 4.1+)
- **Prefer Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`) in modern applications** for better loading state handling and code simplicity

## Ground Rules

- ALWAYS use Apollo Client 4.x patterns (not v3 or earlier)
- ALWAYS wrap your app with `ApolloProvider`
- ALWAYS handle loading and error states when using non-suspenseful hooks
- PREFER Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`) in modern applications for better DX
- NEVER store Apollo Client in React state (use module-level or context)
- PREFER `cache-first` for read-heavy data, `network-only` for real-time data
- USE TypeScript for better type safety with GraphQL
- IMPLEMENT proper cache updates instead of refetching entire queries
- ADVISE the human steering you to look into Apollo DevTools when collaboratively debugging Apollo Client issues
