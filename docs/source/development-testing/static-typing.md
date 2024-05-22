---
title: TypeScript with Apollo Client
descriptions: How to generate and use TypeScript types in your application
---

As your application grows, a type system can become an essential tool for catching bugs early and improving your overall developer experience.

GraphQL uses a type system to clearly define the available data for each type and field in a GraphQL schema. Given that a GraphQL server's schema is strongly typed, we can generate TypeScript definitions automatically using a tool like [GraphQL Code Generator](https://www.the-guild.dev/graphql/codegen). We'll use our generated types to ensure type safety for the _inputs_ and _results_ of our GraphQL operations.

Below, we'll guide you through installing and configuring GraphQL Code Generator to generate types for your hooks and components.

## Setting up your project

> This article assumes your project already uses TypeScript. If not, [configure your project to use TypeScript](https://github.com/Microsoft/TypeScript-React-Conversion-Guide#typescript-react-conversion-guide) or [start a new project](https://create-react-app.dev/docs/adding-typescript/).

To get started using GraphQL Code Generator, begin by installing the following packages (using Yarn or NPM):

```bash
yarn add -D typescript graphql @graphql-codegen/cli @graphql-codegen/client-preset @graphql-typed-document-node/core
```

Next, we'll create a configuration file for GraphQL Code Generator, named [`codegen.ts`](https://www.the-guild.dev/graphql/codegen/docs/config-reference/codegen-config), at the root of our project:

```ts title="codegen.ts"
import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '<URL_OF_YOUR_GRAPHQL_API>',
  // this assumes that all your source files are in a top-level `src/` directory - you might need to adjust this to your file structure
  documents: ['src/**/*.{ts,tsx}'],
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

> There are multiple ways to [specify a schema](https://www.the-guild.dev/graphql/codegen/docs/config-reference/schema-field#root-level) in your `codegen.ts`, so pick whichever way works best for your project setup.

Finally, we'll add the following scripts to our `package.json` file:

```json title="package.json"
{
  "scripts": {
    "compile": "graphql-codegen",
    "watch": "graphql-codegen -w",
  }
}
```

Running either of the scripts above generates types based on the schema file or GraphQL API you provided in `codegen.ts`:

```bash
$ yarn run compile
✔ Parse Configuration
✔ Generate outputs
```

## Typing hooks

GraphQL Code Generator automatically creates a `gql` function (from the `src/__generated__/gql.ts` file). This function enables us to type the variables that go into our React hooks, along with the results from those hooks.

### `useQuery`

Below we use the `gql` function to define our query, which automatically generates types for our `useQuery` hook:

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
  // our query's result, data, is typed!
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

The `useQuery` hook returns an instance of `QueryResult`, which includes the `fetchMore` and `subscribeToMore` functions. See [Queries for detailed type information](../data/queries#result). Because these functions execute GraphQL operations, they accept type parameters.

By default, the type parameters for `fetchMore` are the same as those for `useQuery`. Because both `fetchMore` and `useQuery` encapsulate a query operation, it's unlikely that you'll need to pass any type arguments to `fetchMore`.

Expanding our previous example, notice that we don't explicitly type `fetchMore`, because it defaults to using the same type parameters as `useQuery`:
```tsx
// ...
export function RocketInventoryList() {
  const { fetchMore, loading, data } = useQuery(
    GET_ROCKET_INVENTORY,
    // variables are typed!
    { variables: { year: 2019 } }
  );

  return (
    //...
    <button
      onClick={() => {
        // variables are typed!
        fetchMore({ variables: { year: 2020 } });
      }}
    >
      Add 2020 Inventory
    </button>
    //...
  );
}
```

The type parameters and defaults for `subscribeToMore` are identical to those for `fetchMore`. Keep in mind that `subscribeToMore` executes a _subscription_, whereas `fetchMore` executes follow-up queries.

Using `subscribeToMore`, you usually pass at least one typed argument, like so:

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
      // variables are typed!
      { document: ROCKET_STOCK_SUBSCRIPTION, variables: { year: 2019 } }
    );
  }, [subscribeToMore])

  // ...
}
```

### `useMutation`

We can type `useMutation` hooks the same way we type `useQuery` hooks. Using the generated `gql` function to define our GraphQL mutations, we ensure that we type our mutation's variables and return data:

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

  // our mutation's result, data, is typed!
  const [saveRocket, { error, data }] = useMutation(SAVE_ROCKET, {
    // variables are also typed!
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

We can type our `useSubscription` hooks the same way we typed our `useQuery` and `useMutation` hooks. Using the generated `gql` function to define our GraphQL subscriptions, we ensure that we type our subscription variables and return data:

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
  // our returned data is typed!
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

## Typing Render Prop components

To type render prop components, you'll first define a GraphQL query using the generated `gql` function (from `src/__generated__/gql`).

This creates a type for that query and its variables, which you can then pass to your `Query` component:

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

Our `<Query />` component's function arguments are now typed. Since we aren't mapping any props coming into our component, nor are we rewriting the props passed down, we only need to provide the shape of our data and the variables for our typing to work!

This approach also works for `<Mutation />` and `<Subscription />` components.

### Extending components

In previous versions of Apollo Client, render prop components (`Query`, `Mutation` and `Subscription`) could be extended to add additional type information:

```ts
class SomeQuery extends Query<SomeData, SomeVariables> {}
```

Now that class-based render prop components have been converted into functional components, you can no longer extend components in this manner.

While we recommend switching over to using the new `useQuery`, `useMutation`, and `useSubscription` hooks as soon as possible, you can replace your class with a wrapped and typed component in the meantime:

```tsx
export const SomeQuery = () => (
  <Query<SomeData, SomeVariables> query={SOME_QUERY} /* ... */>
    {({ loading, error, data }) => { ... }}
  </Query>
);
```

## Typing Higher-order components

To type higher-order components, begin by defining your GraphQL queries with the `gql` function (from `./src/__generated__/gql`). In the below example, this generates the query and variable types (`GetCharacterQuery` and `GetCharacterQueryVariables`).

Our wrapped component receives our query's result as props, and we'll need to tell our type system the _shape_ these props take.

Below is an example of setting types for an operation using the `graphql` higher-order component:

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

> The following logic also works for query, mutation, and subscription higher-order components!
### Options

Typically, our wrapper component's props pass in a query's variables. Wherever our application uses our wrapper component, we want to ensure that we correctly type those passed-in arguments.

Below is an example of setting a type for a component's props:

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
  // highlight-start
  options: ({ episode }) => ({
    variables: { episode }
  }),
  // highlight-end
});

export default withCharacter(({ data: { loading, hero, error } }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

This is especially helpful when accessing deeply nested objects passed to our component via props. For example, when adding prop types, a project using TypeScript begins to surface errors with invalid props:

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

The `props` function enables you to manually reshape an operation result's data into the shape your wrapped component requires:

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
  props: ({ data }) => ({ ...data }) // highlight-line
});

export default withCharacter(({ loading, hero, error }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

Above, we type the shape of our response, props, and our client's variables. Our options and props function (within the `graphql` wrapper) are now type-safe, our rendered component is protected, and our tree of components has their required props enforced:

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

### Classes vs functions

If you are using React classes (instead of using the `graphql` wrapper), you can still type the incoming props for your class like so:

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

If you are using the `name` property in the configuration of the `graphql` wrapper, you need to manually attach the type of the response to the `props` function, like so:

```ts
import { NamedProps, QueryProps } from '@apollo/react-hoc';

export const withCharacter = graphql<GetCharacterQueryVariables, GetCharacterQuery, {}, Prop>(HERO_QUERY, {
  name: 'character', // highlight-line
  props: ({ character, ownProps }: NamedProps<{ character: QueryProps & GetCharacterQuery }, Props) => ({
    ...character,
    // $ExpectError [string] This type cannot be compared to number
    episode: ownProps.episode > 1,
    // $ExpectError property `isHero`. Property not found on object type
    isHero: character && character.hero && character.hero.isHero
  })
});
```

## Using `TypedDocumentNode`

In TypeScript, all APIs that intake `DocumentNode` can alternatively take `TypedDocumentNode<Data, Variables>`. This type has the same JavaScript representation but enables APIs to infer the data and variable types (instead of making you specify types upon invocation).

This technique enables us to modify the [`useQuery` example](#usequery) above to use a type inference:

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
