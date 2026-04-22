# Queries Reference

> **Note**: In most applications, there should only be one use of a query hook per page. Use fragment-reading hooks (`useFragment`, `useSuspenseFragment`) with component-colocated fragments and data masking for the rest of the page components.

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
import { useQuery } from "@apollo/client/react";

const GET_DOGS = gql`
  query GetDogs {
    dogs {
      id
      breed
      displayImage
    }
  }
`;

function Dogs() {
  const { loading, error, data } = useQuery(GET_DOGS);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data.dogs.map((dog) => (
        <li key={dog.id}>{dog.breed}</li>
      ))}
    </ul>
  );
}
```

### Return Object

```typescript
const {
  data, // Query result data
  loading, // True during initial load
  error, // ApolloError if request failed
  networkStatus, // Detailed network state (1-8)
  dataState, // For TypeScript type narrowing (AC 4.x)
  refetch, // Function to re-execute query
  fetchMore, // Function for pagination
  startPolling, // Start polling at interval
  stopPolling, // Stop polling
  subscribeToMore, // Add subscription to query
  updateQuery, // Manually update query result
  client, // Apollo Client instance
  called, // True if query has been executed
  previousData, // Previous data (useful during loading)
} = useQuery(QUERY);
```

## Query Variables

### Basic Variables

```tsx
const GET_DOG = gql`
  query GetDog($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

function DogPhoto({ breed }: { breed: string }) {
  const { loading, error, data } = useQuery(GET_DOG, {
    variables: { breed },
  });

  if (loading) return null;
  if (error) return <p>Error: {error.message}</p>;

  return <img src={data.dog.displayImage} alt={breed} />;
}
```

### TypeScript Types

Use `TypedDocumentNode` instead of generic type parameters for better type safety:

