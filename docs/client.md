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
- `options: FetchOptions` Options that are passed through to `fetch` XXX link to docs

### NetworkInterface

This is an interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: GraphQLRequest): Promise<GraphQLResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

#### GraphQLRequest

Represents a request passed to the network interface. Has the following properties:

- `query: string` The query to send to the server.
- `variables: Object` The variables to send with the query.
- `debugName: string` An optional parameter that will be included in error messages about this query. XXX do we need this?

#### GraphQLResult

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.
