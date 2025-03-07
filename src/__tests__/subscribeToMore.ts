import { DocumentNode, OperationDefinitionNode } from "graphql";
import { gql } from "graphql-tag";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import { ApolloLink, Operation } from "@apollo/client/link/core";
import {
  mockObservableLink,
  mockSingleLink,
  wait,
} from "@apollo/client/testing";

import { ObservableStream, spyOnConsole } from "../testing/internal/index.js";

const isSub = (operation: Operation) =>
  (operation.query as DocumentNode).definitions
    .filter(
      (x): x is OperationDefinitionNode => x.kind === "OperationDefinition"
    )
    .some((x) => x.operation === "subscription");

describe("subscribeToMore", () => {
  const query = gql`
    query aQuery {
      entry {
        value
      }
    }
  `;
  const result = {
    data: {
      entry: {
        value: "1",
      },
    },
  };

  const req1 = { request: { query } as Operation, result };

  const results = ["Dahivat Pandya", "Amanda Liu"].map((name) => ({
    result: { data: { name } },
    delay: 10,
  }));

  const results2 = [
    { result: { data: { name: "Amanda Liu" } }, delay: 10 },
    { error: new Error("You cant touch this"), delay: 10 },
  ];

  const results3 = [
    { error: new Error("You cant touch this"), delay: 10 },
    { result: { data: { name: "Amanda Liu" } }, delay: 10 },
  ];

  const result4 = {
    data: {
      entry: [{ value: "1" }, { value: "2" }],
    },
  };
  const req4 = { request: { query } as Operation, result: result4 };

  interface SubscriptionData {
    name: string;
  }

  it("triggers new result from subscription data", async () => {
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const obsHandle = client.watchQuery({ query });
    const stream = new ObservableStream(obsHandle);

    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "1" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    wSLink.simulateResult(results[0]);

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "Dahivat Pandya" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await wait(10);
    wSLink.simulateResult(results[1]);

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "Amanda Liu" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });
  });

  it("calls error callback on error", async () => {
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req1);
    const link = ApolloLink.split(isSub, wSLink, httpLink);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obsHandle = client.watchQuery<(typeof req1)["result"]["data"]>({
      query,
    });
    const stream = new ObservableStream(obsHandle);

    const onError = jest.fn();

    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
      onError,
    });

    for (const result of results2) {
      wSLink.simulateResult(result);
    }

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "1" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "Amanda Liu" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await wait(15);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error("You cant touch this"));
  });

  it("prints unhandled subscription errors to the console", async () => {
    using _ = spyOnConsole("error");

    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req1);
    const link = ApolloLink.split(isSub, wSLink, httpLink);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const stream = new ObservableStream(obsHandle);

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: () => {
        throw new Error("should not be called because of initial error");
      },
    });

    for (const result of results3) {
      wSLink.simulateResult(result);
    }

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "1" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await wait(15);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Unhandled GraphQL subscription error",
      new Error("You cant touch this")
    );

    await expect(stream).not.toEmitAnything();
  });

  it("should not corrupt the cache (#3062)", async () => {
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req4);
    const link = ApolloLink.split(isSub, wSLink, httpLink);

    const client = new ApolloClient({
      cache: new InMemoryCache().restore({
        ROOT_QUERY: {
          entry: [
            {
              value: "1",
            },
            {
              value: "2",
            },
          ],
        },
      }),
      link,
    });

    const obsHandle = client.watchQuery<(typeof req4)["result"]["data"]>({
      query,
    });
    const stream = new ObservableStream(obsHandle);

    let nextMutation: { value: string };
    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription createdEntry {
          name
        }
      `,
      updateQuery: (prev, { subscriptionData, complete, previousData }) => {
        expect(complete).toBe(true);
        expect(previousData).toStrictEqual(prev);
        // Type Guard
        if (!complete) {
          return;
        }

        expect(previousData.entry).not.toContainEqual(nextMutation);
        return {
          entry: [...previousData.entry, { value: subscriptionData.data.name }],
        };
      },
    });

    for (let i = 0; i < 2; i++) {
      // init optimistic mutation
      let data = client.cache.readQuery<(typeof req4)["result"]["data"]>(
        { query },
        false
      );
      client.cache.recordOptimisticTransaction((proxy) => {
        nextMutation = { value: results[i].result.data.name };
        proxy.writeQuery({
          data: { entry: [...((data && data.entry) || []), nextMutation] },
          query,
        });
      }, i.toString());
      // on slow networks, subscription can happen first
      wSLink.simulateResult(results[i]);
      await wait(results[i].delay + 1);
      // complete mutation
      client.cache.removeOptimistic(i.toString());
      // note: we don't complete mutation with performTransaction because a real example would detect duplicates
    }

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: [{ value: "1" }, { value: "2" }] },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        entry: [{ value: "1" }, { value: "2" }, { value: "Dahivat Pandya" }],
      },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        entry: [
          { value: "1" },
          { value: "2" },
          { value: "Dahivat Pandya" },
          { value: "Amanda Liu" },
        ],
      },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });
  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.

  it("allows specification of custom types for variables and payload (#4246)", async () => {
    interface TypedOperation extends Operation {
      variables: {
        someNumber: number;
      };
    }
    const typedReq = {
      request: { query, variables: { someNumber: 1 } } as TypedOperation,
      result,
    };
    interface TypedSubscriptionVariables {
      someString: string;
    }

    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(typedReq);
    const link = ApolloLink.split(isSub, wSLink, httpLink);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    type TData = (typeof typedReq)["result"]["data"];
    type TVars = (typeof typedReq)["request"]["variables"];
    const obsHandle = client.watchQuery<TData, TVars>({
      query,
      variables: { someNumber: 1 },
    });
    const stream = new ObservableStream(obsHandle);

    obsHandle.subscribeToMore<SubscriptionData, TypedSubscriptionVariables>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      variables: {
        someString: "foo",
      },
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "1" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    wSLink.simulateResult(results[0]);

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "Dahivat Pandya" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await wait(10);
    wSLink.simulateResult(results[1]);

    await expect(stream).toEmitApolloQueryResult({
      data: { entry: { value: "Amanda Liu" } },
      loading: false,
      networkStatus: 7,
      partial: false,
    });
  });
});
