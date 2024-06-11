import React from "react";
import { render, waitFor } from "@testing-library/react";
import gql from "graphql-tag";

import { MockSubscriptionLink } from "../../core";
import { ApolloClient } from "../../../core";
import { InMemoryCache as Cache } from "../../../cache";
import { ApolloProvider } from "../../../react/context";
import { useSubscription } from "../../../react/hooks";

describe("mockSubscriptionLink", () => {
  it("should work with multiple subscribers to the same mock websocket", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    let renderCountA = 0;
    const ComponentA = () => {
      useSubscription(subscription);
      renderCountA += 1;
      return null;
    };

    let renderCountB = 0;
    const ComponentB = () => {
      useSubscription(subscription);
      renderCountB += 1;
      return null;
    };

    const results = ["Audi", "BMW", "Mercedes", "Hyundai"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const Component = () => {
      const [index, setIndex] = React.useState(0);
      React.useEffect(() => {
        if (index >= results.length) return;
        link.simulateResult(results[index]);
        setIndex(index + 1);
      }, [index]);
      return null;
    };

    render(
      <ApolloProvider client={client}>
        <div>
          <Component />
          <ComponentA />
          <ComponentB />
        </div>
      </ApolloProvider>
    );

    const numRenders = results.length + 1;

    // automatic batching in React 18 means we only see 2 renders vs. 5 in v17
    await waitFor(
      () => {
        expect(renderCountA).toBe(numRenders);
      },
      { timeout: 1000 }
    );
    expect(renderCountB).toBe(numRenders);
  });
});
