import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalResolvers } from "@apollo/client/local-resolvers";

import { gql } from "./testUtils.js";

test("runs resolvers marked with @client(always: true)", async () => {
  const document = gql`
    query Author {
      author {
        name
        isLoggedIn @client(always: true)
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({
    query: document,
    data: {
      author: {
        name: "John Smith",
        isLoggedIn: false,
        __typename: "Author",
      },
    },
  });

  const localResolvers = new LocalResolvers();

  // When the resolver isn't defined, there isn't anything to force, so
  // make sure the query resolves from the cache properly.
  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      remoteResult: { data: client.readQuery({ query: document }) },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      author: { __typename: "Author", name: "John Smith", isLoggedIn: false },
    },
  });

  localResolvers.addResolvers({
    Author: {
      isLoggedIn() {
        return true;
      },
    },
  });

  // A resolver is defined, so make sure it's forced, and the result
  // resolves properly as a combination of cache and local resolver
  // data.
  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      remoteResult: { data: client.readQuery({ query: document }) },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      author: { __typename: "Author", name: "John Smith", isLoggedIn: true },
    },
  });
});

test("only runs forced resolvers for fields marked with `@client(always: true)`, not all `@client` fields", async () => {
  const document = gql`
    query UserDetails {
      name @client
      isLoggedIn @client(always: true)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let nameCount = 0;
  let isLoggedInCount = 0;

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        name() {
          nameCount += 1;
          return "John Smith";
        },
        isLoggedIn() {
          isLoggedInCount += 1;
          return true;
        },
      },
    },
  });

  client.writeQuery({
    query: document,
    data: {
      name: "John Smith",
      isLoggedIn: true,
    },
  });

  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      onlyRunForcedResolvers: true,
    })
  ).resolves.toStrictEqualTyped({
    data: { name: "John Smith", isLoggedIn: true },
  });

  expect(nameCount).toEqual(0);
  expect(isLoggedInCount).toEqual(1);
});

test("runs nested forced resolvers from non-forced client descendant field", async () => {
  const document = gql`
    query UserDetails {
      user @client {
        id
        name
        isLoggedIn @client(always: true)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let userCount = 0;
  let isLoggedInCount = 0;

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        user() {
          userCount += 1;
          return { __typename: "User", id: 1, name: "John Smith" };
        },
      },
      User: {
        isLoggedIn() {
          isLoggedInCount += 1;
          return true;
        },
      },
    },
  });

  client.writeQuery({
    query: document,
    data: {
      user: {
        __typename: "User",
        id: 1,
        name: "John Smith",
        isLoggedIn: true,
      },
    },
  });

  await expect(
    localResolvers.execute({
      document,
      client,
      context: {},
      onlyRunForcedResolvers: true,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      user: { __typename: "User", id: 1, name: "John Smith", isLoggedIn: true },
    },
  });

  expect(userCount).toEqual(0);
  expect(isLoggedInCount).toEqual(1);
});
