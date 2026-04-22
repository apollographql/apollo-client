# Suspense Hooks Reference

> **Note**: Suspense hooks are the recommended approach for data fetching in modern React applications (React 18+). They provide cleaner code, better loading state handling, and enable streaming SSR.

## Table of Contents

- [useSuspenseQuery Hook](#usesuspensequery-hook)
- [useBackgroundQuery and useReadQuery](#usebackgroundquery-and-usereadquery)
- [useLoadableQuery](#useloadablequery)
- [createQueryPreloader](#createquerypreloader)
- [useQueryRefHandlers](#usequeryrefhandlers)
- [Distinguishing Queries with queryKey](#distinguishing-queries-with-querykey)
- [Suspense Boundaries and Error Handling](#suspense-boundaries-and-error-handling)
- [Transitions](#transitions)
- [Avoiding Request Waterfalls](#avoiding-request-waterfalls)
- [Fetch Policies](#fetch-policies)
- [Streaming SSR or React Server Components](#streaming-ssr-or-react-server-components)
- [Conditional Queries](#conditional-queries)

## useSuspenseQuery Hook

The `useSuspenseQuery` hook is the Suspense-ready replacement for `useQuery`. It initiates a network request and causes the component calling it to suspend while the request is made. Unlike `useQuery`, it does not return `loading` states—these are handled by React's Suspense boundaries and error boundaries.

### Basic Usage

```tsx
import { Suspense } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import { GET_DOG } from "./queries.generated";

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Dog id="3" />
    </Suspense>
  );
}

function Dog({ id }: { id: string }) {
  const { data } = useSuspenseQuery(GET_DOG, {
    variables: { id },
  });

  // data is always defined when this component renders
  return <div>Name: {data.dog.name}</div>;
}
```

### Return Object

```typescript
const {
  data, // Query result data
  dataState, // With default options: "complete" | "streaming"
  // With returnPartialData: also "partial"
  // With errorPolicy "all" or "ignore": also "empty"
  error, // ApolloError (only when errorPolicy is "all" or "ignore")
  networkStatus, // NetworkStatus.ready, NetworkStatus.loading, etc.
  client, // Apollo Client instance
  refetch, // Function to re-execute query
  fetchMore, // Function for pagination
} = useSuspenseQuery(QUERY, options);
```

### Key Differences from useQuery

- **No `loading` boolean**: Component suspends instead of returning `loading: true`
- **Error handling**: With default `errorPolicy` (`none`), errors are thrown and caught by error boundaries. With `errorPolicy: "all"` or `"ignore"`, the `error` property is returned and `data` may be `undefined`.
- **`data` availability**: With default `errorPolicy` (`none`), `data` is guaranteed to be present when the component renders. With `errorPolicy: "all"` or `"ignore"`, when `dataState` is `empty`, `data` may be `undefined`.
- **Suspense boundaries**: Must wrap component with `<Suspense>` to handle loading state

### Changing Variables

When variables change, `useSuspenseQuery` automatically re-runs the query. If the data is not in the cache, the component suspends again.

```tsx
import { useState } from "react";
import { GET_DOGS } from "./queries.generated";

function DogSelector() {
  const { data } = useSuspenseQuery(GET_DOGS);
  const [selectedDog, setSelectedDog] = useState(data.dogs[0].id);

  return (
    <>
      <select value={selectedDog} onChange={(e) => setSelectedDog(e.target.value)}>
        {data.dogs.map((dog) => (
          <option key={dog.id} value={dog.id}>
            {dog.name}
          </option>
        ))}
      </select>
      <Suspense fallback={<div>Loading...</div>}>
        <Dog id={selectedDog} />
      </Suspense>
    </>
  );
}

function Dog({ id }: { id: string }) {
  const { data } = useSuspenseQuery(GET_DOG, {
    variables: { id },
  });

  return (
    <>
      <div>Name: {data.dog.name}</div>
      <div>Breed: {data.dog.breed}</div>
    </>
  );
}
```

### Rendering Partial Data

Use `returnPartialData` to render immediately with partial cache data instead of suspending. The component will still suspend if there is no data in the cache.

```tsx
function Dog({ id }: { id: string }) {
  const { data } = useSuspenseQuery(GET_DOG, {
    variables: { id },
    returnPartialData: true,
  });

  return (
    <>
      <div>Name: {data.dog?.name ?? "Unknown"}</div>
      {data.dog?.breed && <div>Breed: {data.dog.breed}</div>}
    </>
  );
}
```

## useBackgroundQuery and useReadQuery

Use `useBackgroundQuery` with `useReadQuery` to avoid request waterfalls by starting a query in a parent component and reading the result in a child component. This pattern enables the parent to start fetching data before the child component renders.

### Basic Usage

```tsx
import { Suspense } from "react";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";

function Parent() {
  // Start fetching immediately
  const [queryRef] = useBackgroundQuery(GET_DOG, {
    variables: { id: "3" },
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Child queryRef={queryRef} />
    </Suspense>
  );
}

function Child({ queryRef }: { queryRef: QueryRef<DogData> }) {
  // Read the query result
  const { data } = useReadQuery(queryRef);

  return <div>Name: {data.dog.name}</div>;
}
```

### When to Use

- **Avoiding waterfalls**: Start fetching data in a parent (preferably above a suspense boundary) before child components render
- **Preloading data**: Begin fetching before the component that needs the data is ready
- **Parallel queries**: Start multiple queries at once in a parent component

### Return Values

`useBackgroundQuery` returns a tuple:

```typescript
const [
  queryRef, // QueryRef to pass to useReadQuery
  { refetch, fetchMore, subscribeToMore }, // Helper functions
] = useBackgroundQuery(QUERY, options);
```

`useReadQuery` returns the query result:

```typescript
const {
  data, // Query result data (always defined)
  dataState, // "complete" | "streaming" | "partial" | "empty"
  error, // ApolloError (if errorPolicy allows)
  networkStatus, // Detailed network state (1-8)
} = useReadQuery(queryRef);
```

## useLoadableQuery

Use `useLoadableQuery` to imperatively load a query in response to a user interaction (like a button click) instead of on component mount.

### Basic Usage

```tsx
import { Suspense } from "react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import { GET_GREETING } from "./queries.generated";

function App() {
  const [loadGreeting, queryRef] = useLoadableQuery(GET_GREETING);

  return (
    <>
      <button onClick={() => loadGreeting({ variables: { language: "english" } })}>Load Greeting</button>
      <Suspense fallback={<div>Loading...</div>}>{queryRef && <Greeting queryRef={queryRef} />}</Suspense>
    </>
  );
}

function Greeting({ queryRef }: { queryRef: QueryRef<GreetingData> }) {
  const { data } = useReadQuery(queryRef);

  return <div>{data.greeting.message}</div>;
}
```

### Return Values

```typescript
const [
  loadQuery, // Function to load the query
  queryRef, // QueryRef (null until loadQuery is called)
  { refetch, fetchMore, subscribeToMore, reset }, // Helper functions
] = useLoadableQuery(QUERY, options);
```

### When to Use

- **User-triggered fetching**: Load data in response to user actions
- **Lazy loading**: Defer data fetching until it's actually needed
- **Progressive disclosure**: Load data for UI elements that may not be initially visible

## createQueryPreloader

The `createQueryPreloader` function creates a `preloadQuery` function that can be used to initiate queries outside of React components. This is useful for preloading data before a component renders, such as in route loaders or event handlers.

### Basic Usage

```tsx
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { createQueryPreloader } from "@apollo/client/react";

const client = new ApolloClient({
  uri: "https://your-graphql-endpoint.com/graphql",
  cache: new InMemoryCache(),
});

// Create a preload function
export const preloadQuery = createQueryPreloader(client);
```

### Using preloadQuery with Route Loaders

> **Note**: This example applies to React Router in non-framework mode. For React Router framework mode, see [setup-react-router.md](./setup-react-router.md).

Use the preload function with React Router's `loader` function to begin loading data during route transitions:

```tsx
import { preloadQuery } from "@/lib/apollo-client";
import { GET_DOG } from "./queries.generated";

// React Router loader function
export async function loader({ params }: { params: { id: string } }) {
  return preloadQuery({
    query: GET_DOG,
    variables: { id: params.id },
  });
}

// Route component
export default function DogRoute() {
  const queryRef = useLoaderData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DogDetails queryRef={queryRef} />
    </Suspense>
  );
}

function DogDetails({ queryRef }: { queryRef: QueryRef<DogData> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <div>
      <h1>{data.dog.name}</h1>
      <p>Breed: {data.dog.breed}</p>
    </div>
  );
}
```

### Preventing Route Transitions Until Query Loads

Use the `toPromise()` method to prevent route transitions until the query finishes loading:

```tsx
export async function loader({ params }: { params: { id: string } }) {
  const queryRef = preloadQuery({
    query: GET_DOG,
    variables: { id: params.id },
  });

  // Wait for the query to complete before transitioning
  return queryRef.toPromise();
}
```

When `toPromise()` is used, the route transition waits for the query to complete, and the data renders immediately without showing a loading fallback.

> **Note**: `toPromise()` resolves with the `queryRef` itself (not the data) to encourage using `useReadQuery` for cache updates. If you need raw query data in your loader, use `client.query()` directly.

### With Next.js Server Components

> **Note**: For Next.js App Router, use the `PreloadQuery` component from `@apollo/client-integration-nextjs` instead. See [setup-nextjs.md](./setup-nextjs.md) for details.

## useQueryRefHandlers

The `useQueryRefHandlers` hook provides access to `refetch` and `fetchMore` functions for queries initiated with `preloadQuery`, `useBackgroundQuery`, or `useLoadableQuery`. This is useful when you need to refetch or paginate data in components where the `queryRef` is passed through.

> **Important:** Always call `useQueryRefHandlers` before `useReadQuery`. These two hooks interact with the same `queryRef`, and calling them in the wrong order could cause subtle bugs.

### Basic Usage

```tsx
import { useQueryRefHandlers } from "@apollo/client/react";

function Breeds({ queryRef }: { queryRef: QueryRef<BreedsData> }) {
  const { refetch } = useQueryRefHandlers(queryRef);
  const { data } = useReadQuery(queryRef);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(() => {
            refetch();
          });
        }}
      >
        {isPending ? "Refetching..." : "Refetch breeds"}
      </button>
      <ul>
        {data.breeds.map((breed) => (
          <li key={breed.id}>{breed.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### With Pagination

Use `fetchMore` to implement pagination:

```tsx
function Posts({ queryRef }: { queryRef: QueryRef<PostsData> }) {
  const { fetchMore } = useQueryRefHandlers(queryRef);
  const { data } = useReadQuery(queryRef);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <ul>
        {data.posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(() => {
            fetchMore({
              variables: {
                offset: data.posts.length,
              },
            });
          });
        }}
      >
        {isPending ? "Loading..." : "Load more"}
      </button>
    </div>
  );
}
```

### When to Use

- **Preloaded queries**: Access refetch/fetchMore for queries initiated with `preloadQuery`
- **Background queries**: Use in child components receiving `queryRef` from `useBackgroundQuery`
- **Loadable queries**: Refetch or paginate queries initiated with `useLoadableQuery`
- **React transitions**: Integrate with transitions to avoid showing loading fallbacks during refetches

## Distinguishing Queries with queryKey

Apollo Client uses the combination of `query` and `variables` to uniquely identify each query. When multiple components use the same `query` and `variables`, they share the same identity and suspend at the same time, regardless of which component initiates the request.

Use the `queryKey` option to ensure each hook has a unique identity:

```tsx
function UserProfile() {
  // First query with unique key
  const { data: userData } = useSuspenseQuery(GET_USER, {
    variables: { id: "1" },
    queryKey: ["user-profile"],
  });

  // Second query with same query and variables but different key
  const { data: userPreview } = useSuspenseQuery(GET_USER, {
    variables: { id: "1" },
    queryKey: ["user-preview"],
  });

  return (
    <div>
      <UserCard user={userData.user} />
      <UserSidebar user={userPreview.user} />
    </div>
  );
}
```

### When to Use

- **Multiple instances**: When rendering multiple components that use the same query and variables
- **Preventing shared suspension**: When you want independent control over when each query suspends
- **Separate cache entries**: When you need to maintain separate cache states for the same query

> **Note**: Each item in the `queryKey` array must be a stable identifier to prevent infinite fetches.

## Suspense Boundaries and Error Handling

### Suspense Boundaries

Wrap components that use Suspense hooks with `<Suspense>` boundaries to handle loading states. Place boundaries strategically to control the granularity of loading indicators.

```tsx
function App() {
  return (
    <>
      {/* Top-level loading for entire page */}
      <Suspense fallback={<PageSpinner />}>
        <Header />
        <Content />
      </Suspense>
    </>
  );
}

function Content() {
  return (
    <>
      <MainSection />
      {/* Granular loading for sidebar */}
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </>
  );
}
```

### Error Boundaries

Suspense hooks throw errors to React error boundaries instead of returning them. Use error boundaries to handle GraphQL errors.

```tsx
import { ErrorBoundary } from "react-error-boundary";

function App() {
  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <div>
          <h2>Something went wrong</h2>
          <p>{error.message}</p>
        </div>
      )}
    >
      <Suspense fallback={<div>Loading...</div>}>
        <Dog id="3" />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Custom Error Policies

Use `errorPolicy` to control how errors are handled:

```tsx
function Dog({ id }: { id: string }) {
  const { data, error } = useSuspenseQuery(GET_DOG, {
    variables: { id },
    errorPolicy: "all", // Return both data and errors
  });

  return (
    <>
      <div>Name: {data?.dog?.name ?? "Unknown"}</div>
      {error && <div>Warning: {error.message}</div>}
    </>
  );
}
```

## Transitions

Use React transitions to avoid showing loading UI when updating state. Transitions keep the previous UI visible while new data is fetching.

### Using startTransition

```tsx
import { useState, Suspense, startTransition } from "react";

function DogSelector() {
  const { data } = useSuspenseQuery(GET_DOGS);
  const [selectedDog, setSelectedDog] = useState(data.dogs[0].id);

  return (
    <>
      <select
        value={selectedDog}
        onChange={(e) => {
          // Wrap state update in startTransition
          startTransition(() => {
            setSelectedDog(e.target.value);
          });
        }}
      >
        {data.dogs.map((dog) => (
          <option key={dog.id} value={dog.id}>
            {dog.name}
          </option>
        ))}
      </select>
      <Suspense fallback={<div>Loading...</div>}>
        <Dog id={selectedDog} />
      </Suspense>
    </>
  );
}
```

### Using useTransition

Use `useTransition` to get an `isPending` flag for visual feedback during transitions.

```tsx
import { useState, Suspense, useTransition } from "react";

function DogSelector() {
  const [isPending, startTransition] = useTransition();
  const { data } = useSuspenseQuery(GET_DOGS);
  const [selectedDog, setSelectedDog] = useState(data.dogs[0].id);

  return (
    <>
      <select
        style={{ opacity: isPending ? 0.5 : 1 }}
        value={selectedDog}
        onChange={(e) => {
          startTransition(() => {
            setSelectedDog(e.target.value);
          });
        }}
      >
        {data.dogs.map((dog) => (
          <option key={dog.id} value={dog.id}>
            {dog.name}
          </option>
        ))}
      </select>
      <Suspense fallback={<div>Loading...</div>}>
        <Dog id={selectedDog} />
      </Suspense>
    </>
  );
}
```

## Avoiding Request Waterfalls

Request waterfalls occur when a child component waits for the parent to finish rendering before it can start fetching its own data. Use `useBackgroundQuery` to start fetching child data earlier in the component tree.

> **Note**: When one query depends on the result of another query (e.g., the child query needs an ID from the parent query), the waterfall is unavoidable. The best solution is to restructure your schema to fetch all needed data in a single nested query.

### Example: Independent Queries

When queries don't depend on each other, use `useBackgroundQuery` to start them in parallel:

```tsx
const GET_USER = gql`
  query GetUser($id: String!) {
    user(id: $id) {
      id
      name
    }
  }
`;

const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
    }
  }
`;

function Parent() {
  // Both queries start immediately - no waterfall
  const [userRef] = useBackgroundQuery(GET_USER, {
    variables: { id: "1" },
  });

  const [postsRef] = useBackgroundQuery(GET_POSTS);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile queryRef={userRef} />
      <PostsList queryRef={postsRef} />
    </Suspense>
  );
}

function UserProfile({ queryRef }: { queryRef: QueryRef<UserData> }) {
  const { data } = useReadQuery(queryRef);

  return <div>User: {data.user.name}</div>;
}

function PostsList({ queryRef }: { queryRef: QueryRef<PostsData> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <ul>
      {data.posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

## Fetch Policies

Suspense hooks support most of the same fetch policies as `useQuery`, controlling how the query interacts with the cache. Note that `cache-only` and `standby` are not supported by Suspense hooks.

| Policy              | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `cache-first`       | Return cached data if available, otherwise fetch (default) |
| `cache-and-network` | Return cached data immediately, then fetch and update      |
| `network-only`      | Always fetch, update cache, ignore cached data             |
| `no-cache`          | Always fetch, never read or write cache                    |

### Usage Examples

```tsx
// Always fetch fresh data
const { data } = useSuspenseQuery(GET_NOTIFICATIONS, {
  fetchPolicy: "network-only",
});

// Prefer cached data
const { data } = useSuspenseQuery(GET_CATEGORIES, {
  fetchPolicy: "cache-first",
});

// Show cached data while fetching fresh data
const { data } = useSuspenseQuery(GET_POSTS, {
  fetchPolicy: "cache-and-network",
});
```

## Streaming SSR or React Server Components

Apollo Client integrates with modern React frameworks that support Streaming SSR and React Server Components. For detailed setup instructions specific to your framework, see:

- **Next.js App Router**: [setup-nextjs.md](./setup-nextjs.md) - Includes React Server Components, PreloadQuery component, and streaming SSR
- **React Router**: [setup-react-router.md](./setup-react-router.md) - Framework mode with SSR support
- **TanStack Start**: [setup-tanstack-start.md](./setup-tanstack-start.md) - Full-stack React framework with SSR

These guides cover:

- Framework-specific client setup and configuration
- Preloading queries for optimal performance
- Streaming SSR with `useBackgroundQuery` and Suspense
- Error handling in server-rendered environments

## Conditional Queries

### Using skipToken

Use `skipToken` to conditionally skip queries without TypeScript issues. When `skipToken` is used, the component won't suspend and `data` will be `undefined`.

```tsx
import { skipToken } from "@apollo/client";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

function UserProfile({ userId }: { userId: string | null }) {
  const { data, dataState } = useSuspenseQuery(
    GET_USER,
    !userId
      ? skipToken
      : {
          variables: { id: userId },
        },
  );

  if (dataState !== "complete") {
    return <p>Select a user</p>;
  }

  return <Profile user={data.user} />;
}
```

### Conditional Rendering

Alternatively, use conditional rendering to control when Suspense hooks are called. This provides better type safety and clearer component logic.

```tsx
function UserProfile({ userId }: { userId: string | null }) {
  if (!userId) {
    return <p>Select a user</p>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserDetails userId={userId} />
    </Suspense>
  );
}

function UserDetails({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery(GET_USER, {
    variables: { id: userId },
  });

  return <Profile user={data.user} />;
}
```

> **Note**: Using conditional rendering with `skipToken` provides better type safety and avoids issues with required variables. The `skip` option is deprecated in favor of `skipToken`.
