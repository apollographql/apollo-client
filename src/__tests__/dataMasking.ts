import { FragmentSpreadNode, Kind, visit } from "graphql";
import {
  ApolloCache,
  ApolloClient,
  ApolloError,
  ApolloLink,
  Cache,
  DataProxy,
  DocumentTransform,
  FetchPolicy,
  gql,
  InMemoryCache,
  Observable,
  Reference,
  TypedDocumentNode,
} from "../core";
import {
  MockedResponse,
  MockLink,
  MockSubscriptionLink,
  wait,
} from "../testing";
import { ObservableStream, spyOnConsole } from "../testing/internal";
import { invariant } from "../utilities/globals";
import { createFragmentRegistry } from "../cache/inmemory/fragmentRegistry";
import { isSubscriptionOperation } from "../utilities";

describe("client.watchQuery", () => {
  test("masks queries when dataMasking is `true`", async () => {
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

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
  });

  test("does not mask query when dataMasking is `false`", async () => {
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    const query: TypedDocumentNode<Query, never> = gql`
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

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    const query: TypedDocumentNode<Query, never> = gql`
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

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

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

    client.writeQuery({
      query,
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (updated)",
          // @ts-ignore TODO: Determine how to handle cache writes with masked
          // query type
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const observable = client.watchQuery({ query });

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

    client.writeQuery({
      query,
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          // @ts-ignore TODO: Determine how to handle cache writes with masked
          // query type
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
      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        };
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
            // @ts-expect-error TODO: Determine how to write this with masked types
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
          // @ts-expect-error TODO: Determine how to write this with masked types
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
          currentUser: {
            __typename: "User",
            id: 1,
            // @ts-expect-error TODO: Determine how to write this with masked types
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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

    {
      const { data, errors } = await stream.takeNext();

      expect(data).toEqual({
        currentUser: {
          __typename: "User",
          id: 1,
          name: null,
        },
      });

      expect(errors).toEqual([{ message: "Couldn't get name" }]);
    }
  });

  it.each([
    "cache-first",
    "network-only",
    "cache-and-network",
  ] as FetchPolicy[])(
    "does not mask result returned from getCurrentResult when using %s fetchPolicy",
    async (fetchPolicy) => {
      interface Query {
        currentUser: {
          __typename: "User";
          id: number;
          name: string;
        };
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
            age: 34,
            name: "Test User",
          },
        });
      }
    }
  );

  test("warns when accessing a unmasked field while using @unmask with mode: 'migrate'", async () => {
    using consoleSpy = spyOnConsole("warn");

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    const query: TypedDocumentNode<Query, never> = gql`
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

    {
      const { data } = await stream.takeNext();
      data.currentUser.__typename;
      data.currentUser.id;
      data.currentUser.name;

      expect(consoleSpy.warn).not.toHaveBeenCalled();

      data.currentUser.age;

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "Accessing unmasked field on %s at path '%s'. This field will not be available when masking is enabled. Please read the field from the fragment instead.",
        "query 'UnmaskedQuery'",
        "currentUser.age"
      );

      // Ensure we only warn once
      data.currentUser.age;
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    }
  });

  test("reads fragment by passing parent object to `from`", async () => {
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    interface Fragment {
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
      fragment UserFields on User {
        age
      }
    `;

    const query: TypedDocumentNode<Query, never> = gql`
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

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data.currentUser,
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

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    interface Fragment {
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
      fragment UserFields on User {
        id
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

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data.currentUser,
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

    interface Query {
      currentUser: {
        __typename: "User";
        name: string;
      };
    }

    interface Fragment {
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
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

    const { data } = await queryStream.takeNext();
    const fragmentObservable = client.watchFragment({
      fragment,
      from: data.currentUser,
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

    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
        age: number;
      };
    }

    const query: TypedDocumentNode<Query, never> = gql`
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
        return Observable.of({
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
});

describe("client.watchFragment", () => {
  test("masks watched fragments when dataMasking is `true`", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    };

    const nameFieldsFragment: TypedDocumentNode<NameFieldsFragment> = gql`
      fragment NameFields on User {
        firstName
        lastName
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment> = gql`
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
        // @ts-expect-error Need to determine types when writing data for masked fragment types
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
      firstName: string;
      lastName: string;
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    };

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
      firstName: string;
      lastName: string;
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    };

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
    interface Fragment {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
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
    interface Fragment {
      __typename: "User";
      id: number;
      name: string;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
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
        // @ts-expect-error Need to determine how to handle masked fragment types with writes
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
    interface Fragment {
      __typename: "User";
      id: number;
      name: string;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
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
    interface UserFieldsFragment {
      __typename: "User";
      id: number;
      name: string;
    }

    interface ProfileFieldsFragment {
      __typename: "User";
      age: number;
    }

    const profileFieldsFragment: TypedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment, never> =
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
    interface UserFieldsFragment {
      __typename: "User";
      id: number;
      lastUpdatedAt: string;
    }

    interface ProfileFieldsFragment {
      __typename: "User";
      lastUpdatedAt: string;
    }

    const profileFieldsFragment: TypedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
        lastUpdatedAt @nonreactive
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment, never> =
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
    interface UserFieldsFragment {
      __typename: "User";
      id: number;
      lastUpdatedAt: string;
    }

    interface ProfileFieldsFragment {
      __typename: "User";
      lastUpdatedAt: string;
    }

    const profileFieldsFragment: TypedDocumentNode<
      ProfileFieldsFragment,
      never
    > = gql`
      fragment ProfileFields on User {
        age
        lastUpdatedAt @nonreactive
      }
    `;

    const userFieldsFragment: TypedDocumentNode<UserFieldsFragment, never> =
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

    interface Fragment {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
    interface Query {
      currentUser: {
        __typename: "User";
        id: number;
        name: string;
      };
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
      new ApolloError({
        graphQLErrors: [{ message: "User not logged in" }],
      })
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

    const { data, errors } = await client.query({ query, errorPolicy: "all" });

    expect(data).toEqual({
      currentUser: null,
    });

    expect(errors).toEqual([{ message: "User not logged in" }]);
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

    const { data, errors } = await client.query({ query, errorPolicy: "all" });

    expect(data).toEqual({
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });

    expect(errors).toEqual([{ message: "Could not determine age" }]);
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

    const error = await stream.takeError();

    expect(error).toEqual(
      new ApolloError({ graphQLErrors: [{ message: "Something went wrong" }] })
    );
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

    const { data, errors } = await stream.takeNext();

    expect(data).toEqual({ addedComment: null });
    expect(errors).toEqual([{ message: "Something went wrong" }]);
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

    const { data, errors } = await stream.takeNext();

    expect(data).toEqual({ addedComment: { __typename: "Comment", id: 1 } });
    expect(errors).toEqual([{ message: "Could not get author" }]);
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
        variables: {},
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
        variables: {},
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

    const client = new ApolloClient({ cache: new InMemoryCache(), link });
    const observable = client.watchQuery({ query });
    const queryStream = new ObservableStream(observable);

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
        variables: {},
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
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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
      new ApolloError({
        graphQLErrors: [{ message: "User not logged in" }],
      })
    );
  });

  test("handles errors returned when using errorPolicy `all`", async () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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

    const { data, errors } = await client.mutate({
      mutation,
      errorPolicy: "all",
    });

    expect(data).toEqual({ updateUser: null });
    expect(errors).toEqual([{ message: "User not logged in" }]);
  });

  test("masks fragment data in fields nulled by errors when using errorPolicy `all`", async () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
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

    const { data, errors } = await client.mutate({
      mutation,
      errorPolicy: "all",
    });

    expect(data).toEqual({
      updateUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    });

    expect(errors).toEqual([{ message: "Could not determine age" }]);
  });
});

class TestCache extends ApolloCache<unknown> {
  public diff<T>(query: Cache.DiffOptions): DataProxy.DiffResult<T> {
    return {};
  }

  public evict(): boolean {
    return false;
  }

  public extract(optimistic?: boolean): unknown {
    return undefined;
  }

  public performTransaction(
    transaction: <TSerialized>(c: ApolloCache<TSerialized>) => void
  ): void {
    transaction(this);
  }

  public read<T, TVariables = any>(
    query: Cache.ReadOptions<TVariables>
  ): T | null {
    return null;
  }

  public removeOptimistic(id: string): void {}

  public reset(): Promise<void> {
    return new Promise<void>(() => null);
  }

  public restore(serializedState: unknown): ApolloCache<unknown> {
    return this;
  }

  public watch(watch: Cache.WatchOptions): () => void {
    return function () {};
  }

  public write<TResult = any, TVariables = any>(
    _: Cache.WriteOptions<TResult, TVariables>
  ): Reference | undefined {
    return;
  }
}
