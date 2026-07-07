import { delay, of } from "rxjs";

import type { OperationVariables, TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar, ObservableStream } from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
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
    subscription Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  using stream = new ObservableStream(
    client.subscribe({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  await expect(stream).toComplete();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables used in directive arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
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
    subscription Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  using stream = new ObservableStream(
    client.subscribe({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  await expect(stream).toComplete();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
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
    subscription Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  using stream = new ObservableStream(
    client.subscribe({
      query,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  await expect(stream).toComplete();

  expect(requestVariables).toStrictEqualTyped({
    filter: {
      date: "2026-01-01",
    },
  });
});

test("parses custom scalar fields with a cache-only fetch policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      typePolicies: {
        Event: {
          fields: {
            startDate: {
              scalar: "Date",
            },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({
      query: subscription,
      fetchPolicy: "cache-only",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(stream).toComplete();
});

test("parses custom scalar fields with a cache-first fetch policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      typePolicies: {
        Event: {
          fields: {
            startDate: {
              scalar: "Date",
            },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({
      query: subscription,
      fetchPolicy: "cache-first",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(stream).toComplete();
});

test("parses custom scalar fields with a network-only fetch policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      typePolicies: {
        Event: {
          fields: {
            startDate: {
              scalar: "Date",
            },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({
      query: subscription,
      fetchPolicy: "network-only",
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(stream).toComplete();
});

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
    const subscription = gql`
      subscription EventCreated {
        eventCreated {
          id
          startDate
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache({
        scalars: {
          Date: dateScalar,
        },
        typePolicies: {
          Event: {
            fields: {
              startDate: {
                scalar: "Date",
              },
            },
          },
        },
      }),
      link: new ApolloLink(() =>
        of({
          data: {
            eventCreated: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        }).pipe(delay(20))
      ),
    });

    using stream = new ObservableStream(
      client.subscribe({
        query: subscription,
        fetchPolicy: "no-cache",
      })
    );

    await expect(stream).toEmitTypedValue({
      data: {
        eventCreated: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
    });

    await expect(stream).toComplete();
  }
);

test("preserves referential identity when a subscription emits identical serialized scalar values", async () => {
  const subscription: TypedDocumentNode<{
    eventCreated: { __typename: "Event"; id: string; startDate: Date };
  }> = gql`
    subscription EventCreated {
      eventCreated {
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
      of(
        {
          data: {
            eventCreated: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        },
        {
          data: {
            eventCreated: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        }
      ).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({ query: subscription })
  );

  const first = await stream.takeNext();

  expect(first).toStrictEqualTyped({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  const second = await stream.takeNext();

  expect(second.data!.eventCreated).toBe(first.data!.eventCreated);

  await expect(stream).toComplete();
});

test("serializes scalar fields in the error with a `none` error policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
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
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["eventCreated", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({ query: subscription, errorPolicy: "none" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    error: new CombinedGraphQLErrors({
      data: {
        eventCreated: {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
          endDate: null,
        },
      },
      errors: [
        {
          message: "Could not resolve endDate",
          path: ["eventCreated", "endDate"],
        },
      ],
    }),
  });

  await expect(stream).toComplete();
});

test("parses scalar fields in the result and serializes them in the error with an `all` error policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
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
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["eventCreated", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({ query: subscription, errorPolicy: "all" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
      },
    },
    error: new CombinedGraphQLErrors({
      data: {
        eventCreated: {
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
          path: ["eventCreated", "endDate"],
        },
      ],
    }),
  });

  await expect(stream).toComplete();
});

test("parses custom scalar fields with an `ignore` error policy", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
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
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["eventCreated", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using stream = new ObservableStream(
    client.subscribe({ query: subscription, errorPolicy: "ignore" })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
      },
    },
  });

  await expect(stream).toComplete();
});
