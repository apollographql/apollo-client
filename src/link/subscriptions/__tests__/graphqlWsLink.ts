import { Client } from "graphql-ws";
import { ExecutionResult } from "graphql";
import gql from "graphql-tag";

import { Observable } from "../../../utilities";
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
});
