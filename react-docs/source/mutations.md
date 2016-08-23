---
title: Modifying data on the server
order: 4
---

In addition to fetching data using queries, Apollo also handles [GraphQL mutations](link-to-guide). Mutation strings are identical to query strings in syntax, the only difference being that you use the keyword `mutation` instead of `query` to indicate that the operation is used to change the dataset behind the schema. Basically, a query is the GraphQL equivalent of an HTTP GET and a mutation is the equivalent of an HTTP POST.

```js
mutation {
  submitRepository(repoFullName: "apollostack/apollo-client") {
    id
    createdAt
  }
}
```

GraphQL mutations consist of two parts:

1. The mutation name with arguments (`submitRepository`), which represents the actual operation to be done on the server
2. The fields you want back from the result of the mutation to update the client (`id` and `createdAt`)

The result of the above mutation might be be:

```
{
  "data": {
    "submitRepository": {
      "id": "123",
      "createdAt": 12345.43
    }
  }
}
```

When we use mutations in Apollo typically result is integrated into the cache automatically [based on the id of the result](link-to-cache-section), which is reflected in your UI automatically, and we don't explicitly handle the results ourselves. However, querying the fields that may have changed is important.

<h2 id="basics">Basic Mutations</h2>


Using `graphql` with mutations makes it easy to bind actions to components. Unlike queries, mutations provide only a simple prop (the `mutate` function) to the wrapped component.

```js
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

const NewEntry = function({ mutate }) { ... };

const SUBMIT_RESPOSITORY_MUTATION = gql`
  mutation submitRepository {
    submitRepository(repoFullName: "apollostack/apollo-client") {
      createdAt
    }
  }
`;

const withSubmitRepositoryMutation = graphql(SUBMIT_RESPOSITORY_MUTATION);
const NewEntryWithData = withSubmitRepositoryMutation(NewEntry);
```

The callback takes all the arguments

<h3 id="calling-mutations">Calling mutations</h3>

Most mutations will require arguments in the form of query variables, and you may wish to provide other options to [ApolloClient#mutate](apollo-client-api.html#mutate). You can directly pass options to `mutate` when you call it in the wrapped component:

```js
import React from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

const NewEntry = function({ mutate }) {
  const onClick = () => {
    mutate({ variables: { repoFullName: 'apollostack/apollo-client' } })
      .then(({ data }) => {
        console.log('got data', data);
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });      
  }

  return <div onClick={onClick}>Click me</div>;
};

const SUBMIT_RESPOSITORY_MUTATION = gql`
  mutation submitRepository($repoFullName: String!) {
    submitRepository(repoFullName: "apollostack/apollo-client") {
      createdAt
    }
  }
`;

const withSubmitRepositoryMutation = graphql(SUBMIT_RESPOSITORY_MUTATION);
const NewEntryWithData = withSubmitRepositoryMutation(NewEntry);
```

However, typically you'd want to keep the concern of understanding the mutation's structure out of your presentational component. The best way to do this is to use the [`props`](queries.html#graphql-props) argument to bind your mutate function:

```js
const NewEntry = function({ submit }) {
  return <div onClick={submit('apollostack/apollo-client')}>Click me</div>;
});

const SUBMIT_RESPOSITORY_MUTATION = /* as above */;

const withSubmitRepositoryMutation = graphql(SUBMIT_RESPOSITORY_MUTATION, {
  props({ mutate }) {
    return {
      submit(repoFullName) {
        return mutate({ variables: { repoFullName } });
      },
    };
  },
});
const NewEntryWithData = withSubmitRepositoryMutation(NewEntry);
```

> Note that in general you shouldn't attempt to use the results from the mutation callback directly, instead you can rely on Apollo's id-based cache updating to take care of it for you, or if necessary passing a [`updateQueries`](cache-updates.html#updateQueries) callback to update the result of relevant queries with your mutation results.

<h2 id="optimistic-ui">Optimistic UI</h2>

Sometimes your client code can easily predict the result of the mutation, if it succeeds, even before the server responds with the result. For instance, in GitHunt, when a user comments on a repository, we want to show the new comment in context immediately, without waiting on the latency of a round trip to the server, giving the user the experience of a snappy UI. This is what we call [Optimistic UI](http://info.meteor.com/blog/optimistic-ui-with-meteor-latency-compensation). This is possible if the client can predict an *Optimistic Response* for the mutation.

Apollo Client gives you a way to specify the `optimisticResponse` option, that will be used to update active queries immediately, in the same way that the server's mutation response will. Once the actual mutation response returns, the optimistic part will be thrown away and replaced with the real result.

```js
import React from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

const commentPage = function({ submit }) { ... };

const SUBMIT_COMMENT_MUTATION = gql`
  mutation submitComment($repoFullName: String!, $commentContent: String!) {
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

const withSubmitCommentMutation = graphql(SUBMIT_COMMENT_MUTATION, {
  props: ({ ownProps, mutate }) => ({
    submit({ repoFullName, commentContent }) {
      return mutate({
        variables: { repoFullName, commentContent },
        optimisticResponse: {
          __typename: 'Mutation',
          submitComment: {
            __typename: 'Comment',
            // Note that we can access the props of the container at `ownProps`
            postedBy: ownProps.currentUser,
            createdAt: +new Date,
            content: commentContent,
          },
        },
      };
    });
  }),
});
```

For the example above, it is easy to construct an optimistic response, since we know the shape of the new comment and can approximately predict the created date. The optimistic response doesn't have to be exactly correct because it will always will be replaced with the real result from the server, but it should be close enough to make users feel like there is no delay.

<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty nice if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In GraphQL itself, there isn't any specification about how this is supposed to work. In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the new array.

In many cases, it's beneficial to have the mutation result return the _parent_ of the new object, so that the client developer can decide what data they need to update. For example, if a todo list has a computed field for the number of tasks, inserting a new task might update that as well, meaning it might be good to have the mutation return a `TodoList` type rather than a `Task` type.

Sometimes, you might need to define a new type just for the result of a specific mutation. For example, in the todo list case, it might make sense for the result of the mutation to have two fields, and include _both_ the inserted task and the associated todo list. That way, the client can more easily refetch related data.
