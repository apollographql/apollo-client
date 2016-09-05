---
title: Mutations
order: 11
---

In addition to fetching data using queries, Apollo also handles GraphQL mutations. Mutations are identical to queries in syntax, the only difference being that you use the keyword `mutation` instead of `query` to indicate that the operation is used to change the dataset behind the schema.

```js
mutation {
  submitRepository(repoFullName: "apollostack/apollo-client") {
    id
    repoName
  }
}
```

GraphQL mutations consist of two parts:

1. The mutation name with arguments (`submitRepository`), which represents the actual operation to be done on the server
2. The fields you want back from the result of the mutation to update the client (`id` and `repoName`)

The result of the above mutation might be be:

```
{
  "data": {
    "submitRepository": {
      "id": "123",
      "repoName": "apollostack/apollo-client"
    }
  }
}
```

When we use mutations in Apollo, the result is typically integrated into the cache automatically [based on the id of the result](cache-updates.html#dataIdFromObject), which in turn updates UI automatically, so we don't explicitly handle the results ourselves. In order for the client to correctly do this, we need to ensure we select the correct fields (as in all the fields that we care about that may have changed).

<h2 id="basics">Basic Mutations</h2>


Using `graphql` with mutations makes it easy to bind actions to components. Unlike queries, mutations provide only a simple prop (the `mutate` function) to the wrapped component.

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

class NewEntry extends Component { ... }
NewEntry.propTypes = {
  mutate: PropTypes.func.isRequired,
};

const submitRepository = gql`
  mutation submitRepository {
    submitRepository(repoFullName: "apollostack/apollo-client") {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

<h3 id="calling-mutations">Calling mutations</h3>

Most mutations will require arguments in the form of query variables, and you may wish to provide other options to [ApolloClient#mutate](/core/apollo-client-api.html#mutate). You can directly pass options to `mutate` when you call it in the wrapped component:

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

class NewEntry extends Component {
  onClick() {
    this.props.mutate({ variables: { repoFullName: 'apollostack/apollo-client' } })
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
NewEntry.propTypes = {
  mutate: PropTypes.func.isRequired,
};

const submitRepository = gql`
  mutation submitRepository {
    submitRepository(repoFullName: "apollostack/apollo-client") {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

However, typically you'd want to keep the concern of understanding the mutation's structure out of your presentational component. The best way to do this is to use the [`props`](queries.html#graphql-props) argument to bind your mutate function:

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

class NewEntry extends Component {
  render() {
    return <div onClick={this.props.submit('apollostack/apollo-client')}>Click me</div>;
  }
}
NewEntry.propTypes = {
  submit: PropTypes.func.isRequired,
};

const submitRepository = /* as above */;

const NewEntryWithData = graphql(submitRepository, {
  props({ mutate }) {
    return {
      submit(repoFullName) {
        return mutate({ variables: { repoFullName } });
      },
    };
  },
})(NewEntry);
```

> Note that in general you shouldn't attempt to use the results from the mutation callback directly, instead you can rely on Apollo's id-based cache updating to take care of it for you, or if necessary passing a [`updateQueries`](cache-updates.html#updateQueries) callback to update the result of relevant queries with your mutation results.

<h2 id="optimistic-ui">Optimistic UI</h2>

Sometimes your client code can easily predict the result of the mutation, if it succeeds, even before the server responds with the result. For instance, in GitHunt, when a user comments on a repository, we want to show the new comment in context immediately, without waiting on the latency of a round trip to the server, giving the user the experience of a snappy UI. This is what we call [Optimistic UI](http://info.meteor.com/blog/optimistic-ui-with-meteor-latency-compensation). This is possible if the client can predict an *Optimistic Response* for the mutation.

Apollo Client gives you a way to specify the `optimisticResponse` option, that will be used to update active queries immediately, in the same way that the server's mutation response will. Once the actual mutation response returns, the optimistic part will be thrown away and replaced with the real result.

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import { gql } from 'graphql-tag';

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
})(CommentPage);
```

For the example above, it is easy to construct an optimistic response, since we know the shape of the new comment and can approximately predict the created date. The optimistic response doesn't have to be exactly correct because it will always will be replaced with the real result from the server, but it should be close enough to make users feel like there is no delay.

> As this comment is *new* and not visible in the UI before the mutation, it won't appear automatically on the screen as a result of the mutation. You can use [`updateQueries`](cache-updates.html#updateQueries) to make it appear in this case (and this is what we do in GitHunt).

<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty nice if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In GraphQL itself, there isn't any specification about how this is supposed to work. In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the new array.
