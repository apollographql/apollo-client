import type { FragmentSpreadNode } from "graphql";
import { Kind, visit } from "graphql";
import { of } from "rxjs";

import type {
  Cache,
  DataProxy,
  FetchPolicy,
  OperationVariables,
  Reference,
  TypedDocumentNode,
} from "@apollo/client";
import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  DocumentTransform,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { createFragmentRegistry } from "@apollo/client/cache";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import type { MaskedDocumentNode, Unmasked } from "@apollo/client/masking";
import type { MockedResponse } from "@apollo/client/testing";
import { MockLink, MockSubscriptionLink, wait } from "@apollo/client/testing";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { isSubscriptionOperation } from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

const NO_CACHE_WARNING =
  '[%s]: Fragments masked by data masking are inaccessible when using fetch policy "no-cache". Please add `@unmask` to each fragment spread to access the data.';

describe("client.watchQuery", () => {
  test("masks queries when dataMasking is `true`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }
  });

  test("does not mask query when dataMasking is `false`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }
  });

  test("does not mask query by default", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }
  });

  test("does not mask fragments marked with @unmask", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }
  });

  test("does not mask fragments marked with @unmask added by document transforms", async () => {
    const documentTransform = new DocumentTransform((document) => {
      return visit(document, {
        FragmentSpread(node) {
          return {
            ...node,
            directives: [
              {
                kind: Kind.DIRECTIVE,
                name: { kind: Kind.NAME, value: "unmask" },
              },
            ],
          } satisfies FragmentSpreadNode;
        },
      });
    });

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
      documentTransform,
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }
  });

  test("does not mask query when using a cache that does not support it", async () => {
    using _ = spyOnConsole("warn");

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new TestCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "The configured cache does not support data masking"
      )
    );
  });

  test("masks queries updated by the cache", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }

    client.writeQuery({
      query,
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (updated)",
          age: 35,
        },
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (updated)",
        },
      });
    }
  });

  test("does not trigger update when updating field in named fragment", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }

    client.writeQuery({
      query,
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 35,
        },
      },
    });

    await expect(stream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(client.readQuery({ query })).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 35,
      },
    });
  });

  it.each(["cache-first", "cache-only"] as FetchPolicy[])(
    "masks result from cache when using with %s fetch policy",
    async (fetchPolicy) => {
      type UserFieldsFragment = {
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: MaskedDocumentNode<Query, never> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 30,
              },
            },
          },
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      client.writeQuery({
        query,
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      });

      const observable = client.watchQuery({ query, fetchPolicy });

      const stream = new ObservableStream(observable);

      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }
  );

  test("masks cache and network result when using cache-and-network fetch policy", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User (server)",
              age: 35,
            },
          },
        },
        delay: 20,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    client.writeQuery({
      query,
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 34,
        },
      },
    });

    const observable = client.watchQuery({
      query,
      fetchPolicy: "cache-and-network",
    });

    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (server)",
        },
      });
    }
  });

  test("masks partial cache data when returnPartialData is `true`", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User (server)",
              age: 35,
            },
          },
        },
        delay: 20,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    {
      // Silence warning about writing partial data
      using _ = spyOnConsole("error");

      client.writeQuery({
        query,
        data: {
          // @ts-expect-error writing partial data
          currentUser: {
            __typename: "User",
            id: 1,
            age: 34,
          },
        },
      });
    }

    const observable = client.watchQuery({
      query,
      returnPartialData: true,
    });

    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
        },
      });
    }

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (server)",
        },
      });
    }
  });

  test("masks partial data returned from data on errors with errorPolicy `all`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string | null;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: null,
              age: 34,
            },
          },
          errors: [{ message: "Couldn't get name" }],
        },
        delay: 20,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, errorPolicy: "all" });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: null,
        },
      },
      error: new CombinedGraphQLErrors({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: null,
            age: 34,
          },
        },
        errors: [{ message: "Couldn't get name" }],
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      partial: false,
    });
  });

  it.each([
    "cache-first",
    "network-only",
    "cache-and-network",
  ] as FetchPolicy[])(
    "masks result returned from getCurrentResult when using %s fetchPolicy",
    async (fetchPolicy) => {
      type UserFieldsFragment = {
        age: number;
      } & { " $fragmentName"?: "UserFieldsFragment" };

      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
      }

      const query: MaskedDocumentNode<Query, never> = gql`
        query MaskedQuery {
          currentUser {
            id
            name
            ...UserFields
          }
        }

        fragment UserFields on User {
          age
        }
      `;

      const mocks = [
        {
          request: { query },
          result: {
            data: {
              currentUser: {
                __typename: "User",
                id: 1,
                name: "Test User",
                age: 34,
              },
            },
          },
          delay: 20,
        },
      ];

      const client = new ApolloClient({
        dataMasking: true,
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const observable = client.watchQuery({ query, fetchPolicy });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      {
        const { data } = await stream.takeNext();

        expect(data).toEqual({
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
          },
        });
      }

      {
        const { data } = observable.getCurrentResult(false);

        expect(data).toEqual({
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
          },
        });
      }
    }
  );

  test("warns when accessing a unmasked field while using @unmask with mode: 'migrate'", async () => {
    using consoleSpy = spyOnConsole("warn");

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        /** @deprecated */
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
        name
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 34,
            },
          },
        },
        delay: 20,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();
      data!.currentUser.__typename;
      data!.currentUser.id;
      data!.currentUser.name;

      expect(consoleSpy.warn).not.toHaveBeenCalled();

      data!.currentUser.age;

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
        "query 'UnmaskedQuery'",
        "currentUser.age"
      );

      // Ensure we only warn once
      data!.currentUser.age;
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    }
  });

  // https://github.com/apollographql/apollo-client/issues/12043
  test("does not warn when passing @unmask(mode: 'migrate') object to cache.identify", async () => {
    using consoleSpy = spyOnConsole("warn");

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        /** @deprecated */
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask(mode: "migrate")
        }
      }

      fragment UserFields on User {
        age
        name
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 34,
            },
          },
        },
        delay: 20,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    const { data } = await stream.takeNext();

    const id = client.cache.identify(data!.currentUser);

    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(id).toEqual("User:1");
  });

  test("reads fragment by passing parent object to `from`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        age
      }
    `;

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      ${fragment}
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const queryStream = new ObservableStream(client.watchQuery({ query }));

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data!.currentUser,
    });

    const fragmentStream = new ObservableStream(fragmentObservable);

    {
      const { data, complete } = await fragmentStream.takeNext();

      expect(complete).toBe(true);
      expect(data).toEqual({ __typename: "User", age: 30 });
    }
  });

  test("warns when passing parent object to `from` when id is masked", async () => {
    using _ = spyOnConsole("warn");

    type UserFieldsFragment = {
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        id
        age
      }
    `;

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          name
          ...UserFields
        }
      }

      ${fragment}
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const queryStream = new ObservableStream(client.watchQuery({ query }));

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data!.currentUser,
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Could not identify object passed to `from` for '%s' fragment, either because the object is non-normalized or the key fields are missing. If you are masking this object, please ensure the key fields are requested by the parent object.",
      "UserFields"
    );

    const fragmentStream = new ObservableStream(fragmentObservable);

    {
      const { data, complete } = await fragmentStream.takeNext();

      expect(data).toEqual({});
      // TODO: Update when https://github.com/apollographql/apollo-client/issues/12003 is fixed
      expect(complete).toBe(true);
    }
  });

  test("warns when passing parent object to `from` that is non-normalized", async () => {
    using _ = spyOnConsole("warn");

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const fragment: TypedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        age
      }
    `;

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          name
          ...UserFields
        }
      }

      ${fragment}
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const queryStream = new ObservableStream(client.watchQuery({ query }));

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data!.currentUser,
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Could not identify object passed to `from` for '%s' fragment, either because the object is non-normalized or the key fields are missing. If you are masking this object, please ensure the key fields are requested by the parent object.",
      "UserFields"
    );

    const fragmentStream = new ObservableStream(fragmentObservable);

    {
      const { data, complete } = await fragmentStream.takeNext();

      expect(data).toEqual({});
      // TODO: Update when https://github.com/apollographql/apollo-client/issues/12003 is fixed
      expect(complete).toBe(true);
    }
  });

  test("can lookup unmasked fragments from the fragment registry in queries", async () => {
    const fragments = createFragmentRegistry();

    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }
    `;

    fragments.register(gql`
      fragment UserFields on User {
        age
      }
    `);

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache({ fragments }),
      link: new ApolloLink(() => {
        return of({
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        });
      }),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
    }
  });

  test("masks result of refetch", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query UnmaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 31,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    });
    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
    }

    const result = await observable.refetch();

    expect(result.data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });

    expect(client.readQuery({ query })).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 31,
      },
    });

    // Since we don't set notifyOnNetworkStatus to `true`, we don't expect to
    // see another result since the masked data did not change
    await expect(stream).not.toEmitAnything();
  });

  test("masks result of setVariables", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      user: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    interface Variables {
      id: number;
    }

    const query: MaskedDocumentNode<Query, Variables> = gql`
      query UnmaskedQuery($id: ID!) {
        user(id: $id) {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: {
          data: {
            user: {
              __typename: "User",
              id: 1,
              name: "User 1",
              age: 30,
            },
          },
        },
      },
      {
        request: { query, variables: { id: 2 } },
        result: {
          data: {
            user: {
              __typename: "User",
              id: 2,
              name: "User 2",
              age: 31,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        user: {
          __typename: "User",
          id: 1,
          name: "User 1",
        },
      });
    }

    const result = await observable.setVariables({ id: 2 });

    expect(result.data).toEqual({
      user: {
        __typename: "User",
        id: 2,
        name: "User 2",
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        user: {
          __typename: "User",
          id: 2,
          name: "User 2",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  test("masks result of reobserve", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      user: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    interface Variables {
      id: number;
    }

    const query: MaskedDocumentNode<Query, Variables> = gql`
      query UnmaskedQuery($id: ID!) {
        user(id: $id) {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: {
          data: {
            user: {
              __typename: "User",
              id: 1,
              name: "User 1",
              age: 30,
            },
          },
        },
      },
      {
        request: { query, variables: { id: 2 } },
        result: {
          data: {
            user: {
              __typename: "User",
              id: 2,
              name: "User 2",
              age: 31,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        user: {
          __typename: "User",
          id: 1,
          name: "User 1",
        },
      });
    }

    const result = await observable.reobserve({ variables: { id: 2 } });

    expect(result.data).toEqual({
      user: {
        __typename: "User",
        id: 2,
        name: "User 2",
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        user: {
          __typename: "User",
          id: 2,
          name: "User 2",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  test("does not mask data passed to updateQuery", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      user: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    interface Variables {
      id: number;
    }

    const query: MaskedDocumentNode<Query, Variables> = gql`
      query UnmaskedQuery($id: ID!) {
        user(id: $id) {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeQuery({
      query,
      data: {
        user: {
          __typename: "User",
          id: 1,
          name: "User 1",
          age: 30,
        },
      },
      variables: { id: 1 },
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        user: {
          __typename: "User",
          id: 1,
          name: "User 1",
        },
      });
    }

    const updateQuery: Parameters<typeof observable.updateQuery>[0] = jest.fn(
      (previousResult, { complete, previousData }) => {
        expect(complete).toBe(true);
        expect(previousData).toStrictEqual(previousResult);
        // Type Guard
        if (!complete) {
          return;
        }
        return {
          user: { ...previousData.user, name: "User (updated)" },
        };
      }
    );

    observable.updateQuery(updateQuery);

    expect(updateQuery).toHaveBeenCalledWith(
      { user: { __typename: "User", id: 1, name: "User 1", age: 30 } },
      {
        variables: { id: 1 },
        complete: true,
        previousData: {
          user: { __typename: "User", id: 1, name: "User 1", age: 30 },
        },
      }
    );

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        user: {
          __typename: "User",
          id: 1,
          name: "User (updated)",
        },
      });
    }

    await expect(stream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );
  });

  test("masks deferred fragments", async () => {
    type GreetingFragment = {
      recipient: {
        name: string;
      };
    } & { " $fragmentName"?: "GreetingFragment" };

    interface Query {
      greeting: {
        __typename: "Greeting";
        message: string;
      } & { " $fragmentRefs"?: { GreetingFragment: GreetingFragment } };
    }

    const fragment: MaskedDocumentNode<GreetingFragment> = gql`
      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }
    `;

    const query: MaskedDocumentNode<Query> = gql`
      query {
        greeting {
          message
          ...GreetingFragment @defer
        }
      }

      ${fragment}
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              recipient: { name: "Alice", __typename: "Person" },
              __typename: "Greeting",
            },
            path: ["greeting"],
          },
        ],
        hasNext: false,
      },
    });

    // Since the fragment data is masked, we don't expect to get another result
    await expect(stream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(client.readQuery({ query })).toEqual({
      greeting: {
        message: "Hello world",
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Alice" },
      },
    });
  });

  test("masks deferred fragments within inline fragments", async () => {
    type GreetingFragment = {
      recipient: {
        name: string;
      };
    } & { " $fragmentName"?: "GreetingFragment" };

    interface Query {
      greeting: {
        __typename: "Greeting";
        message: string;
      } & { " $fragmentRefs"?: { GreetingFragment: GreetingFragment } };
    }

    const fragment: MaskedDocumentNode<GreetingFragment> = gql`
      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }
    `;

    const query: MaskedDocumentNode<Query> = gql`
      query {
        greeting {
          message
          ... @defer {
            sentAt
            ...GreetingFragment
          }
        }
      }

      ${fragment}
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              sentAt: "2024-01-01",
              recipient: { name: "Alice", __typename: "Person" },
              __typename: "Greeting",
            },
            path: ["greeting"],
          },
        ],
        hasNext: false,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sentAt: "2024-01-01",
        },
      });
    }

    expect(client.readQuery({ query })).toEqual({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "Person", name: "Alice" },
      },
    });
  });

  test("does not mask deferred fragments marked with @unmask", async () => {
    type GreetingFragment = {
      recipient: {
        name: string;
      };
    } & { " $fragmentName"?: "GreetingFragment" };

    interface Query {
      greeting: {
        __typename: "Greeting";
        message: string;
        recipient: {
          __typename: "Person";
          name: string;
        };
      } & { " $fragmentRefs"?: { GreetingFragment: GreetingFragment } };
    }

    const fragment: MaskedDocumentNode<GreetingFragment> = gql`
      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }
    `;

    const query: MaskedDocumentNode<Query> = gql`
      query {
        greeting {
          message
          ...GreetingFragment @defer @unmask
        }
      }

      ${fragment}
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: { name: "Alice", __typename: "Person" },
                __typename: "Greeting",
              },
              path: ["greeting"],
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      });
    }

    expect(client.readQuery({ query })).toEqual({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    });
  });

  test("handles deferred fragments with a mix of masked and unmasked", async () => {
    type GreetingFragment = {
      recipient: {
        name: string;
      };
    } & { " $fragmentName"?: "GreetingFragment" };

    type TimeFieldsFragment = {
      sentAt: string;
    } & { " $fragmentName"?: "TimeFieldsFragment" };

    interface Query {
      greeting: {
        __typename: "Greeting";
        message: string;
        recipient: {
          __typename: "Person";
          name: string;
        };
      } & {
        " $fragmentRefs"?: {
          GreetingFragment: GreetingFragment;
          TimeFieldsFragment: TimeFieldsFragment;
        };
      };
    }

    const query: MaskedDocumentNode<Query> = gql`
      query {
        greeting {
          message
          ... @defer {
            ...GreetingFragment @unmask
            ...TimeFieldsFragment
          }
        }
      }

      fragment GreetingFragment on Greeting {
        recipient {
          name
        }
      }

      fragment TimeFieldsFragment on Greeting {
        sentAt
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query, variables: { id: 1 } });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: { message: "Hello world", __typename: "Greeting" },
      });
    }

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                sentAt: "2024-01-01",
                recipient: { name: "Alice", __typename: "Person" },
                __typename: "Greeting",
              },
              path: ["greeting"],
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      });
    }

    expect(client.readQuery({ query })).toEqual({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        sentAt: "2024-01-01",
        recipient: { __typename: "Person", name: "Alice" },
      },
    });
  });

  test("warns and returns masked result when used with no-cache fetch policy", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, fetchPolicy: "no-cache" });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(NO_CACHE_WARNING, "MaskedQuery");
  });

  test("does not warn on no-cache queries when data masking is disabled", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, fetchPolicy: "no-cache" });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          // @ts-expect-error using a no-cache query
          age: 30,
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn on no-cache queries when all fragments use `@unmask`", async () => {
    using _ = spyOnConsole("warn");

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, fetchPolicy: "no-cache" });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warns on no-cache queries when at least one fragment does not use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
        ...ProfileFields
      }

      fragment ProfileFields on User {
        username
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
              username: "testuser",
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query, fetchPolicy: "no-cache" });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(NO_CACHE_WARNING, "MaskedQuery");
  });
});

describe("client.watchFragment", () => {
  test("masks watched fragments when dataMasking is `true`", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: { NameFieldsFragment: NameFieldsFragment };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    const nameFieldsFragment: MaskedDocumentNode<NameFieldsFragment> = gql`
      fragment NameFields on User {
        firstName
        lastName
      }
    `;

    const userFieldsFragment: MaskedDocumentNode<UserFieldsFragment> = gql`
      fragment UserFields on User {
        id
        age
        ...NameFields
      }

      ${nameFieldsFragment}
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        age: 30,
        firstName: "Test",
        lastName: "User",
      },
    });

    const fragmentStream = new ObservableStream(
      client.watchFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        from: { __typename: "User", id: 1 },
      })
    );

    const { data, complete } = await fragmentStream.takeNext();

    expect(data).toEqual({ __typename: "User", id: 1, age: 30 });
    expect(complete).toBe(true);
    invariant(complete, "Should never be incomplete");

    const nestedFragmentStream = new ObservableStream(
      client.watchFragment({ fragment: nameFieldsFragment, from: data })
    );

    {
      const { data, complete } = await nestedFragmentStream.takeNext();

      expect(complete).toBe(true);
      expect(data).toEqual({
        __typename: "User",
        firstName: "Test",
        lastName: "User",
      });
    }
  });

  test("does not mask watched fragments when dataMasking is disabled", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: { NameFieldsFragment: NameFieldsFragment };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    const nameFieldsFragment: TypedDocumentNode<NameFieldsFragment> = gql`
      fragment NameFields on User {
        __typename
        firstName
        lastName
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment> = gql`
      fragment UserFields on User {
        __typename
        id
        age
        ...NameFields
      }

      ${nameFieldsFragment}
    `;

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        age: 30,
        firstName: "Test",
        lastName: "User",
      },
    });

    const fragmentStream = new ObservableStream(
      client.watchFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        from: { __typename: "User", id: 1 },
      })
    );

    const { data, complete } = await fragmentStream.takeNext();

    expect(data).toEqual({
      __typename: "User",
      id: 1,
      age: 30,
      firstName: "Test",
      lastName: "User",
    });
    expect(complete).toBe(true);
    invariant(complete, "Should never be incomplete");

    const nestedFragmentStream = new ObservableStream(
      client.watchFragment({ fragment: nameFieldsFragment, from: data })
    );

    {
      const { data, complete } = await nestedFragmentStream.takeNext();

      expect(complete).toBe(true);
      expect(data).toEqual({
        __typename: "User",
        firstName: "Test",
        lastName: "User",
      });
    }
  });

  test("does not mask watched fragments by default", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: { NameFieldsFragment: NameFieldsFragment };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    const nameFieldsFragment: TypedDocumentNode<NameFieldsFragment> = gql`
      fragment NameFields on User {
        __typename
        firstName
        lastName
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment> = gql`
      fragment UserFields on User {
        __typename
        id
        age
        ...NameFields
      }

      ${nameFieldsFragment}
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        age: 30,
        firstName: "Test",
        lastName: "User",
      },
    });

    const fragmentStream = new ObservableStream(
      client.watchFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        from: { __typename: "User", id: 1 },
      })
    );

    const { data, complete } = await fragmentStream.takeNext();

    expect(data).toEqual({
      __typename: "User",
      id: 1,
      age: 30,
      firstName: "Test",
      lastName: "User",
    });
    expect(complete).toBe(true);
    invariant(complete, "Should never be incomplete");

    const nestedFragmentStream = new ObservableStream(
      client.watchFragment({ fragment: nameFieldsFragment, from: data })
    );

    {
      const { data, complete } = await nestedFragmentStream.takeNext();

      expect(complete).toBe(true);
      expect(data).toEqual({
        __typename: "User",
        firstName: "Test",
        lastName: "User",
      });
    }
  });

  test("does not mask watched fragments marked with @unmask", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName"?: "ProfileFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        id
        name
        ...ProfileFields @unmask
      }

      fragment ProfileFields on User {
        age
      }
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    const observable = client.watchFragment({
      fragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      });
    }
  });

  test("masks watched fragments updated by the cache", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        id
        name
        ...ProfileFields
      }

      fragment ProfileFields on User {
        age
      }
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    const observable = client.watchFragment({
      fragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        name: "Test User",
      });
    }

    client.writeFragment({
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User (updated)",
        // @ts-ignore TODO: Determine how to handle cache writes with masked
        // query type
        age: 35,
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        name: "Test User (updated)",
      });
    }
  });

  test("does not trigger update on watched fragment when updating field in named fragment", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        id
        name
        ...ProfileFields
      }

      fragment ProfileFields on User {
        age
      }
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 30,
      },
    });

    const observable = client.watchFragment({
      fragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });
    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        name: "Test User",
      });
    }

    client.writeFragment({
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 35,
      },
    });

    await expect(stream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(
      client.readFragment({
        fragment,
        fragmentName: "UserFields",
        id: "User:1",
      })
    ).toEqual({
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 35,
    });
  });

  test("triggers update to child watched fragment when updating field in named fragment", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const profileFieldsFragment: MaskedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
      }
    `;

    const userFieldsFragment: MaskedDocumentNode<UserFieldsFragment, never> =
      gql`
        fragment UserFields on User {
          id
          name
          ...ProfileFields
        }

        ${profileFieldsFragment}
      `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 30,
      },
    });

    const userFieldsObservable = client.watchFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const nameFieldsObservable = client.watchFragment({
      fragment: profileFieldsFragment,
      from: { __typename: "User", id: 1 },
    });

    const userFieldsStream = new ObservableStream(userFieldsObservable);
    const nameFieldsStream = new ObservableStream(nameFieldsObservable);

    {
      const { data } = await userFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        name: "Test User",
      });
    }

    {
      const { data } = await nameFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        age: 30,
      });
    }

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        name: "Test User",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 35,
      },
    });

    {
      const { data } = await nameFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        age: 35,
      });
    }

    await expect(userFieldsStream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(
      client.readFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        id: "User:1",
      })
    ).toEqual({
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 35,
    });
  });

  test("does not trigger update to watched fragments when updating field in named fragment with @nonreactive", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
      lastUpdatedAt: string;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      lastUpdatedAt: string;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const profileFieldsFragment: MaskedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
        lastUpdatedAt @nonreactive
      }
    `;

    const userFieldsFragment: MaskedDocumentNode<UserFieldsFragment, never> =
      gql`
        fragment UserFields on User {
          id
          lastUpdatedAt @nonreactive
          ...ProfileFields
        }

        ${profileFieldsFragment}
      `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-01",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 30,
      },
    });

    const userFieldsObservable = client.watchFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const profileFieldsObservable = client.watchFragment({
      fragment: profileFieldsFragment,
      from: { __typename: "User", id: 1 },
    });

    const userFieldsStream = new ObservableStream(userFieldsObservable);
    const profileFieldsStream = new ObservableStream(profileFieldsObservable);

    {
      const { data } = await userFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-01",
      });
    }

    {
      const { data } = await profileFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        age: 30,
        lastUpdatedAt: "2024-01-01",
      });
    }

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-02",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 30,
      },
    });

    await expect(userFieldsStream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );
    await expect(profileFieldsStream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(
      client.readFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        id: "User:1",
      })
    ).toEqual({
      __typename: "User",
      id: 1,
      lastUpdatedAt: "2024-01-02",
      age: 30,
    });
  });

  test("does not trigger update to watched fragments when updating parent field with @nonreactive and child field", async () => {
    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
      lastUpdatedAt: string;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      lastUpdatedAt: string;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const profileFieldsFragment: MaskedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
        lastUpdatedAt @nonreactive
      }
    `;

    const userFieldsFragment: MaskedDocumentNode<UserFieldsFragment, never> =
      gql`
        fragment UserFields on User {
          id
          lastUpdatedAt @nonreactive
          ...ProfileFields
        }

        ${profileFieldsFragment}
      `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-01",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 30,
      },
    });

    const userFieldsObservable = client.watchFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const profileFieldsObservable = client.watchFragment({
      fragment: profileFieldsFragment,
      from: { __typename: "User", id: 1 },
    });

    const userFieldsStream = new ObservableStream(userFieldsObservable);
    const profileFieldsStream = new ObservableStream(profileFieldsObservable);

    {
      const { data } = await userFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-01",
      });
    }

    {
      const { data } = await profileFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        age: 30,
        lastUpdatedAt: "2024-01-01",
      });
    }

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        lastUpdatedAt: "2024-01-02",
        // @ts-ignore TODO: Determine how to handle cache writes with masking
        age: 31,
      },
    });

    {
      const { data } = await profileFieldsStream.takeNext();

      expect(data).toEqual({
        __typename: "User",
        age: 31,
        lastUpdatedAt: "2024-01-02",
      });
    }

    await expect(userFieldsStream.takeNext()).rejects.toThrow(
      new Error("Timeout waiting for next event")
    );

    expect(
      client.readFragment({
        fragment: userFieldsFragment,
        fragmentName: "UserFields",
        id: "User:1",
      })
    ).toEqual({
      __typename: "User",
      id: 1,
      lastUpdatedAt: "2024-01-02",
      age: 31,
    });
  });

  test("warns when accessing an unmasked field on a watched fragment while using @unmask with mode: 'migrate'", async () => {
    using consoleSpy = spyOnConsole("warn");

    type ProfileFieldsFragment = {
      __typename: "User";
      age: number;
      name: string;
    } & { " $fragmentName": "UserFieldsFragment" };

    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      name: string;
      /** @deprecated */
      age: number;
    } & { " $fragmentName": "UserFieldsFragment" } & {
      " $fragmentRefs": { ProfileFieldsFragment: ProfileFieldsFragment };
    };

    const fragment: MaskedDocumentNode<UserFieldsFragment, never> = gql`
      fragment UserFields on User {
        id
        name
        ...ProfileFields @unmask(mode: "migrate")
      }

      fragment ProfileFields on User {
        age
        name
      }
    `;

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
    });

    client.writeFragment({
      id: client.cache.identify({ __typename: "User", id: 1 }),
      fragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        age: 30,
        name: "Test User",
      },
    });

    const observable = client.watchFragment({
      fragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });
    const stream = new ObservableStream(observable);

    {
      const { data } = await stream.takeNext();
      data.__typename;
      data.id;
      data.name;

      expect(consoleSpy.warn).not.toHaveBeenCalled();

      data.age;

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
        "fragment 'UserFields'",
        "age"
      );

      // Ensure we only warn once
      data.age;
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    }
  });

  test("can lookup unmasked fragments from the fragment registry in watched fragments", async () => {
    const fragments = createFragmentRegistry();

    const profileFieldsFragment = gql`
      fragment ProfileFields on User {
        age
      }
    `;

    const userFieldsFragment = gql`
      fragment UserFields on User {
        id
        ...ProfileFields @unmask
      }
    `;

    fragments.register(profileFieldsFragment);

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache({ fragments }),
    });

    client.writeFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      data: {
        __typename: "User",
        id: 1,
        age: 30,
      },
    });

    const observable = client.watchFragment({
      fragment: userFieldsFragment,
      fragmentName: "UserFields",
      from: { __typename: "User", id: 1 },
    });

    const stream = new ObservableStream(observable);

    {
      const result = await stream.takeNext();

      expect(result).toEqual({
        data: {
          __typename: "User",
          id: 1,
          age: 30,
        },
        complete: true,
      });
    }
  });
});

