---
"@apollo/client": major
---

Apollo Client no longer wraps errors in `ApolloError`. `ApolloError` has been replaced with separate error classes depending on the cause of the error. As such, APIs that return an `error` property have been updated to use the generic `Error` type. Use `instanceof` to check for more specific error types.

## Migration guide

`ApolloError` encapsulated 4 main error properties. The type of error would determine which property was set:
- `graphqlErrors` - Errors returned from the `errors` field by the GraphQL server
- `networkError` - Any non-GraphQL error that caused the query to fail
- `protocolErrors` - Transport-level errors that occur during [multipart HTTP subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol)
- `clientErrors` - A space to define custom errors. Mostly unused.

These errors were mutally exclusive, meaning both `networkError` and `graphqlErrors` were never set simultaneously. The following replaces each of these fields from `ApolloError`.

### `graphqlErrors`

GraphQL errors are now encapsulated in a `CombinedGraphQLErrors` instance. You can access the raw GraphQL errors via the `errors` property.

```js
import { CombinedGraphQLErrors } from '@apollo/client';

// ...

const { error } = useQuery(query);

if (error && error instanceof CombinedGraphQLErrors) {
  console.log(error.errors);
}
```

### `networkError`

Network errors are no longer wrapped and are instead passed through directly.

```js
const client = new ApolloClient({
  link: new ApolloLink(() => {
    return new Observable((observer) => {
      observer.error(new Error('Test error'));
    })
  })
})

// ...

const { error } = useQuery(query);

// error is `new Error('Test error')`;
```

### `protocolErrors`

Protocol errors are now encapsulated in a `CombinedProtocolErrors` instance. You can access the raw protocol errors via the `errors` property.


```js
import { CombinedProtocolErrors } from '@apollo/client';

// ...

const { error } = useSubscription(subscription);

if (error && error instanceof CombinedProtocolErrors) {
  console.log(error.errors);
}
```

### `clientErrors`

These were unused by the client and have no replacement. Any non-GraphQL or non-protocol errors are now passed through unwrapped.

### Strings as errors

If the link sends a string error, Apollo Client will wrap this in an `Error` instance. This ensures `error` properties are guaranteed to be of type `Error`.

```js
const client = new ApolloClient({
  link: new ApolloLink(() => {
    return new Observable((observer) => {
      // Oops we sent a string instead of wrapping it in an `Error`
      observer.error('Test error');
    })
  })
})

// ...

const { error } = useQuery(query);

// The error string is wrapped and returned as `new Error('Test error')`;
```

### Non-error types

If the link chain sends any other object type as an error, Apollo Client will wrap this in an `UnknownError` instance with the [`cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) set to the original object. This ensures `error` properties are guaranteed to be of type `Error`.

```js
const client = new ApolloClient({
  link: new ApolloLink(() => {
    return new Observable((observer) => {
      observer.error({ message: 'Not a proper error type' });
    })
  })
})

// ...

const { error } = useQuery(query);

// error is an `UnknownError` instance. error.cause returns the original object.
```
