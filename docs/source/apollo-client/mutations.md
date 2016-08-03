---
title: Mutations
order: 103
description: How to run mutations to modify data with Apollo Client.
---

In addition to fetching data using queries, the Apollo Client also handles GraphQL mutations. Mutation strings are identical to query strings in syntax, the only difference is that you use the keyword `mutation` instead of `query` to indicate that the operation is used to change the dataset behind the schema. Basically, a query is the GraphQL equivalent of an HTTP GET and a mutation is the equivalent of an HTTP POST.

```js
mutation {
  createUser(name: "Jane Doe", email: "jane@apollostack.com") {
    id
    name
  }
}
```

GraphQL mutations consist of two parts:

1. The mutation name with arguments (`createUser`), which represents the actual operation to be done on the server
2. The fields you want back from the result of the mutation to update the client (`id` and `name`)

The result of the above mutation would be:

```
{
  "data": {
    "createUser": {
      "id": "123",
      "name": "Jane Doe"
    }
  }
}
```

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


<h2 id="updating-query-results">Updating Query results</h2>

In Apollo Client, there is a special system that allows mutations to update the results of the active queries. Active queries are bound to your UI components via `watchQuery` or any of the view integrations. These UI components will automatically re-render as updated queries are updated.


<h3 id="new-object-or-updated-fields">Updated Fields</h3>

In cases when your mutation returns a new value for an existing object with some fields updated, you might avoid writing any queries updating code at all. As long as your instance of Apollo Client has [`dataIdFromObject`](/apollo-client/index.html#ApolloClient) option defined, the occurrences of the object (matching by the generated id) in the active queries will be updated automatically without any extra code.

For example, say you have a query with a flat list of `TodoList`s. Later, after editing the name of one of lists, the mutation `changeTodoListName(list_id: ID!, name: String!)` was fired. If `changeTodoListName` mutation returns the `TodoList` object with the same id and updated fields, then it will be incorporated into store and updated in active queries automatically.


<h3 id="update-queries">Updating query results with `updateQueries`</h3>

Depending on how complicated are your queries, the logic incorporating the mutation result could be sophisticated.

For example, let's say you have a mutation `addNewTask(text: String!, list_id: ID!)` that adds a new task of type `Task` to a `TodoList` currently displayed on the screen. In this example, to update a query with the new task returned by the mutation, it is required to insert the new task into the correct place in the list of tasks.

For cases like these, use the special option `updateQueries`. `updateQueries` is a mapping from query name to a reducer function to update that query. The query name goes between the `query` keyword and the declaration of variables (in the example below it is `todos`).

---

The `updateQueries` functions are similar to [Redux](http://redux.js.org/docs/basics/Reducers.html) reducers. This means that they:

- must return an updated query result that incorporates the result of the mutation
- must avoid mutating the arguments and should return new objects instead
- should have no side effects
- should take the following form:


```
(previousQueryResult, { mutationResult, queryVariables }) => updatedQueryResult
```

Each reducer function accepts the old result of the query, the `mutationResult`, and optionally a `queryVariables` object that contains the variables that were passed into the original query. `queryVariables` is useful when you have multiple queries of the same name but with different variables and you only want to update a certain one (i.e. fetching multiple todo lists with different id's).

<h3 id="example">Example</h3>

Let's say we have the following query that is fetching a list of `todos`:

```js
client.watchQuery({
  query: gql`
    query todos($id: ID!) {
      todo_list(id: $id) {
        id
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
    id: '123',
  },
});
```

We can then call the following mutation to add an item to the list and update the query result:

```js
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
      if (queryVariables.id !== '123') {
        // this isn't the query we updated, so just return the previous result
        return previousQueryResult
      }
      // otherwise, create a new object with the same shape as the
      // previous result with the mutationResult incorporated
      const originalList = previousQueryResult.todo_list;
      const newTask = mutationResult.data.addNewTask
      return {
        todo_list: {
          ...originalList,
          tasks: [...originalList.tasks, newTask]
        }
      };
    },
  },
});
```

If there are multiple active queries of the same name, the reducer function will be run for each one of them. In the example above, you can see how we used the `queryVariables` to check the id passed into the original query and update the correct list. Alternatively, if the field you want to check isn't a part of the `queryVariables`, you can also check the previous result itself:

```js
(previousQueryResult, { mutationResult }) => {
  if (previousQueryResult.todo_list.id !== '123') {
    return previousQueryResult
  }
  ...
}
```

<h2 id="optimistic-results">Optimistic Results</h2>

Sometimes your client code can easily predict the result of the mutation, if it succeeds, even before the server responds with the result. When a user clicks a button "add new task", you want to add the new task to the list immediately, without waiting on the latency of a round trip to the server, giving the users the feeling of a snappy UI. This is what we call [Optimistic UI](http://info.meteor.com/blog/optimistic-ui-with-meteor-latency-compensation). This is possible if the client can predict an *Optimistic Response* for the mutation.

Apollo Client gives you a way to specify the `optimisticResponse` option, that will be used to update active queries immediately. Once the actual mutation response returns, the optimistic part will be thrown away and replaced with the real result.

For the example above, it is easy to construct an optimistic response, since we know the text field of the new task, we know that it is created not completed, and can approximately predict the created date. The optimistic response doesn't have to be exactly correct because it will always will be replaced with the real result from the server. But it should be close enough to make users feel like there is no delay.

```js
client.mutate({
  mutation: ...,
  variables: ...,
  updateQueries: ...,
  optimisticResponse: {
    id: generatedId,
    text: text,
    createdAt: +(new Date),
    completed: false,
  },
});
```


<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty nice if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In GraphQL itself, there isn't any specification about how this is supposed to work. In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the new array.

In many cases, it's beneficial to have the mutation result return the _parent_ of the new object, so that the client developer can decide what data they need to update. For example, if a todo list has a computed field for the number of tasks, inserting a new task might update that as well, meaning it might be good to have the mutation return a `TodoList` type rather than a `Task` type.

Sometimes, you might need to define a new type just for the result of a specific mutation. For example, in the todo list case, it might make sense for the result of the mutation to have two fields, and include _both_ the inserted task and the associated todo list. That way, the client can more easily refetch related data.
