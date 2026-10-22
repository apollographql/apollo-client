# Suspense Hooks Reference

> **Note**: Suspense hooks are the recommended approach for data fetching in modern React applications (React 18+). They provide cleaner code, better loading state handling, and enable streaming SSR.

> **Where queries go**: Only the route component starts a query (`useSuspenseQuery`, `useBackgroundQuery`, or `preloadQuery` in a route loader). All other components read their data from fragments with `useSuspenseFragment`. Queries are never shared between routes or put in reusable custom hooks. See [Where Data Comes From](../SKILL.md#where-data-comes-from) for the rules and the permitted exceptions, and the [Fragments reference](fragments.md) for the child component pattern.
>
> The examples in this file are route components. Components such as `DogCard` receive data through a fragment prop.

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
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useSuspenseQuery } from "@apollo/client/react";
import { DogProfile, DOG_PROFILE_FRAGMENT } from "../components/DogProfile";
import type { DogPageQuery, DogPageQueryVariables } from "./DogPage.generated";

const DOG_PAGE_QUERY: TypedDocumentNode<DogPageQuery, DogPageQueryVariables> =
  gql`
    query DogPage($id: ID!) {
      dog(id: $id) {
        id
        ...DogProfile_dog
      }
    }
    ${DOG_PROFILE_FRAGMENT}
  `;

export function DogPage({ params }: { params: { id: string } }) {
  const { data } = useSuspenseQuery(DOG_PAGE_QUERY, {
    variables: { id: params.id },
  });

  // data is always defined when this component renders
  return <DogProfile dog={data.dog} />;
}
```

Render the route component inside a `<Suspense>` boundary, for example the pending UI of the router or a boundary in a parent layout.

### Key Differences from useQuery

- **No `loading` boolean**: Component suspends instead of returning `loading: true`
- **Error handling**: With default `errorPolicy` (`none`), errors are thrown and caught by error boundaries. With `errorPolicy: "all"` or `"ignore"`, the `error` property is returned and `data` may be `undefined`.
- **`data` availability**: With default `errorPolicy` (`none`), `data` is guaranteed to be present when the component renders. With `errorPolicy: "all"` or `"ignore"`, when `dataState` is `empty`, `data` may be `undefined`.
- **Suspense boundaries**: Must wrap component with `<Suspense>` to handle loading state
- **`dataState` values**: With default options, `dataState` is `"complete"` or `"streaming"`. With `returnPartialData`, it can also be `"partial"`. With `errorPolicy: "all"` or `"ignore"`, it can also be `"empty"`.

### Changing Variables

When variables change, `useSuspenseQuery` automatically re-runs the query. If the data for the new variables is not in the cache, the component suspends again.

This example uses the lazy-loaded modal [exception](../SKILL.md#permitted-exceptions). The route does not know which dog the user selects, and the modal is closed until the user selects one, so the modal owns its own query.

```tsx
import { useState, Suspense } from "react";

