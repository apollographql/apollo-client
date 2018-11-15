---
title: Testing React components
description: Have peace of mind when using react-apollo in production
---

Running tests against code meant for production has long been a best practice. It provides additional security for the code that's already written, and prevents accidental regressions in the future. Components utilizing `react-apollo`, the React implementation of Apollo Client, are no exception.

Although `react-apollo` has a lot going on under the hood, the library provides multiple tools for testing that simplify those abstractions, and allows complete focus on the component logic. These testing utilities have long been used to test the `react-apollo` library itself, so they will be supported long-term.

## An introduction

The `react-apollo` library relies on [context](https://reactjs.org/docs/context.html) in order to pass the `ApolloClient` instance through the React component tree. In addition, `react-apollo` makes network requests in order to fetch data. This behavior affects how tests should be written for components that use `react-apollo`.

This guide will explain step-by-step how to test `react-apollo` code. The following examples use the [Jest](https://facebook.github.io/jest/docs/en/tutorial-react.html) testing framework, but most concepts should be reusable with other libraries. These examples aim to use as simple of a toolset as possible, so React's [test renderer](https://reactjs.org/docs/test-renderer.html) will be used in place of React-specific tools like [Enzyme](https://github.com/airbnb/enzyme) and [react-testing-library](https://github.com/kentcdodds/react-testing-library).

Consider the component below, which makes a basic query, and displays its results:

```js
import React from 'react';
import gql from 'graphql-tag';
import { Query } from 'react-apollo';

// Make sure the query is also exported -- not just the component
export const GET_DOG_QUERY = gql`
  query getDog($name: String) {
    dog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const Dog = ({ name }) => (
  <Query query={GET_DOG_QUERY} variables={{ name }}>
    {({ loading, error, data }) => {
      if (loading) return 'Loading...';
      if (error) return `Error!`;

      return (
        <p>
          {data.dog.name} is a {data.dog.breed}
        </p>
      );
    }}
  </Query>
);
```

Given this component, let's try to render it inside a test, just to make sure there are no render errors:

```js
// Broken because it's missing Apollo Client in the context
it('should render without error', () => {
  renderer.create(<Dog name="Buck" />);
});
```

This test would produce an error because Apollo Client isn't available on the context for the `Query` component to consume.

In order to fix this we could wrap the component in an `ApolloProvider` and pass an instance of Apollo Client to the `client` prop. However, this will cause the tests to run against an actual backend which makes the tests very unpredictable for the following reasons:

- The server could be down.
- There may be no network connection.
- The results are not guaranteed to be the same for every query.

```js
// Not predictable
it('renders without error', () => {
  renderer.create(
    <ApolloProvider client={client}>
      <Dog name="Buck" />
    </ApolloProvider>,
  );
});
```

## `MockedProvider`

The `react-apollo/test-utils` module exports a `MockedProvider` component which simplifies the testing of React components by mocking calls to the GraphQL endpoint.  This allows the tests to be run in isolation and provides consistent results on every run by removing the dependence on remote data.

By using this `MockedProvider` component, it's possible to specify the exact results that should be returned for a certain query using the `mocks` prop.  

Here's an example of a test for the above `Dog` component using `MockedProvider`, which shows how to define the mocked response for `GET_DOG_QUERY`:

```js
// dog.test.js

import { MockedProvider } from 'react-apollo/test-utils';

// The component AND the query need to be exported
import { GET_DOG_QUERY, Dog } from './dog';

const mocks = [
  {
    request: {
      query: GET_DOG_QUERY,
      variables: {
        name: 'Buck',
      },
    },
    result: {
      data: {
        dog: { id: '1', name: 'Buck', breed: 'bulldog' },
      },
    },
  },
];

it('renders without error', () => {
  renderer.create(
    <MockedProvider mocks={mocks} addTypename={false}>
      <Dog name="Buck" />
    </MockedProvider>,
  );
});
```

The `mocks` array takes objects with specific `request`s and their associated `result`s.  When the provider receives a `GET_DOG_QUERY` with matching `variables`, it returns the corresponding object from the `result` key.

### `addTypename`

You may notice the prop being passed to the `MockedProvider` called `addTypename`. The reason this is here is because of how Apollo Client normally works. When a request is made with Apollo Client normally, it adds a `__typename` field to every object type requested. This is to make sure that Apollo Client's cache knows how to normalize and store the response. When we're making our mocks, though, we're importing the raw queries _without typenames_ from the component files.

If we don't disable the adding of typenames to queries, the imported query won't match the query actually being run by the component during our tests.

> In short, if queries are lacking `__typename`, it's important to pass the `addTypename={false}` prop to the `MockedProvider`s.

## Testing loading states

In this example, the `Dog` component will render, but it will render in a loading state, not the final response state. This is because `MockedProvider` doesn't just return the data but instead returns a `Promise` that will resolve to that data.  By using a `Promise` it enables testing of the loading state in addition to the final state:

```js
it('should render loading state initially', () => {
  const component = renderer.create(
    <MockedProvider mocks={[]}>
      <Dog />
    </MockedProvider>,
  );

  const tree = component.toJSON();
  expect(tree.children).toContain('Loading...');
});
```

This shows a basic example test that tests the loading state of a component by checking that the children of the component contain the text `Loading...`. In an actual application, this test would probably be more complicated, but the testing logic would be the same.

## Testing final state

Loading state, while important, isn't the only thing to test. To test the final state of the component after receiving data, we can just wait for it to update and test the final state.

```js
const wait = require('waait');

it('should render dog', async () => {
  const dogMock = {
    request: {
      query: GET_DOG_QUERY,
      variables: { name: 'Buck' },
    },
    result: {
      data: { dog: { id: 1, name: 'Buck', breed: 'poodle' } },
    },
  };

  const component = renderer.create(
    <MockedProvider mocks={[dogMock]} addTypename={false}>
      <Dog name="Buck" />
    </MockedProvider>,
  );

  await wait(0); // wait for response

  const p = component.root.findByType('p');
  expect(p.children).toContain('Buck is a poodle');
});
```

Here, you can see the `await wait(0)` line. This is a utility function from the [`waait`](https://npm.im/waait) npm package. It delays until the next "tick" of the event loop, and allows time for that `Promise` returned from `MockedProvider` to be fulfilled. After that `Promise` resolves (or rejects), the component can be checked to ensure it displays the correct information — in this case, "Buck is a poodle".

For more complex UI with heavy calculations, or delays added into its render logic, the `wait(0)` will not be long enough. In these cases, you could either increase the wait time or use a package like [`wait-for-expect`](https://npm.im/wait-for-expect) to delay until the render has happened. The risk of using a package like this everywhere by default is that _every_ test could take up to five seconds to execute (or longer if the default timeout has been increased).

## Testing error states

Since they can make or break the experience a user has when interacting with the app, error states are one of the most important states to test, but are often less tested in development.

Since most developers would follow the "happy path" and not encounter these states as often, it's almost _more_ important to test these states to prevent accidental regressions.

To simulate a network error, an `error` property can be included on the mock, in place of or in addition to the `result`.

```js
it('should show error UI', async () => {
  const dogMock = {
    request: {
      query: GET_DOG_QUERY,
      variables: { name: 'Buck' },
    },
    error: new Error('aw shucks'),
  };

  const component = renderer.create(
    <MockedProvider mocks={[dogMock]} addTypename={false}>
      <Dog name="Buck" />
    </MockedProvider>,
  );

  await wait(0); // wait for response

  const tree = component.toJSON();
  expect(tree.children).toContain('Error!');
});
```

Here, whenever the `MockedProvider` receives a `GET_DOG_QUERY` with matching `variables`, it will return the error assigned to the `error` property in the mock. This forces the component into the error state, allowing verification that it's being handled gracefully.

To simulate GraphQL errors, simply define `errors` along with any data in your result.

```js
const dogMock = {
  // ...
  result: {
    errors: [{ message: "Error!" }],
  },
};
```

## Testing mutation components

`Mutation` components are tested very similarly to `Query` components. The only key difference is how the operation is fired. On a `Query` component, the query is fired when the component _mounts_, whereas with `Mutation` components, the mutation is fired manually, usually after some user interaction like pressing a button.

Consider this component that calls a mutation:

```js
export const DELETE_DOG_MUTATION = gql`
  mutation deleteDog($name: String!) {
    deleteDog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const DeleteButton = () => (
  <Mutation mutation={DELETE_DOG_MUTATION}>
    {(mutate, { loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error!</p>;
      if (data) return <p>Deleted!</p>;

      return (
        <button onClick={() => mutate({ variables: { name: 'Buck' } })}>
          Click me to Delete Buck!
        </button>
      );
    }}
  </Mutation>
);
```

Testing an initial render for this component looks identical to testing our `Query` component.

```js
import DeleteButton, { DELETE_DOG_MUTATION } from './delete-dog';

it('should render without error', () => {
  renderer.create(
    <MockedProvider mocks={[]}>
      <DeleteButton />
    </MockedProvider>,
  );
});
```

Calling the mutation is where things get interesting:

```js
it('should render loading state initially', () => {
  const deleteDog = { name: 'Buck', breed: 'Poodle', id: 1 };
  const mocks = [
    {
      request: {
        query: DELETE_DOG_MUTATION,
        variables: { name: 'Buck' },
      },
      result: { data: { deleteDog } },
    },
  ];

  const component = renderer.create(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DeleteButton />
    </MockedProvider>,
  );

  // find the button and simulate a click
  const button = component.root.findByType('button');
  button.props.onClick(); // fires the mutation

  const tree = component.toJSON();
  expect(tree.children).toContain('Loading...');
});
```

This example looks very similar to the `Query` component, but the difference comes after the rendering is completed. Since this component relies on a button to be clicked to fire a mutation, the renderer's API is used to find the button.

After a reference to the button has been obtained, a "click" on the button can be simulated by calling its `onClick` handler. This will fire off the mutation, and then the rest will be tested identically to the `Query` component.

> Note: Other test utilities like [Enzyme](https://github.com/airbnb/enzyme) and [react-testing-library](https://github.com/kentcdodds/react-testing-library) have built-in tools for finding elements and simulating events, but the concept is the same: find the button and simulate a click on it.

To test for a successful mutation after simulating the click, the fulfilled `Promise` from `MockedProvider` can be checked for the appropriate confirmation message, just like the `Query` component:

```js
it('should delete and give visual feedback', async () => {
  const deleteDog = { name: 'Buck', breed: 'Poodle', id: 1 };
  const mocks = [
    {
      request: {
        query: DELETE_DOG_MUTATION,
        variables: { name: 'Buck' },
      },
      result: { data: { deleteDog } },
    },
  ];

  const component = renderer.create(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DeleteButton />
    </MockedProvider>,
  );

  // find the button and simulate a click
  const button = component.root.findByType('button');
  button.props.onClick(); // fires the mutation

  await wait(0);

  const tree = component.toJSON();
  expect(tree.children).toContain('Deleted!');
});
```

For the sake of simplicity, the error case for mutations hasn't been shown here, but testing `Mutation` errors is exactly the same as testing `Query` errors: just add an `error` to the mock, fire the mutation, and check the UI for error messages.

Testing UI components isn't a simple issue, but hopefully these tools will create confidence when testing components that are dependent on data.

For a working example showing how to test components, check out this project on CodeSandbox:

[![Edit React-Apollo Testing](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/40k7j708n4)

<!-- Refer to the [docs](../api/react-apollo.html#MockedProvider) for more information on the API for `<MockedProvider />`. -->
