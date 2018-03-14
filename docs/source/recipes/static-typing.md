---
title: Using Apollo with TypeScript and Flow
sidebar_title: Using TypeScript and Flow
---

**Note: The flow types are still under development for the 2.0, we plan on launching them as soon as possible but if you are able to help out, please open a PR!**

As your application grows, you may find it helpful to include a type system to assist in development. Apollo supports type definitions for both Flow and TypeScript systems. Both `apollo-client` and `react-apollo` ship with definitions in their npm packages, so installation should be done for you after the libraries are included in your project.

These docs assume you already have either Flow or TypeScript configured in your project, if not start [here for Flow](https://flow.org/en/docs/install/), or [here for TypeScript](https://github.com/Microsoft/TypeScript-React-Conversion-Guide#typescript-react-conversion-guide).

<h2 id="operation-result">Operation result</h2>

The most common need when using type systems with GraphQL is to type the results of an operation. Given that a GraphQL server's schema is strongly typed, we can even generate Flow or TypeScript definitions automaticaly using a tool like [apollo-codegen](https://github.com/apollographql/apollo-codegen). In these docs however, we will be writing result types manually.

Since the result of a query will be sent to the wrapped component as props, we want to be able to tell our type system the shape of those props. Here is an example setting types for an operation using Flow:

```javascript
// @flow
import React from "react";
import gql from "graphql-tag";
import { graphql } from "react-apollo";

import type { OperationComponent } from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string,
  id: string,
  appearsIn: string[],
  friends: Hero[]
};

type Response = {
  hero: Hero
};

const withCharacter: OperationComponent<Response> = graphql(HERO_QUERY, {
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

The same example looks like this when using TypeScript:

```javascript
import React from "react";
import gql from "graphql-tag";
import { graphql } from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string;
  id: string;
  appearsIn: string[];
  friends: Hero[];
};

type Response = {
  hero: Hero;
};

const withCharacter = graphql<Response>(HERO_QUERY, {
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

One of the major differences between the two systems is how they handle inferring types. Because TypeScript does not infer types, the React integration of Apollo exports extra type definitions to make adding types easier.

<h2 id="options">Options</h2>

Typically, variables to the query will be computed from the props of the wrapper component. Wherever the component is used in your application, the caller would pass arguments that we want our type system to validate what the shape of these props could look like. Here is an example setting the type of props using Flow:

```javascript
// @flow
import React from "react";
import gql from "graphql-tag";
import { graphql } from "react-apollo";

import type { OperationComponent } from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string,
  id: string,
  appearsIn: string[],
  friends: Hero[]
};

type Response = {
  hero: Hero
};

export type InputProps = {
  episode: string
};

const withCharacter: OperationComponent<Response, InputProps> = graphql(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  })
});

export default withCharacter(({ data: { loading, hero, error } }) => {
  if (loading) return <div>Loading</div>;
  if (error) return <h1>ERROR</h1>;
  return ...// actual component with data;
});
```

The same example looks like this when using TypeScript:

```javascript
import React from "react";
import gql from "graphql-tag";
import { graphql } from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string;
  id: string;
  appearsIn: string[];
  friends: Hero[];
};

type Response = {
  hero: Hero;
};

type InputProps = {
  episode: string
};

const withCharacter = graphql<Response, InputProps>(HERO_QUERY, {
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

This is expecially helpful when accessing deeply nested objects that are passed down to the component through props. For example, when adding prop types a project using Flow will begin to surface errors where props being passed are invalid:

```javascript
// @flow
import React from "react";
import { ApolloClient } from "apollo-client";
import { createHttpLink } from "apollo-link-http";
import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloProvider } from "react-apollo";

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

<h2 id="props">Props</h2>

One of the most powerful feature of the React integration is the `props` function which allows you to reshape the result data from an operation into a new shape of props for the wrapped component. GraphQL is awesome at allowing you to only request the data you want from the server. The client still often needs to reshape or do client side calculations based on these results. The return value can even differ depending on the state of the operation (i.e loading, error, recieved data), so informing our type system of choice of these possible values is really important to make sure our components won't have runtime errors.

The `graphql` wrapper from `react-apollo` supports manually declaring the shape of your result props. It is implemented in Flow like this:

```javascript
// @flow
import React from "react";
import gql from "graphql-tag";
import { graphql } from "react-apollo";

import type { OperationComponent, QueryProps } from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string,
  id: string,
  appearsIn: string[],
  friends: Hero[]
};

type Response = {
  hero: Hero
};

type Props = Response & QueryProps;

export type InputProps = {
  episode: string
};

const withCharacter: OperationComponent<Response, InputProps, Props> = graphql(HERO_QUERY, {
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

The same example looks like this when using TypeScript:

```javascript
import React from "react";
import gql from "graphql-tag";
import { graphql, NamedProps, QueryProps} from "react-apollo";

const HERO_QUERY = gql`
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
`;

type Hero = {
  name: string;
  id: string;
  appearsIn: string[];
  friends: Hero[];
};

type Response = {
  hero: Hero;
};

type WrappedProps = Response & QueryProps;

type InputProps = {
  episode: string
};

const withCharacter = graphql<Response, InputProps, WrappedProps>(HERO_QUERY, {
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

Since we have typed the response shape, the props shape, and the shape of what will be passed to the client, we can prevent errors in multiple places. Our options and props function within the `graphql` wrapper are now type safe, our rendered component is protected, and our tree of components have their required props enforced. Take for example errors using Flow within the `props` function after adding the above typings:

```javascript
// @flow

export const withCharacter: OperationComponent<Response, InputProps, Props> = graphql(HERO_QUERY, {
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

<h2 id="classes-vs-functions">Classes vs Functions</h2>

All of the above examples show wrapping a component which is just a function using the result of a `graphql` wrapper. Sometimes, components that depend on GraphQL data require state and are formed using the `class MyComponent extends React.Component` practice. In these use cases, both TypeScript and Flow require adding prop shape to the class instance. In order to support this, `react-apollo` exports types to support creating result types easily. This is the previous example shortened to show just the component when using Flow:

```javascript
// @flow
import { ChildProps } from "react-apollo";

const withCharacter: OperationComponent<Response, InputProps> = graphql(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  })
});

