---
title: Updating the Store
---

Apollo performs two important core tasks: Executing queries and mutations, and caching the results.

Thanks to Apollo's store design, it's possible for the results of a query or mutation to update your UI in all the right places. In many cases it's possible for that to happen automatically, whereas in others you need to help the client out a little in doing so.

## Normalization with `dataIdFromObject`

Apollo does result caching based on two things:

1. The shape of GraphQL queries and their results.
2. The identities of the objects returned from the server.

Flattening out the cache based on object identity is referred to as cache normalization. You can read about our caching model in detail in our blog post, ["GraphQL Concepts Visualized"](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3).

By default, Apollo identifies objects based on two properties: The `__typename` and an ID field, either `id` or `_id`. The client automatically adds the `__typename` field to your queries, so you just have to make sure to fetch the `id` field if you have one.

```js
// This result
{
  __typename: 'Person',
  id: '1234',
  name: 'Jonas',
}

// Will get the following ID
'Person:1234'
```

You can also specify a custom function to generate IDs from each object, and supply it as the `dataIdFromObject` in the [`InMemoryCache` constructor](/advanced/caching/#configuration), if you want to specify how Apollo will identify and de-duplicate the objects returned from the server.

```js
import { InMemoryCache } from 'apollo-cache-inmemory';

// If your database has unique IDs across all types of objects, you can use
// a very simple function!
const cache = new InMemoryCache({
  dataIdFromObject: o => o.id
});
```

These IDs allow Apollo Client to reactively tell all queries that fetched a particular object about updates to that part of the store.

If you want to get the dataIdFromObjectFunction (for instance when using the [`readFragment` function](LINK PLZ)), you can import it from the InMemoryCache package;

```js
import { defaultDataIdFromObject } from 'apollo-cache-inmemory';
const person = {
  __typename: 'Person',
  id: '1234',
};

defaultDataIdFromObject(person); // 'Person:1234'
```

### Automatic store updates

Let's look at a case where just using the cache normalization results in the correct update to our store. Let's say we do the following query:

```graphql
{
  post(id: '5') {
    id
    score
  }
}
```

Then, we do the following mutation:

```graphql
mutation {
  upvotePost(id: '5') {
    id
    score
  }
}
```

If the `id` field on both results matches up, then the `score` field everywhere in our UI will be updated automatically! One nice way to take advantage of this property as much as possible is to make your mutation results have all of the data necessary to update the queries previously fetched. A simple trick for this is to use [fragments](/advanced/fragments/) to share fields between the query and the mutation that affects it.

## Updating after a mutation

In some cases, just using `dataIdFromObject` is not enough for your application UI to update correctly. For example, if you want to add something to a list of objects without refetching the entire list, or if there are some objects that to which you can't assign an object identifier, Apollo Client cannot update existing queries for you. Read on to learn about the other tools at your disposal.

### `refetchQueries`

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

### `update`

Using `update` gives you full control over the cache, allowing you to make changes to your data model in response to a mutation in any way you like. `update` is the recommended way of updating the cache after a query. It is explained in full [here](/api/react-apollo/#optionsupdate).

```javascript
import CommentAppQuery from '../queries/CommentAppQuery';

const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`;

const CommentsPageWithMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  props({ ownProps, mutate }) {
    return {
      submit({ repoFullName, commentContent }) {
        return mutate({
          variables: { repoFullName, commentContent },

          update: (store, { data: { submitComment } }) => {
            // Read the data from our cache for this query.
            const data = store.readQuery({ query: CommentAppQuery });
            // Add our comment from the mutation to the end.
            data.comments.push(submitComment);
            // Write our data back to the cache.
            store.writeQuery({ query: CommentAppQuery, data });
          },
        });
      },
    };
  },
})(CommentsPage);
```

### `updateQueries`

**NOTE: We recommend using the more flexible `update` API instead of `updateQueries`. The `updateQueries` API may be deprecated in the future.**

As its name suggests, `updateQueries` lets you update your UI based on the result of a mutation. To re-emphasize: most of the time, your UI will update automatically based on mutation results, as long as the object IDs in the result match up with the IDs you already have in your store. See the [`normalization`](#normalization-with-dataidfromobject) documentation above for more information about how to take advantage of this feature.

However, if you are removing or adding items to a list with a mutation or can't assign object identifiers to the relevant objects, you'll have to use `updateQueries` to make sure that your UI reflects the change correctly.

We'll take the comments page within GitHunt as our example. When we submit a new comment, the "submit" button fires a mutation which adds a new comment to the "list" of the comments held on the server. In reality, the server doesn't know there's a list--it just knows that something is added to the `comments` table in SQL--so the server can't really tell us exactly where to put the result. The original query that fetched the comments for the list also doesn't know about this new comment yet, so Apollo can't automatically add it to the list for us.

In this case, we can use `updateQueries` to make sure that query result is updated, which will also update Apollo's normalized store to make everything remain consistent.

If you're familiar with Redux, think of the `updateQueries` option as a reducer, except instead of updating the store directly we're updating the query result shape, which means we don't have to worry about how the store internals work.

We expose this mutation through a function prop that the `CommentsPage` component can call. This is what the code looks like:

```javascript
import update from 'immutability-helper';

