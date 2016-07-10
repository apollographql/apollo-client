---
title: Mutations
order: 103
description: How to run mutations to modify data with Apollo Client.
---

In addition to fetching data using queries, the Apollo Client also handles GraphQL mutations. GraphQL mutations consist of two parts:

1. The root field with arguments, which represents the actual operation to be done on the server
2. The rest of the query, which describes the results to fetch to update the client

Apollo Client handles both of these requirements.

<h2 id="mutate" title="ApolloClient#mutate">ApolloClient#mutate(options)</h2>

Send a mutation to the server and get the result. The result is also incorporated into the store, updating any queries registered with `watchQuery` that are interested in the changed objects. Returns a promise that resolves to a GraphQLResult.

- `mutation: string` The mutation to send to the server.
- `variables: Object` The variables to send along with the mutation.
- `fragments: FragmentDefinition[]` An array of fragment definitions, as returned by `createFragment`. [Learn more on the fragments page.](fragments.html)


Here's how you would call a mutation and pass in arguments via variables:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();

client.mutate({
  mutation: gql`
    mutation postReply($topic_id: ID!, $category_id: ID!, $raw: String!) {
      createPost(topic_id: $topic_id, category: $category_id, raw: $raw) {
        id
        cooked
      }
    }
  `,
  variables: {
    topic_id: '123',
    category_id: '456',
    raw: 'This is the post text.',
  }
}).then((graphQLResult) => {
  const { errors, data } = graphQLResult;

  if (data) {
    console.log('got data', data);
  }

  if (errors) {
    console.log('got some GraphQL execution errors', errors);
  }
}).catch((error) => {
  console.log('there was an error sending the query', error);
});
```

Mutations can get a bit verbose because you often need to pass in variables for a lot of different arguments, and those need to be declared in several places. This is inherent to the design of GraphQL itself, but future versions of Apollo Client may contain helpers to reduce the necessary boilerplate. In an ideal world, GraphQL itself would make variable type declarations optional.

<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty nice if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In GraphQL itself, there isn't any specification about how this is supposed to work. In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the new array.

In many cases, it's beneficial to have the mutation result return the _parent_ of the new object, so that the client developer can decide what data they need to update. For example, if a todo list has a computed field for the number of tasks, inserting a new task might update that as well, meaning it might be good to have the mutation return a `TodoList` type rather than a `Task` type.

Sometimes, you might need to define a new type just for the result of a specific mutation. For example, in the todo list case, it might make sense for the result of the mutation to have two fields, and include _both_ the inserted task and the associated todo list. That way, the client can more easily refetch related data.

<h2 id="mutation-behaviors">Mutation behaviors</h2>

In Apollo Client, there is a special system for handling mutation results and incorporating them back into the store. Then, any queries you have bound to your UI components via `watchQuery` or any of the view integrations will automatically update.

This section is still under construction, the tests can give some indication of how it works: [apollo-client/test/mutationResults](https://github.com/apollostack/apollo-client/blob/22f038de8d64c50f86aa152714288f51dd674ac9/test/mutationResults.ts)

<h3 id="update-fields">Default: update fields</h3>

...

<h3 id="ARRAY_INSERT">ARRAY_INSERT</h3>

...

<h3 id="ARRAY_INSERT">DELETE</h3>

...

<h3 id="ARRAY_INSERT">ARRAY_DELETE</h3>

...

<h3 id="custom-behaviors">Custom mutation behaviors</h3>

...
