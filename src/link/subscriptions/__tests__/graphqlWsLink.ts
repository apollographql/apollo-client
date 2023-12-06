import { Client } from "graphql-ws";
import { ExecutionResult, GraphQLError } from "graphql";
import gql from "graphql-tag";

import { Observable } from "../../../utilities";
import { ApolloError } from "../../../errors";
import { execute } from "../../core";
import { GraphQLWsLink } from "..";

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

function mockClient(subscribe: Client["subscribe"]): Client {
  return {
    subscribe,
    // GraphQLWsLink doesn't use these methods
    iterate: () => (async function* iterator() {})(),
    on: () => () => {},
    dispose: () => {},
    terminate: () => {},
  };
}

async function observableToArray<T>(o: Observable<T>): Promise<T[]> {
  const out: T[] = [];
  await o.forEach((v) => out.push(v));
  return out;
}

describe("GraphQLWSlink", () => {
  it("constructs", () => {
    const client = mockClient(() => () => {});
    expect(() => new GraphQLWsLink(client)).not.toThrow();
  });

  // TODO some sort of dependency injection

  // it('should pass the correct initialization parameters to the Subscription Client', () => {
  // });

  it("should call subscribe on the client for a query", async () => {
    const result = { data: { data: "result" } } as ExecutionResult<any, any>;
    const subscribe: Client["subscribe"] = (_, sink) => {
      sink.next(result);
      sink.complete();
      return () => {};
    };
    const client = mockClient(subscribe);
    const link = new GraphQLWsLink(client);

    const obs = execute(link, { query });
    await expect(observableToArray(obs)).resolves.toEqual([result]);
  });

  it("should call subscribe on the client for a mutation", async () => {
    const result = { data: { data: "result" } } as ExecutionResult<any, any>;
    const subscribe: Client["subscribe"] = (_, sink) => {
      sink.next(result);
      sink.complete();
      return () => {};
    };
    const client = mockClient(subscribe);
    const link = new GraphQLWsLink(client);

    const obs = execute(link, { query: mutation });
    await expect(observableToArray(obs)).resolves.toEqual([result]);
  });

  it("should call next with multiple results for subscription", async () => {
    const results = [
      { data: { data: "result1" } },
      { data: { data: "result2" } },
    ] as ExecutionResult<any, any>[];
    const subscribe: Client["subscribe"] = (_, sink) => {
      const copy = [...results];
      for (const r of copy) {
        sink.next(r);
      }
      sink.complete();
      return () => {};
    };
    const client = mockClient(subscribe);
    const link = new GraphQLWsLink(client);

    const obs = execute(link, { query: subscription });
    await expect(observableToArray(obs)).resolves.toEqual(results);
  });

  describe("should reject", () => {
    it("with Error on subscription error via Error", async () => {
      const subscribe: Client["subscribe"] = (_, sink) => {
        sink.error(new Error("an error occurred"));
        return () => {};
      };
      const client = mockClient(subscribe);
      const link = new GraphQLWsLink(client);

      const obs = execute(link, { query: subscription });
      await expect(observableToArray(obs)).rejects.toEqual(
        new Error("an error occurred")
      );
    });

    it("with Error on subscription error via CloseEvent", async () => {
      const subscribe: Client["subscribe"] = (_, sink) => {
        // A WebSocket close event receives a CloseEvent
        // See: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event
        sink.error(
          new CloseEvent("an error occurred", {
            code: 1006,
            reason: "abnormally closed",
          })
        );
        return () => {};
      };
      const client = mockClient(subscribe);
      const link = new GraphQLWsLink(client);

      const obs = execute(link, { query: subscription });
      await expect(observableToArray(obs)).rejects.toEqual(
        new Error("Socket closed with event 1006 abnormally closed")
      );
    });

    it("with ApolloError on subscription error via Event (network disconnected)", async () => {
      const subscribe: Client["subscribe"] = (_, sink) => {
        // A WebSocket error event receives a generic Event
        // See: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event
        sink.error({ target: { readyState: WebSocket.CLOSED } });
        return () => {};
      };
      const client = mockClient(subscribe);
      const link = new GraphQLWsLink(client);

      const obs = execute(link, { query: subscription });
      await expect(observableToArray(obs)).rejects.toEqual(
        new Error("Socket closed")
      );
    });

    it("with ApolloError on subscription error via GraphQLError[]", async () => {
      const subscribe: Client["subscribe"] = (_, sink) => {
        sink.error([new GraphQLError("Foo bar.")]);
        return () => {};
      };
      const client = mockClient(subscribe);
      const link = new GraphQLWsLink(client);

      const obs = execute(link, { query: subscription });
      await expect(observableToArray(obs)).rejects.toEqual(
        new ApolloError({
          graphQLErrors: [new GraphQLError("Foo bar.")],
        })
      );
    });
  });
});
