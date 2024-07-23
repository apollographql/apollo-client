import { FragmentSpreadNode, GraphQLError, Kind, visit } from "graphql";
import {
  ApolloCache,
  ApolloClient,
  ApolloError,
  Cache,
  DataProxy,
  DocumentTransform,
  FetchPolicy,
  gql,
  InMemoryCache,
  Reference,
  TypedDocumentNode,
} from "../core";
import { MockLink } from "../testing";
import { ObservableStream, spyOnConsole } from "../testing/internal";

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
    expect.stringContaining("This cache does not support data masking")
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
        errors: [new GraphQLError("Couldn't get name")],
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

    expect(errors).toEqual([
      new ApolloError({
        graphQLErrors: [new GraphQLError("Couldn't get name")],
      }),
    ]);
  }
});

it.each(["cache-first", "network-only", "cache-and-network"] as FetchPolicy[])(
  "masks result returned from getCurrentResult when using %s fetchPolicy",
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
