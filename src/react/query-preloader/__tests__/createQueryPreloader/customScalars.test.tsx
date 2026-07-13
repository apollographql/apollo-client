import { disableActEnvironment } from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  Defer20220824Handler,
  GraphQL17Alpha9Handler,
} from "@apollo/client/incremental";
import { createQueryPreloader } from "@apollo/client/react";
import {
  dateScalar,
  markAsStreaming,
  mockDefer20220824,
  mockDeferStreamGraphQL17Alpha9,
  spyOnConsole,
} from "@apollo/client/testing/internal";

import { renderDefaultTestApp } from "./testUtils.js";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      });
    }),
  });

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { date: new Date(2026, 0, 1) },
  });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

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
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      });
    }),
  });

  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { date: new Date(2026, 0, 1) },
  });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      inputObjects: {
        EventFilter: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      });
    }),
  });

  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { filter: { date: new Date(2026, 0, 1) } },
  });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(requestVariables).toStrictEqualTyped({
    filter: { date: "2026-01-01" },
  });
});

test("serializes scalar fields in the error with a `none` error policy", async () => {
  using _consoleSpy = spyOnConsole("error");
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
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
            endDate: { scalar: "Date" },
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
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "none" });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["Error"]);
    expect(snapshot.error).toEqual(
      new CombinedGraphQLErrors({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      })
    );
  }

  await expect(renderStream).not.toRerender();
});

test("parses scalar fields in the result and serializes them in the error with an `all` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
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
            endDate: { scalar: "Date" },
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
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "all" });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: null,
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            // TODO: Determine if this is correct
            startDate: new Date(2026, 0, 1),
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }),
    });
  }

  await expect(renderStream).not.toRerender();
});

test("parses custom scalar fields with an `ignore` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
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
            endDate: { scalar: "Date" },
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
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "ignore" });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: null,
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 1, 2),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    pending: [{ id: "0", path: ["event"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 1, 2),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
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
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        path: ["events", 1],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
          {
            __typename: "Event",
            id: "2",
            startDate: new Date(2026, 1, 2),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
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
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    pending: [{ id: "0", path: ["events"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
          {
            __typename: "Event",
            id: "2",
            startDate: new Date(2026, 1, 2),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});