// flow will infer this type
export default class Character extends Component {
  render(){
    const { loading, hero, error } = this.props.data;
    if (loading) return <div>Loading</div>;
    if (error) return <h1>ERROR</h1>;
    return ...// actual component with data;
  }
}

const CharacterWithData = withCharacter(Character);
```

The same example looks like this when using TypeScript:

```javascript
import { ChildProps } from "react-apollo";

const withCharacter = graphql<Response, InputProps>(HERO_QUERY, {
  options: ({ episode }) => ({
    variables: { episode }
  })
});

class Character extends React.Component<ChildProps<InputProps, Response>, {}> {
  render(){
    const { loading, hero, error } = this.props.data;
    if (loading) return <div>Loading</div>;
    if (error) return <h1>ERROR</h1>;
    return ...// actual component with data;
  }
}

export default withCharacter(Character);
```

<h2 id="using-name">Using the `name` property</h2>
If you are using the `name` property in the configuration of the `graphql` wrapper, you will need to manually attach the type of the response to the `props` function. An example using TypeScript would be like this:

```javascript
import { NamedProps, QueryProps } from 'react-apollo';

export const withCharacter = graphql<Response, InputProps, Prop>(HERO_QUERY, {
  name: 'character',
  props: ({ character, ownProps }: NamedProps<{ character: QueryProps & Response }, Props) => ({
    ...character,
    // $ExpectError [string] This type cannot be compared to number
    episode: ownProps.episode > 1,
    // $ExpectError property `isHero`. Property not found on object type
    isHero: character && character.hero && character.hero.isHero
  })
});
```

<h2 id="more-info">More information</h2>

For more information regarding using Flow or TypeScript with Apollo, check out the following articles:
- [A stronger (typed) React Apollo](https://dev-blog.apollodata.com/a-stronger-typed-react-apollo-c43bd52be0d8)
- [Getting started with TypeScript and React Apollo](https://dev-blog.apollodata.com/getting-started-with-typescript-and-apollo-a9aa2c7dcf87)



