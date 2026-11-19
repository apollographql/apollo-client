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
  version: "1.1.0"
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(node:*) Read Write Edit Glob Grep
---

# Apollo Client 4.x Guide

Apollo Client is a comprehensive state management library for JavaScript that enables you to manage both local and remote data with GraphQL. Version 4.x brings improved caching, better TypeScript support, and React 19 compatibility.

Before you use an API marked with a minimum version (for example "4.1+"), read the installed `@apollo/client` version in `package.json`. If the installed version is older, use the alternative that the reference file describes.

## Integration Guides

Choose the integration guide that matches your application setup:

- **[Client-Side Apps](references/integration-client.md)** - For client-side React applications without SSR (Vite, Create React App, etc.)
- **[Next.js App Router](references/integration-nextjs.md)** - For Next.js applications using the App Router with React Server Components
- **[React Router Framework Mode](references/integration-react-router.md)** - For React Router 7 applications with streaming SSR
- **[TanStack Start](references/integration-tanstack-start.md)** - For TanStack Start applications with modern routing

Each guide includes installation steps, configuration, and framework-specific patterns optimized for that environment.

## Where Data Comes From

Read this section before you write any code that fetches data. It decides where queries go, and it overrides patterns that you find in examples elsewhere.

### Only the route component calls a query hook

The **route component** is the component that renders the route for the current URL. For example, the `element` or `Component` of a React Router route, the `component` of a TanStack Router route, or a Next.js `page.tsx`. The route component owns the one query for that route (`useQuery`, `useSuspenseQuery`, `useBackgroundQuery`, or `preloadQuery` in the route loader).

All other components get their data from a fragment that they own, and read it with `useFragment` or `useSuspenseFragment`. See the [Fragments reference](references/fragments.md).

**Why:** One query per route sends one request, gives one loading state, and avoids request waterfalls. Each component declares exactly the fields it uses, so you can change one component without breaking or over-fetching for another. With data masking, a component re-renders only when its own fields change.

If the route needs a `<Suspense>` boundary around the part of the page that uses the data, prefer `useBackgroundQuery` (or `preloadQuery`) in the route component and `useReadQuery` in the parent-most component that needs the data. `useBackgroundQuery` starts the query in the route without suspending it, so the request starts sooner and the route renders its shell immediately while the loading fallback appears only around the data. The child receives only the `queryRef`, not every value needed for the variables. A skipped query returns an `undefined` `queryRef` that you can check before you render. Do not move `useSuspenseQuery` into an inner component only to wrap it in a boundary. If an inner component does call the route query, it is part of the route and owns the route query. It is not a second query.

### Queries are never shared

Each route has its own query. Do not reuse the query of another route, and do not wrap a query in a custom hook (such as `useCurrentUser()` or `useProduct(id)`) that more than one component calls. This applies even when two routes need the same data today. Routes change for different reasons, and a shared query makes every route fetch the fields that the other routes need. If two routes need the same component, each route spreads that component's fragment in its own query.

### Permitted exceptions

These are the only cases where a component other than the route component calls a query hook. When you use one, add a comment above the hook that states which exception applies and why.

1. **A modal or panel that loads its data lazily.** The most common case is a modal that shows details for an item the user selects. The page does not know the item until the user selects it. It is also correct when the modal or panel is hidden until the user opens it and needs a lot of data that the route does not show. In both cases, the modal can query exactly what it needs, and the route does not load data that it does not render.
2. **A query that a user action starts.** For example, a search page that runs the query when the user submits a search. Use `useLoadableQuery` or `useLazyQuery`.
3. **A dependent query, as a last resort.** Only when the schema cannot return the data in one query, and a second query needs a value from the first query as a variable. Before you use this exception, look in the schema for a field that returns the data as part of the first query.
4. **A slow route that `@defer` cannot fix (extreme cases only).** First, use `@defer` on the slow fields or on the fields below the fold. Use a separate query only when all of these are true:

   - The route query is so slow that it causes a measured performance problem. A guess is not enough.
   - `@defer` is not available: the server does not support it, or the user decided not to use it, for example to reduce load on the initial query.
   - The separate query loads data below the fold that the first render does not need.

   This exception does not permit parallel queries to "make the page faster". Two queries for one route send two requests and cannot share loading or error states. The comment must say why `@defer` is not available.

