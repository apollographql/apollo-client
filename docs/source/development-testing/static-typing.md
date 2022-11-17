---
title: Using Apollo with TypeScript
---

As your application grows, you may find it helpful to include a type system to assist in development. Apollo supports type definitions for TypeScript out of the box. Apollo Client ships with definitions in its associated npm package, so installation should be done for you after the libraries are included in your project.

These docs assume you already have TypeScript configured in your project, if not start [here](https://github.com/Microsoft/TypeScript-React-Conversion-Guide#typescript-react-conversion-guide).

The most common need when using type systems with GraphQL is to type the results of an operation. Given that a GraphQL server's schema is strongly typed, we can generate TypeScript definitions automatically using a tool like [GraphQL Code Generator](https://www.the-guild.dev/graphql/codegen).

Below, we'll guide you through installing and configuring GraphQL Code Generator to generate types for your hooks and components.

## Setting up your project

To get started using GraphQL Code Generator, we'll begin by installing the following packages (using Yarn or NPM):

```bash
yarn add -D typescript @graphql-codegen/cli @graphql-codegen/client-preset
```

Next, we'll create a configuration file for GraphQL Code Generator, named [`codegen.ts`](https://www.the-guild.dev/graphql/codegen/docs/config-reference/codegen-config), at the root of our project:

```ts title="codegen.ts"
import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '<URL_OF_YOUR_GRAPHQL_API>',
  documents: ['src/**/*.tsx'],
  generates: {
    './src/__generated__/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
      }
    }
  },
  ignoreNoDocuments: true,
};

export default config;
```

> There are multiple ways to [specify a schema](https://www.the-guild.dev/graphql/codegen/docs/config-reference/schema-field#root-level) in your `codegen.ts`, so pick the way that works best for your project setup.

Finally, we'll add the following scripts to our `package.json` file:

```json title="package.json"
{
  "scripts": {
    "compile": "graphql-codegen",
    "watch": "graphql-codegen -w",
  }
}
```

GraphQL Code Generator generates types based on our GraphQL schema if we run either code-generation script above:

```bash
$ yarn run compile
✔ Parse Configuration
✔ Generate outputs
```

## Typing hooks

GraphQL Code Generator automatically generates a `gql` function (from the `src/__genterated__/gql.ts` file), which we can use to type our hooks.

### `useQuery`

```tsx
import React from 'react';
import { useQuery } from '@apollo/client';

import { gql } from '../src/__generated__/gql';

const GET_ROCKET_INVENTORY = gql(/* GraphQL */ `
  query GetRocketInventory($year: Int!) {
    rocketInventory(year: $year) {
      id
      model
      year
      stock
    }
  }
`);

export function RocketInventoryList() {
  // data is typed!
  const { loading, data } = useQuery(
    GET_ROCKET_INVENTORY,
    // variables are also typed!
    { variables: { year: 2019 } }
  );
  return (
    <div>
      <h3>Available Inventory</h3>
      {loading ? (
        <p>Loading ...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {data && data.rocketInventory.map(inventory => (
              <tr>
                <td>{inventory.model}</td>
                <td>{inventory.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

#### `fetchMore` and `subscribeToMore`

`useQuery` returns an instance of `QueryResult`. This includes the `fetchMore` and `subscribeToMore` functions. See the `Result` section of the [Queries](../data/queries#result) documentation page for detailed type information. Because these functions execute GraphQL operations, they accept type parameters.

`fetchMore`'s type parameters are similar to those of `useQuery`. In fact, the type parameters are set to the same values as `useQuery`'s by default. Since both `fetchMore` and `useQuery` encapsulate a `query` operation, it's unlikely that you will need to pass any type arguments to `fetchMore`. Here's a sketch derived from the previous example:

```tsx
// ...
export function RocketInventoryList() {
  const { fetchMore, loading, data } = useQuery(
    GET_ROCKET_INVENTORY,
    { variables: { year: 2019 } }
  );

  return (
    //...
    <button
      onClick={() => {
        fetchMore({ variables: { year: 2020 } });
      }}
    >
      Add 2020 Inventory
    </button>
    //...
  );
}
```

`subscribeToMore`'s type parameters and defaults are identical to `fetchMore`'s. Keep in mind that `subscribeToMore` encapsulates a `subscription` whereas `fetchMore` encapsulates a `query`. Subscriptions and queries are different operations in the GraphQL spec. This means that you'll almost always pass at least one type argument to `subscribeToMore` since its default value will rarely Just Work. Here's another sketch based on the previous example:

```tsx
// ...
const ROCKET_STOCK_SUBSCRIPTION = gql(/* GraphQL */ `
  subscription OnRocketStockUpdated {
    rocketStockAdded {
      id
      stock
    }
  }
`);

export function RocketInventoryList() {
  const { subscribeToMore, loading, data } = useQuery(
    GET_ROCKET_INVENTORY,
    { variables: { year: 2019 } }
  );

  React.useEffect(() => {
    subscribeToMore(
      { document: ROCKET_STOCK_SUBSCRIPTION, variables: { year: 2019 } }
    );
  }, [subscribeToMore])

  // ...
}
```

### `useMutation`

We can type our `useMutation()` hooks the same way we type our `useQuery()` hooks.

We can use the generated `gql()` function to define our GraphQL mutations, ensuring our mutation's variables and data are typed:

```tsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';

import { gql } from '../src/__generated__/gql';

const SAVE_ROCKET = gql(/* GraphQL */ `
  mutation saveRocket($rocket: RocketInput!) {
    saveRocket(rocket: $rocket) {
      model
    }
  }
`);


export function NewRocketForm() {
  const [model, setModel] = useState('');
  const [year, setYear] = useState(0);
  const [stock, setStock] = useState(0);

  // data is typed!
  const [saveRocket, { error, data }] = useMutation(SAVE_ROCKET, {
    // our variables are also typed!
    variables: { rocket: { model, year: +year, stock: +stock } }
  });

  return (
    <div>
      <h3>Add a Rocket</h3>
      {error ? <p>Oh no! {error.message}</p> : null}
      {data && data.saveRocket ? <p>Saved!</p> : null}
      <form>
        <p>
          <label>Model</label>
          <input
            name="model"
            onChange={e => setModel(e.target.value)}
          />
        </p>
        <p>
          <label>Year</label>
          <input
            type="number"
            name="year"
            onChange={e => setYear(+e.target.value)}
          />
        </p>
        <p>
          <label>Stock</label>
          <input
            type="number"
            name="stock"
            onChange={e => setStock(e.target.value)}
          />
        </p>
        <button onClick={() => model && year && stock && saveRocket()}>
          Add
        </button>
      </form>
    </div>
  );
}
```

### `useSubscription`

We can use the generated `gql()` function to define our GraphQL subscriptions, ensuring our subscription's variables and data are typed:


```tsx
import React from 'react';
import { useSubscription } from '@apollo/client';

import { gql } from '../src/gql';

const LATEST_NEWS = gql(/* GraphQL */ `
  subscription getLatestNews {
    latestNews {
      content
    }
  }
`);

export function LatestNews() {
  // `data` is typed!
  const { loading, data } = useSubscription(LATEST_NEWS);
  return (
    <div>
      <h5>Latest News</h5>
      <p>
        {loading ? 'Loading...' : data!.latestNews.content}
      </p>
    </div>
  );
}
```

## Typing Render Prop Components

To type your render prop components, you'll first define a GraphQL query using the generated `gql()` function (from `src/__generated__/gql`). This creates a type for that query and its variables, which you can then pass to your `Query` component:


```tsx
import { gql, AllPeopleQuery, AllPeopleQueryVariables } from '../src/__generated__/gql';

const ALL_PEOPLE_QUERY = gql(/* GraphQL */ `
  query All_People {
    allPeople {
      people {
        id
        name
      }
    }
  }
`;


const AllPeopleComponent = <Query<AllPeopleQuery, AllPeopleQueryVariables> query={ALL_PEOPLE_QUERY}>
  {({ loading, error, data }) => { ... }}
</Query>
```

Now the `<Query />` component render prop function arguments are typed. Since we are not mapping any props coming into our component, nor are we rewriting the props passed down, we only need to provide the shape of our data and the variables for full typing to work! Everything else is handled by React Apollo's robust type definitions.

This approach is the exact same for the `<Query />`, `<Mutation />`, and `<Subscription />` components! Learn it once, and get the best types ever with Apollo.

### Extending components

In previous versions of React Apollo, render prop components (`Query`, `Mutation` and `Subscription`) could be extended to add additional type information:

```ts
class SomeQuery extends Query<SomeData, SomeVariables> {}
```

Since all class based render prop components have been converted to functional components, extending components in this manner is no longer possible. While we recommend switching over to use the new `useQuery`, `useMutation` and `useSubscription` hooks as soon as possible, if you're looking for a stop gap you can consider replacing your class with a wrapped and typed component:

```tsx
export const SomeQuery = () => (
  <Query<SomeData, SomeVariables> query={SOME_QUERY} /* ... */>
    {({ loading, error, data }) => { ... }}
  </Query>
);
```

## Typing Higher Order Components

To type high-order components, begin by defining your GraphQL documents with the generated `gql()` function (from `./src/__generated__/gql`).

In the below example, this generates the query and variable types (`GetCharacterQuery` and `GetCharacterQueryVariables`).

Our wrapped component receives the query's result as props. So, we need to tell our type system the _shape_ of these props. Below is an example of setting types for an operation using the `graphql` higher-order component.

> The following logic also works for the query, mutation, and subscription higher-order components!

```tsx
import React from "react";
import { ChildDataProps, graphql } from "@apollo/react-hoc";

import { gql, GetCharacterQuery, GetCharacterQueryVariables } from '../src/gql';

const HERO_QUERY = gql(/* GraphQL */ `
  query GetCharacter($episode: Episode!) {
    hero(episode: $episode) {
      name
      id
      friends {
        name
        id
        appearsIn
      }
    }
  }
`);


type ChildProps = ChildDataProps<{}, GetCharacterQuery, GetCharacterQueryVariables>;

// Note that the first parameter here is an empty Object, which means we're
// not checking incoming props for type safety in this example. The next
// example (in the "Options" section) shows how the type safety of incoming
// props can be ensured.
const withCharacter = graphql<{}, GetCharacterQuery, GetCharacterQueryVariables, ChildProps>(HERO_QUERY, {
  options: () => ({
    variables: { episode: "JEDI" }
  })
});

export default withCharacter(({ data: { loading, hero, error } }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

### Options

Typically, variables to the query will be computed from the props of the wrapper component. Wherever the component is used in your application, the caller would pass arguments that we want our type system to validate what the shape of these props could look like. Here is an example setting the type of props:

```tsx
import React from "react";
import { ChildDataProps, graphql } from "@apollo/react-hoc";

import { gql, GetCharacterQuery, GetCharacterQueryVariables } from '../src/gql';

const HERO_QUERY = gql(/* GraphQL */ `
  query GetCharacter($episode: Episode!) {
    hero(episode: $episode) {
      name
      id
      friends {
        name
        id
        appearsIn
      }
    }
  }
`);

type ChildProps = ChildDataProps<GetCharacterQueryVariables, GetCharacterQuery, GetCharacterQueryVariables>;

const withCharacter = graphql<
  GetCharacterQueryVariables,
  GetCharacterQuery,
  GetCharacterQueryVariables,
  ChildProps
>(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  }),
});

export default withCharacter(({ data: { loading, hero, error } }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

This is especially helpful when accessing deeply nested objects that are passed down to the component through props. For example, when adding prop types, a project using TypeScript will begin to surface errors where props being passed are invalid:

```tsx
import React from "react";
import {
  ApolloClient,
  createHttpLink,
  InMemoryCache,
  ApolloProvider
} from "@apollo/client";

import Character from "./Character";

export const link = createHttpLink({
  uri: "https://mpjk0plp9.lp.gql.zone/graphql"
});

export const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
});

export default () =>
  <ApolloProvider client={client}>
    // $ExpectError property `episode`. Property not found in. See: src/Character.js:43
    <Character />
  </ApolloProvider>;
```

### Props

One of the most powerful feature of the React integration is the `props` function which allows you to reshape the result data from an operation into a new shape of props for the wrapped component. GraphQL is awesome at allowing you to only request the data you want from the server. The client still often needs to reshape or do client side calculations based on these results. The return value can even differ depending on the state of the operation (i.e loading, error, received data), so informing our type system of choice of these possible values is really important to make sure our components won't have runtime errors.

The `graphql` wrapper from `@apollo/react-hoc` supports manually declaring the shape of your result props.

```tsx
import React from "react";
import { graphql, ChildDataProps } from "@apollo/react-hoc";

import { gql, GetCharacterQuery, GetCharacterQueryVariables } from '../src/gql';

const HERO_QUERY = gql(/* GraphQL */ `
  query GetCharacter($episode: Episode!) {
    hero(episode: $episode) {
      name
      id
      friends {
        name
        id
        appearsIn
      }
    }
  }
`);


type ChildProps = ChildDataProps<GetCharacterQueryVariables, GetCharacterQuery, GetCharacterQueryVariables>;

const withCharacter = graphql<
  GetCharacterQueryVariables,
  GetCharacterQuery,
  GetCharacterQueryVariables,
  ChildProps
>(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  }),
  props: ({ data }) => ({ ...data })
});

