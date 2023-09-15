import { SubscriptionClient } from "subscriptions-transport-ws";
import { ExecutionResult } from "graphql";
import gql from "graphql-tag";

import { Observable } from "../../../utilities";
import { execute } from "../../core";
import { WebSocketLink } from "..";
import { itAsync } from "../../../testing";

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

  itAsync(
    "should call request on the client for a query",
    (resolve, reject) => {
      const result = { data: { data: "result" } };
      const client: any = {};
      const observable = Observable.of(result);
      client.__proto__ = SubscriptionClient.prototype;
      client.request = jest.fn();
      client.request.mockReturnValueOnce(observable);
      const link = new WebSocketLink(client);

      const obs = execute(link, { query });
      expect(obs).toEqual(observable);
      obs.subscribe((data) => {
        expect(data).toEqual(result);
        expect(client.request).toHaveBeenCalledTimes(1);
        resolve();
      });
    }
  );

  itAsync(
    "should call query on the client for a mutation",
    (resolve, reject) => {
      const result = { data: { data: "result" } };
      const client: any = {};
      const observable = Observable.of(result);
      client.__proto__ = SubscriptionClient.prototype;
      client.request = jest.fn();
      client.request.mockReturnValueOnce(observable);
      const link = new WebSocketLink(client);

      const obs = execute(link, { query: mutation });
      expect(obs).toEqual(observable);
      obs.subscribe((data) => {
        expect(data).toEqual(result);
        expect(client.request).toHaveBeenCalledTimes(1);
        resolve();
      });
    }
  );

  itAsync(
    "should call request on the subscriptions client for subscription",
    (resolve, reject) => {
      const result = { data: { data: "result" } };
      const client: any = {};
      const observable = Observable.of(result);
      client.__proto__ = SubscriptionClient.prototype;
      client.request = jest.fn();
      client.request.mockReturnValueOnce(observable);
      const link = new WebSocketLink(client);

      const obs = execute(link, { query: subscription });
      expect(obs).toEqual(observable);
      obs.subscribe((data) => {
        expect(data).toEqual(result);
        expect(client.request).toHaveBeenCalledTimes(1);
        resolve();
      });
    }
  );

  itAsync(
    "should call next with multiple results for subscription",
    (resolve, reject) => {
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

      execute(link, { query: subscription }).subscribe((data) => {
        expect(client.request).toHaveBeenCalledTimes(1);
        expect(data).toEqual(results.shift());
        if (results.length === 0) {
          resolve();
        }
      });
    }
  );
});
