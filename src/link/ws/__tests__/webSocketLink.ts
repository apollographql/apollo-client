import type { ExecutionResult } from "graphql";
import { gql } from "graphql-tag";
import { Observable, of } from "rxjs";
import { SubscriptionClient } from "subscriptions-transport-ws";

import { execute } from "@apollo/client/link/core";
import { WebSocketLink } from "@apollo/client/link/ws";
import { ObservableStream } from "@apollo/client/testing/internal";

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const mutation = gql`
  mutation SampleMutation {
    stub {
      id
    }
  }
`;

const subscription = gql`
  subscription SampleSubscription {
    stub {
      id
    }
  }
`;

describe("WebSocketLink", () => {
  it("constructs", () => {
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    expect(() => new WebSocketLink(client)).not.toThrow();
  });

  // TODO some sort of dependency injection

  // it('should pass the correct initialization parameters to the Subscription Client', () => {
  // });

  it("should call request on the client for a query", async () => {
    const result = { data: { data: "result" } };
    const client: any = {};
    const observable = of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    const link = new WebSocketLink(client);

    const obs = execute(link, { query });
    expect(obs).toEqual(observable);

    const stream = new ObservableStream(obs);

    await expect(stream).toEmitStrictTyped(result);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("should call query on the client for a mutation", async () => {
    const result = { data: { data: "result" } };
    const client: any = {};
    const observable = of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    const link = new WebSocketLink(client);

    const obs = execute(link, { query: mutation });
    expect(obs).toEqual(observable);

    const stream = new ObservableStream(obs);

    await expect(stream).toEmitStrictTyped(result);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("should call request on the subscriptions client for subscription", async () => {
    const result = { data: { data: "result" } };
    const client: any = {};
    const observable = of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    const link = new WebSocketLink(client);

    const obs = execute(link, { query: subscription });
    expect(obs).toEqual(observable);

    const stream = new ObservableStream(obs);

    await expect(stream).toEmitStrictTyped(result);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("should call next with multiple results for subscription", async () => {
    const results = [
      { data: { data: "result1" } },
      { data: { data: "result2" } },
    ];
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn(() => {
      const copy = [...results];
      return new Observable<ExecutionResult>((observer) => {
        observer.next(copy[0]);
        observer.next(copy[1]);
      });
    });

    const link = new WebSocketLink(client);

    const observable = execute(link, { query: subscription });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitStrictTyped(results.shift()!);
    await expect(stream).toEmitStrictTyped(results.shift()!);

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(0);
  });
});