const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`;

const CommentsPageWithMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  props({ ownProps, mutate }) {
    return {
      submit({ repoFullName, commentContent }) {
        return mutate({
          variables: { repoFullName, commentContent },

          updateQueries: {
            Comment: (prev, { mutationResult }) => {
              const newComment = mutationResult.data.submitComment;

              return update(prev, {
                entry: {
                  comments: {
                    $unshift: [newComment],
                  },
                },
              });
            },
          },
        });
      },
    };
  },
})(CommentsPage);
```

If we were to look carefully at the server schema, we'd see that the mutation actually returns information about the single new comment that was added; it doesn't refetch the whole list of comments. This makes a lot of sense: if we have a thousand comments on a page, we don't want to refetch all of them if we add a single new comment.

The comments page itself is rendered with the following query:

```javascript
const COMMENT_QUERY = gql`
  query Comment($repoName: String!) {
    currentUser {
      login
      html_url
    }

    entry(repoFullName: $repoName) {
      id
      postedBy {
        login
        html_url
      }
      createdAt
      comments {
        postedBy {
          login
          html_url
        }
        createdAt
        content
      }
      repository {
        full_name
        html_url
        description
        open_issues_count
        stargazers_count
      }
    }
  }`;
```

Now, we have to incorporate the newly added comment returned by the mutation into the information that was already returned by the `COMMENT_QUERY` that was fired when the page was loaded. We accomplish this through `updateQueries`. Zooming in on that portion of the code:

```javascript
mutate({
  //...
  updateQueries: {
    Comment: (prev, { mutationResult }) => {
      const newComment = mutationResult.data.submitComment;
      return update(prev, {
        entry: {
          comments: {
            $unshift: [newComment],
          },
        },
      });
    },
  },
})
```

Fundamentally, `updateQueries` is a map going from the name of a query (in our case, `Comment`) to a function that receives the previous result that this query received as well as the result returned by the mutation. In our case, the mutation returns information about the new comment. This function should then incorporate the mutation result into a new object containing the result previously received by the query (`prev`) and return that new object.

Note that the function must not alter the `prev` object (because `prev` is compared with the new object returned to see what changes the function made and hence what prop updates are needed).

