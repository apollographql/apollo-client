import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { GraphQLError } from "graphql";

import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { createClientWrapper } from "@apollo/client/testing/internal";

interface ProfileQueryData {
  profile: {
    __typename: "Profile";
    id: string;
    name: string;
    bio: string | null;
  };
}

const profileQuery: TypedDocumentNode<ProfileQueryData> = gql`
  query ProfileQuery {
    profile {
      __typename
      id
      name
      bio
    }
  }
`;

const bioError = new GraphQLError("Could not load bio", {
  path: ["profile", "bio"],
});

function extract(client: ApolloClient) {
  return (client.cache as InMemoryCache).extract();
}

const profileData = {
  profile: {
    __typename: "Profile" as const,
    id: "1",
    name: "Alice",
    bio: null,
  },
};

test("useQuery renders the full response shape while the cache holds only the successful fields", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query: profileQuery },
        result: { data: profileData, errors: [bioError] },
      },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(profileQuery, { errorPolicy: "localized" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: profileData,
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: profileData,
      errors: [bioError],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();

  expect(extract(client)["Profile:1"]).toStrictEqual({
    __typename: "Profile",
    id: "1",
    name: "Alice",
  });
});

test("a component reading only the successful fields is updated", async () => {
  const nameQuery: TypedDocumentNode<{
    profile: { __typename: "Profile"; id: string; name: string };
  }> = gql`
    query NameQuery {
      profile {
        __typename
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query: nameQuery },
        result: {
          data: {
            profile: { __typename: "Profile", id: "1", name: "Old name" },
          },
        },
      },
      {
        request: { query: profileQuery },
        result: { data: profileData, errors: [bioError] },
      },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(nameQuery),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { profile: { __typename: "Profile", id: "1", name: "Old name" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  await client.query({ query: profileQuery, errorPolicy: "localized" });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { profile: { __typename: "Profile", id: "1", name: "Alice" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      profile: { __typename: "Profile", id: "1", name: "Old name" },
    },
    variables: {},
  });
});

test("a component reading an errored field keeps its cached value", async () => {
  const bioQuery: TypedDocumentNode<{
    profile: { __typename: "Profile"; id: string; bio: string };
  }> = gql`
    query BioQuery {
      profile {
        __typename
        id
        bio
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query: bioQuery },
        result: {
          data: {
            profile: { __typename: "Profile", id: "1", bio: "Existing bio" },
          },
        },
      },
      {
        request: { query: profileQuery },
        result: { data: profileData, errors: [bioError] },
      },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(bioQuery),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { profile: { __typename: "Profile", id: "1", bio: "Existing bio" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  await client.query({ query: profileQuery, errorPolicy: "localized" });

  await expect(takeSnapshot).not.toRerender();
});

test("useMutation returns the full response shape and writes only the successful fields", async () => {
  const mutation: TypedDocumentNode<{
    updateProfile: {
      __typename: "Profile";
      id: string;
      name: string;
      bio: string | null;
    };
  }> = gql`
    mutation UpdateProfile {
      updateProfile {
        __typename
        id
        name
        bio
      }
    }
  `;
  const data = {
    updateProfile: {
      __typename: "Profile" as const,
      id: "1",
      name: "Alice",
      bio: null,
    },
  };
  const errors = [
    new GraphQLError("Could not load bio", { path: ["updateProfile", "bio"] }),
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      { request: { query: mutation }, result: { data, errors } },
    ]),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation, { errorPolicy: "localized" }),
    { wrapper: createClientWrapper(client) }
  );

  const [execute] = await takeSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data,
    error: new CombinedGraphQLErrors({ data, errors }),
  });

  expect(extract(client)["Profile:1"]).toStrictEqual({
    __typename: "Profile",
    id: "1",
    name: "Alice",
  });
});
