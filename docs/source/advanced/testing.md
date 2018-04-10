---
title: Testing
description: Testing react-apollo
---

React-apollo relies on [context](https://reactjs.org/docs/context.html) in order to pass the apollo-client instance through the react component tree. In addition, react-apollo makes network requests in order to fetch data. This behavior affects how you write tests for components that use react-apollo.

This guide will explain step-by-step how you can test your react-apollo code.

Consider the example below:

```js
import gql from "graphql-tag";
import { Query } from "react-apollo";

const GET_DOG = gql`
  query getDog($name: String) {
    dog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const Dog = ({ name }) => (
  <Query query={GET_DOG} variables={{ name }}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <div>
          {data.dog.name} has breed {data.dog.breed}
        </div>
      );
    }}
  </Query>
);
```

If we were to try and write a test for it then you will get an error that the `client` is missing in the context.

```js
//broken because of a missing apollo-client in the context
test("it shows a dog", () => {
  render(<Dog name="Buck" />);
  expect(dogsToBePresent);
});
```

In order to fix this we could wrap the component in an `<ApolloProvider />` and pass an instance of apollo-client to the `client` prop. However, this will cause our tests to run against an actual back-end which makes the tests very unpredictable for the following reasons:

* The server could be down
* No network connection
* The results are not guaranteed to be the same for every query.

```js
// Not predictable
test("it shows a dog", () => {
  render(
    <ApolloProvider client={client}>
      <Dog name="Buck" />
    </ApolloProvider>
  );
  expect(dogsToBePresent);
});
```

In order to test the component in isolation we need to mock out all the calls to the backend. This will make our tests predictable. Rect-apollo provides the `<MockedProvider />` component in order to do just that! `<MockedProvider />` allows you to specify the exact results that should be returned for a certain query using the `mocks` prop.

Let's see how we can write the example using this component:

First we need to export the `GET_DOG` query that we are sending to the graphQL API:

```js
// Export the query
export const GET_DOG = gql`
query getDog($name: String) {
  dog(name: $name) {
    id
    name
    breed
  }
}
`;

export const Dog = (...)
```

Next, we go to our test file and define the mocked result that should be returned for the query. Mocks is an array that takes an object with specific request and the associated result.

```js
import { GET_DOG, Dog } from "./dog";

const mocks = [
  {
    request: {
      query: GET_DOG,
      variables: {
        name: "Buck"
      }
    },
    result: {
      data: {
        dog: {
          id: "1",
          name: "Buck",
          breed: "bulldog"
        }
      }
    }
  }
];

test("it shows a dog", () => {
  render(
    <MockedProvider mocks={mocks}>
      <Dog name="Buck" />
    </MockedProvider>
  );

  //Fails because react-apollo will initially show a loading state
  expect(dogsToBePresent);
});
```

Despite having mocked the request the above test will still fail. Due to the asynchronous nature of react-apollo the loading state will be rendered instead of the dog name.

In order to overcome this issue we advise you separate the react-apollo components from presentational components and test these independently.

Let's see how we can refactor the code to improve testability.

```js
export const GET_DOG = gql`
query getDog($name: String) {
  dog(name: $name) {
    id
    name
    breed
  }
}
`;

// The react-apollo component
export const DogQuery = ({ children, name }) => (
  <Query query={GET_DOG} variables={{name}}>
    {({ loading, error, data }) =>
      children({
        loading,
        error,
        dog: data && data.dog
      })
    }
  </Query>
);

// The presentational component
export const DogInterface = props => {
  const { loading, error, dog } = props;
  if (loading) return "Loading...";
  if (error) return `Error! ${error.message}`;

  return <div>{dog.name} has breed {dog.breed}</div>;
};

// Connecting the components together.
export const Dog = props => (
  <DogQuery name={props.name}>{result => <DogInterface {...result} />}</DogInterface>
);
```

Let's go back to our test file and see how we can test the `<DogQuery />` component.

```js
import { GET_DOG, DogQuery } from "./dog";

const expectedRequest = {
  query: GET_DOG,
  name: "Buck"
}

const mocks = [
  {
    request: expectedRequest,
    result: {
      data: {
        dog: {
          id: "1",
          name: "Buck",
          breed: "bulldog"
        }
      }
    }
  }
];

describe("dog with query", () => {
  it("renders a loading and then dog", done => {
    let renderCount = 0;

    render(
      <MockedProvider mocks={mocks}>
        <DogQuery name="Buck">
          {result => {
            if (renderCount === 0) {
              // The first render has the loading state
              expect(result.loading).toBe(true);
              expect(result.dog).toBe(undefined);
            }
            else if (renderCount === 1) {
              // The second render has the data.
              expect(result.loading).toBe(false);
              expect(result.dog).toEqual({
                dog: {
                  id: "1",
                  name: "Buck",
                  breed: "bulldog"
                }
              });
              done()
            }

            renderCount++;

            return null;
          }}
        </DogWithQuery>
      </MockedProvider>
    );
  });

  it("renders an error", done => {
    //<MockedProvider /> can also be used to test error states.
    const mocksWithError = [
      {
        request: expectedRequest,
        error: new Error('Something went wrong'),
      },
    ];

    let renderCount = 0;

    render(
        <MockedProvider mocks={mocksWithError}>
          <DogQuery name="Buck">
            {result => {
              // Second render has the error state
              if (renderCount === 1) {
                expect(result).toEqual({
                  error: new Error('Network error: Something went wrong'),
                  loading: false,
                });
                done();
              }

              renderCount++;
              return null;
            }}
          </HeroQuery>
        </MockedProvider>
    );
  })
});
```

Next, let's test the `<DogInterface />` component:

```js
describe("<DogInterface />", () => {
  it("renders the dog", () => {
    const dog = {
      id: "1"
      name: "Buck",
      breed: "bulldog"
    };

    render(<DogInterface dog={dog} />);
    expect(dogToBeShown);
  });

  it("renders a loading state", () => {
    render(<DogInterface loading={true} />);
    expect(loadingToBeShown);
  });

  it("renders an error state", () => {
    render(<DogInterface error={new Error("Something went wrong")} />);
    expect(errorToBeShown);
  });
});
```

Finally, we need to test that the `<Dog />` component has correctly connected the `<DogQuery />` and `<DogInterface />` together.

```js
it("renders <Dog />", () => {
  render(
    <MockedProvider mocks={mocks}>
      <Dog />
    </MockedProvider>
  );
  
  expect(loadingToBeShown);
});
```

We have now successfully tested the code!

In case you want some more information, we have created an [example repo](https://github.com/apollographql/react-apollo/tree/master/examples/components) that illustrates how you can use the techniques outlined in this guide to test your components.
