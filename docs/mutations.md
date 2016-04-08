# Mutations

In addition to fetching data using queries, the Apollo Client also handles GraphQL mutations. Current support for mutations is relatively basic, just letting you send a mutation and then incorporate the result into the store.

## API

### ApolloClient#mutate(options)

Send a mutation to the server and get the result. The result is also incorporated into the store, updating any queries registered with `watchQuery` that are interested in the changed objects. Returns a promise that resolves to a GraphQLResult.

- `mutation: string` The mutation to send to the server.
- `variables: Object` The variables to send along with the mutation.

## Examples

Calling a mutation and passing arguments via variables:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();

client.mutate({
  mutation: `
    mutation postReply(
      $token: String!
      $topic_id: ID!
      $category_id: ID!
      $raw: String!
    ) {
      createPost(
        token: $token
        topic_id: $topic_id
        category: $category_id
        raw: $raw
      ) {
        id
        cooked
      }
    }
  `,
  variables: {
    token: 'asdf',
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

Right now, this is a bit verbose because you have to list the names of the variables three times, but we hope to improve this in the future.
