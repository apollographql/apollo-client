import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";
import { spyOnConsole } from "@apollo/client/testing/internal";

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

  const localState = new LocalState();

  // When the resolver isn't defined, there isn't anything to force, so
  // make sure the query resolves from the cache properly.
  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: client.readQuery({ query: document }) },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      author: { __typename: "Author", name: "John Smith", isLoggedIn: false },
    },
  });

  localState.addResolvers({
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
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
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

  const localState = new LocalState({
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
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
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

  const localState = new LocalState({
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
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
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

test("warns for client fields without cached data and resolvers when running forced resolvers and returnPartialData: false", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query {
      user {
        id
        name @client
        isLoggedIn @client(always: true)
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let nameCount = 0;
  let isLoggedInCount = 0;
  const localState = new LocalState({
    resolvers: {
      User: {
        name: () => {
          nameCount++;
          return "John Smith";
        },
        isLoggedIn: () => {
          isLoggedInCount++;
          return true;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { user: { __typename: "User", id: 1 } } },
      onlyRunForcedResolvers: true,
    })
  ).resolves.toStrictEqualTyped({
    // Note: name is null because we are only running forced resolvers and
    // there is no cached value, but we aren't asking for partial data
    data: {
      user: { __typename: "User", id: 1, name: null, isLoggedIn: true },
    },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "The '%s' field had no cached value and only forced resolvers were run. The value was set to `null`.",
    "User.name"
  );
  expect(nameCount).toBe(0);
  expect(isLoggedInCount).toBe(1);
});
