import { FragmentSpreadNode, Kind, visit } from "graphql";
import {
  ApolloCache,
  ApolloClient,
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
import { invariant } from "../utilities/globals";

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
      ...NameFields @unmask
    }

    fragment NameFields on User {
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