```typescript
import { gql, TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

interface GetDogData {
  dog: {
    id: string;
    displayImage: string;
  };
}

interface GetDogVariables {
  breed: string;
}

const GET_DOG: TypedDocumentNode<GetDogData, GetDogVariables> = gql`
  query GetDog($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

const { data } = useQuery(GET_DOG, {
  variables: { breed: "bulldog" },
});

// data?.dog is fully typed
```

### Dynamic Variables

```tsx
function DogSelector() {
  const [breed, setBreed] = useState("bulldog");

  // Query automatically re-runs when breed changes
  const { data } = useQuery(GET_DOG, {
    variables: { breed },
  });

  return (
    <select value={breed} onChange={(e) => setBreed(e.target.value)}>
      <option value="bulldog">Bulldog</option>
      <option value="poodle">Poodle</option>
    </select>
  );
}
```

## Loading and Error States

### Using Previous Data

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { loading, data, previousData } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  // Show previous data while loading new data
  const displayData = data ?? previousData;

  return (
    <div>
      {loading && <LoadingSpinner />}
      {displayData && <UserCard user={displayData.user} />}
    </div>
  );
}
```

### Network Status

```tsx
import { NetworkStatus } from "@apollo/client";

function Dogs() {
  const { loading, error, data, networkStatus, refetch } = useQuery(GET_DOGS, {
    notifyOnNetworkStatusChange: true,
  });

  if (networkStatus === NetworkStatus.refetch) {
    return <p>Refetching...</p>;
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {data.dogs.map((dog) => (
          <li key={dog.id}>{dog.breed}</li>
        ))}
      </ul>
    </>
  );
}
```

## useLazyQuery

Use `useLazyQuery` when you want to execute a query in response to a user-triggered event (like a button click) rather than on component mount.

**Important**: `useLazyQuery` doesn't guarantee a network request - it only sets variables. If data is already in the cache, this isn't a "refetch". Only use `useLazyQuery` if you consume the second tuple value (loading, data, error states) to synchronize cache data with the component. If you only need the promise, use `client.query` directly instead.

### Basic Usage

```tsx
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";

const GET_DOG_PHOTO = gql`
  query GetDogPhoto($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

function DelayedQuery() {
  const [getDog, { loading, error, data, called }] = useLazyQuery(GET_DOG_PHOTO);

  if (called && loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {data?.dog && <img src={data.dog.displayImage} />}
      <button onClick={() => getDog({ variables: { breed: "bulldog" } })}>Get Bulldog Photo</button>
    </div>
  );
}
```

### When to Use client.query Instead

If you only need the promise result and don't consume the loading/error/data states from the hook, use `client.query` instead:

```tsx
import { useApolloClient } from "@apollo/client/react";

function SearchDogs() {
  const client = useApolloClient();
  const [search, setSearch] = useState("");

  const handleSearch = async () => {
    try {
      const { data } = await client.query({
        query: SEARCH_DOGS,
        variables: { query: search },
      });
      console.log("Found dogs:", data.searchDogs);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <button onClick={handleSearch}>Search</button>
    </div>
  );
}
```

## Polling and Refetching

### Polling

```tsx
function LiveFeed() {
  const { data, startPolling, stopPolling } = useQuery(GET_FEED, {
    pollInterval: 5000, // Poll every 5 seconds
  });

  // Or control polling dynamically
  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return <Feed items={data?.feed} />;
}
```

### Manual Refetching

```tsx
function DogList() {
  const { data, refetch } = useQuery(GET_DOGS);

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <button onClick={() => refetch({ breed: "poodle" })}>Refetch Poodles</button>
      <ul>
        {data?.dogs.map((dog) => (
          <li key={dog.id}>{dog.breed}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Fetch Policies

Control how the query interacts with the cache.

| Policy              | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `cache-first`       | Return cached data if available, otherwise fetch (default) |
| `cache-only`        | Only return cached data, never fetch                       |
| `cache-and-network` | Return cached data immediately, then fetch and update      |
| `network-only`      | Always fetch, update cache, ignore cached data             |
| `no-cache`          | Always fetch, never read or write cache                    |
| `standby`           | Same as cache-first but doesn't auto-update                |

### Usage Examples

```tsx
// Real-time data - always fetch
const { data } = useQuery(GET_NOTIFICATIONS, {
  fetchPolicy: "network-only",
});

// Static data - prefer cache
const { data } = useQuery(GET_CATEGORIES, {
  fetchPolicy: "cache-first",
});

// Show cached data while fetching fresh data
const { data, loading } = useQuery(GET_POSTS, {
  fetchPolicy: "cache-and-network",
});

// Fetch once, then use cache
const { data } = useQuery(GET_USER_PROFILE, {
  fetchPolicy: "network-only",
  nextFetchPolicy: "cache-first",
});
```

### nextFetchPolicy

```tsx
// First request: network-only
// Subsequent requests: cache-first
const { data } = useQuery(GET_POSTS, {
  fetchPolicy: "network-only",
  nextFetchPolicy: "cache-first",
});

// Or use a function for more control
const { data } = useQuery(GET_POSTS, {
  fetchPolicy: "network-only",
  nextFetchPolicy: (currentFetchPolicy, { reason, observable }) => {
    if (reason === "after-fetch") {
      return "cache-first";
    }
    return currentFetchPolicy;
  },
});
```

## Conditional Queries

### Using skipToken (Recommended)

Use `skipToken` to conditionally skip queries without TypeScript issues:

```tsx
import { skipToken } from "@apollo/client";

function UserProfile({ userId }: { userId: string | null }) {
  const { data } = useQuery(
    GET_USER,
    !userId
      ? skipToken
      : {
          variables: { id: userId },
        },
  );

  return userId ? <Profile user={data?.user} /> : <p>Select a user</p>;
}
```

### Skip Option (Alternative)

```tsx
function UserProfile({ userId }: { userId: string | null }) {
  const { data } = useQuery(GET_USER, {
    variables: { id: userId! },
    skip: !userId, // Don't execute if no userId
  });

  return userId ? <Profile user={data?.user} /> : <p>Select a user</p>;
}
```

> **Note**: Using `skipToken` is preferred over `skip` as it avoids TypeScript issues with required variables and the non-null assertion operator.

### SSR Skip

```tsx
// Skip during server-side rendering
const { data } = useQuery(GET_USER_LOCATION, {
  skip: typeof window === "undefined",
  ssr: false,
});
```
