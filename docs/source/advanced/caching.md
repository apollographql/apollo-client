---
title: Caching data
description: A guide to customizing and directly accessing your Apollo cache
---

## InMemoryCache

`apollo-cache-inmemory` is the default cache implementation for Apollo Client 2.0. `InMemoryCache` is a normalized data store that supports all of Apollo Client 1.0's features without the dependency on Redux.

In some instances, you may need to manipulate the cache directly, such as updating the store after a mutation. We'll cover some common use cases [here](#recipes).

### Installation

```bash
npm install apollo-cache-inmemory --save
```

After installing the package, you'll want to initialize the cache constructor. Then, you can pass in your newly created cache to ApolloClient.

```js
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { ApolloClient } from 'apollo-client';

const cache = new InMemoryCache();

const client = new ApolloClient({
  link: new HttpLink(),
  cache
});
```

### Configuration

The `InMemoryCache` constructor takes an optional config object with properties to customize your cache:

- `addTypename`: A boolean to determine whether to add __typename to the document (default: `true`)
- `dataIdFromObject`: A function that takes a data object and returns a unique identifier to be used when normalizing the data in the store. Learn more about how to customize `dataIdFromObject` in the [Normalization](#normalization) section.
- `fragmentMatcher`: By default, the `InMemoryCache` uses a heuristic fragment matcher. If you are using fragments on unions and interfaces, you will need to use an `IntrospectionFragmentMatcher`. For more information, please read [our guide to setting up fragment matching for unions & interfaces](/advanced/fragments/#fragments-on-unions-and-interfaces).
- `cacheRedirects` (previously known as `cacheResolvers` or `customResolvers`): A map of functions to redirect a query to another entry in the cache before a request takes place. This is useful if you have a list of items and want to use the data from the list query on a detail page where you're querying an individual item. More on that [here](#cache-redirects-with-cacheredirects).

### Normalization

The `InMemoryCache` normalizes your data before saving it to the store by splitting the result into individual objects, creating a unique identifier for each object, and storing those objects in a flattened data structure. By default, `InMemoryCache` will attempt to use the commonly found primary keys of `id` and `_id` for the unique identifier if they exist along with `__typename` on an object.

If `id` and `_id` are not specified, or if `__typename` is not specified, `InMemoryCache` will fall back to the path to the object in the query, such as `ROOT_QUERY.allPeople.0` for the first record returned on the `allPeople` root query.
That would make data for given type scoped for `allPeople` query and other queries would have to fetch their own separate objects.

This "getter" behavior for unique identifiers can be configured manually via the `dataIdFromObject` option passed to the `InMemoryCache` constructor, so you can pick which field is used if some of your data follows unorthodox primary key conventions so it could be referenced by any query.

For example, if you wanted to key off of the `key` field for all of your data, you could configure `dataIdFromObject` like so:

```js
const cache = new InMemoryCache({
  dataIdFromObject: object => object.key || null
});
```

Note that Apollo Client doesn't add the type name to the cache key when you specify a custom `dataIdFromObject`, so if your IDs are not unique across all objects, you might want to include the `__typename` in your `dataIdFromObject`.

You can use different unique identifiers for different data types by keying off of the `__typename` property attached to every object typed by GraphQL.  For example:

```js
import { InMemoryCache, defaultDataIdFromObject } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  dataIdFromObject: object => {
    switch (object.__typename) {
      case 'foo': return object.key; // use `key` as the primary key
      case 'bar': return `bar:${object.blah}`; // use `bar` prefix and `blah` as the primary key
      default: return defaultDataIdFromObject(object); // fall back to default handling
    }
  }
});
```

### Automatic cache updates

Let's look at a case where just using the cache normalization results in the correct update to our store. Let's say we perform the following query:

```graphql
{
  post(id: '5') {
    id
    score
  }
}
```

Then, we perform the following mutation:

```graphql
mutation {
  upvotePost(id: '5') {
    id
    score
  }
}
```

If the `id` field on both results matches up, then the `score` field everywhere in our UI will be updated automatically! One nice way to take advantage of this property as much as possible is to make your mutation results have all of the data necessary to update the queries previously fetched. A simple trick for this is to use [fragments](/advanced/fragments/) to share fields between the query and the mutation that affects it.

## Direct Cache Access

To interact directly with your cache, you can use the Apollo Client class methods readQuery, readFragment, writeQuery, and writeFragment. These methods are available to us via the `DataProxy` interface. Accessing these methods will vary slightly based on your view layer implementation. If you are using React, you can wrap your component in the `withApollo` higher order component, which will give you access to `this.props.client`. From there, you can use the methods to control your data.

**Note**: The `cache` you created with `new InMemoryCache(...)` class is not meant to be used directly, but passed to the `ApolloClient` constructor. The client then accesses the `cache` using methods like `readQuery` and `writeQuery`. The difference between `cache.writeQuery` and `client.writeQuery` is that the client version also performs a broadcast after writing to the cache. This broadcast ensures your data is refreshed in the view layer after the `client.writeQuery` operation. If you only use `cache.writeQuery`, the changes may not be immediately reflected in the view layer. This behavior is sometimes useful in scenarios where you want to perform multiple cache writes without immediately updating the view layer.

Any code demonstration in the following sections will assume that we have already initialized an instance of  `ApolloClient` and that we have imported the `gql` tag from `graphql-tag`.

### readQuery

The `readQuery` method is very similar to the `query` method on `ApolloClient` except that `readQuery` will _never_ make a request to your GraphQL server. The `query` method, on the other hand, may send a request to your server if the appropriate data is not in your cache whereas `readQuery` will throw an error if the data is not in your cache. `readQuery` will _always_ read from the cache. You can use `readQuery` by giving it a GraphQL query like so:

```js
const { todo } = client.readQuery({
  query: gql`
    query ReadTodo {
      todo(id: 5) {
        id
        text
        completed
      }
    }
  `,
});
```

If all of the data needed to fulfill this read is in Apollo Client’s normalized data cache then a data object will be returned in the shape of the query you wanted to read. If not all of the data needed to fulfill this read is in Apollo Client’s cache then an error will be thrown instead, so make sure to only read data that you know you have!

You can also pass variables into `readQuery`.

```js
const { todo } = client.readQuery({
  query: gql`
    query ReadTodo($id: Int!) {
      todo(id: $id) {
        id
        text
        completed
      }
    }
  `,
  variables: {
    id: 5,
  },
});
```

Note that you should not modify the return value of `readQuery` because the same object may be reused between components.  If you want to update the data in the cache, create a new replacement object and pass it to `writeQuery`.

### readFragment

This method allows you great flexibility around the data in your cache. Whereas `readQuery` only allowed you to read data from your root query type, `readFragment` allows you to read data from _any node you have queried_. This is incredibly powerful. You use this method as follows:

```js
const todo = client.readFragment({
  id: ..., // `id` is any id that could be returned by `dataIdFromObject`.
  fragment: gql`
    fragment myTodo on Todo {
      id
      text
      completed
    }
  `,
});
```

The first argument is the id of the data you want to read from the cache. That id must be a value that was returned by the `dataIdFromObject` function you defined when initializing `ApolloClient`. So for example if you initialized `ApolloClient` like so:

```js
const client = new ApolloClient({
  ...,
  cache: new InMemoryCache({
    ...,
    dataIdFromObject: object => object.id,
  }),
});
```

…and you requested a todo before with an id of `5`, then you can read that todo out of your cache with the following:

```js
const todo = client.readFragment({
  id: '5',
  fragment: gql`
    fragment myTodo on Todo {
      id
      text
      completed
    }
  `,
});
```

> **Note:** Most people add a `__typename` to the id in `dataIdFromObject`. If you do this then don’t forget to add the `__typename` when you are reading a fragment as well. So for example your id may be `Todo_5` and not just `5`.

If a todo with that id does not exist in the cache you will get `null` back. If a todo of that id does exist in the cache, but that todo does not have the `text` field then an error will be thrown.

The beauty of `readFragment` is that the todo could have come from anywhere! The todo could have been selected as a singleton (`{ todo(id: 5) { ... } }`), the todo could have come from a list of todos (`{ todos { ... } }`), or the todo could have come from a mutation (`mutation { createTodo { ... } }`). As long as at some point your GraphQL server gave you a todo with the provided id and fields `id`, `text`, and `completed` you can read it from the cache at any part of your code.

### writeQuery and writeFragment

Not only can you read arbitrary data from the Apollo Client cache, but you can also write any data that you would like to the cache. The methods you use to do this are `writeQuery` and `writeFragment`. They will allow you to change data in your local cache, but it is important to remember that *they will not change any data on your server*. If you reload your environment then changes made with `writeQuery` and `writeFragment` will disappear.

These methods have the same signature as their `readQuery` and `readFragment` counterparts except they also require an additional `data` variable. So for example, if you wanted to update the `completed` flag locally for your todo with id `'5'` you could execute the following:

```js
client.writeFragment({
  id: '5',
  fragment: gql`
    fragment myTodo on Todo {
      completed
    }
  `,
  data: {
    completed: true,
  },
});
```

Any subscriber to the Apollo Client store will instantly see this update and render new UI accordingly.

> **Note:** Again, remember that using `writeQuery` or `writeFragment` only changes data *locally*. If you reload your environment then changes made with these methods will no longer exist.

Or if you wanted to add a new todo to a list fetched from the server, you could use `readQuery` and `writeQuery` together.

```js
const query = gql`
  query MyTodoAppQuery {
    todos {
      id
      text
      completed
    }
  }
`;

const data = client.readQuery({ query });

const myNewTodo = {
  id: '6',
  text: 'Start using Apollo Client.',
  completed: false,
  __typename: 'Todo',
};

client.writeQuery({
  query,
  data: {
    todos: [...data.todos, myNewTodo],
  },
});
```

## Recipes

Here are some common situations where you would need to access the cache directly. If you're manipulating the cache in an interesting way and would like your example to be featured, please send in a pull request!

### Bypassing the cache

Sometimes it makes sense to not use the cache for a specific operation. This can be done using either the `network-only` or `no-cache` fetchPolicy. The key difference between these two policies is that `network-only` still saves the response to the cache for later use, bypassing the reading and forcing a network request. The `no-cache` policy does not read, nor does it write to the cache with the response. This may be useful for sensitive data like passwords that you don't want to keep in the cache.

### Updating after a mutation

In some cases, just using `dataIdFromObject` is not enough for your application UI to update correctly. For example, if you want to add something to a list of objects without refetching the entire list, or if there are some objects that to which you can't assign an object identifier, Apollo Client cannot update existing queries for you. Read on to learn about the other tools at your disposal.

`refetchQueries` is the simplest way of updating the cache. With `refetchQueries` you can specify one or more queries that you want to run after a mutation is completed in order to refetch the parts of the store that may have been affected by the mutation:

```javascript
mutate({
  //... insert comment mutation
  refetchQueries: [{
    query: gql`
      query UpdateCache($repoName: String!) {
        entry(repoFullName: $repoName) {
          id
          comments {
            postedBy {
              login
              html_url
            }
            createdAt
            content
          }
        }
      }
    `,
    variables: { repoName: 'apollographql/apollo-client' },
  }],
})
```

Please note that if you call `refetchQueries` with an array of strings, then Apollo Client will look for any previously called queries that have the same names as the provided strings. It will then refetch those queries with their current variables.

A very common way of using `refetchQueries` is to import queries defined for other components to make sure that those components will be updated:

```javascript
import RepoCommentsQuery from '../queries/RepoCommentsQuery';

mutate({
  //... insert comment mutation
  refetchQueries: [{
    query: RepoCommentsQuery,
    variables: { repoFullName: 'apollographql/apollo-client' },
  }],
})
```

Using `update` gives you full control over the cache, allowing you to make changes to your data model in response to a mutation in any way you like. `update` is the recommended way of updating the cache after a query. It is explained in full [here](/api/react-apollo/#mutation).

```jsx
import CommentAppQuery from '../queries/CommentAppQuery';

const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(
      repoFullName: $repoFullName
      commentContent: $commentContent
    ) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`;

const CommentsPageWithMutations = () => (
  <Mutation mutation={SUBMIT_COMMENT_MUTATION}>
    {mutate => {
      <AddComment
        submit={({ repoFullName, commentContent }) =>
          mutate({
            variables: { repoFullName, commentContent },
            update: (store, { data: { submitComment } }) => {
              // Read the data from our cache for this query.
              const data = store.readQuery({ query: CommentAppQuery });
              // Add our comment from the mutation to the end.
              data.comments.push(submitComment);
              // Write our data back to the cache.
              store.writeQuery({ query: CommentAppQuery, data });
            }
          })
        }
      />;
    }}
  </Mutation>
);
```

### Incremental loading: `fetchMore`

`fetchMore` can be used to update the result of a query based on the data returned by another query. Most often, it is used to handle infinite-scroll pagination or other situations where you are loading more data when you already have some.

In our GitHunt example, we have a paginated feed that displays a list of GitHub repositories. When we hit the "Load More" button, we don't want Apollo Client to throw away the repository information it has already loaded. Instead, it should just append the newly loaded repositories to the list that Apollo Client already has in the store. With this update, our UI component should re-render and show us all of the available repositories.

Let's see how to do that with the `fetchMore` method on a query:

```javascript
const FEED_QUERY = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    currentUser {
      login
    }
    feed(type: $type, offset: $offset, limit: $limit) {
      id
      # ...
    }
  }
`;

const FeedWithData = ({ match }) => (
  <Query
    query={FEED_QUERY}
    variables={{
      type: match.params.type.toUpperCase() || "TOP",
      offset: 0,
      limit: 10
    }}
    fetchPolicy="cache-and-network"
  >
    {({ data, fetchMore }) => (
      <Feed
        entries={data.feed || []}
        onLoadMore={() =>
          fetchMore({
            variables: {
              offset: data.feed.length
            },
            updateQuery: (prev, { fetchMoreResult }) => {
              if (!fetchMoreResult) return prev;
              return Object.assign({}, prev, {
                feed: [...prev.feed, ...fetchMoreResult.feed]
              });
            }
          })
        }
      />
    )}
  </Query>
);
```


The `fetchMore` method takes a map of `variables` to be sent with the new query. Here, we're setting the offset to `feed.length` so that we fetch items that aren't already displayed on the feed. This variable map is merged with the one that's been specified for the query associated with the component. This means that other variables, e.g. the `limit` variable, will have the same value as they do within the component query.

It can also take a `query` named argument, which can be a GraphQL document containing a query that will be fetched in order to fetch more information; we refer to this as the `fetchMore` query. By default, the `fetchMore` query is the query associated with the container, in this case the `FEED_QUERY`.

When we call `fetchMore`, Apollo Client will fire the `fetchMore` query and use the logic in the `updateQuery` option to incorporate that into the original result. The named argument `updateQuery` should be a function that takes the previous result of the query associated with your component (i.e. `FEED_QUERY` in this case) and the information returned by the `fetchMore` query and return a combination of the two.

Here, the `fetchMore` query is the same as the query associated with the component. Our `updateQuery` takes the new feed items returned and just appends them onto the feed items that we'd asked for previously. With this, the UI will update and the feed will contain the next page of items!

Although `fetchMore` is often used for pagination, there are many other cases in which it is applicable. For example, suppose you have a list of items (say, a collaborative todo list) and you have a way to fetch items that have been updated after a certain time. Then, you don't have to refetch the whole todo list to get updates: you can just incorporate the newly added items with `fetchMore`, as long as your `updateQuery` function correctly merges the new results.

### The `@connection` directive

Fundamentally, paginated queries are the same as any other query with the exception that calls to `fetchMore` update the same cache key. Since these queries are cached by both the initial query and their parameters, a problem arises when later retrieving or updating paginated queries in the cache. We don’t care about pagination arguments such as limits, offsets, or cursors outside of the need to `fetchMore`, nor do we want to provide them simply for accessing cached data.

To solve this Apollo Client 1.6 introduced the `@connection` directive to specify a custom store key for results. A connection allows us to set the cache key for a field and to filter which arguments actually alter the query.

To use the `@connection` directive, simply add the directive to the segment of the query you want a custom store key for and provide the `key` parameter to specify the store key. In addition to the `key` parameter, you can also include the optional `filter` parameter, which takes an array of query argument names to include in the generated custom store key.

```js
const query = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    feed(type: $type, offset: $offset, limit: $limit) @connection(key: "feed", filter: ["type"]) {
      ...FeedEntry
    }
  }
`
```

With the above query, even with multiple `fetchMore`s, the results of each feed update will always result in the `feed` key in the store being updated with the latest accumulated values. In this example, we also use the `@connection` directive's optional `filter` argument to include the `type` query argument in the store key, which results in multiple store values that accumulate queries from each type of feed.

Now that we have a stable store key, we can easily use `writeQuery` to perform a store update, in this case clearing out the feed.

```js
client.writeQuery({
  query: gql`
    query Feed($type: FeedType!) {
      feed(type: $type) @connection(key: "feed", filter: ["type"]) {
        id
      }
    }
  `,
  variables: {
    type: "top",
  },
  data: {
    feed: [],
  },
});
```

Note that because we are only using the `type` argument in the store key, we don't have to provide `offset` or `limit`.

### Cache redirects with `cacheRedirects`

In some cases, a query requests data that already exists in the client store under a different key. A very common example of this is when your UI has a list view and a detail view that both use the same data. The list view might run the following query:

```graphql
query ListView {
  books {
    id
    title
    abstract
  }
}
```

When a specific book is selected, the detail view displays an individual item using this query:

```graphql
query DetailView {
  book(id: $id) {
    id
    title
    abstract
  }
}
```

> Note: The data returned by the list query has to include all the data the specific query needs. If the specific book query fetches a field that the list query doesn't return Apollo Client cannot return the data from the cache.

We know that the data is most likely already in the client cache, but because it's requested with a different query, Apollo Client doesn't know that. In order to tell Apollo Client where to look for the data, we can define custom resolvers:

```js
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  cacheRedirects: {
    Query: {
      book: (_, args, { getCacheKey }) =>
        getCacheKey({ __typename: 'Book', id: args.id })
    },
  },
});
```

> Note: This'll also work with custom `dataIdFromObject` methods as long as you use the same one.

Apollo Client will use the ID returned by the custom resolver to look up the item in its cache. `getCacheKey` is passed inside the third argument to the resolver to generate the key of the object based on its `__typename` and `id`.

To figure out what you should put in the `__typename` property run one of the queries in GraphiQL and get the `__typename` field:

```graphql
query ListView {
  books {
    __typename
  }
}

