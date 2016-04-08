# Apollo Client

The Apollo Client class is the thing you import from this package, and should be instantiated to communicate with your server. You can instantiate as many clients as you want, but most apps will have exactly one of these. If you want to talk to multiple backends, the right place to do that is in your GraphQL server.

## API

### new ApolloClient(options)

Instantiate a new Apollo Client.

- `networkInterface: NetworkInterface` (Optional, defaults to an interface that points to `/graphql`) The network interface to use when sending GraphQL queries to the server.
- `XXX redux integration` (Optional, creates a new Redux store by default) A Redux store to in which to keep all state.

### createNetworkInterface(url, options)

Create a new HTTP network interface that points to a GraphQL server at a specific URI.

- `url: string` The URL of the remote server, for example `https://example.com/graphql`.
- `options: FetchOptions` (Optional) Options that are passed through to `fetch` XXX link to docs

## Examples

Instantiate a new Apollo Client:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();
```

Instantiate a new client with a custom endpoint URL:

```js
import ApolloClient from 'apollo-client';

const networkInterface = createNetworkInterface('https://example.com/graphql');

const client = new ApolloClient({
  networkInterface,
});
```
