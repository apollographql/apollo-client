import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { GraphQLError } from "graphql";
import * as React from "react";

import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { useSuspenseQuery } from "@apollo/client/react";
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

test("resolves with the full response shape instead of throwing", async () => {
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
    () => useSuspenseQuery(profileQuery, { errorPolicy: "localized" }),
    {
      wrapper: createClientWrapper(client, ({ children }) => (
        <React.Suspense fallback="loading">{children}</React.Suspense>
      )),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: profileData,
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: profileData,
      errors: [bioError],
    }),
    networkStatus: NetworkStatus.error,
  });

  expect(extract(client)["Profile:1"]).toStrictEqual({
    __typename: "Profile",
    id: "1",
    name: "Alice",
  });
});