export default withCharacter(({ loading, hero, error }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

Since we have typed the response shape, the props shape, and the shape of what will be passed to the client, we can prevent errors in multiple places. Our options and props function within the `graphql` wrapper are now type safe, our rendered component is protected, and our tree of components have their required props enforced.

```ts
export const withCharacter = graphql<
  GetCharacterQueryVariables,
  GetCharacterQuery,
  GetCharacterQueryVariables,
  Props
>(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  }),
  props: ({ data, ownProps }) => ({
    ...data,
    // $ExpectError [string] This type cannot be compared to number
    episode: ownProps.episode > 1,
    // $ExpectError property `isHero`. Property not found on object type
    isHero: data && data.hero && data.hero.isHero
  })
});
```

With this addition, the entirety of the integration between Apollo and React can be statically typed. When combined with the strong tooling each system provides, it can make for a much improved application and developer experience.

### Classes vs Functions

All of the above examples show wrapping a component which is just a function using the result of a `graphql` wrapper. Sometimes, components that depend on GraphQL data require state and are formed using the `class MyComponent extends React.Component` practice. In these use cases, TypeScript requires adding prop shape to the class instance. In order to support this, `@apollo/react-hoc` exports types to support creating result types easily.

```tsx
import { ChildProps } from "@apollo/react-hoc";

const withCharacter = graphql<GetCharacterQueryVariables, GetCharacterQuery>(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  })
});

class Character extends React.Component<ChildProps<GetCharacterQueryVariables, GetCharacterQuery>, {}> {
  render(){
    const { loading, hero, error } = this.props.data;
    if (loading) return <div>Loading</div>;
    if (error) return <h1>ERROR</h1>;
    return ...// actual component with data;
  }
}

export default withCharacter(Character);
```

### Using the `name` property

If you are using the `name` property in the configuration of the `graphql` wrapper, you will need to manually attach the type of the response to the `props` function. An example using TypeScript would be like this:

```ts
import { NamedProps, QueryProps } from '@apollo/react-hoc';

export const withCharacter = graphql<GetCharacterQueryVariables, GetCharacterQuery, {}, Prop>(HERO_QUERY, {
  name: 'character',
  props: ({ character, ownProps }: NamedProps<{ character: QueryProps & GetCharacterQuery }, Props) => ({
    ...character,
    // $ExpectError [string] This type cannot be compared to number
    episode: ownProps.episode > 1,
    // $ExpectError property `isHero`. Property not found on object type
    isHero: character && character.hero && character.hero.isHero
  })
});
```

## Using `TypeDocumentNode`

In TypeScript, all APIs that take `DocumentNode` parameters may alternatively take `TypeDocumentNode<Data, Variables>`. This type has the same JavaScript representation but allows the APIs to infer the data and variable types instead of requiring you to specify types explicitly at the call site. This technique could allow us to modify the [`useQuery` example](#usequery) above to use type inference:

```tsx
import React from 'react';
import { useQuery, gql, TypedDocumentNode } from '@apollo/client';

interface RocketInventoryData {
  rocketInventory: RocketInventory[];
}

interface RocketInventoryVars {
  year: number;
}

const GET_ROCKET_INVENTORY: TypedDocumentNode<RocketInventoryData, RocketInventoryVars> = gql`
  query GetRocketInventory($year: Int!) {
    rocketInventory(year: $year) {
      id
      model
      year
      stock
    }
  }
`;

export function RocketInventoryList() {
  const { loading, data } = useQuery(
    GET_ROCKET_INVENTORY,
    { variables: { year: 2019 } }
  );
  return (
    <div>
      <h3>Available Inventory</h3>
      {loading ? (
        <p>Loading ...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {data && data.rocketInventory.map(inventory => (
              <tr>
                <td>{inventory.model}</td>
                <td>{inventory.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

```
