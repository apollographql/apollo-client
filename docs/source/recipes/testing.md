---
title: Testing React Apollo
description: Have peace of mind when using React Apollo in production
---

Running tests against code meant for production has long been a best practice. It provides additional security for the code that's already written, as well as prevents accidental regressions in the future. Components utilizing React Apollo are no exception.

Although React Apollo has a lot going on under the hood, the library provides multiple tools for testing that simplify those abstractions, and allows complete focus on the component logic. These testing utilities have long been used to test the React Apollo library itself, so you can trust in their stability and long-term support.

## An introduction

React Apollo relies on [context](https://reactjs.org/docs/context.html) in order to pass the Apollo Client instance through the React component tree. In addition, React Apollo makes network requests in order to fetch data. This behavior affects how you write tests for components that use React Apollo.

This guide will explain step-by-step how you can test your React Apollo code. The following examples will be using the [Jest](https://facebook.github.io/jest/docs/en/tutorial-react.html) testing framework, but most concepts should be reusable with other libraries. These examples aim to use as simple of a toolset as possible, so React's [test renderer](https://reactjs.org/docs/test-renderer.html) will be used in place of something like [Enzyme](https://github.com/airbnb/enzyme).

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

If we ran this test, we would get an error because Apollo Client isn't available on the context for the `Query` component to consume.

In order to fix this we could wrap the component in an `ApolloProvider` and pass an instance of Apollo Client to the `client` prop. However, this will cause our tests to run against an actual backend which makes the tests very unpredictable for the following reasons:

* The server could be down
* There may be no network connection
* The results are not guaranteed to be the same for every query

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

## MockedProvider

To test the component in true isolation, we can mock all calls to the GraphQL endpoint. This makes the UI consistent every time tests are run, since they don't depend on any remote data.

React Apollo provides the `MockedProvider` component in the `react-apollo/test-utils` library to do just that! `MockedProvider` allows us to specify the exact results that should be returned for a certain query using the `mocks` prop.

Here's an example of a test for the above `Dog` component using `MockedProvider`:

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

This example shows how to define the mocked response for a query. The `mocks` array takes objects with specific `request`s and their associated `result`s. In this example, when the provider receives a `GET_DOG_QUERY` with the specified variables, it returns the object under the `result` key.

### addTypename

You may notice the prop being passed to the `MockedProvider` called `addTypename`. The reason this is here is because of how Apollo Client normally works. When a request is made with Apollo Client normally, it adds a `__typename` field to every object type requested. This is to make sure that Apollo Client's cache knows how to normalize and store the response. When we're making our mocks, though, we're importing the raw queries _without typenames_ from the component files.

If we don't disable the adding of typenames to queries, our imported query won't match the query actually being run by the component during our tests.

> In short, If you don't have `__typename`s in your queries, pass `addTypename={false}` to your `MockedResolver`s.

## Testing loading states

In this example, the `Dog` component will render, but it will render in a loading state, not the final response state. This is because `MockedProvider` doesn't just return the data. It returns a promise that will resolve to that data. This allows testing of loading states as well as the final state.

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

This example shows how to (very basically) test loading state of a component. Here, all we're checking is that the children of the component contain the text `Loading...`. In real apps, this test would probably be more complicated, but the testing logic would be the same.

## Testing final state

Loading state, while important, isn't the only thing to test. To test the final state of the component after receiving data, we can just wait for it to update and test the final state.

```js
const wait = require('waait');

it('should render currency conversions', async () => {
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

Here, you can see the `await wait(0)` line. This is a util function from a npm package called `waait`.This artificially adds a delay, and allows time for that promise returned from `MockedProvider` to resolve. After that promise resolves, we can check the component to make sure it displays the correct information (in this case, "Buck is a poodle").

## Testing error states

Error states are one of the most important states to test, since they can make or break the experience a user has when interacting with the app.

Error states are also tested less in development. Since most developers would follow the "happy path" and not encounter these states as often, it's almost _more_ important to test these states to prevent accidental regressions.

To simulate a GraphQL error, all you have to do is pass an `error` to your mock instead of (or in addition to) the `result`.

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

Here, whenever your `MockProvider` receives a `GET_DOG_QUERY` with matching variables, it will return a GraphQL error. This forces the component into the error state, allowing us to verify that it's handling the error gracefully.

## Testing mutation components

`Mutation` components are tested very similarly to `Query` components. The only key difference is how the operation is fired. With `Query` components, the query is fired when the component mounts. With `Mutation` components, the mutation is fired manually, usually after some user interaction like pressing a button.

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

This example looks very similar to the `Query` component. The difference comes after the render. Since this component relies on a button to be clicked to fire a mutation, we first use the renderer's API to find that button.

After we find the button, we can manually call the `onClick` prop to that button, simulating a user clicking the button. This click fires off the mutation, and then the rest is tested identically to the `Query` component.

For example, to test for a successful mutation, you'd just wait for the promise to resolve from `MockedProvider` and check for any confirmation message in your UI, just like the `Query` component:

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

Testing UI components isn't a simple issue, but hopefully with these tools, you can feel more confident when testing components dependent on data.

For a working example showing how to test components, check out this example on CodeSandbox:

[![Edit React-Apollo Testing](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/40k7j708n4)

<!-- Refer to the [docs](../api/react-apollo.html#MockedProvider) for more information on the API for `<MockedProvider />`. -->
