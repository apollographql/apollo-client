---
title: Mutations
---

In addition to fetching data using queries, Apollo also helps you handle GraphQL mutations. In GraphQL, mutations are identical to queries in syntax, the only difference being that you use the keyword `mutation` instead of `query` to indicate that the root fields on this query are going to be performing writes to the backend.

```js
mutation {
  submitRepository(repoFullName: "apollographql/apollo-client") {
    id
    repoName
  }
}
```

GraphQL mutations represent two things in one query string:

1. The mutation field name with arguments, `submitRepository`, which represents the actual operation to be done on the server.
2. The fields you want back from the result of the mutation to update the client, in this case `{ id, repoName }`.

The above mutation will submit a new GitHub repository to GitHunt, saving an entry to the database. The result might be:

```
{
  "data": {
    "submitRepository": {
      "id": "123",
      "repoName": "apollographql/apollo-client"
    }
  }
}
```

When we use mutations in Apollo, the result is typically integrated into the cache automatically [based on the id of the result](cache-updates.html#dataIdFromObject), which in turn updates the UI automatically, so we often don't need to explicitly handle the results. In order for the client to correctly do this, we need to ensure we select the necessary fields in the result. One good strategy can be to simply ask for any fields that might have been affected by the mutation. Alternatively, you can use [fragments](fragments.html) to share the fields between a query and a mutation that updates that query.

<h2 id="basics">Basic mutations</h2>

Using `graphql` with mutations makes it easy to bind actions to your components. Unlike queries, which provide a complicated object with lots of metadata and methods, mutations provide only a simple function to the wrapped component, in a prop called `mutate`.

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

class NewEntry extends Component { ... }

const submitRepository = gql`
  mutation submitRepository {
    submitRepository(repoFullName: "apollographql/apollo-client") {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

If we were to write `propTypes` for the component above, they would look like:

```js
NewEntry.propTypes = {
  mutate: PropTypes.func.isRequired,
};
```

<h2 id="calling-mutations">Calling mutations</h2>

Most mutations will require arguments in the form of query variables, and you may wish to also provide other options as well. [See the complete set of mutation options in the API docs.](api-mutations.html#graphql-mutation-options)

The simplest option is to directly pass options to the default `mutate` prop when you call it in the wrapped component:

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

class NewEntry extends Component {
  onClick() {
    this.props.mutate({
      variables: { repoFullName: 'apollographql/apollo-client' }
    })
      .then(({ data }) => {
        console.log('got data', data);
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });
  }

  render() {
    return <div onClick={this.onClick.bind(this)}>Click me</div>;
  }
}

const submitRepository = gql`
  mutation submitRepository($repoFullName: String!) {
    submitRepository(repoFullName: $repoFullName) {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

<h3 id="custom-arguments">Custom arguments</h3>

While the above approach with the default prop works just fine, typically you'd want to keep the concern of formatting the mutation options out of your presentational component. The best way to do this is to use the [`props`](api-graphql.html#graphql-config-props) config to wrap the mutation in a function that accepts exactly the arguments it needs:

```js
const NewEntryWithData = graphql(submitRepository, {
  props: ({ mutate }) => ({
    submit: (repoFullName) => mutate({ variables: { repoFullName } }),
  }),
})(NewEntry);
```

Here's that in context with a component, which can now be much simpler because it just needs to pass one argument:

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

const NewEntry = ({ submit }) => (
  <div onClick={() => submit('apollographql/apollo-client')}>
    Click me
  </div>
);

const submitRepository = gql`...`; // Same query as above

const NewEntryWithData = graphql(submitRepository, {
  props: ({ mutate }) => ({
    submit: (repoFullName) => mutate({ variables: { repoFullName } }),
  }),
})(NewEntry);
```

Note that, in general, you don't need to use the results from the mutation callback directly. Instead you should usually rely on Apollo's id-based cache updating to take care of it for you. If that doesn't cover your needs, there are [several different options for updating the store after a mutation](cache-updates.html). That way, you can keep your UI components as stateless and declarative as possible.

<h2 id="multiple-mutations">Multiple mutations</h2>

If you need more than one mutation on a component, you make a graphql container for each:

```js
const ComponentWithMutations =
  graphql(submitNewUser, { name: 'newUserMutation' })(
    graphql(submitRepository, { name: 'newRepositoryMutation' })(Component)
  )
```

Make sure to use the [`name` option on the `graphql()` container](api-graphql.html#graphql-config-name) to name the provided prop, so that the two containers don't both try to name their function `mutate`.

If you want a better syntax for the above, consider using [`compose`](api-graphql.html#compose):

```js
import { compose } from 'react-apollo';

const ComponentWithMutations = compose(
  graphql(submitNewUser, { name: 'newUserMutation' }),
  graphql(submitRepository, { name: 'newRepositoryMutation' })
)(Component);
```

This does the exact same thing as the previous snippet, but with a nicer syntax that flattens things out.

<h2 id="optimistic-ui">Optimistic UI</h2>

Sometimes your client code can easily predict the result of a successful mutation even before the server responds with the result. For instance, in GitHunt, when a user comments on a repository, we want to show the new comment in the UI immediately, without waiting on the latency of a round trip to the server, giving the user a faster UI experience. This is what we call [Optimistic UI](optimistic-ui.html). This is possible with Apollo if the client can predict an *optimistic response* for the mutation.

All you need to do is specify the `optimisticResponse` option. This "fake result" will be used to update active queries immediately, in the same way that the server's mutation response would have done. The optimistic patches are stored in a separate place in the cache, so once the actual mutation returns, the relevant optimistic update is automatically thrown away and replaced with the real result.

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

class CommentPage extends Component { ... }
CommentPage.propTypes = {
  submit: PropTypes.func.isRequired,
};

const submitComment = gql`
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

const CommentPageWithData = graphql(submitComment, {
  props: ({ ownProps, mutate }) => ({
    submit: ({ repoFullName, commentContent }) => mutate({
      variables: { repoFullName, commentContent },

      optimisticResponse: {
        __typename: 'Mutation',
        submitComment: {
          __typename: 'Comment',
          // Note that we can access the props of the container at `ownProps` if we
          // need that information to compute the optimistic response
          postedBy: ownProps.currentUser,
          createdAt: +new Date,
          content: commentContent,
        },
      },
    });
  }),
})(CommentPage);
```

For the example above, it is easy to construct an optimistic response, since we know the shape of the new comment and can approximately predict the created data. The optimistic response doesn't have to be exactly correct because it will always will be replaced with the real result from the server, but it should be close enough to make users feel like there is no delay.

<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty elegant if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the whole array.

<h2 id="update-after-mutation">Store updates</h2>

Most of the time it is not necessary to tell Apollo which parts of the cache to update, but if your mutation is creating a new object or deleting something, you will need to write some extra logic. Read about it in the [article about updating the store](cache-updates.html).

For more information about all of the options and features supported by React Apollo for GraphQL mutations be sure to review the [API reference on `graphql()` mutations](api.html#mutations).