describe("client.query", () => {
  test("masks data returned from client.query when dataMasking is `true`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });
  });

  test("does not mask data returned from client.query when dataMasking is `false`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });
  });

  test("does not mask data returned from client.query by default", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: TypedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });
  });

  test("handles errors returned when using errorPolicy `none`", async () => {
    const query = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          errors: [{ message: "User not logged in" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    await expect(client.query({ query, errorPolicy: "none" })).rejects.toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "User not logged in" }] })
    );
  });

  test("handles errors returned when using errorPolicy `all`", async () => {
    const query = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: { currentUser: null },
          errors: [{ message: "User not logged in" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const result = await client.query({ query, errorPolicy: "all" });

    expect(result).toStrictEqualTyped({
      data: { currentUser: null },
      error: new CombinedGraphQLErrors({
        data: { currentUser: null },
        errors: [{ message: "User not logged in" }],
      }),
    });
  });

  test("masks fragment data in fields nulled by errors when using errorPolicy `all`", async () => {
    const query = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: null,
            },
          },
          errors: [{ message: "Could not determine age" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const result = await client.query({ query, errorPolicy: "all" });

    expect(result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      error: new CombinedGraphQLErrors({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: null,
          },
        },
        errors: [{ message: "Could not determine age" }],
      }),
    });
  });

  test("warns and returns masked result when used with no-cache fetch policy", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(NO_CACHE_WARNING, "MaskedQuery");
  });

  test("does not warn on no-cache queries when data masking is disabled", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn on no-cache queries when all fragments use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warns on no-cache queries when at least one fragment does not use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const query: MaskedDocumentNode<Query, never> = gql`
      query MaskedQuery {
        currentUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
        ...ProfileFields
      }

      fragment ProfileFields on User {
        username
      }
    `;

    const mocks = [
      {
        request: { query },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
              username: "testuser",
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.query({ query, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(NO_CACHE_WARNING, "MaskedQuery");
  });
});

describe("client.subscribe", () => {
  test("masks data returned from subscriptions when dataMasking is `true`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({ query: subscription });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
      },
    });
  });

  test("does not mask data returned from subscriptions when dataMasking is `false`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({ query: subscription });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
        comment: "Test comment",
        author: "Test User",
      },
    });
  });

  test("does not mask data returned from subscriptions by default", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({ query: subscription });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
        comment: "Test comment",
        author: "Test User",
      },
    });
  });

  test("handles errors returned from the subscription when errorPolicy is `none`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      errorPolicy: "none",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: null,
        },
        errors: [{ message: "Something went wrong" }],
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: { addedComment: null },
        errors: [{ message: "Something went wrong" }],
      }),
    });
  });

  test("handles errors returned from the subscription when errorPolicy is `all`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      errorPolicy: "all",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: null,
        },
        errors: [{ message: "Something went wrong" }],
      },
    });

    await expect(stream).toEmitTypedValue({
      data: { addedComment: null },
      error: new CombinedGraphQLErrors({
        data: { addedComment: null },
        errors: [{ message: "Something went wrong" }],
      }),
    });
  });

  test("masks partial data for errors returned from the subscription when errorPolicy is `all`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      errorPolicy: "all",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: null,
          },
        },
        errors: [{ message: "Could not get author" }],
      },
    });

    await expect(stream).toEmitTypedValue({
      data: { addedComment: { __typename: "Comment", id: 1 } },
      error: new CombinedGraphQLErrors({
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: null,
          },
        },
        errors: [{ message: "Could not get author" }],
      }),
    });
  });

  test("warns and returns masked result when used with no-cache fetch policy", async () => {
    using _ = spyOnConsole("warn");
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      fetchPolicy: "no-cache",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        addedComment: {
          __typename: "Comment",
          id: 1,
        },
      });
    }

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 2,
            comment: "Test comment 2",
            author: "Test User",
          },
        },
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({
        addedComment: {
          __typename: "Comment",
          id: 2,
        },
      });
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      NO_CACHE_WARNING,
      "NewCommentSubscription"
    );
  });

  test("does not warn on no-cache queries when data masking is disabled", async () => {
    using _ = spyOnConsole("warn");
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      fetchPolicy: "no-cache",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
        comment: "Test comment",
        author: "Test User",
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn on no-cache queries when all fragments use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields @unmask
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      fetchPolicy: "no-cache",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
        comment: "Test comment",
        author: "Test User",
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warns on no-cache queries when at least one fragment does not use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields @unmask
        }
      }

      fragment CommentFields on Comment {
        comment
        author {
          ...AuthorFields
        }
      }

      fragment AuthorFields on User {
        name
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      fetchPolicy: "no-cache",
    });
    const stream = new ObservableStream(observable);

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: { __typename: "User", name: "Test User" },
          },
        },
      },
    });

    const { data } = await stream.takeNext();

    expect(data).toEqual({
      addedComment: {
        __typename: "Comment",
        id: 1,
        comment: "Test comment",
        author: { __typename: "User" },
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      NO_CACHE_WARNING,
      "NewCommentSubscription"
    );
  });
});

