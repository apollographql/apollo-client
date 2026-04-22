# Caching Reference

## Table of Contents

- [InMemoryCache Setup](#inmemorycache-setup)
- [Cache Normalization](#cache-normalization)
- [Type Policies](#type-policies)
- [Field Policies](#field-policies)
- [Pagination](#pagination)
- [Cache Manipulation](#cache-manipulation)
- [Garbage Collection](#garbage-collection)

## InMemoryCache Setup

### Basic Configuration

```typescript
import { InMemoryCache } from "@apollo/client";

const cache = new InMemoryCache({
  // Custom type policies
  typePolicies: {
    Query: {
      fields: {
        // Query-level field policies
      },
    },
    User: {
      keyFields: ["id"],
      fields: {
        // User-level field policies
      },
    },
  },

  // Custom type name handling (rare)
  possibleTypes: {
    Character: ["Human", "Droid"],
    Node: ["User", "Post", "Comment"],
  },
});
```

### Constructor Options

```typescript
new InMemoryCache({
  // Define how types are identified in cache
  typePolicies: {
    /* ... */
  },

  // Interface/union type mappings between supertypes and their subtypes
  possibleTypes: {
    /* ... */
  },

  // Custom function to generate cache IDs (rare)
  dataIdFromObject: (object) => {
    if (object.__typename === "Book") {
      return `Book:${object.isbn}`;
    }
    return defaultDataIdFromObject(object);
  },
});
```

## Cache Normalization

Apollo Client normalizes data by splitting query results into individual objects and storing them by unique identifier.

### How Normalization Works

```graphql
# Query
query GetPost {
  post(id: "1") {
    id
    title
    author {
      id
      name
    }
  }
}
```

```typescript
// Normalized cache structure
{
  'Post:1': {
    __typename: 'Post',
    id: '1',
    title: 'Hello World',
    author: { __ref: 'User:42' }
  },
  'User:42': {
    __typename: 'User',
    id: '42',
    name: 'John'
  },
  ROOT_QUERY: {
    'post({"id":"1"})': { __ref: 'Post:1' }
  }
}
```

### Benefits of Normalization

1. **Automatic updates**: When `User:42` is updated anywhere, all components showing that user update
2. **Deduplication**: Same objects aren't stored multiple times
3. **Efficient updates**: Only changed objects trigger re-renders

## Type Policies

### keyFields

Customize how objects are identified in the cache.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    // Use ISBN instead of id for books
    Book: {
      keyFields: ["isbn"],
    },

    // Composite key
    UserSession: {
      keyFields: ["userId", "deviceId"],
    },

    // Nested key
    Review: {
      keyFields: ["book", ["isbn"], "reviewer", ["id"]],
    },

    // No key fields (singleton, only one object in cache per type)
    AppSettings: {
      keyFields: [],
    },

    // Disable normalization (objects of this type will be stored with their
    // parent entity. The same object might end up multiple times in the cache
    // and run out of sync. Use with caution, only if this object really relates
    // to a property of their parent entity and cannot exist on its own.)
    Address: {
      keyFields: false,
    },
  },
});
```

### merge Functions

Control how incoming data merges with existing data.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      fields: {
        // Deep merge profile object
        profile: {
          merge: true, // Shorthand for deep merge
        },

        // Custom merge logic
        notifications: {
          merge(existing = [], incoming, { mergeObjects }) {
            // Prepend new notifications
            return [...incoming, ...existing];
          },
        },
      },
    },
  },
});
```

## Field Policies

### read Function

Transform cached data when reading.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      fields: {
        // Computed field
        fullName: {
          read(_, { readField }) {
            const firstName = readField("firstName");
            const lastName = readField("lastName");
            return `${firstName} ${lastName}`;
          },
        },

        // Transform existing field
        birthDate: {
          read(existing) {
            return existing ? new Date(existing) : null;
          },
        },

        // Default value
        role: {
          read(existing = "USER") {
            return existing;
          },
        },
      },
    },
  },
});
```

### merge Function

Control how incoming data is stored.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      fields: {
        // Accumulate items instead of replacing
        friends: {
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },

        // Merge objects deeply
        settings: {
          merge(existing, incoming, { mergeObjects }) {
            return mergeObjects(existing, incoming);
          },
        },
      },
    },

    Query: {
      fields: {
        // Merge paginated results
        posts: {
          keyArgs: ["category"], // Only category affects cache key
          merge(existing = { items: [] }, incoming) {
            return {
              ...incoming,
              items: [...existing.items, ...incoming.items],
            };
          },
        },
      },
    },
  },
});
```

### keyArgs

