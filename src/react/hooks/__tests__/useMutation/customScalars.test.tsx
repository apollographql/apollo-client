import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables, TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useMutation, useQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: {
          createEvent: {
            __typename: "Event",
            name: "GraphQL Summit",
          },
        },
      }).pipe(delay(20));
    }),
  });

  const mutation = gql`
    mutation CreateEvent($date: Date!) {
      createEvent(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  await expect(
    mutate({ variables: { date: new Date(2026, 0, 1) } })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables used in directive arguments", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: {
          createEvent: {
            __typename: "Event",
            name: "GraphQL Summit",
          },
        },
      }).pipe(delay(20));
    }),
  });

  const mutation = gql`
    mutation CreateEvent($date: Date!) {
      createEvent @on(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  await expect(
    mutate({ variables: { date: new Date(2026, 0, 1) } })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      inputObjects: {
        EventInput: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: {
          createEvent: {
            __typename: "Event",
            name: "GraphQL Summit",
          },
        },
      }).pipe(delay(20));
    }),
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput!) {
      createEvent(input: $input) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  await expect(
    mutate({ variables: { input: { date: new Date(2026, 0, 1) } } })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({
    input: { date: "2026-01-01" },
  });
});

test("parses custom scalar fields with a network-only fetch policy", async () => {
  const mutation = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          createEvent: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  await expect(
    mutate({ fetchPolicy: "network-only" })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
    const mutation = gql`
      mutation CreateEvent {
        createEvent {
          id
          startDate
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache({
        scalars: { Date: dateScalar },
        typePolicies: {
          Event: {
            fields: {
              startDate: { scalar: "Date" },
            },
          },
        },
      }),
      link: new ApolloLink(() =>
        of({
          data: {
            createEvent: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        }).pipe(delay(20))
      ),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(() => useMutation(mutation), {
        wrapper: createClientWrapper(client),
      });

    await takeSnapshot();
    const [mutate] = getCurrentSnapshot();

    await expect(
      mutate({ fetchPolicy: "no-cache" })
    ).resolves.toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
    });
  }
);

test("parses parsed custom scalar fields in optimistic responses", async () => {
  const mutation = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
  const fragment = gql`
    fragment EventFragment on Event {
      id
      startDate
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          createEvent: {
            __typename: "Event",
            id: "1",
            startDate: "2026-02-02",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();
  const promise = mutate({
    optimisticResponse: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  expect(
    client.cache.readFragment({
      id: "Event:1",
      fragment,
      optimistic: true,
    })
  ).toStrictEqualTyped({
    __typename: "Event",
    id: "1",
    startDate: new Date(2026, 0, 1),
  });

  await expect(promise).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 1, 2),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 1, 2),
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses serialized custom scalar fields in optimistic responses", async () => {
  const mutation = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
  const fragment = gql`
    fragment EventFragment on Event {
      id
      startDate
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          createEvent: {
            __typename: "Event",
            id: "1",
            startDate: "2026-02-02",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();
  const promise = mutate({
    optimisticResponse: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  expect(
    client.cache.readFragment({
      id: "Event:1",
      fragment,
      optimistic: true,
    })
  ).toStrictEqualTyped({
    __typename: "Event",
    id: "1",
    startDate: new Date(2026, 0, 1),
  });

  await expect(promise).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 1, 2),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 1, 2),
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("passes parsed custom scalar fields to mutation updater callbacks", async () => {
  const mutation: TypedDocumentNode<{
    createEvent: { __typename: "Event"; id: string; startDate: Date };
  }> = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
  const query = gql`
    query LastCreatedEvent {
      lastCreatedEvent {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          createEvent: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  await expect(
    mutate({
      update(cache, result) {
        expect(result).toStrictEqualTyped({
          data: {
            createEvent: {
              __typename: "Event",
              id: "1",
              startDate: new Date(2026, 0, 1),
            },
          },
        });

        cache.writeQuery({
          query,
          data: {
            lastCreatedEvent: result.data!.createEvent,
          },
        });
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(client.readQuery({ query })).toStrictEqualTyped({
    lastCreatedEvent: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 0, 1),
    },
  });
});

test("parses custom scalar fields in queries triggered by refetchQueries", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
  const mutation = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
  let requestCount = 0;
  const link = new MockLink([
    {
      request: { query },
      maxUsageCount: 2,
      delay: 20,
      result: () => {
        requestCount++;

        return {
          data: {
            event: {
              __typename: "Event",
              id: "1",
              startDate: requestCount === 1 ? "2026-01-01" : "2026-03-03",
            },
          },
        };
      },
    },
    {
      request: { query: mutation },
      delay: 20,
      result: {
        data: {
          createEvent: {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        },
      },
    },
  ]);
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => ({
      query: useQuery(query),
      mutation: useMutation(mutation),
    }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: false,
      loading: false,
    });
  }

  const {
    mutation: [mutate],
  } = getCurrentSnapshot();

  await expect(
    mutate({
      refetchQueries: [query],
      awaitRefetchQueries: true,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "2",
        startDate: new Date(2026, 1, 2),
      },
    },
  });

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      previousData: undefined,
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 2, 3),
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      called: true,
      loading: true,
    });
  }

  {
    const {
      query,
      mutation: [, mutation],
    } = await takeSnapshot();

    expect(query).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 2, 3),
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      variables: {},
    });

    expect(mutation).toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "2",
          startDate: new Date(2026, 1, 2),
        },
      },
      error: undefined,
      called: true,
      loading: false,
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(client.readQuery({ query })).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 2, 3),
    },
  });
});
