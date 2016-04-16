---
title: GraphQL server guide
order: 202
description: These are Apollo Docs!!
---

This guide will explain all the parts required for a simple GraphQL Blog server. If you're looking for a tutorial, check out this Medium post or our GraphQL server tutorial video on Youtube.

We'll be using a package called [graphql-tools](https://www.npmjs.com/package/graphql-tools), which is actively being developed for [Apollo](http://www.apollostack.com). There are of course many ways to build a GraphQL server for Node.js, but this is the way we recommend. It describes each step in detail, from defining a schema to writing your own resolve functions and loaders.

## Setup
For the remainder of this guide, we'll assume that you are familiar with using the command line of your operating system and already have Node 5 and npm set up for your environment.
If that's not the case, you should [do that first](https://nodejs.org/en/download/package-manager/) before you read the rest of this guide.

To get started, you need to install a few packages and set up some boilerplate. To make this easier, we've created a barebones started kit which you can use:
```bash
git clone --branch server-only https://github.com/apollostack/apollo-starter-kit
cd apollo-starter-kit
npm install
```

This will download the starter-kit from GitHub and install all the npm packages you need to get started.

Once the installation is finished, you can launch the server with this command:
```bash
npm start
```
If all goes well, the server should now print out a message that it is listening on port 8080. If you open [localhost:8080](http://localhost:8080/?query=%7B%0A%20%20testString%0A%7D) in your browser, you should now see the GraphiQL GUI for GraphQL, ready to query the server:

![Testing the server with GraphiQL](graphiql-test.png)

**For advanced users:**
If you already have an express server or a GraphQL server set up, then you can also simply install graphql-tools with the command `npm install graphql-tools` and jump to the [Tools](tools.html) section in this guide to learn about using the individual parts of the graphql-tools package.


## Schema

If you open the `data` folder in the project directory, you will see the file `schema.js` which defines the schema your server currently uses:
```js
const typeDefinitions = `
type Query {
  testString: String
}

schema {
  query: Query
}
`;

export default [typeDefinitions];
```
ApolloServer uses the GraphQL schema language notation, which it then compiles to a GraphQL-JS schema. With the current schema, our server provides exactly one entry point `testString`, which returns a String.

The schema notation supports all GraphQL types. In this tutorial we are only going to use a few of them. You can learn about all the others in the [schema creation subsection of Tools](http://localhost:4000/apollo-server/tools.html#Schema-creation).

For the todos app, we're going to use a schema that has the following two types: Authors and Posts. For each type, the schema defines which fields it has, and how it relates to the other types. The fields of the RootQuery and RootMutation types are the client's entry points to the schema. Every query or mutation has to start there, but it can ask for as much or as little data as it wants by expanding the fields when necessary.

````js
const typeDefinitions = `
type Author {
  id: Int! # the ! means that every author object _must_ have an id
  firstName: String
  lastName: String
  posts: [Post] # the list of Posts by this author
}

type Post {
  id: Int!
  tags: [String]
  title: String
  text: String
  author: Author
}

# the schema allows the following two queries:
type RootQuery {
  author(firstName: String, lastName: String): User
  posts(tags: [String]): [Post]
}

# this schema allows the following two mutations:
type RootMutation {
  createAuthor(
    firstName: String!
    lastName: String!
  ): Author

  createPost(
    tags: [String!]!
    title: String!
    text: String!
    authorId: Int!
  ): Post
}

# we need to tell the server which types represent the root query
# and root mutation types. We call them RootQuery and RootMutation by convention.
schema {
  query: RootQuery
  mutation: RootMutation
}
`;

export default [typeDefinitions];
```
For more information about GraphQL's type system and schema language, you can read the [Schema definition subsection in the Tools chapter](http://localhost:4000/apollo-server/tools.html#Schema-creation) or refer to the [official GraphQL website](http://graphql.org/docs/typesystem/).

## Mocking

Mocking is one of the many things that GraphQL makes much easier than traditional RESTful APIs. If you copy the schema of the previous subsection into the `data/schema.js` file and restart your server, you can immediately start querying it and it will return some mocked data!

The defaults for mocked data are a great, but sometimes you need data that looks more realistic. To achieve that, you need to tell the `apolloServer` how to generate mock data for your schema.

The rules for mocking are defined in `data/mocks.js`. In the unmodified starter kit, the file looks like this:

```js
const mocks = {
  String: () => "It works!",
};

export default mocks;
```

That's right, the "It works!" that you saw earlier came from here. We're going to modify that to create more realistic mock data. In order to do that, we'll use a package called casual to generate fake data. You can install it by running `npm i --save-dev casual`.

```js
import { MockList } from 'graphql-tools';

const mocks = {
  Int: () => casual.integer(1,1000),
  Author: () => ({
    firstName: () => casual.first_name,
    lastName: () => casual.last_name,
    posts: () => new MockList([1,6]),
  }),
  Post: () => ({
    tags: () => new MockList([1,3]),
    title: () => casual.title,
    text: () => casual.sentences(4)
  })
  RootQuery: () => ({
    author: (o, args) => {
      if (casual.integer(1,10) > 8){
        return null;
      }
      return { ...args };
    }
  })
}
```

You can tell `apolloServer` to mock a scalar type, such as Int or String in a specific way. In this case, we told it to return an integer between 1 and 1000 every time an Int field is requested by the client.

You can also tell `apolloSever` to use special mocks for a specific type. In the `mocks.js` file above, we're telling the server to use `casual.first_name` to mock the `firstName` field of `Author`. If we didn't tell it to do that, it would use the default mock for the `String` type instead.

In the mock functions, you can also access the arguments passed to the field. In the file above, we're using that feature for the `author` field on `RootQuery`, to make sure that when the query asks for a user with a specific fist and/or last name, we either return a user with that first and/or last name, or we return null (to simulate an unsuccessful search in 20% of the cases).

## Resolve Functions

## Connectors

### SQL

### MongoDB

### REST / HTTP