Control which arguments affect cache storage.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Different cache entry per userId only
        // (limit, offset don't create new entries)
        userPosts: {
          keyArgs: ["userId"],
        },

        // No arguments affect cache key
        // (useful for pagination)
        feed: {
          keyArgs: false,
        },

        // Nested argument
        search: {
          keyArgs: ["filter", ["category", "status"]],
        },
      },
    },
  },
});
```

## Pagination

### Offset-Based Pagination

```typescript
import { offsetLimitPagination } from "@apollo/client/utilities";

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: offsetLimitPagination(),

        // With key arguments
        userPosts: offsetLimitPagination(["userId"]),
      },
    },
  },
});
```

### Cursor-Based Pagination (Relay Style)

```typescript
import { relayStylePagination } from "@apollo/client/utilities";

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: relayStylePagination(),

        // With key arguments
        userPosts: relayStylePagination(["userId"]),
      },
    },
  },
});
```

### Custom Pagination

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          keyArgs: false,

          merge(existing, incoming, { args }) {
            const merged = existing ? existing.slice(0) : [];
            const offset = args?.offset ?? 0;

            for (let i = 0; i < incoming.length; i++) {
              merged[offset + i] = incoming[i];
            }

            return merged;
          },

          read(existing, { args }) {
            const offset = args?.offset ?? 0;
            const limit = args?.limit ?? existing?.length ?? 0;
            return existing?.slice(offset, offset + limit);
          },
        },
      },
    },
  },
});
```

### fetchMore for Pagination

```tsx
function PostList() {
  const { data, fetchMore, loading } = useQuery(GET_POSTS, {
    variables: { offset: 0, limit: 10 },
  });

  const loadMore = () => {
    fetchMore({
      variables: {
        offset: data.posts.length,
      },
      // With proper type policies, no updateQuery needed
    });
  };

  return (
    <div>
      {data?.posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <button onClick={loadMore} disabled={loading}>
        Load More
      </button>
    </div>
  );
}
```

## Cache Manipulation

### cache.readQuery

```typescript
// Read data from cache
const data = cache.readQuery({
  query: GET_TODOS,
});

// With variables
const userData = cache.readQuery({
  query: GET_USER,
  variables: { id: "1" },
});
```

### cache.writeQuery

```typescript
// Write data to cache
cache.writeQuery({
  query: GET_TODOS,
  data: {
    todos: [{ __typename: "Todo", id: "1", text: "Buy milk", completed: false }],
  },
});

// With variables
cache.writeQuery({
  query: GET_USER,
  variables: { id: "1" },
  data: {
    user: { __typename: "User", id: "1", name: "John" },
  },
});
```

### cache.readFragment / cache.writeFragment

```typescript
// Read a specific object - use cache.identify for safety
const user = cache.readFragment({
  id: cache.identify({ __typename: "User", id: "1" }),
  fragment: gql`
    fragment UserFragment on User {
      id
      name
      email
    }
  `,
});

// Apollo Client 4.1+: Use 'from' parameter (recommended)
const user = cache.readFragment({
  from: { __typename: "User", id: "1" },
  fragment: gql`
    fragment UserFragment on User {
      id
      name
      email
    }
  `,
});

// Update a specific object
cache.writeFragment({
  id: cache.identify({ __typename: "User", id: "1" }),
  fragment: gql`
    fragment UpdateUser on User {
      name
    }
  `,
  data: {
    name: "Jane",
  },
});

// Apollo Client 4.1+: Use 'from' parameter (recommended)
cache.writeFragment({
  from: { __typename: "User", id: "1" },
  fragment: gql`
    fragment UpdateUser on User {
      name
    }
  `,
  data: {
    name: "Jane",
  },
});
```

### cache.modify

```typescript
// Modify fields directly
cache.modify({
  id: cache.identify(user),
  fields: {
    // Set new value
    name: () => "New Name",

    // Transform existing value
    postCount: (existing) => existing + 1,

    // Delete field
    temporaryField: (_, { DELETE }) => DELETE,

    // Add to array
    friends: (existing, { toReference }) => [...existing, toReference({ __typename: "User", id: "2" })],
  },
});
```

### cache.evict

```typescript
// Remove object from cache
cache.evict({ id: "User:1" });

// Remove specific field
cache.evict({ id: "User:1", fieldName: "friends" });

// Remove with broadcast (trigger re-renders)
cache.evict({ id: "User:1", broadcast: true });
```

## Garbage Collection

### Manual Garbage Collection

```typescript
// After evicting objects, clean up dangling references
cache.evict({ id: "User:1" });
cache.gc();
```

### Retaining Objects

```typescript
// Prevent objects from being garbage collected
const release = cache.retain("User:1");

// Later, allow GC
release();
cache.gc();
```

### Inspecting Cache

```typescript
// Get all cached data
const cacheContents = cache.extract();

// Restore cache state
cache.restore(previousCacheContents);

// Get identified object cache key
const userId = cache.identify({ __typename: "User", id: "1" });
// Returns: 'User:1'
```
