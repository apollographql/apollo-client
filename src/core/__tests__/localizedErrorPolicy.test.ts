import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";

import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { MockLink, MockSubscriptionLink } from "@apollo/client/testing";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

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

const profileResult = {
  data: {
    profile: {
      __typename: "Profile" as const,
      id: "1",
      name: "Alice",
      bio: null,
    },
  },
  errors: [bioError],
};

function extract(client: ApolloClient) {
  return (client.cache as InMemoryCache).extract();
}

function createClient(
  mocks: ConstructorParameters<typeof MockLink>[0],
  cache = new InMemoryCache()
) {
  return new ApolloClient({ cache, link: new MockLink(mocks) });
}

describe("errorPolicy: 'localized'", () => {
  describe("client.query", () => {
    it("resolves with the full response shape and the errors", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      await expect(
        client.query({ query: profileQuery, errorPolicy: "localized" })
      ).resolves.toStrictEqualTyped({
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: null,
          },
        },
        error: new CombinedGraphQLErrors(profileResult),
      });
    });

    it("writes only the fields without errors to the cache", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      expect(client.extract()).toStrictEqual({
        ROOT_QUERY: {
          __typename: "Query",
          profile: { __ref: "Profile:1" },
        },
        "Profile:1": {
          __typename: "Profile",
          id: "1",
          name: "Alice",
        },
      });
    });

    it("leaves the cache read incomplete for the errored field", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      expect(
        client.cache.diff({ query: profileQuery, optimistic: false }).complete
      ).toBe(false);
    });

    it("does not warn that the written result read back partial", async () => {
      using _ = spyOnConsole("warn");
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      expect(console.warn).not.toHaveBeenCalled();
    });

    it("writes the full result when the response has no errors", async () => {
      const client = createClient([
        {
          request: { query: profileQuery },
          result: {
            data: {
              profile: {
                __typename: "Profile",
                id: "1",
                name: "Alice",
                bio: "Hello",
              },
            },
          },
        },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
        bio: "Hello",
      });
    });

    it("writes the full result when the errors carry no path", async () => {
      const client = createClient([
        {
          request: { query: profileQuery },
          result: {
            data: {
              profile: {
                __typename: "Profile",
                id: "1",
                name: "Alice",
                bio: null,
              },
            },
            errors: [new GraphQLError("Something went wrong")],
          },
        },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
        bio: null,
      });
    });

    it("keeps a previously cached value for the errored field", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      client.writeQuery({
        query: profileQuery,
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: "Cached bio",
          },
        },
      });

      await client.query({
        query: profileQuery,
        errorPolicy: "localized",
        fetchPolicy: "network-only",
      });

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
        bio: "Cached bio",
      });
    });

    it("resolves with the cached value for the errored field when the cache read is complete", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      client.writeQuery({
        query: profileQuery,
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: "Cached bio",
          },
        },
      });

      await expect(
        client.query({
          query: profileQuery,
          errorPolicy: "localized",
          fetchPolicy: "network-only",
        })
      ).resolves.toStrictEqualTyped({
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: "Cached bio",
          },
        },
        error: new CombinedGraphQLErrors({
          data: {
            profile: {
              __typename: "Profile",
              id: "1",
              name: "Alice",
              bio: "Cached bio",
            },
          },
          errors: [bioError],
        }),
      });
    });

    it("rejects on a network error, like `none`", async () => {
      const networkError = new Error("Oops");
      const client = createClient([
        { request: { query: profileQuery }, error: networkError },
      ]);

      // A transport failure has no error `path`, so there is no field to localize
      // it to and no response shape to hand back. Resolving with an empty result
      // (what `all` does) would clear data the caller is already rendering.
      await expect(
        client.query({ query: profileQuery, errorPolicy: "localized" })
      ).rejects.toThrow(networkError);
    });

    it("omits a field on a single list item", async () => {
      const query = gql`
        query PeopleQuery {
          people {
            __typename
            id
            name
          }
        }
      `;
      const errors = [
        new GraphQLError("Could not load name", {
          path: ["people", 1, "name"],
        }),
      ];
      const client = createClient([
        {
          request: { query },
          result: {
            data: {
              people: [
                { __typename: "Person", id: "1", name: "Alice" },
                { __typename: "Person", id: "2", name: null },
              ],
            },
            errors,
          },
        },
      ]);

      await expect(
        client.query({ query, errorPolicy: "localized" })
      ).resolves.toStrictEqualTyped({
        data: {
          people: [
            { __typename: "Person", id: "1", name: "Alice" },
            { __typename: "Person", id: "2", name: null },
          ],
        },
        error: new CombinedGraphQLErrors({
          data: {
            people: [
              { __typename: "Person", id: "1", name: "Alice" },
              { __typename: "Person", id: "2", name: null },
            ],
          },
          errors,
        }),
      });

      expect(extract(client)["Person:1"]).toStrictEqual({
        __typename: "Person",
        id: "1",
        name: "Alice",
      });
      expect(extract(client)["Person:2"]).toStrictEqual({
        __typename: "Person",
        id: "2",
      });
    });

    it("omits the null parent when an error propagates up from a non-null field", async () => {
      const query = gql`
        query ProfileQuery {
          viewer
          profile {
            __typename
            id
            name
          }
        }
      `;
      const client = createClient([
        {
          request: { query },
          result: {
            data: { viewer: "me", profile: null },
            errors: [
              new GraphQLError("Could not load name", {
                path: ["profile", "name"],
              }),
            ],
          },
        },
      ]);

      await client.query({ query, errorPolicy: "localized" });

      expect(client.extract()).toStrictEqual({
        ROOT_QUERY: { __typename: "Query", viewer: "me" },
      });
    });

    it("writes the whole result under 'all' for comparison", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      await client.query({ query: profileQuery, errorPolicy: "all" });

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
        bio: null,
      });
    });
  });

  describe("client.watchQuery", () => {
    it("emits the full response shape together with the error", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      const stream = new ObservableStream(
        client.watchQuery({ query: profileQuery, errorPolicy: "localized" })
      );

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: null,
          },
        },
        dataState: "complete",
        error: new CombinedGraphQLErrors(profileResult),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does not replace the emitted result with the incomplete cache result", async () => {
      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
      ]);

      const observable = client.watchQuery({
        query: profileQuery,
        errorPolicy: "localized",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      await expect(stream).toEmitNext();

      // An unrelated cache write triggers a broadcast. The incomplete cache
      // result must not clobber the response the query already delivered.
      client.writeQuery({
        query: gql`
          query {
            unrelated
          }
        `,
        data: { unrelated: "value" },
      });

      await expect(stream).not.toEmitAnything();
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: null,
          },
        },
        dataState: "complete",
        error: new CombinedGraphQLErrors(profileResult),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });
    });

    it("broadcasts the successfully written fields to another watched query", async () => {
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

      const client = createClient([
        {
          request: { query: nameQuery },
          result: {
            data: {
              profile: { __typename: "Profile", id: "1", name: "Old name" },
            },
          },
        },
        { request: { query: profileQuery }, result: profileResult },
      ]);

      const nameStream = new ObservableStream(
        client.watchQuery({ query: nameQuery })
      );

      await expect(nameStream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      await expect(nameStream).toEmitTypedValue({
        data: { profile: { __typename: "Profile", id: "1", name: "Old name" } },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      // `name` was written and broadcast even though `bio` errored.
      await expect(nameStream).toEmitTypedValue({
        data: { profile: { __typename: "Profile", id: "1", name: "Alice" } },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    });

    it("does not broadcast an errored field to another watched query", async () => {
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

      const client = createClient([
        {
          request: { query: bioQuery },
          result: {
            data: {
              profile: { __typename: "Profile", id: "1", bio: "Existing bio" },
            },
          },
        },
        { request: { query: profileQuery }, result: profileResult },
      ]);

      const bioStream = new ObservableStream(
        client.watchQuery({ query: bioQuery })
      );

      await expect(bioStream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      await expect(bioStream).toEmitTypedValue({
        data: {
          profile: { __typename: "Profile", id: "1", bio: "Existing bio" },
        },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await client.query({ query: profileQuery, errorPolicy: "localized" });

      // `bio` was never written, so this query keeps its value and is not
      // notified with `null`.
      await expect(bioStream).not.toEmitAnything();
      expect(client.readQuery({ query: bioQuery })?.profile.bio).toBe(
        "Existing bio"
      );
    });

    it("clobbers the errored field for another watched query under 'all'", async () => {
      const bioQuery: TypedDocumentNode<{
        profile: { __typename: "Profile"; id: string; bio: string | null };
      }> = gql`
        query BioQuery {
          profile {
            __typename
            id
            bio
          }
        }
      `;

      const client = createClient([
        {
          request: { query: bioQuery },
          result: {
            data: {
              profile: { __typename: "Profile", id: "1", bio: "Existing bio" },
            },
          },
        },
        { request: { query: profileQuery }, result: profileResult },
      ]);

      const bioStream = new ObservableStream(
        client.watchQuery({ query: bioQuery })
      );

      await expect(bioStream).toEmitNext();
      await expect(bioStream).toEmitNext();

      await client.query({ query: profileQuery, errorPolicy: "all" });

      await expect(bioStream).toEmitTypedValue({
        data: { profile: { __typename: "Profile", id: "1", bio: null } },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    });

    it("emits the complete result once another operation supplies the missing field", async () => {
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

      const client = createClient([
        { request: { query: profileQuery }, result: profileResult },
        {
          request: { query: bioQuery },
          result: {
            data: {
              profile: { __typename: "Profile", id: "1", bio: "Repaired bio" },
            },
          },
        },
      ]);

      const stream = new ObservableStream(
        client.watchQuery({ query: profileQuery, errorPolicy: "localized" })
      );

      await expect(stream).toEmitNext();
      await expect(stream).toEmitNext();

      await client.query({ query: bioQuery });

      await expect(stream).toEmitTypedValue({
        data: {
          profile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: "Repaired bio",
          },
        },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    });
  });

  describe("client.mutate", () => {
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

    const mutationResult = {
      data: {
        updateProfile: {
          __typename: "Profile" as const,
          id: "1",
          name: "Alice",
          bio: null,
        },
      },
      errors: [
        new GraphQLError("Could not load bio", {
          path: ["updateProfile", "bio"],
        }),
      ],
    };

    it("resolves with the full response shape and the errors", async () => {
      const client = createClient([
        { request: { query: mutation }, result: mutationResult },
      ]);

      await expect(
        client.mutate({ mutation, errorPolicy: "localized" })
      ).resolves.toStrictEqualTyped({
        data: {
          updateProfile: {
            __typename: "Profile",
            id: "1",
            name: "Alice",
            bio: null,
          },
        },
        error: new CombinedGraphQLErrors(mutationResult),
      });
    });

    it("writes only the fields without errors to the cache", async () => {
      const client = createClient([
        { request: { query: mutation }, result: mutationResult },
      ]);

      await client.mutate({ mutation, errorPolicy: "localized" });

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
      });
    });

    it("rejects on a network error, like `none`", async () => {
      const networkError = new Error("Oops");
      const client = createClient([
        { request: { query: mutation }, error: networkError },
      ]);

      await expect(
        client.mutate({ mutation, errorPolicy: "localized" })
      ).rejects.toThrow(networkError);
    });
  });

  describe("client.subscribe", () => {
    it("writes only the fields without errors to the cache", async () => {
      const subscription = gql`
        subscription ProfileUpdated {
          profileUpdated {
            __typename
            id
            name
            bio
          }
        }
      `;
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({ cache: new InMemoryCache(), link });

      const stream = new ObservableStream(
        client.subscribe({ query: subscription, errorPolicy: "localized" })
      );

      link.simulateResult({
        result: {
          data: {
            profileUpdated: {
              __typename: "Profile",
              id: "1",
              name: "Alice",
              bio: null,
            },
          },
          errors: [
            new GraphQLError("Could not load bio", {
              path: ["profileUpdated", "bio"],
            }),
          ],
        },
      });

      await expect(stream).toEmitNext();

      expect(extract(client)["Profile:1"]).toStrictEqual({
        __typename: "Profile",
        id: "1",
        name: "Alice",
      });
    });
  });
});