# or

query DetailView {
  book(id: $id) {
    __typename
  }
}
```

The value that's returned (the name of your type) is what you need to put into the `__typename` property.

It is also possible to return a list of IDs:

```js
cacheRedirects: {
  Query: {
    books: (_, args, { getCacheKey }) =>
      args.ids.map(id =>
        getCacheKey({ __typename: 'Book', id: id }))
  }
}
```

### Resetting the store

Sometimes, you may want to reset the store entirely, such as [when a user logs out](/recipes/authentication/#reset-store-on-logout). To accomplish this, use `client.resetStore` to clear out your Apollo cache. Since `client.resetStore` also refetches any of your active queries for you, it is asynchronous.

```js
export default withApollo(graphql(PROFILE_QUERY, {
  props: ({ data: { loading, currentUser }, ownProps: { client }}) => ({
    loading,
    currentUser,
    resetOnLogout: async () => client.resetStore(),
  }),
})(Profile));
```

To register a callback function to be executed after the store has been reset, call `client.onResetStore` and pass in your callback. If you would like to register multiple callbacks, simply call `client.onResetStore` again. All of your callbacks will be pushed into an array and executed concurrently.

In this example, we're using `client.onResetStore` to write our default values to the cache for [`apollo-link-state`](https://www.apollographql.com/docs/link/links/state). This is necessary if you're using `apollo-link-state` for local state management and calling `client.resetStore` anywhere in your application.

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { withClientState } from 'apollo-link-state';

import { resolvers, defaults } from './resolvers';

const cache = new InMemoryCache();
const stateLink = withClientState({ cache, resolvers, defaults });

const client = new ApolloClient({
  cache,
  link: stateLink,
});

client.onResetStore(stateLink.writeDefaults);
```

