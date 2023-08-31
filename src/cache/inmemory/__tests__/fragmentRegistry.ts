import { ApolloClient, ApolloLink, gql, NetworkStatus } from "../../../core";
import { getFragmentDefinitions, Observable } from "../../../utilities";
import { InMemoryCache, createFragmentRegistry } from "../../index";
import { itAsync, subscribeAndCount } from "../../../testing";

describe("FragmentRegistry", () => {
  it("can be passed to InMemoryCache", () => {
    const cache = new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment BasicFragment on Query {
          basic
        }
      `),
    });

    // TODO Allow writeFragment to just use fragmentName:"BasicFragment"?
    cache.writeQuery({
      query: gql`
        query {
          ...BasicFragment
        }
      `,
      data: {
        basic: true,
      },
    });

    const result = cache.readQuery({
      query: gql`
        query {
          ...BasicFragment
        }
      `,
    });

    expect(result).toEqual({
      basic: true,
    });
  });

  itAsync("influences ApolloClient and ApolloLink", (resolve, reject) => {
    const cache = new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment SourceFragment on Query {
          source
        }
      `),
    });

    const client = new ApolloClient({
      cache,
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            expect(
              getFragmentDefinitions(operation.query)
                .map((def) => def.name.value)
                .sort()
            ).toEqual([
              // Proof that the missing SourceFragment definition was appended to
              // operation.query before it was passed into the link.
              "SourceFragment",
            ]);

            observer.next({
              data: {
                source: "link",
              },
            });

            observer.complete();
          })
      ),
    });

    const query = gql`
      query SourceQuery {
        ...SourceFragment
      }
    `;

    cache.writeQuery({
      query,
      data: {
        source: "local",
      },
    });

    subscribeAndCount(
      reject,
      client.watchQuery({
        query,
        fetchPolicy: "cache-and-network",
      }),
      (count, result) => {
        if (count === 1) {
          expect(result).toEqual({
            loading: true,
            networkStatus: NetworkStatus.loading,
            data: {
              __typename: "Query",
              source: "local",
            },
          });
        } else if (count === 2) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              __typename: "Query",
              source: "link",
            },
          });

          expect(cache.readQuery({ query })).toEqual({
            source: "link",
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Unexpectedly many results (${count})`);
        }
      }
    );
  });

  it("throws an error when not all used fragments are defined", () => {
    const cache = new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment IncompleteFragment on Person {
          __typename
          id
          ...MustBeDefinedByQuery
        }
      `),
    });

    const queryWithoutFragment = gql`
      query WithoutFragment {
        me {
          ...IncompleteFragment
        }
      }
    `;

    const queryWithFragment = gql`
      query WithFragment {
        me {
          ...IncompleteFragment
        }
      }

      fragment MustBeDefinedByQuery on Person {
        name
      }
    `;

    expect(() => {
      cache.writeQuery({
        query: queryWithoutFragment,
        data: {
          me: {
            __typename: "Person",
            id: 12345,
            name: "Ben",
          },
        },
      });
    }).toThrow(/No fragment named MustBeDefinedByQuery/);

    expect(cache.extract()).toEqual({
      // Nothing written because the cache.writeQuery failed above.
    });

    cache.writeQuery({
      query: queryWithFragment,
      data: {
        me: {
          __typename: "Person",
          id: 12345,
          name: "Ben Newman",
        },
      },
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        me: { __ref: "Person:12345" },
      },
      "Person:12345": {
        __typename: "Person",
        id: 12345,
        name: "Ben Newman",
      },
    });

    expect(() => {
      cache.diff({
        query: queryWithoutFragment,
        returnPartialData: true,
        optimistic: true,
      });
    }).toThrow(/No fragment named MustBeDefinedByQuery/);

    expect(() => {
      cache.readQuery({
        query: queryWithoutFragment,
      });
    }).toThrow(/No fragment named MustBeDefinedByQuery/);

    expect(
      cache.readQuery({
        query: queryWithFragment,
      })
    ).toEqual({
      me: {
        __typename: "Person",
        id: 12345,
        name: "Ben Newman",
      },
    });
  });

  it("can register fragments with unbound ...spreads", () => {
    const cache = new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment NeedsExtra on Person {
          __typename
          id
          # This fragment spread has a default definition below, but can be
          # selectively overridden by queries.
          ...ExtraFields
        }

        fragment ExtraFields on Person {
          __typename
        }
      `),
    });

    const query = gql`
      query GetMe {
        me {
          ...NeedsExtra
        }
      }

      # This version of the ExtraFields fragment will be used instead of the one
      # registered in the FragmentRegistry, because explicit definitions take
      # precedence over registered fragments.
      fragment ExtraFields on Person {
        name
      }
    `;

    cache.writeQuery({
      query,
      data: {
        me: {
          __typename: "Person",
          id: 12345,
          name: "Alice",
        },
      },
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        me: { __ref: "Person:12345" },
      },
      "Person:12345": {
        __typename: "Person",
        id: 12345,
        name: "Alice",
      },
    });

    expect(cache.readQuery({ query })).toEqual({
      me: {
        __typename: "Person",
        id: 12345,
        name: "Alice",
      },
    });
  });
});