**App shell data** (for example, the current user in a navigation bar) is not an exception. It belongs to the query of the **root route**, the route that all other routes render under. Where the root route lives depends on the framework.

### Starting the route query

The route query can start in one of two places:

- **In a route loader**, with `preloadQuery`. Read the result with `useReadQuery`.
- **In the route component**, with `useSuspenseQuery`, `useBackgroundQuery`, or `useQuery`.

Use the pattern that the project already uses. If the project uses neither, ask the user which they prefer.

`preloadQuery` and `useBackgroundQuery` let the route render its shell (layout, headings, navigation) without waiting for data. Pass the `queryRef` to the **parent-most component that needs the data**, and read it there with `useReadQuery` inside a `<Suspense>` boundary. Only that one component reads the `queryRef`. Its children get data from fragments. `useReadQuery` reads the result of the existing query. It does not start a new query.

### When a component needs a new field

1. Add the field to the fragment of that component.
2. Make sure that the parent fragment or query spreads that fragment. **Use TypeScript to check this.** With data masking, the prop type of the child is `FragmentType<typeof CHILD_FRAGMENT>`. If the parent does not spread the fragment, the parent's data does not match that prop type, and `tsc` reports an error where the parent renders the child. After each change, run codegen and then `tsc`, so that `tsc` checks the new generated types. Fix the missing spread. Do not silence the error with a type cast.
3. Do not add a query, and do not pass the field as a separate prop from the parent.

### When a new component needs data

- If the component displays an object type from the server (a `User`, a `Product`), give it its own fragment named `ComponentName_propName` (for example `UserCard_user`), and spread it in the fragment or query of its parent.
- If the component is a general-purpose component that uses one value (for example a `<Date value={...} />` or `<Price amount={...} />` component), pass the value as a plain prop. A fragment would tie a general component to one type.
- If the component is built for one specific type, use a fragment, even if it only needs one field today. Then it can grow on its own.

The fragment tree mirrors the component tree. A component spreads only the fragments of the components it renders directly, never the fragments of its grandchildren. Spreading a grandchild's fragment couples the component to what its child renders.

Never reuse the fragment of another component, even if the fields are the same today. A fragment is 1:1 with its component. If you want to share a fragment, render the component that owns it instead.

### Existing codebases without fragments

Many codebases put queries in child components or pass raw query data down as props. When you work in one:

- Use the fragment pattern for every component you create or change.
- Do not copy the query-in-child or raw-props pattern from the code around you.
- Do not refactor components that are not part of the task.
- Do not enable `dataMasking` without asking. It changes the runtime data of every component. Instead, explain its benefits to the user and point them to [Enabling data masking in an existing app](references/fragments.md#enabling-data-masking-in-an-existing-app). Apollo Client supports an incremental migration: existing code keeps working, and all new code is masked.

## Quick Reference

### Route Query With a Child Fragment (Suspense)

```tsx
// components/UserHeader.tsx
import { gql } from "@apollo/client";
import type { FragmentType, TypedDocumentNode } from "@apollo/client";
import { useSuspenseFragment } from "@apollo/client/react";
import type { UserHeader_UserFragment } from "./UserHeader.generated";

export const USER_HEADER_FRAGMENT: TypedDocumentNode<
  UserHeader_UserFragment,
  Record<string, never>
> = gql`
  fragment UserHeader_user on User {
    id
    name
    avatarUrl
  }
`;

export function UserHeader({
  user,
}: {
  user: FragmentType<typeof USER_HEADER_FRAGMENT>;
}) {
  const { data } = useSuspenseFragment({
    fragment: USER_HEADER_FRAGMENT,
    from: user,
  });

  return (
    <header>
      <img src={data.avatarUrl} alt="" />
      <h1>{data.name}</h1>
    </header>
  );
}
```

```tsx
// routes/UserPage.tsx
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useSuspenseQuery } from "@apollo/client/react";
import { UserHeader, USER_HEADER_FRAGMENT } from "../components/UserHeader";
import type {
  UserPageQuery,
  UserPageQueryVariables,
} from "./UserPage.generated";

const USER_PAGE_QUERY: TypedDocumentNode<
  UserPageQuery,
  UserPageQueryVariables
> = gql`
  query UserPage($id: ID!) {
    user(id: $id) {
      id
      ...UserHeader_user
    }
  }
  ${USER_HEADER_FRAGMENT}
`;

export function UserPage({ params }: { params: { id: string } }) {
  const { data } = useSuspenseQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  if (!data.user) {
    return <p>User not found</p>;
  }

  return <UserHeader user={data.user} />;
}
```

Route components in this skill receive the URL parameters as a `params` prop. How you get them depends on the router (for example `useParams()` in React Router or `Route.useParams()` in TanStack Router). Use the method of the project's router. Wrap `UserPage` in a `<Suspense>` boundary and an error boundary. `FragmentType<typeof FRAGMENT>` requires Apollo Client 4.1+ and the data masking type overrides. See [Fragments: Setup](references/fragments.md#setup-before-you-use-fragmenttype).

### Route Query With a Child Fragment (Without Suspense)

The same route with `useQuery` and `useFragment`. Suspense is preferred, but this pattern is fully supported.

```tsx
// routes/UserPage.tsx
export function UserPage({ params }: { params: { id: string } }) {
  const { data, dataState, loading, error } = useQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  if (error) return <p>Error: {error.message}</p>;

  if (dataState === "empty") {
    // `empty` while not loading means the query was skipped, a cache-only
    // query found nothing, or `errorPolicy: "ignore"` discarded an error
    return loading ? <p>Loading...</p> : null;
  }

  if (!data.user) return <p>User not found</p>;

  return <UserHeader user={data.user} />;
}
```

```tsx
// components/UserHeader.tsx
export function UserHeader({
  user,
}: {
  user: FragmentType<typeof USER_HEADER_FRAGMENT>;
}) {
  const { data, dataState } = useFragment({
    fragment: USER_HEADER_FRAGMENT,
    from: user,
  });

  if (dataState !== "complete") return null;

  return <h1>{data.name}</h1>;
}
```

Check `dataState`, not `loading`, before you read `data`. `dataState` narrows the type of `data`. Do not treat `dataState === "empty"` alone as a loading state, and do not hide data with `dataState !== "complete"` on query results: `"partial"` (with `returnPartialData`) and `"streaming"` (with `@defer`) results contain data that you can render.

### Basic Mutation

```tsx
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import type {
  CreateUserMutation,
  CreateUserMutationVariables,
} from "./CreateUserForm.generated";

const CREATE_USER: TypedDocumentNode<
  CreateUserMutation,
  CreateUserMutationVariables
> = gql`
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

Mutations are not queries. Call `useMutation` in the component where the user interaction happens. Do not wrap `useMutation` in a custom hook (such as `useCreateUser()`), and avoid sharing one mutation between components. Different components usually need different logic: different variables, `update` functions, optimistic responses, error handling, and fields in the mutation response. A shared wrapper collects options for every caller and couples components that change for different reasons. Each component defines its own mutation document and calls `useMutation` directly.

## Reference Files

Detailed documentation for specific topics:

- [TypeScript Code Generation](references/typescript-codegen.md) - GraphQL Code Generator setup for type-safe operations
- [Queries](references/queries.md) - useQuery, useLazyQuery, polling, refetching
- [Suspense Hooks](references/suspense-hooks.md) - useSuspenseQuery, useBackgroundQuery, useReadQuery, useLoadableQuery, preloadQuery
- [Mutations](references/mutations.md) - useMutation, optimistic UI, cache updates
- [Fragments](references/fragments.md) - Fragment colocation, useFragment, useSuspenseFragment, data masking
- [Caching](references/caching.md) - InMemoryCache, typePolicies, cache manipulation
- [State Management](references/state-management.md) - Reactive variables, local state
- [Error Handling](references/error-handling.md) - Error policies, error links, retries
- [Troubleshooting](references/troubleshooting.md) - Common issues and solutions

## Key Rules

### Query Rules

- Follow [Where Data Comes From](#where-data-comes-from): one query per route, owned by the route component, composed from colocated fragments.
- Use `@defer` to stream slow fields or fields below the fold instead of splitting the route query.
- Handle loading and error states when you use non-suspenseful hooks (`useQuery`, `useLazyQuery`). With Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`, `useReadQuery`), use `<Suspense>` boundaries and error boundaries.
- Use `fetchPolicy` to control cache behavior per query.
- Use the TypeScript type server to look up documentation for functions and options (Apollo Client has extensive docblocks).

### Mutation Rules

- Call `useMutation` in the component where the user interaction happens. Do not wrap it in a custom hook, and avoid sharing a mutation between components.
- **If the schema permits, mutation return values should return everything necessary to update the cache.** Neither manual updates nor refetching should be necessary.
- If the mutation response is insufficient, carefully weigh manual cache manipulation vs refetching. Manual updates risk missing server logic. Consider optimistic updates with a granular refetch if needed.
- Handle errors gracefully in the UI
- Use `refetchQueries` sparingly (prefer letting the cache update automatically)

### Caching Rules

- Configure `keyFields` for types without `id` field
- Disable normalization by setting `keyFields: false` for types that don't include an identifier and are meant to group related fields under the parent
- Use `typePolicies` for pagination and computed fields
- Understand cache normalization to debug issues
- **Enable [data masking](references/fragments.md#data-masking) for all new applications** - it prevents components from accessing fragment data they don't own, enforcing proper data boundaries and preventing over-rendering. Set up the masking types first (see [Fragments: Setup](references/fragments.md#setup-before-you-use-fragmenttype)).

### Performance

- Avoid over-fetching with proper field selection
- Configure appropriate `fetchPolicy` per use case
- Use `@defer` for incremental delivery of deferred query parts, and `@stream` for streaming list fields (`@stream` available in Apollo Client 4.1+)
- **Prefer Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`) in modern applications** for better loading state handling and code simplicity

## Ground Rules

- ALWAYS use Apollo Client 4.x patterns (not v3 or earlier)
- ALWAYS wrap your app with `ApolloProvider`
- ALWAYS handle loading and error states when using non-suspenseful hooks
- NEVER call a query hook in a component that is not a route component, except for the [permitted exceptions](#permitted-exceptions)
- NEVER share a query between routes or components, and NEVER put a query in a custom hook that more than one component calls
- NEVER share a fragment between components
- ALWAYS pass the variables type to `TypedDocumentNode` for a fragment, `Record<string, never>` when it uses no variables
- AVOID custom hooks that wrap `useMutation` and mutations shared between components
- NEVER enable `dataMasking` before the masking types are set up
- PREFER Suspense hooks (`useSuspenseQuery`, `useBackgroundQuery`) in modern applications for better DX
- NEVER store Apollo Client in React state (use module-level or context)
- KEEP the default `cache-first` fetch policy for most queries. Change it only for volatile data (`network-only`), or when the route must show cached data immediately and sync with the server in the background (`cache-and-network`)
- NEVER change `fetchPolicy` to fix data that this app changed with a mutation but that the cache does not show. That is a cache problem. Fix the cache: return the changed fields in the mutation response, configure key fields, or add a `merge` or `update` function. If the mutation response cannot contain the changed data, update the cache directly with an `update` function. Refetch the affected queries with `refetchQueries` only when a direct cache update is not possible, for example when the server decides which items belong in a filtered list
- USE `network-only` for volatile data that changes often on the server, outside the user's control, for example an insights product that shows network traffic. Load a fresh result each time the route is visited instead of serving cached data first
- USE TypeScript for better type safety with GraphQL
- IMPLEMENT proper cache updates instead of refetching entire queries
- ADVISE the human steering you to look into Apollo DevTools when collaboratively debugging Apollo Client issues
