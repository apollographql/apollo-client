# Error Handling Reference (Apollo Client 4.x)

Note that Apollo Client 4.x handles errors differently than Apollo Client 3.x.
This reference documents the updated error handling mechanisms, error types, and best practices for managing errors in your Apollo Client applications.
For older Apollo Client 3.x error handling documentation, see [Apollo Client 3.x Error Handling](https://www.apollographql.com/docs/react/v3/data/error-handling).

## Table of Contents

- [Understanding Errors](#understanding-errors)
- [Error Types](#error-types)
- [Identifying Error Types](#identifying-error-types)
- [GraphQL Error Policies](#graphql-error-policies)
- [Error Links](#error-links)
- [Retry Logic](#retry-logic)
- [Error Boundaries](#error-boundaries)

## Understanding Errors

Errors in Apollo Client fall into two main categories: **GraphQL errors** and **network errors**. Each category has specific error classes that provide detailed information about what went wrong.

### GraphQL Errors

GraphQL errors are related to server-side execution of a GraphQL operation:

- **Syntax errors** (e.g., malformed query)
- **Validation errors** (e.g., query includes a non-existent schema field)
- **Resolver errors** (e.g., error while populating a query field)

If a syntax or validation error occurs, the server doesn't execute the operation. If resolver errors occur, the server can still return partial data.

Example server response with GraphQL error:

```json
{
  "errors": [
    {
      "message": "Cannot query field \"nonexistentField\" on type \"Query\".",
      "locations": [{ "line": 2, "column": 3 }],
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED"
      }
    }
  ],
  "data": null
}
```

In Apollo Client 4.x, GraphQL errors are represented by the [`CombinedGraphQLErrors`](https://apollographql.com/docs/react/api/errors/CombinedGraphQLErrors) error type.

### Network Errors

Network errors occur when attempting to communicate with your GraphQL server:

- `4xx` or `5xx` HTTP response status codes
- Network unavailability
- JSON parsing failures
- Custom errors from Apollo Link request handlers

Network errors might be represented by special error types, but if an api such as the `fetch` API throws a native error (e.g., `TypeError`), Apollo Client will pass it through as-is.
Thrown values that don't fulfill the standard `ErrorLike` interface are wrapped in the [`UnconventionalError`](https://apollographql.com/docs/react/api/errors/UnconventionalError) class, which fulfills the `ErrorLike` interface. As such, you can expect any error returned by Apollo Client to fulfill the `ErrorLike` interface.

```ts
export interface ErrorLike {
  message: string;
  name: string;
  stack?: string;
}
```

## Error Types

Apollo Client 4.x provides specific error classes for different error scenarios:

### CombinedGraphQLErrors

Represents GraphQL errors returned by the server. Most common error type in applications.

```tsx
import { CombinedGraphQLErrors } from "@apollo/client/errors";

function UserProfile({ userId }: { userId: string }) {
  const { data, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  // no need to check for nullishness of error, CombinedGraphQLErrors.is handles that
  if (CombinedGraphQLErrors.is(error)) {
    // Handle GraphQL errors
    return (
      <div>
        {error.graphQLErrors.map((err, i) => (
          <p key={i}>GraphQL Error: {err.message}</p>
        ))}
      </div>
    );
  }

  return data ? <Profile user={data.user} /> : null;
}
```

### CombinedProtocolErrors

Represents fatal transport-level errors during multipart HTTP subscription execution.

### ServerError

Occurs when the server responds with a non-200 HTTP status code.

```tsx
import { ServerError } from "@apollo/client/errors";

if (ServerError.is(error)) {
  console.error("Server error:", error.statusCode, error.result);
}
```

### ServerParseError

Occurs when the server response cannot be parsed as valid JSON.

```tsx
import { ServerParseError } from "@apollo/client/errors";

if (ServerParseError.is(error)) {
  console.error("Invalid JSON response:", error.bodyText);
}
```

### LocalStateError

Represents errors in local state configuration or execution.

### UnconventionalError

Wraps non-standard errors (e.g., thrown symbols or objects) to ensure consistent error handling.

## Identifying Error Types

Every Apollo Client error class provides a static `is` method that reliably determines whether an error is of that specific type. This is more robust than `instanceof` because it avoids false positives/negatives.

```ts
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  LocalStateError,
  ServerError,
  ServerParseError,
  UnconventionalError,
  ErrorLike,
} from "@apollo/client/errors";

// Anything returned in the `error` field of Apollo Client hooks or methods is of type `ErrorLike` or `undefined`.
function handleError(error?: ErrorLike) {
  if (CombinedGraphQLErrors.is(error)) {
    // Handle GraphQL errors
    console.error("GraphQL errors:", error.graphQLErrors);
  } else if (CombinedProtocolErrors.is(error)) {
    // Handle multipart subscription protocol errors
  } else if (LocalStateError.is(error)) {
    // Handle errors thrown by the LocalState class
  } else if (ServerError.is(error)) {
    // Handle server HTTP errors
    console.error("Server error:", error.statusCode);
  } else if (ServerParseError.is(error)) {
    // Handle JSON parse errors
  } else if (UnconventionalError.is(error)) {
    // Handle errors thrown by irregular types
  } else if (error) {
    // Handle other errors
  }
}
```

## GraphQL Error Policies

If a GraphQL operation produces errors, the server's response might still include partial data:

```json
{
  "data": {
    "getInt": 12,
    "getString": null
  },
  "errors": [
    {
      "message": "Failed to get string!"
    }
  ]
}
```

By default, Apollo Client throws away partial data and populates the `error` field. You can use partial results by defining an **error policy**:

| Policy   | Description                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`   | (Default) If the response includes errors, they are returned in `error` and response `data` is set to `undefined` even if the server returns `data`.                         |
| `ignore` | Errors are ignored (`error` is not populated), and any returned `data` is cached and rendered as if no errors occurred. `data` may be `undefined` if a network error occurs. |
| `all`    | Both `data` and `error` are populated and any returned `data` is cached, enabling you to render both partial results and error information.                                  |

### Setting an Error Policy

```tsx
const MY_QUERY = gql`
  query WillFail {
    badField # This field's resolver produces an error
    goodField # This field is populated successfully
  }
`;

function ShowingSomeErrors() {
  const { loading, error, data } = useQuery(MY_QUERY, { errorPolicy: "all" });

  if (loading) return <span>loading...</span>;

  return (
    <div>
      <h2>Good: {data?.goodField}</h2>
      {error && <pre>Bad: {error.message}</pre>}
    </div>
  );
}
```

### Avoid setting a Global Error Policy

While it is possible to set a global error policy using `defaultOptions`, in practice this is discouraged as it can lead to unexpected behavior and type safety issues. The return types of the TypeScript hooks may change depending on the `errorPolicy` passed into the hook, and this can conceptually not take global `defaultOptions` error policies into account. As such, it is best to set the `errorPolicy` per operation as needed.

## Error Links

The `ErrorLink` can be used to e.g. log error globally or perform specific side effects based on errors happening.

An `ErrorLink` can't be used to swallow errors fully, but it can be used to retry an operation after handling an error, in which case the error wouldn't propagate. Otherwise, the most common use for `ErrorLink` is logging.

```ts
import { ErrorLink } from "@apollo/client/link/error";

const errorLink = new ErrorLink(({ error, operation, forward }) => {
  if (someCondition(error)) {
    // Retry the request, returning the new observable
    return forward(operation);
  }

  // Log the error for any unhandled GraphQL errors or network errors.
  console.log(`[Error]: ${error.message}`);

  // If nothing is returned from the error handler callback, the error will be
  // emitted from the link chain as normal.
});
```

### Retry Link

Alternatively, you can use the `RetryLink` from `@apollo/client/link/retry` to implement retry logic for failed operations.

```typescript
import { RetryLink } from "@apollo/client/link/retry";

const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true,
  },
  attempts: {
    max: 5,
    retryIf: (error, operation) => {
      // Retry on network errors
      return !!error && operation.operationName !== "SensitiveOperation";
    },
  },
});

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: from([retryLink, errorLink, httpLink]),
});
```

### Custom Retry Logic

```typescript
const retryLink = new RetryLink({
  attempts: (count, operation, error) => {
    // Don't retry mutations
    if (operation.query.definitions.some((def) => def.kind === "OperationDefinition" && def.operation === "mutation")) {
      return false;
    }

    // Retry up to 3 times on network errors
    return count < 3 && !!error;
  },
  delay: (count) => {
    // Exponential backoff
    return Math.min(1000 * Math.pow(2, count), 30000);
  },
});
```

## Error Boundaries

When using suspenseful hooks, you should use React Error Boundaries for graceful error handling.

### Non-suspense per-Component Error Handling

```tsx
function SafeUserList() {
  const { data, error, loading, refetch } = useQuery(GET_USERS, {
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
  });

  // Handle network errors
  if (error?.networkError) {
    return (
      <Alert severity="error">
        <AlertTitle>Connection Error</AlertTitle>
        Failed to load users. Please check your internet connection.
        <Button onClick={() => refetch()}>Retry</Button>
      </Alert>
    );
  }

  // Handle GraphQL errors but still show available data
  return (
    <div>
      {error?.graphQLErrors && (
        <Alert severity="warning">Some data may be incomplete: {error.graphQLErrors[0].message}</Alert>
      )}

      {loading && <LinearProgress />}

      {data?.users && <UserList users={data.users} />}
    </div>
  );
}
```
