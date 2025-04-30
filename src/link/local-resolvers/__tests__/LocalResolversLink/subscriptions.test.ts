import { of } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("works with subscriptions with no client fields", async () => {
  const subscription = gql`
    subscription {
      field
    }
  `;

  const mockLink = new MockSubscriptionLink();
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);

  const stream = new ObservableStream(execute(link, { query: subscription }));

  mockLink.simulateResult({ result: { data: { field: 1 } } });
  mockLink.simulateResult({ result: { data: { field: 2 } } }, true);

  await expect(stream).toEmitTypedValue({ data: { field: 1 } });
  await expect(stream).toEmitTypedValue({ data: { field: 2 } });
  await expect(stream).toComplete();
});

test("adds @client fields with subscription results", async () => {
  const subscription = gql`
    subscription {
      field
      count @client
    }
  `;

  let subCounter = 0;
  const mockLink = new MockSubscriptionLink();
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Subscription: {
        count: () => {
          subCounter += 1;
          return subCounter;
        },
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);

  const stream = new ObservableStream(execute(link, { query: subscription }));

  mockLink.simulateResult({ result: { data: { field: 1 } } });
  mockLink.simulateResult({ result: { data: { field: 2 } } }, true);

  await expect(stream).toEmitTypedValue({ data: { field: 1, count: 1 } });
  await expect(stream).toEmitTypedValue({ data: { field: 2, count: 2 } });
  await expect(stream).toComplete();
});

test("adds export variables", async () => {
  const subscription = gql`
    subscription ($userId: ID!) {
      user(id: $userId) {
        id
        count
      }
      currentUserId @client @export(as: "userId")
    }
  `;

  const testUserId = 1;
  const mockLink = new ApolloLink(({ variables }) => {
    return of(
      {
        data: { user: { __typename: "User", id: variables.userId, count: 1 } },
      },
      { data: { user: { __typename: "User", id: variables.userId, count: 2 } } }
    );
  });
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Subscription: {
        currentUserId: () => testUserId,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);

  const stream = new ObservableStream(execute(link, { query: subscription }));

  await expect(stream).toEmitTypedValue({
    data: { currentUserId: 1, user: { __typename: "User", id: 1, count: 1 } },
  });
  await expect(stream).toEmitTypedValue({
    data: { currentUserId: 1, user: { __typename: "User", id: 1, count: 2 } },
  });
  await expect(stream).toComplete();
});