export function DogsPage() {
  const { data } = useSuspenseQuery(DOGS_PAGE_QUERY);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);

  return (
    <>
      <ul>
        {data.dogs.map((dog) => (
          <DogListItem
            key={dog.id}
            dog={dog}
            onSelect={() => setSelectedDogId(dog.id)}
          />
        ))}
      </ul>
      {selectedDogId && (
        <Suspense fallback={<ModalSkeleton />}>
          <DogDetailsModal
            id={selectedDogId}
            onClose={() => setSelectedDogId(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function DogDetailsModal({ id, onClose }: { id: string; onClose: () => void }) {
  // Exception: lazy-loaded modal. It renders only after the user selects a
  // dog, so it loads the details for that selection.
  const { data } = useSuspenseQuery(DOG_DETAILS_MODAL_QUERY, {
    variables: { id },
  });

  return (
    <Modal onClose={onClose}>
      <DogDetails dog={data.dog} />
    </Modal>
  );
}
```

### Rendering Partial Data

Use `returnPartialData` to render immediately with partial cache data instead of suspending. The component will still suspend if there is no data in the cache.

```tsx
function DogPage({ params }: { params: { id: string } }) {
  const { data, dataState } = useSuspenseQuery(DOG_PAGE_QUERY, {
    variables: { id: params.id },
    returnPartialData: true,
  });

  return (
    <>
      <div>Name: {data.dog?.name ?? "Unknown"}</div>
      {dataState === "complete" && <DogProfile dog={data.dog} />}
    </>
  );
}
```

## useBackgroundQuery and useReadQuery

Use `useBackgroundQuery` in the route component to start the route query without suspending the route component. The route renders its shell (layout, headings, navigation) immediately. Pass the `queryRef` to the **parent-most component that needs the data**, which reads it with `useReadQuery` inside a `<Suspense>` boundary. The loading state then appears only in that area instead of replacing the whole route.

`useReadQuery` does not start a query. It reads the result of the query that `useBackgroundQuery` started and re-renders when that data changes in the cache. Only one component reads the `queryRef`. Its children get their data from fragments.

### Basic Usage

```tsx
import { Suspense } from "react";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

export function DogPage({ params }: { params: { id: string } }) {
  // Start fetching immediately. DogPage does not suspend.
  const [queryRef] = useBackgroundQuery(DOG_PAGE_QUERY, {
    variables: { id: params.id },
  });

  return (
    <main>
      <h1>Dog details</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <DogContent queryRef={queryRef} />
      </Suspense>
    </main>
  );
}

function DogContent({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof DOG_PAGE_QUERY>;
}) {
  const { data } = useReadQuery(queryRef);

  return <DogProfile dog={data.dog} />;
}
```

`QueryRef.ForQuery<typeof QUERY>` requires Apollo Client 4.1+. On 4.0, use `QueryRef<DogPageQuery, DogPageQueryVariables>`.

### When to Use

- **Render the route shell first**: The route component renders immediately, and only the area that needs the data suspends.
- **Place the loading state**: Put the `<Suspense>` boundary around the parent-most component that needs the data.
- **Avoid waterfalls**: The query starts in the route component, before any child renders.

## useLoadableQuery

Use `useLoadableQuery` to load a query in response to a user interaction (like a button click or a form submit) instead of on component mount. This is a [permitted exception](../SKILL.md#permitted-exceptions) to the route query rule.

### Basic Usage

```tsx
import { Suspense } from "react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

export function DogSearchPage() {
  // Exception: user action. The search runs when the user submits a breed.
  const [searchDogs, queryRef] = useLoadableQuery(DOG_SEARCH_QUERY);

  return (
    <>
      <button onClick={() => searchDogs({ breed: "bulldog" })}>
        Find bulldogs
      </button>
      <Suspense fallback={<div>Loading...</div>}>
        {queryRef && <DogSearchResults queryRef={queryRef} />}
      </Suspense>
    </>
  );
}

function DogSearchResults({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof DOG_SEARCH_QUERY>;
}) {
  const { data } = useReadQuery(queryRef);

  return (
    <ul>
      {data.dogs.map((dog) => (
        <DogCard key={dog.id} dog={dog} />
      ))}
    </ul>
  );
}
```

### When to Use

- **User-triggered fetching**: Load data in response to user actions, such as a search
- **Lazy-loaded modals and panels**: Load data for a modal or panel when the user opens it

## createQueryPreloader

The `createQueryPreloader` function creates a `preloadQuery` function that starts queries outside of React components. Use it in route loaders to start the route query before the route component renders.

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

> **Note**: This example applies to React Router in non-framework mode. For React Router framework mode, see [integration-react-router.md](./integration-react-router.md).

Use the preload function with React Router's `loader` function to begin loading data during route transitions:

```tsx
import { Suspense } from "react";
import { useLoaderData } from "react-router";
import { useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";
import { preloadQuery } from "@/lib/apollo-client";

// React Router loader function
export async function loader({ params }: { params: { id: string } }) {
  return preloadQuery(DOG_PAGE_QUERY, {
    variables: { id: params.id },
  });
}

// Route component
export default function DogRoute() {
  const queryRef = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>Dog details</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <DogContent queryRef={queryRef} />
      </Suspense>
    </main>
  );
}

function DogContent({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof DOG_PAGE_QUERY>;
}) {
  const { data } = useReadQuery(queryRef);

  return <DogProfile dog={data.dog} />;
}
```

### Preventing Route Transitions Until Query Loads

Use `preloadQuery.toPromise(queryRef)` to prevent route transitions until the query finishes loading:

```tsx
export async function loader({ params }: { params: { id: string } }) {
  const queryRef = preloadQuery(DOG_PAGE_QUERY, {
    variables: { id: params.id },
  });

  // Wait for the query to complete before transitioning
  return preloadQuery.toPromise(queryRef);
}
```

When `preloadQuery.toPromise()` is used, the route transition waits for the query to complete, and the data renders immediately without showing a loading fallback.

> **Note**: `preloadQuery.toPromise()` resolves with the `queryRef` itself (not the data) to encourage using `useReadQuery` for cache updates. If you need raw query data in your loader, use `client.query()` directly.

### With Next.js Server Components

> **Note**: For Next.js App Router, use the `PreloadQuery` component from `@apollo/client-integration-nextjs` instead. See [integration-nextjs.md](./integration-nextjs.md) for details.

## useQueryRefHandlers

The `useQueryRefHandlers` hook provides access to `refetch` and `fetchMore` functions for queries initiated with `preloadQuery`, `useBackgroundQuery`, or `useLoadableQuery`. Use it in the component that reads the `queryRef` when that component needs to refetch or paginate.

> **Important:** Always call `useQueryRefHandlers` before `useReadQuery`. `refetch` and `fetchMore` give the `queryRef` a new promise, and `useQueryRefHandlers` applies it during render. If `useReadQuery` runs first, it reads the previous promise, which is already settled, so the component does not suspend and does not show the new result. This is a known issue that cannot be fixed without breaking transitions. See [#11772](https://github.com/apollographql/apollo-client/issues/11772) and [this comment](https://github.com/apollographql/apollo-client/issues/11772#issuecomment-3387822851) for the details.

### Basic Usage

```tsx
import { useTransition } from "react";
import { useQueryRefHandlers, useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

function BreedsContent({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof BREEDS_PAGE_QUERY>;
}) {
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
          <BreedListItem key={breed.id} breed={breed} />
        ))}
      </ul>
    </div>
  );
}
```

### With Pagination

Use `fetchMore` to implement pagination:

```tsx
function PostsContent({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof POSTS_PAGE_QUERY>;
}) {
  const { fetchMore } = useQueryRefHandlers(queryRef);
  const { data } = useReadQuery(queryRef);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <ul>
        {data.posts.map((post) => (
          <PostListItem key={post.id} post={post} />
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
- **Background queries**: Use in the component that receives the `queryRef` from `useBackgroundQuery`
- **Loadable queries**: Refetch or paginate queries initiated with `useLoadableQuery`
- **React transitions**: Integrate with transitions to avoid showing loading fallbacks during refetches

## Distinguishing Queries with queryKey

Apollo Client identifies a Suspense query by its query document and variables. If the same component renders more than once with the same variables (for example, two copies of the same panel), the copies share one query and suspend together.

This is uncommon, because queries are never shared between components. If you do need each copy to suspend independently, give each one a unique `queryKey`:

```tsx
function DogComparePanel({ id, side }: { id: string; side: "left" | "right" }) {
  const { data } = useSuspenseQuery(DOG_COMPARE_PANEL_QUERY, {
    variables: { id },
    // Each copy of the panel gets its own identity
    queryKey: ["dog-compare-panel", side],
  });

  return <DogDetails dog={data.dog} />;
}
```

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
        <DogPage params={{ id: "3" }} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

To render partial data together with the error instead of throwing to the error boundary, set `errorPolicy: "all"`. First read [Choosing an Error Policy](error-handling.md#choosing-an-error-policy), which explains how `"all"` affects the cache.

## Transitions

Use React transitions to avoid showing loading UI when updating state. Transitions keep the previous UI visible while new data is fetching.

### Using startTransition

Wrap the state update that changes the variables in `startTransition`. When the user selects a dog, the page keeps showing the list until the modal's data loads, instead of showing the `<Suspense>` fallback.

```tsx
import { startTransition } from "react";

// In DogsPage from the "Changing Variables" example
<DogListItem
  key={dog.id}
  dog={dog}
  onSelect={() => {
    startTransition(() => {
      setSelectedDogId(dog.id);
    });
  }}
/>;
```

### Using useTransition

Use `useTransition` to get an `isPending` flag for visual feedback during transitions.

```tsx
import { useState, Suspense, useTransition } from "react";

export function DogsPage() {
  const { data } = useSuspenseQuery(DOGS_PAGE_QUERY);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <ul style={{ opacity: isPending ? 0.5 : 1 }}>
        {data.dogs.map((dog) => (
          <DogListItem
            key={dog.id}
            dog={dog}
            onSelect={() => {
              startTransition(() => {
                setSelectedDogId(dog.id);
              });
            }}
          />
        ))}
      </ul>
      {selectedDogId && (
        <Suspense fallback={<ModalSkeleton />}>
          <DogDetailsModal
            id={selectedDogId}
            onClose={() => setSelectedDogId(null)}
          />
        </Suspense>
      )}
    </>
  );
}
```

## Avoiding Request Waterfalls

A request waterfall occurs when one query cannot start until another query has finished, for example when a child component with its own query renders only after its parent's query resolves. Each level adds a full network round trip.

**The fix is one query per route.** Compose the data of all components on the route into the route query with fragments. Then there is one request, and nothing waits.

```tsx
// ❌ Waterfall: UserPosts starts its query only after UserPage's query resolves
function UserPage({ params }: { params: { id: string } }) {
  const { data } = useSuspenseQuery(USER_QUERY, {
    variables: { id: params.id },
  });
  return <UserPosts userId={data.user.id} />;
}

function UserPosts({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery(USER_POSTS_QUERY, {
    variables: { userId },
  });
  // ...
}
```

```tsx
// ✅ One query for the route. Each child reads its fragment.
const USER_PAGE_QUERY: TypedDocumentNode<
  UserPageQuery,
  UserPageQueryVariables
> = gql`
  query UserPage($id: ID!) {
    user(id: $id) {
      id
      ...UserHeader_user
      ...UserPosts_user
    }
  }
  ${USER_HEADER_FRAGMENT}
  ${USER_POSTS_FRAGMENT}
`;

export function UserPage({ params }: { params: { id: string } }) {
  const { data } = useSuspenseQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  return (
    <>
      <UserHeader user={data.user} />
      <UserPosts user={data.user} />
    </>
  );
}
```

Do not fix a waterfall by starting several independent queries in parallel with `useBackgroundQuery` or `preloadQuery`. Parallel queries still send several requests, and the route has no single loading or error state. If part of the route query is slow, use `@defer` on that part (see [Deferring Fragments](fragments.md#deferring-fragments)).

When a second query needs a value that only the first query returns, the waterfall is unavoidable. Before you accept it, look in the schema for a field that returns the data in the first query. See the dependent query [exception](../SKILL.md#permitted-exceptions).

## Fetch Policies

Suspense hooks do not support `cache-only` or `standby`. Use this list to choose a fetch policy:

- **`cache-first` (default)**: Keep the default for almost all queries. A normalized cache keeps data current after mutations and refetches.
- **`cache-and-network`**: Use it when the route must show a cached result immediately, without waiting for the network, and still sync with the server. While the request is in flight, `networkStatus` is `NetworkStatus.loading`. Check it to show a loading indicator next to the cached data.
- **`network-only`**: Use it for volatile data that changes often on the server, outside the user's control, for example an insights product that shows network traffic. Also use it for screens that must sync with the server before they render to avoid showing incorrect data, for example an item that requires approval from someone else in the organization. The query loads a fresh result each time the route is visited, writes it to the cache, and then updates with cache changes like any other query.
- **`no-cache`**: Avoid it. The result is not written to the cache, so the query keeps a local copy of the data. It does not update when the cache changes, and it does not update other parts of the UI. Use it sparingly.

Never change `fetchPolicy` to fix data that this app changed with a mutation but that the cache does not show. That is a cache problem. Fix the cache: return the changed fields in the mutation response, configure key fields, or add a `merge` or `update` function. If the mutation response cannot contain the changed data, update the cache directly with an `update` function. Refetch the affected queries with `refetchQueries` only when a direct cache update is not possible, for example when the server decides which items belong in a filtered list.

## Streaming SSR or React Server Components

Apollo Client integrates with modern React frameworks that support Streaming SSR and React Server Components. For detailed setup instructions specific to your framework, see:

- **Next.js App Router**: [integration-nextjs.md](./integration-nextjs.md) - Includes React Server Components, PreloadQuery component, and streaming SSR
- **React Router**: [integration-react-router.md](./integration-react-router.md) - Framework mode with SSR support
- **TanStack Start**: [integration-tanstack-start.md](./integration-tanstack-start.md) - Full-stack React framework with SSR

These guides cover:

- Framework-specific client setup and configuration
- Preloading queries for optimal performance
- Streaming SSR with `useBackgroundQuery` and Suspense
- Error handling in server-rendered environments

## Conditional Queries

### Using skipToken

Use `skipToken` to conditionally skip queries without TypeScript issues. When `skipToken` is used, the component won't suspend and `data` will be `undefined`.

```tsx
import { skipToken } from "@apollo/client/react";

export function UserPage({ params }: { params: { id?: string } }) {
  const { data, dataState } = useSuspenseQuery(
    USER_PAGE_QUERY,
    params.id ? { variables: { id: params.id } } : skipToken
  );

  if (dataState !== "complete") {
    return <p>Select a user</p>;
  }

  return <UserProfile user={data.user} />;
}
```

### Skipping With useBackgroundQuery

When the route renders a `<Suspense>` boundary around the part of the page that uses the data, use `useBackgroundQuery` with `skipToken`. When the query is skipped, `queryRef` is `undefined`, so render the component that reads the data only when `queryRef` exists.

```tsx
import { Suspense } from "react";
import {
  skipToken,
  useBackgroundQuery,
  useReadQuery,
} from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

export function UserPage({ params }: { params: { id?: string } }) {
  const [queryRef] = useBackgroundQuery(
    USER_PAGE_QUERY,
    params.id ? { variables: { id: params.id } } : skipToken
  );

  return (
    <main>
      <h1>User</h1>
      {queryRef ?
        <Suspense fallback={<div>Loading...</div>}>
          <UserContent queryRef={queryRef} />
        </Suspense>
      : <p>Select a user</p>}
    </main>
  );
}

function UserContent({
  queryRef,
}: {
  queryRef: QueryRef.ForQuery<typeof USER_PAGE_QUERY>;
}) {
  const { data } = useReadQuery(queryRef);

  return <UserProfile user={data.user} />;
}
```

> **Note**: `skipToken` provides better type safety than the `skip` option and avoids issues with required variables. The `skip` option is deprecated in favor of `skipToken`.
