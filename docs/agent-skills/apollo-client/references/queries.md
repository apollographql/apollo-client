# Queries Reference

> **Where queries go**: Only the route component calls a query hook. All other components read their data from fragments with `useFragment` or `useSuspenseFragment`. Queries are never shared between routes or put in reusable custom hooks. See [Where Data Comes From](../SKILL.md#where-data-comes-from) for the rules and the permitted exceptions, and the [Fragments reference](fragments.md) for the child component pattern.
>
> The examples in this file are route components. Components such as `DogCard` receive data through a fragment prop.

## Table of Contents

- [useQuery Hook](#usequery-hook)
- [Query Variables](#query-variables)
- [Loading and Error States](#loading-and-error-states)
- [useLazyQuery](#uselazyquery)
- [Polling and Refetching](#polling-and-refetching)
- [Fetch Policies](#fetch-policies)
- [Conditional Queries](#conditional-queries)

## useQuery Hook

The `useQuery` hook is the primary way to fetch data in Apollo Client in non-suspenseful applications. It returns loading and error states that must be handled.

> **Note**: In suspenseful applications, use `useSuspenseQuery` or `useBackgroundQuery` instead. See the [Suspense Hooks reference](suspense-hooks.md) for more details.

### Basic Usage

```tsx
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { DogCard, DOG_CARD_FRAGMENT } from "../components/DogCard";
import type {
  DogsPageQuery,
  DogsPageQueryVariables,
} from "./DogsPage.generated";

const DOGS_PAGE_QUERY: TypedDocumentNode<
  DogsPageQuery,
  DogsPageQueryVariables
> = gql`
  query DogsPage {
    dogs {
      id
      ...DogCard_dog
    }
  }
  ${DOG_CARD_FRAGMENT}
`;

export function DogsPage() {
  const { data, dataState, loading, error } = useQuery(DOGS_PAGE_QUERY);

  if (error) return <p>Error: {error.message}</p>;

  if (dataState === "empty") {
    // `empty` while not loading means the query was skipped, a cache-only
    // query found nothing, or `errorPolicy: "ignore"` discarded an error
    return loading ? <p>Loading...</p> : null;
  }

  return (
    <ul>
      {data.dogs.map((dog) => (
        <DogCard key={dog.id} dog={dog} />
      ))}
    </ul>
  );
}
```

### Checking dataState

Check `dataState` before you read `data`. It narrows the type of `data`:

| `dataState`   | `data`                                                            | When                                                                                                    |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `"empty"`     | `undefined`                                                       | First load, variables changed with no cached data, an error, a skipped query, a `cache-only` cache miss |
| `"partial"`   | Partial data                                                      | `returnPartialData: true` with incomplete cache data                                                    |
| `"streaming"` | Data with holes only at `@defer` boundaries that have not arrived | A `@defer` response is still arriving                                                                   |
| `"complete"`  | Complete data                                                     | All data has arrived                                                                                    |

- Do not treat `dataState === "empty"` alone as a loading state. A skipped query, a `cache-only` query with no cached data, or `errorPolicy: "ignore"` with an error all return `"empty"` with `loading: false`. Check `loading` inside the `"empty"` branch.
- Do not hide data with `dataState !== "complete"`. `"partial"` and `"streaming"` results contain data that you can render.
- A `@stream` result reports `"complete"`, not `"streaming"`, because every field in the query is present while more list items arrive. To detect that incremental chunks are still arriving for `@defer` or `@stream`, check `networkStatus === NetworkStatus.streaming`, not `dataState`. This applies to Apollo Client 4.3+. On earlier versions, every intermediate `@defer` or `@stream` result reports `"streaming"`.
- Use `loading` (not `networkStatus === NetworkStatus.loading`) to detect the first load. When variables change, `networkStatus` is `setVariables`, not `loading`.

## Query Variables

### Basic Variables

```tsx
const DOG_PAGE_QUERY: TypedDocumentNode<DogPageQuery, DogPageQueryVariables> =
  gql`
    query DogPage($breed: String!) {
      dog(breed: $breed) {
        id
        ...DogPhoto_dog
      }
    }
    ${DOG_PHOTO_FRAGMENT}
  `;

export function DogPage({ params }: { params: { breed: string } }) {
  const { data, dataState, loading, error } = useQuery(DOG_PAGE_QUERY, {
    variables: { breed: params.breed },
  });

  if (error) return <p>Error: {error.message}</p>;
  if (dataState === "empty") return loading ? <p>Loading...</p> : null;

  return <DogPhoto dog={data.dog} />;
}
```

### TypeScript Types

Annotate the document with `TypedDocumentNode` and the types generated by GraphQL Codegen. Hooks infer `data` and `variables` from the document. Never pass explicit generics such as `useQuery<Data, Variables>()`.

```typescript
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import type { DogPageQuery, DogPageQueryVariables } from "./DogPage.generated";

const DOG_PAGE_QUERY: TypedDocumentNode<DogPageQuery, DogPageQueryVariables> =
  gql`
    query DogPage($breed: String!) {
      dog(breed: $breed) {
        id
        displayImage
      }
    }
  `;

const { data } = useQuery(DOG_PAGE_QUERY, {
  variables: { breed: "bulldog" }, // type-checked against DogPageQueryVariables
});
```

### Dynamic Variables

```tsx
export function DogBreedsPage() {
  const [breed, setBreed] = useState("bulldog");

  // The query re-runs when `breed` changes
  const { data, dataState } = useQuery(DOG_PAGE_QUERY, {
    variables: { breed },
  });

  return (
    <>
      <select value={breed} onChange={(e) => setBreed(e.target.value)}>
        <option value="bulldog">Bulldog</option>
        <option value="poodle">Poodle</option>
      </select>
      {dataState !== "empty" && <DogPhoto dog={data.dog} />}
    </>
  );
}
```

## Loading and Error States

### Using Previous Data

```tsx
export function UserPage({ params }: { params: { id: string } }) {
  const { loading, data, previousData } = useQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  // Show previous data while loading new data
  const displayData = data ?? previousData;

  return (
    <div>
      {loading && <LoadingSpinner />}
      {displayData?.user && <UserCard user={displayData.user} />}
    </div>
  );
}
```

### Network Status

Use `networkStatus` to show a specific state for a refetch, a poll, or `fetchMore`. `useQuery` re-renders on network status changes by default.

```tsx
import { NetworkStatus } from "@apollo/client";

export function DogsPage() {
  const { data, dataState, loading, error, networkStatus, refetch } =
    useQuery(DOGS_PAGE_QUERY);

  if (error) return <p>Error: {error.message}</p>;
  if (dataState === "empty") return loading ? <p>Loading...</p> : null;

  return (
    <>
      <button onClick={() => refetch()}>Refresh</button>
      {networkStatus === NetworkStatus.refetch && <p>Refetching...</p>}
      <ul>
        {data.dogs.map((dog) => (
          <DogCard key={dog.id} dog={dog} />
        ))}
      </ul>
    </>
  );
}
```

## useLazyQuery

Use `useLazyQuery` when a user action (like a button click or a form submit) starts the query, instead of the component mount. This is a [permitted exception](../SKILL.md#permitted-exceptions) to the route query rule.

**Important**: `useLazyQuery` doesn't guarantee a network request - it only sets variables. If data is already in the cache, this isn't a "refetch". Only use `useLazyQuery` if you consume the second tuple value (loading, data, error states) to synchronize cache data with the component. If you only need the promise, use `client.query` directly instead.

In Suspense applications, use [`useLoadableQuery`](suspense-hooks.md#useloadablequery) instead.

### Basic Usage

```tsx
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";

const DOG_SEARCH_QUERY: TypedDocumentNode<
  DogSearchQuery,
  DogSearchQueryVariables
> = gql`
  query DogSearch($breed: String!) {
    dogs(breed: $breed) {
      id
      ...DogCard_dog
    }
  }
  ${DOG_CARD_FRAGMENT}
`;

export function DogSearchPage() {
  // Exception: user action. The search runs when the user submits a breed.
  const [searchDogs, { data, dataState, loading, error }] =
    useLazyQuery(DOG_SEARCH_QUERY);

  return (
    <div>
      <button onClick={() => searchDogs({ variables: { breed: "bulldog" } })}>
        Find bulldogs
      </button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {dataState === "complete" &&
        data.dogs.map((dog) => <DogCard key={dog.id} dog={dog} />)}
    </div>
  );
}
```

### When to Use client.query Instead

If you only need the promise result and don't consume the loading/error/data states from the hook, use `client.query` instead:

```tsx
import { useApolloClient } from "@apollo/client/react";

function ExportDogsButton() {
  const client = useApolloClient();

  const handleExport = async () => {
    try {
      const { data } = await client.query({ query: EXPORT_DOGS_QUERY });
      downloadCsv(data.dogs);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return <button onClick={handleExport}>Export</button>;
}
```

## Polling and Refetching

### Polling

Set `pollInterval` to poll for the lifetime of the component:

```tsx
export function LiveFeedPage() {
  const { data, dataState } = useQuery(LIVE_FEED_PAGE_QUERY, {
    pollInterval: 5000, // Poll every 5 seconds
  });

  return dataState === "empty" ? null : <Feed feed={data.feed} />;
}
```

To change polling at runtime, keep the interval in state and pass it to `pollInterval`. A `pollInterval` of `0` stops polling.

```tsx
export function LiveFeedPage() {
  const [pollInterval, setPollInterval] = useState(0);
  const { data, dataState } = useQuery(LIVE_FEED_PAGE_QUERY, { pollInterval });
  const isLive = pollInterval > 0;

  return (
    <>
      <button onClick={() => setPollInterval(isLive ? 0 : 5000)}>
        {isLive ? "Pause" : "Go live"}
      </button>
      {dataState !== "empty" && <Feed feed={data.feed} />}
    </>
  );
}
```

You can also call `startPolling` and `stopPolling` in the event handler of the user action that starts or stops polling:

```tsx
export function LiveFeedPage() {
  const { data, dataState, startPolling, stopPolling } =
    useQuery(LIVE_FEED_PAGE_QUERY);
  const [isLive, setIsLive] = useState(false);

  function toggleLive() {
    if (isLive) {
      stopPolling();
    } else {
      startPolling(5000);
    }

    setIsLive(!isLive);
  }

  return (
    <>
      <button onClick={toggleLive}>{isLive ? "Pause" : "Go live"}</button>
      {dataState !== "empty" && <Feed feed={data.feed} />}
    </>
  );
}
```

Avoid synchronizing polling with `useEffect`. Changes to `pollInterval` and calls to `startPolling` or `stopPolling` already start and stop polling. Use `useEffect` only as a last resort, and follow the React guidance in [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

### Manual Refetching

```tsx
export function DogsPage() {
  const { data, dataState, refetch } = useQuery(DOGS_PAGE_QUERY);

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {dataState !== "empty" &&
          data.dogs.map((dog) => <DogCard key={dog.id} dog={dog} />)}
      </ul>
    </div>
  );
}
```

`refetch` also accepts new variables: `refetch({ breed: "poodle" })`.

## Fetch Policies

Use this list to choose a fetch policy:

- **`cache-first` (default)**: Keep the default for almost all queries. A normalized cache keeps data current after mutations and refetches.
- **`cache-and-network`**: Use it when the route must show a cached result immediately, without waiting for the network, and still sync with the server. While the request is in flight, `networkStatus` is `NetworkStatus.loading`. Check it to show a loading indicator next to the cached data.
- **`network-only`**: Use it for volatile data that changes often on the server, outside the user's control, for example an insights product that shows network traffic. Also use it for screens that must sync with the server before they render to avoid showing incorrect data, for example an item that requires approval from someone else in the organization. The query loads a fresh result each time the route is visited, writes it to the cache, and then updates with cache changes like any other query.
- **`no-cache`**: Avoid it. The result is not written to the cache, so the query keeps a local copy of the data. It does not update when the cache changes, and it does not update other parts of the UI. Use it sparingly.
- **`standby`**: Avoid it. A `standby` query stays idle: it does not fetch, and it does not update when the cache changes. To skip a query, prefer `skipToken` to `standby`. To run a query after a user action, use `useLazyQuery`.

Never change `fetchPolicy` to fix data that this app changed with a mutation but that the cache does not show. That is a cache problem. Fix the cache: return the changed fields in the mutation response, configure key fields, or add a `merge` or `update` function. If the mutation response cannot contain the changed data, update the cache directly with an `update` function. Refetch the affected queries with `refetchQueries` only when a direct cache update is not possible, for example when the server decides which items belong in a filtered list.

## Conditional Queries

### Using skipToken (Recommended)

Use `skipToken` to conditionally skip queries without TypeScript issues:

```tsx
import { skipToken } from "@apollo/client/react";

export function UserPage({ params }: { params: { id?: string } }) {
  const { data, dataState, loading, error } = useQuery(
    USER_PAGE_QUERY,
    params.id ? { variables: { id: params.id } } : skipToken
  );

  if (!params.id) return <p>Select a user</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (dataState === "empty") return loading ? <p>Loading...</p> : null;

  return <UserCard user={data.user} />;
}
```

### Skip Option (Alternative)

```tsx
export function UserPage({ params }: { params: { id?: string } }) {
  const { data } = useQuery(USER_PAGE_QUERY, {
    variables: { id: params.id! },
    skip: !params.id, // Don't execute if no params.id
  });

  return params.id ? <UserCard user={data?.user} /> : <p>Select a user</p>;
}
```

> **Note**: Using `skipToken` is preferred over `skip` as it avoids TypeScript issues with required variables and the non-null assertion operator.

### SSR Skip

```tsx
// Skip during server-side rendering
const { data } = useQuery(USER_LOCATION_QUERY, {
  skip: typeof window === "undefined",
  ssr: false,
});
```
