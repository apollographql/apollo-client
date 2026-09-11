import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useMutation } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes parsed scalar values in variables", async () => {
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

test("returns parsed scalar fields", async () => {
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

  await expect(mutate()).resolves.toStrictEqualTyped({
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
