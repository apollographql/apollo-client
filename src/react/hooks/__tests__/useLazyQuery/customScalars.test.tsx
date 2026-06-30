import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useLazyQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    }).pipe(delay(20));
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
    }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: undefined,
      variables: {
        date: new Date(2026, 0, 1),
      },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {
        date: new Date(2026, 0, 1),
      },
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables used in directive arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    }).pipe(delay(20));
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
    }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: undefined,
      variables: {
        date: new Date(2026, 0, 1),
      },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {
        date: new Date(2026, 0, 1),
      },
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    }).pipe(delay(20));
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      inputObjects: {
        EventFilter: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link,
  });
  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(
    execute({
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      previousData: undefined,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({
    filter: {
      date: "2026-01-01",
    },
  });
});

test("parses cached custom scalar fields with a cache-only fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
    link: ApolloLink.empty(),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { fetchPolicy: "cache-only" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses cached custom scalar fields with a cache-first fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
    link: ApolloLink.empty(),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { fetchPolicy: "cache-first" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a cache-first fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
          event: {
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
    () => useLazyQuery(query, { fetchPolicy: "cache-first" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
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
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses cached and network custom scalar fields with a cache-and-network fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-02-02",
          },
        },
      }).pipe(delay(20))
    ),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useLazyQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 1, 2),
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 1, 2),
        },
      },
      dataState: "complete",
      called: true,
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
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a cache-and-network fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
          event: {
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
    () => useLazyQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
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
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a network-only fetch policy", async () => {
  const query = gql`
    query Event {
      event {
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
          event: {
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
    () => useLazyQuery(query, { fetchPolicy: "network-only" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: {
      event: {
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
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
    const query = gql`
      query Event {
        event {
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
            event: {
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
      await renderHookToSnapshotStream(
        () => useLazyQuery(query, { fetchPolicy: "no-cache" }),
        { wrapper: createClientWrapper(client) }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        called: false,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }
    const [execute] = getCurrentSnapshot();

    await expect(execute()).resolves.toStrictEqualTyped({
      data: {
        event: {
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
        dataState: "empty",
        called: true,
        loading: true,
        networkStatus: NetworkStatus.loading,
        previousData: undefined,
        variables: {},
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toStrictEqualTyped({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
        },
        dataState: "complete",
        called: true,
        loading: false,
        networkStatus: NetworkStatus.ready,
        previousData: undefined,
        variables: {},
      });
    }
  }
);
