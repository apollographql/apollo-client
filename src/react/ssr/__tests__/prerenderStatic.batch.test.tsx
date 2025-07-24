/** @jest-environment node */
import React from "react";
import { prerenderStatic } from "../prerenderStatic.js";
import { ApolloClient, ApolloLink } from "@apollo/client";
import { InMemoryCache as Cache } from "@apollo/client/cache";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { gql } from "graphql-tag";
import { Observable } from "@apollo/client/utilities";

interface TestData {
  test: string;
}

const TEST_QUERY = gql`
  query TestQuery {
    test
  }
`;

const TestComponent = () => {
  const { data, loading } = useQuery<TestData>(TEST_QUERY);

  if (loading) return <div>Loading...</div>;
  return <div>Data: {data?.test}</div>;
};

describe("prerenderStatic with batch options", () => {
  let client: ApolloClient;

  beforeEach(() => {
    const mockLink = new ApolloLink(() => {
      return new Observable((observer) => {
        // Resolve immediately for testing
        observer.next({ data: { test: "success" } });
        observer.complete();
      });
    });

    client = new ApolloClient({
      cache: new Cache(),
      link: mockLink,
    });
  });

  it("should work with debounced batching", async () => {
    const element = (
      <ApolloProvider client={client}>
        <TestComponent />
      </ApolloProvider>
    );

    const startTime = Date.now();

    const result = await prerenderStatic({
      tree: element,
      renderFunction: (await import("react-dom/server")).renderToString,
      batchOptions: {
        debounce: 50,
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within a reasonable time
    expect(duration).toBeLessThan(200);
    expect(result.result).toMatch(/Data:.*success/);
  });

  it("should handle multiple queries with debouncing", async () => {
    const MultiQueryComponent = () => {
      const { data: data1 } = useQuery<TestData>(TEST_QUERY);
      const { data: data2 } = useQuery<TestData>(TEST_QUERY);

      return (
        <div>
          <div>Query 1: {data1?.test}</div>
          <div>Query 2: {data2?.test}</div>
        </div>
      );
    };

    const element = (
      <ApolloProvider client={client}>
        <MultiQueryComponent />
      </ApolloProvider>
    );

    const startTime = Date.now();

    const result = await prerenderStatic({
      tree: element,
      renderFunction: (await import("react-dom/server")).renderToString,
      batchOptions: {
        debounce: 20,
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should resolve quickly due to debouncing
    expect(duration).toBeLessThan(100);
    expect(result.result).toMatch(/Query 1:.*success/);
    expect(result.result).toMatch(/Query 2:.*success/);
  });

  it("should fall back to default behavior when no batch options provided", async () => {
    const element = (
      <ApolloProvider client={client}>
        <TestComponent />
      </ApolloProvider>
    );

    const result = await prerenderStatic({
      tree: element,
      renderFunction: (await import("react-dom/server")).renderToString,
    });

    expect(result.result).toMatch(/Data:.*success/);
  });

  it("should handle slow queries with debouncing", async () => {
    let resolveSlowQuery: (() => void) | null = null;
    const slowPromise = new Promise<void>((resolve) => {
      resolveSlowQuery = resolve;
    });

    const slowLink = new ApolloLink(() => {
      return new Observable((observer) => {
        // Delay the response
        setTimeout(() => {
          observer.next({ data: { test: "slow" } });
          observer.complete();
          if (resolveSlowQuery) resolveSlowQuery();
        }, 100);
      });
    });

    const slowClient = new ApolloClient({
      cache: new Cache(),
      link: slowLink,
    });

    const element = (
      <ApolloProvider client={slowClient}>
        <TestComponent />
      </ApolloProvider>
    );

    const startTime = Date.now();

    const result = await prerenderStatic({
      tree: element,
      renderFunction: (await import("react-dom/server")).renderToString,
      batchOptions: {
        debounce: 30,
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should timeout around 30ms, not wait for the 100ms query
    expect(duration).toBeGreaterThanOrEqual(25);
    expect(duration).toBeLessThan(80);

    // Wait for the slow query to complete
    await slowPromise;
  });
});