describe("observableQuery.subscribeToMore", () => {
  test("masks query data, does not mask updateQuery callback when dataMasking is `true`", async () => {
    const fragment = gql`
      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const query = gql`
      query RecentCommentQuery {
        recentComment {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const mocks: MockedResponse[] = [
      {
        request: { query },
        result: {
          data: {
            recentComment: {
              __typename: "Comment",
              id: 1,
              comment: "Recent comment",
              author: "Test User",
            },
          },
        },
      },
    ];

    const subscriptionLink = new MockSubscriptionLink();
    const link = ApolloLink.split(
      (operation) => isSubscriptionOperation(operation.query),
      subscriptionLink,
      new MockLink(mocks)
    );

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query });
    const queryStream = new ObservableStream(observable);

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({ recentComment: { __typename: "Comment", id: 1 } });
    }

    const updateQuery = jest.fn((_, { subscriptionData }) => {
      return { recentComment: subscriptionData.data.addedComment };
    });

    observable.subscribeToMore({ document: subscription, updateQuery });

    subscriptionLink.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 2,
            comment: "Most recent comment",
            author: "Test User Jr.",
          },
        },
      },
    });

    await wait(0);

    expect(updateQuery).toHaveBeenLastCalledWith(
      {
        recentComment: {
          __typename: "Comment",
          id: 1,
          comment: "Recent comment",
          author: "Test User",
        },
      },
      {
        complete: true,
        variables: undefined,
        previousData: {
          recentComment: {
            __typename: "Comment",
            id: 1,
            comment: "Recent comment",
            author: "Test User",
          },
        },
        subscriptionData: {
          data: {
            addedComment: {
              __typename: "Comment",
              id: 2,
              comment: "Most recent comment",
              author: "Test User Jr.",
            },
          },
        },
      }
    );

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({ recentComment: { __typename: "Comment", id: 2 } });
    }
  });

  test("does not mask data returned from subscriptions when dataMasking is `false`", async () => {
    const fragment = gql`
      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const query = gql`
      query RecentCommentQuery {
        recentComment {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const mocks: MockedResponse[] = [
      {
        request: { query },
        result: {
          data: {
            recentComment: {
              __typename: "Comment",
              id: 1,
              comment: "Recent comment",
              author: "Test User",
            },
          },
        },
      },
    ];

    const subscriptionLink = new MockSubscriptionLink();
    const link = ApolloLink.split(
      (operation) => isSubscriptionOperation(operation.query),
      subscriptionLink,
      new MockLink(mocks)
    );

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({ query });
    const queryStream = new ObservableStream(observable);

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({
        recentComment: {
          __typename: "Comment",
          id: 1,
          comment: "Recent comment",
          author: "Test User",
        },
      });
    }

    const updateQuery = jest.fn((_, { subscriptionData }) => {
      return { recentComment: subscriptionData.data.addedComment };
    });

    observable.subscribeToMore({ document: subscription, updateQuery });

    subscriptionLink.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 2,
            comment: "Most recent comment",
            author: "Test User Jr.",
          },
        },
      },
    });

    await wait(0);

    expect(updateQuery).toHaveBeenLastCalledWith(
      {
        recentComment: {
          __typename: "Comment",
          id: 1,
          comment: "Recent comment",
          author: "Test User",
        },
      },
      {
        complete: true,
        variables: undefined,
        previousData: {
          recentComment: {
            __typename: "Comment",
            id: 1,
            comment: "Recent comment",
            author: "Test User",
          },
        },
        subscriptionData: {
          data: {
            addedComment: {
              __typename: "Comment",
              id: 2,
              comment: "Most recent comment",
              author: "Test User Jr.",
            },
          },
        },
      }
    );

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({
        recentComment: {
          __typename: "Comment",
          id: 2,
          comment: "Most recent comment",
          author: "Test User Jr.",
        },
      });
    }
  });

  test("does not mask data by default", async () => {
    const fragment = gql`
      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const query = gql`
      query RecentCommentQuery {
        recentComment {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const subscription = gql`
      subscription NewCommentSubscription($id: ID!) {
        addedComment(id: $id) {
          id
          ...CommentFields
        }
      }

      ${fragment}
    `;

    const mocks: MockedResponse[] = [
      {
        request: { query },
        result: {
          data: {
            recentComment: {
              __typename: "Comment",
              id: 1,
              comment: "Recent comment",
              author: "Test User",
            },
          },
        },
      },
    ];

    const subscriptionLink = new MockSubscriptionLink();
    const link = ApolloLink.split(
      (operation) => isSubscriptionOperation(operation.query),
      subscriptionLink,
      new MockLink(mocks)
    );

    const client = new ApolloClient({ cache: new InMemoryCache(), link });
    const observable = client.watchQuery({ query });
    const queryStream = new ObservableStream(observable);

    await expect(queryStream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({
        recentComment: {
          __typename: "Comment",
          id: 1,
          comment: "Recent comment",
          author: "Test User",
        },
      });
    }

    const updateQuery = jest.fn((_, { subscriptionData }) => {
      return { recentComment: subscriptionData.data.addedComment };
    });

    observable.subscribeToMore({
      document: subscription,
      updateQuery,
      variables: { id: 1 },
    });

    subscriptionLink.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 2,
            comment: "Most recent comment",
            author: "Test User Jr.",
          },
        },
      },
    });

    await wait(0);

    expect(updateQuery).toHaveBeenLastCalledWith(
      {
        recentComment: {
          __typename: "Comment",
          id: 1,
          comment: "Recent comment",
          author: "Test User",
        },
      },
      {
        complete: true,
        variables: undefined,
        previousData: {
          recentComment: {
            __typename: "Comment",
            id: 1,
            comment: "Recent comment",
            author: "Test User",
          },
        },
        subscriptionData: {
          data: {
            addedComment: {
              __typename: "Comment",
              id: 2,
              comment: "Most recent comment",
              author: "Test User Jr.",
            },
          },
        },
      }
    );

    {
      const { data } = await queryStream.takeNext();

      expect(data).toEqual({
        recentComment: {
          __typename: "Comment",
          id: 2,
          comment: "Most recent comment",
          author: "Test User Jr.",
        },
      });
    }
  });
});

