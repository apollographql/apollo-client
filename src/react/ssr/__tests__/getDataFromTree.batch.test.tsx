/** @jest-environment node */
import * as React from "react";
import { getDataFromTree, renderToStringWithData } from "../index.js";
import { ApolloClient, InMemoryCache } from "../../../core/index.js";
import { ApolloProvider } from "../../context/index.js";
import { useQuery } from "../../hooks/index.js";
import { gql } from "../../../core/index.js";
import { ApolloLink } from "../../../link/core/index.js";
import { Observable } from "../../../utilities/index.js";

const TEST_QUERY = gql`
  query TestQuery {
    test
  }
`;

const TestComponent = () => {
  const { data, loading } = useQuery(TEST_QUERY);

  if (loading) return <div>Loading...</div>;
  return <div>Data: {data?.test}</div>;
};

describe("getDataFromTree with batch options", () => {
  let client: ApolloClient<any>;

  beforeEach(() => {
    const mockLink = new ApolloLink(() => {
      return new Observable((observer) => {
        // Resolve immediately for testing
        observer.next({ data: { test: "success" } });
        observer.complete();
      });
    });

    client = new ApolloClient({
      cache: new InMemoryCache(),
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

    const view = await getDataFromTree(
      element,
      {},
      {
        debounce: 50,
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within a reasonable time
    expect(duration).toBeLessThan(200);
    expect(view).toMatch(/Data:.*success/);
  });

  it("should work with renderToStringWithData and batching", async () => {
    const element = (
      <ApolloProvider client={client}>
        <TestComponent />
      </ApolloProvider>
    );

    const startTime = Date.now();

    const view = await renderToStringWithData(element, {
      debounce: 30,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within a reasonable time
    expect(duration).toBeLessThan(150);
    expect(view).toMatch(/Data:.*success/);
  });

  it("should handle multiple queries with debouncing", async () => {
    const MultiQueryComponent = () => {
      const { data: data1 } = useQuery(TEST_QUERY);
      const { data: data2 } = useQuery(TEST_QUERY);

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

    const view = await getDataFromTree(
      element,
      {},
      {
        debounce: 20,
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should resolve quickly due to debouncing
    expect(duration).toBeLessThan(100);
    expect(view).toMatch(/Query 1:.*success/);
    expect(view).toMatch(/Query 2:.*success/);
  });

  it("should fall back to default behavior when no batch options provided", async () => {
    const element = (
      <ApolloProvider client={client}>
        <TestComponent />
      </ApolloProvider>
    );

    const view = await getDataFromTree(element);

    expect(view).toMatch(/Data:.*success/);
  });
});
