---
"@apollo/client": major
---

Moves all React-related exports to the `@apollo/client/react` entrypoint and out of the main `@apollo/client` entrypoint. This prevents the need to install React in order to use the core client.

The following is a list of exports available in `@apollo/client` that should now import from `@apollo/client/react`.
- `ApolloConsumer`
- `ApolloProvider`
- `createQueryPreloader`
- `getApolloContext`
- `skipToken`
- `useApolloClient`
- `useBackgroundQuery`
- `useFragment`
- `useLazyQuery`
- `useLoadableQuery`
- `useMutation`
- `useQuery`
- `useQueryRefHandlers`
- `useReactiveVar`
- `useReadQuery`
- `useSubscription`
- `useSuspenseQuery`

The following is a list of exports available in `@apollo/client/testing` that should now import from `@apollo/client/testing/react`:
- `MockedProvider`