describe("client.mutate", () => {
  test("masks data returned from client.mutate when dataMasking is `true`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });
  });

  test("does not mask data returned from client.mutate when dataMasking is `false`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: TypedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });
  });

  test("does not mask data returned from client.mutate by default", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: TypedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });
  });

  test("does not mask data passed to update function", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      dataMasking: true,
      cache,
      link: new MockLink(mocks),
    });

    const update = jest.fn();
    await client.mutate({ mutation, update });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      cache,
      {
        data: {
          updateUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
      { context: undefined, variables: {} }
    );
  });

  test("handles errors returned when using errorPolicy `none`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          errors: [{ message: "User not logged in" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    await expect(
      client.mutate({ mutation, errorPolicy: "none" })
    ).rejects.toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "User not logged in" }] })
    );
  });

  test("handles errors returned when using errorPolicy `all`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser:
        | ({
            __typename: "User";
            id: number;
            name: string;
          } & {
            " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
          })
        | null;
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: { updateUser: null },
          errors: [{ message: "User not logged in" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    await expect(
      client.mutate({
        mutation,
        errorPolicy: "all",
      })
    ).resolves.toStrictEqualTyped({
      data: { updateUser: null },
      error: new CombinedGraphQLErrors({
        data: { updateUser: null },
        errors: [{ message: "User not logged in" }],
      }),
    });
  });

  test("masks fragment data in fields nulled by errors when using errorPolicy `all`", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: null,
            },
          },
          errors: [{ message: "Could not determine age" }],
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    await expect(
      client.mutate({
        mutation,
        errorPolicy: "all",
      })
    ).resolves.toStrictEqualTyped({
      data: {
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      error: new CombinedGraphQLErrors({
        data: {
          updateUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: null,
          },
        },
        errors: [{ message: "Could not determine age" }],
      }),
    });
  });

  test("warns and returns masked result when used with no-cache fetch policy", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      NO_CACHE_WARNING,
      "MaskedMutation"
    );
  });

  test("does not warn on no-cache queries when data masking is disabled", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn on no-cache queries when all fragments use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warns on no-cache queries when at least one fragment does not use `@unmask`", async () => {
    using _ = spyOnConsole("warn");
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: { ProfileFieldsFragment: ProfileFieldsFragment };
    };
    type ProfileFieldsFragment = {
      username: number;
    } & { " $fragmentName"?: "ProfileFieldsFragment" };

    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      } & {
        " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment };
      };
    }

    const mutation: MaskedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields @unmask
        }
      }

      fragment UserFields on User {
        age
        ...ProfileFieldsFragment
      }

      fragment ProfileFieldsFragment on User {
        username
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
              username: "testuser",
            },
          },
        },
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { data } = await client.mutate({ mutation, fetchPolicy: "no-cache" });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      NO_CACHE_WARNING,
      "MaskedMutation"
    );
  });
});

class TestCache extends ApolloCache {
  public diff<T>(query: Cache.DiffOptions<T>): DataProxy.DiffResult<T> {
    return { result: null, complete: false };
  }

  public evict(): boolean {
    return false;
  }

  public extract(optimistic?: boolean): unknown {
    return undefined;
  }

  public performTransaction(transaction: (c: ApolloCache) => void): void {
    transaction(this);
  }

  public read<T = unknown, TVariables = OperationVariables>(
    query: Cache.ReadOptions<TVariables, T>
  ): Unmasked<T> | null {
    return null;
  }

  public removeOptimistic(id: string): void {}

  public reset(): Promise<void> {
    return new Promise<void>(() => null);
  }

  public restore(serializedState: unknown): this {
    return this;
  }

  public watch<T, TVariables>(
    watch: Cache.WatchOptions<T, TVariables>
  ): () => void {
    return function () {};
  }

  public write<TResult = unknown, TVariables = OperationVariables>(
    _: Cache.WriteOptions<TResult, TVariables>
  ): Reference | undefined {
    return;
  }
}