You can also call `client.onResetStore` from your React components. This can be useful if you would like to force your UI to rerender after the store has been reset.

If you would like to unsubscribe your callbacks from resetStore, use the return value of `client.onResetStore` for your unsubscribe function.

```js
import { withApollo } from "react-apollo";

export class Foo extends Component {
  constructor(props) {
    super(props);
    this.unsubscribe = props.client.onResetStore(
      () => this.setState({ reset: false })
    );
    this.state = { reset: false };
  }
  componentDidUnmount() {
    this.unsubscribe();
  }
  render() {
    return this.state.reset ? <div /> : <span />
  }
}

export default withApollo(Foo);
```

If you want to clear the store but don't want to refetch active queries, use
`client.clearStore()` instead of `client.resetStore()`.

### Server side rendering

First, you will need to initialize an `InMemoryCache` on the server and create an instance of `ApolloClient`. In the initial serialized HTML payload from the server, you should include a script tag that extracts the data from the cache. (The `.replace()` is necessary to prevent script injection attacks)

```js
`<script>
  window.__APOLLO_STATE__=${JSON.stringify(cache.extract()).replace(/</g, '\\u003c')}
</script>`
```

On the client, you can rehydrate the cache using the initial data passed from the server:

```js
cache: new Cache().restore(window.__APOLLO_STATE__)
```

If you would like to learn more about server side rendering, please check our our more in depth guide [here](/features/server-side-rendering/).

### Cache persistence

If you would like to persist and rehydrate your Apollo Cache from a storage provider like `AsyncStorage` or `localStorage`, you can use [`apollo-cache-persist`](https://github.com/apollographql/apollo-cache-persist). `apollo-cache-persist` works with all Apollo caches, including `InMemoryCache` & `Hermes`, and a variety of different [storage providers](https://github.com/apollographql/apollo-cache-persist#storage-providers).

To get started, simply pass your Apollo Cache and a storage provider to `persistCache`. By default, the contents of your Apollo Cache will be immediately restored asynchronously, and persisted upon every write to the cache with a short configurable debounce interval.

> Note: The `persistCache` method is async and returns a `Promise`.

```js
import { AsyncStorage } from 'react-native';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { persistCache } from 'apollo-cache-persist';

const cache = new InMemoryCache();

persistCache({
  cache,
  storage: AsyncStorage,
}).then(() => {
  // Continue setting up Apollo as usual.
})
```

For more advanced usage, such as persisting the cache when the app is in the background, and additional configuration options, please check the [README of `apollo-cache-persist`](https://github.com/apollographql/apollo-cache-persist).
