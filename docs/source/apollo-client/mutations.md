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

Send a mutation to the server and get the result. The result is also incorporated into the store, updating any queries registered with `watchQuery` that are interested in the changed objects. Returns a promise that resolves to a GraphQLResult, or throws an [`ApolloError`](queries.html#ApolloError).

- `mutation: string` The mutation to send to the server.
- `variables: Object` The variables to send along with the mutation.
- `fragments: FragmentDefinition[]` An array of fragment definitions, as returned by `createFragment`. [Learn more on the fragments page.](fragments.html)


Here's how you would call a mutation and pass in arguments via variables:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();

client.mutate({
  mutation: gql`
    mutation ($text: String!, $list_id: ID!) {
      addNewTask(text: $text, list_id: $list_id) {
        id
        text
        completed
        createdAt
      }
    }
  `,
  variables: {
    text: 'walk the dog',
    list_id: '123',
  },
}).then(({ data }) => {
  console.log('got data', data);
}).catch((error) => {
  console.log('there was an error sending the query', error);
});
```

Mutations can get a bit verbose because you often need to pass in variables for a lot of different arguments, and those need to be declared in several places. This is inherent to the design of GraphQL itself, but future versions of Apollo Client may contain helpers to reduce the necessary boilerplate. In an ideal world, GraphQL itself would make variable type declarations optional.


<h2 id="updating-queries-results">Updating Query results</h2>

In Apollo Client, there is a special system that allows mutations to update the results of the active queries. Active queries are bound to your UI components via `watchQuery` or any of the view integrations. These UI components will automatically re-render as updated queries are updated.

<h3 id="update-queries">Updating query results with `updateQueries`</h3>

Depending on how complicated are your queries, the logic incorporating the mutation result could be sophisticated.

For example, let's say you have a mutation `addNewTask(text: String!, list_id: ID!)` that adds a new task of type `Task` to a `TodoList` currently displayed on the screen. In this example, to update a query with the new task returned by the mutation, it is required to insert the new task into the correct place in the list of tasks.

For cases like these, use the special option `updateQueries`. `updateQueries` is a mapping from query name to a reducer function.

Each reducer function accepts the old result of the query and the new information such that the mutation result. The job of the reducer function is to return a new query result.

```js

client.watchQuery({
  query: gql`
    query todos($list_id: ID!) {
      todo_list(id: $list_id) {
        title
        tasks {
          id
          text
          completed
          createdAt
        }
      }
    }
  `,
  variables: {
    list_id: '123',
  },
});

client.mutate({
  mutation: gql`
    mutation ($text: String!, $list_id: ID!) {
      addNewTask(text: $text, list_id: $list_id) {
        id
        text
        completed
        createdAt
      }
    }
  `,
  variables: {
    text: 'walk the dog',
    list_id: '123',
  },
  updateQueries: {
    todos: (previousQueryResult, { mutationResult, queryVariables }) => {
      return {
        title: previousQueryResult.title,
        tasks: [...previousQueryResult.tasks, mutationResult],
      };
    },
  },
});
```

The `updateQueries` reducer functions are similar to [Redux](http://redux.js.org/docs/basics/Reducers.html) reducers, if you are familiar with Redux.

This means that reducer functions:
- must return an updated query result that incorporates `mutationResult`
- must avoid mutating the arguments, such that previous query result, and prefer cloning
- should have no side effects

<h3 id="new-object-or-updated-fields">New Object Or Updated Fields</h3>

In cases when your mutation returns either a completely new object (with a uniquely new `id`) or a new value for an existing object with some fields updated, you might avoid writing any queries updating code at all.

If the new object doesn't appear in any relations to other objects, and the Apollo Client has [`dataIdFromObject`](/apollo-client/index.html#ApolloClient) option defined, the occurrences of the object in the active queries will be updated automatically without any extra code.

For example, say you have a query with a flat list list of `TodoList`s. Later, after clicking a "new todo-list" button the mutation `createNewTodoList(name: String!)` was fired. If `createNewTodoList` mutation returns a new `TodoList` object, then it will be incorporated into store and updated in active queries automatically.


<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty nice if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In GraphQL itself, there isn't any specification about how this is supposed to work. In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the new array.

In many cases, it's beneficial to have the mutation result return the _parent_ of the new object, so that the client developer can decide what data they need to update. For example, if a todo list has a computed field for the number of tasks, inserting a new task might update that as well, meaning it might be good to have the mutation return a `TodoList` type rather than a `Task` type.

Sometimes, you might need to define a new type just for the result of a specific mutation. For example, in the todo list case, it might make sense for the result of the mutation to have two fields, and include _both_ the inserted task and the associated todo list. That way, the client can more easily refetch related data.