In our `updateQueries` function for the `Comment` query, we're doing something really simple: just adding the comment we just submitted to the list of comments that the query asks for. We're doing that using the `update` function from the [immutability-helper](https://github.com/kolodny/immutability-helper) package, just to do it concisely. But, if you wanted to, you could write some no-helper Javascript to combine the two incoming objects into a new one for the result.

Once the mutation fires and the result arrives from the server (or, a result is provided through optimistic UI), our `updateQueries` function for the `Comment` query will be called and the `Comment` query will be updated accordingly. These changes in the result will be mapped to React props and our UI will update as well with the new information!

## Incremental loading: `fetchMore`

`fetchMore` can be used to update the result of a query based on the data returned by another query. Most often, it is used to handle infinite-scroll pagination or other situations where you are loading more data when you already have some.

In our GitHunt example, we have a paginated feed that displays a list of GitHub repositories. When we hit the "Load More" button, we don't want Apollo Client to throw away the repository information it has already loaded. Instead, it should just append the newly loaded repositories to the list that Apollo Client already has in the store. With this update, our UI component should re-render and show us all of the available repositories.

Let's see how to do that with the `fetchMore` method on a query:

```javascript
const FeedQuery = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    # ...
  }`;

const FeedWithData = graphql(FeedQuery, {
  props({ data: { loading, feed, currentUser, fetchMore } }) {
    return {
      loading,
      feed,
      currentUser,
      loadNextPage() {
        return fetchMore({
          variables: {
            offset: feed.length,
          },

          updateQuery: (previousResult, { fetchMoreResult }) => {
            if (!fetchMoreResult) { return previousResult; }

            return Object.assign({}, previousResult, {
              feed: [...previousResult.feed, ...fetchMoreResult.feed],
            });
          },
        });
      },
    };
  },
})(Feed);
```

We have two components here: `FeedWithData` and `Feed`. The `FeedWithData` container implementation produces the `props` to be passed to the presentational `Feed` component. Specifically, we're mapping the `loadNextPage` prop to the following:

```js
return fetchMore({
  variables: {
    offset: feed.length,
  },
  updateQuery: (prev, { fetchMoreResult }) => {
    if (!fetchMoreResult.data) { return prev; }
    return Object.assign({}, prev, {
      feed: [...prev.feed, ...fetchMoreResult.feed],
    });
  },
});
```

The `fetchMore` method takes a map of `variables` to be sent with the new query. Here, we're setting the offset to `feed.length` so that we fetch items that aren't already displayed on the feed. This variable map is merged with the one that's been specified for the query associated with the component. This means that other variables, e.g. the `limit` variable, will have the same value as they do within the component query.

It can also take a `query` named argument, which can be a GraphQL document containing a query that will be fetched in order to fetch more information; we refer to this as the `fetchMore` query. By default, the `fetchMore` query is the query associated with the container, in this case the `FEED_QUERY`.

When we call `fetchMore`, Apollo Client will fire the `fetchMore` query and use the logic in the `updateQuery` option to incorporate that into the original result. The named argument `updateQuery` should be a function that takes the previous result of the query associated with your component (i.e. `FEED_QUERY` in this case) and the information returned by the `fetchMore` query and return a combination of the two.

Here, the `fetchMore` query is the same as the query associated with the component. Our `updateQuery` takes the new feed items returned and just appends them onto the feed items that we'd asked for previously. With this, the UI will update and the feed will contain the next page of items!

Although `fetchMore` is often used for pagination, there are many other cases in which it is applicable. For example, suppose you have a list of items (say, a collaborative todo list) and you have a way to fetch items that have been updated after a certain time. Then, you don't have to refetch the whole todo list to get updates: you can just incorporate the newly added items with `fetchMore`, as long as your `updateQuery` function correctly merges the new results.

### The `@connection` directive

Fundamentally, paginated queries are the same as any other query with the exception that calls to `fetchMore` update the same cache key. Since these queries are cached by both the initial query and their parameters, a problem arises when later retrieving or updating paginated queries in the cache. We don’t care about pagination arguments such as limits, offsets, or cursors outside of the need to `fetchMore`, nor do we want to provide them simply for accessing cached data.

To solve this Apollo Client 1.6 introduced the `@connection` directive to specify a custom store key for results. A connection allows us to set the cache key for a field and to filter which arguments actually alter the query.

To have a stable cache location for query results, Apollo Client 1.6 introduced the `@connection` directive, which can be used to specify a custom store key for results. To use the `@connection` directive, simply add the directive to the segment of the query you want a custom store key for and provide the `key` parameter to specify the store key. In addition to the `key` parameter, you can also include the optional `filter` parameter, which takes an array of query argument names to include in the generated custom store key.

```js
const query = gql`query Feed($type: FeedType!, $offset: Int, $limit: Int) {
  feed(type: $type, offset: $offset, limit: $limit) @connection(key: "feed", filter: ["type"]) {
    ...FeedEntry
  }
}`
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

## Cache redirects with `cacheResolvers`

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
import { toIdValue } from 'apollo-utilities';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  cacheResolvers: {
    Query: {
      book: (_, args) => toIdValue(cache.config.dataIdFromObject({ __typename: 'Book', id: args.id })),
    },
  },
});
```

> Note: This'll also work with custom `dataIdFromObject` methods as long as you use the same one.

Apollo Client will use the return value of the custom resolver to look up the item in its cache. `toIdValue` must be used to indicate that the value returned should be interpreted as an id, and not as a scalar value or an object. "Query" key in this example is your root query type name.

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
cacheResolvers: {
  Query: {
    books: (_, args) => args.ids.map(id =>
      toIdValue(cache.config.dataIdFromObject({ __typename: 'Book', id: id }))),
  },
},
```

## Resetting the store

Sometimes, you may want to reset the store entirely, such as [when a user logs out](/recipes/authentication/#reset-store-on-logout). To accomplish this, use `client.resetStore` to clear out your Apollo cache. Since `client.resetStore` also refetches any of your active queries for you, it is asynchronous.

```js
export default withApollo(graphql(PROFILE_QUERY, {
  props: ({ data: { loading, currentUser }, client }) => ({
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
