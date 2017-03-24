# Error handling - design proposal

## Motivation
ApolloClient currently does not deal with errors very gracefully. When the server returns any error, Apollo Client will discard the result and call `observer.error`. With the recent addition of error paths in the standard `formatError` function of [graphql-js](https://github.com/graphql/graphql-js/pull/561) and the [proposal to add it to the spec](https://github.com/facebook/graphql/pull/230), we have an opportunity to improve error handling and write partial results to the store when the server provides one.

## Proposed feature / solution
As far as Apollo Client is concerned, errors can be roughly divided into two categories:

1. Errors that make the entire result unusable
2. Errors that make only part of the result unusable

An example for the first kind of error is when the server cannot be reached, or the server does not return valid JSON. An example for the second kind of error is when the server returned a partial result and a GraphQL error because it could not reach a backend service.

For errors of the first category, the server does not return any data that can be displayed to the user, only errors, so Apollo Client should call `observer.error` and not write data to the store.

For errors of the second category, the server returns data *and* errors, so there is data that can be displayed to the user and Apollo Client should call `observer.error` with `{ data, errors }`, and write as much of the result to the store as possible. Any `null` fields in `result.data` should not be written to the store if there is an error with a path corresponding to that field.

Note: We call `observer.error` with the partial result instead of `observer.next` in order to make error handling stay as close as possible to the current behavior. This is definitely debatable because calling `observer.error` also means the observable will stop at this point and needs to be restarted by the user if more responses are expected (as would be the case with a polling query). If we called `observer.next` instead, then the user could deal with transient GraphQL errors in a more "voluntary" way.

Because initially not all servers will have support for error paths, the current behavior (discarding all data) will be used when errors without path are encountered in the result.

## Implementation steps / changes needed
1. Call `observer.error` and discard the result if not all errors have an error path
2. Write result to store if at least partial data is available. Ignore fields if there's an error with a path to that field.
3. Call `observer.error` with data and errors if there is at least a partial result.

## Changes to the external API
* ApolloClient will have a new configuration option to keep using the current error behavior. Initially this could be on by default to provide a non-breaking change & smooth transition.
* `observer.error` will now receive data as well if is a partial result
* Partial results are now written to the store in the presence of GraphQL errors.

