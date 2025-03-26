/** @jest-environment node */
import { gql } from "graphql-tag";
import React from "react";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient, TypedDocumentNode } from "@apollo/client/core";
import { ApolloProvider, getApolloContext } from "@apollo/client/react/context";
import { useApolloClient, useQuery } from "@apollo/client/react/hooks";
import { getMarkupFromTree } from "@apollo/client/react/ssr";
import { MockedResponse, mockSingleLink } from "@apollo/client/testing";
import { MockedProvider } from "@apollo/client/testing/react";

import { renderToStaticMarkup, renderToString } from "react-dom/server";

beforeEach(() => {
  // We are running tests with multiple different renderers, and that can result in a warning like
  // > Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.
  // This avoids that.
  const context = getApolloContext();
  // @ts-ignore
  context._currentRenderer = null;
});

describe("useQuery Hook SSR", () => {
  const CAR_QUERY: TypedDocumentNode<typeof CAR_RESULT_DATA> = gql`
    query {
      cars {
        make
        model
        vin
      }
    }
  `;

  const CAR_RESULT_DATA = {
    cars: [
      {
        make: "Audi",
        model: "RS8",
        vin: "DOLLADOLLABILL",
        __typename: "Car",
      },
    ],
  };

  const CAR_MOCKS = [
    {
      request: {
        query: CAR_QUERY,
      },
      result: { data: CAR_RESULT_DATA },
    },
  ];

  it("should support SSR", () => {
    const Component = () => {
      const { loading, data } = useQuery(CAR_QUERY);
      if (!loading) {
        expect(data).toEqual(CAR_RESULT_DATA);
        const { make, model, vin } = data!.cars[0];
        return (
          <div>
            {make}, {model}, {vin}
          </div>
        );
      }
      return null;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((markup) => {
      expect(markup).toMatch(/Audi/);
    });
  });

  it("should initialize data as `undefined` when loading", () => {
    const Component = () => {
      const { data, loading } = useQuery(CAR_QUERY);
      if (loading) {
        expect(data).toBeUndefined();
      }
      return null;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    });
  });

  it("should skip SSR tree rendering and return a loading state if `ssr` option is `false`", async () => {
    let renderCount = 0;
    const Component = () => {
      const { data, loading } = useQuery(CAR_QUERY, { ssr: false });
      renderCount += 1;

      expect(loading).toBeTruthy();

      if (!loading) {
        const { make } = data!.cars[0];
        return <div>{make}</div>;
      }
      return null;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((result) => {
      expect(renderCount).toBe(1);
      expect(result).toEqual("");
    });
  });

  it("should skip SSR tree rendering and not return a loading state loading if `ssr` option is `false` and `skip` is `true`", async () => {
    let renderCount = 0;
    const Component = () => {
      const { data, loading } = useQuery(CAR_QUERY, { ssr: false, skip: true });
      renderCount += 1;

      expect(loading).toBeFalsy();
      expect(data).toBeUndefined();

      return null;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((result) => {
      expect(renderCount).toBe(1);
      expect(result).toEqual("");
    });
  });

  it("should skip both SSR tree rendering and SSR component rendering if `ssr` option is `false` and `ssrMode` is `true`", async () => {
    const link = mockSingleLink({
      request: { query: CAR_QUERY },
      result: { data: CAR_RESULT_DATA },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      ssrMode: true,
    });

    let renderCount = 0;
    const Component = () => {
      const { data, loading } = useQuery(CAR_QUERY, { ssr: false });

      let content = null;
      switch (renderCount) {
        case 0:
          expect(loading).toBeTruthy();
          expect(data).toBeUndefined();
          break;
        case 1: // FAIL; should not render a second time
        default:
          throw new Error("Duplicate render");
      }

      renderCount += 1;
      return content;
    };

    const app = (
      <ApolloProvider client={client}>
        <Component />
      </ApolloProvider>
    );

    const view = await getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    });
    expect(renderCount).toBe(1);
    expect(view).toEqual("");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renderCount).toBe(1);
    expect(view).toEqual("");
  });

  it("should skip SSR tree rendering if `skip` option is `true`", async () => {
    let renderCount = 0;
    const Component = () => {
      const { loading, networkStatus, data } = useQuery(CAR_QUERY, {
        skip: true,
      });
      renderCount += 1;

      expect(loading).toBeFalsy();
      expect(networkStatus).toBe(7);
      expect(data).toBeUndefined();

      return null;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((result) => {
      expect(renderCount).toBe(1);
      expect(result).toBe("");
    });
  });

  it("should render SSR tree rendering if `skip` option is `true` for only one instance of the query", async () => {
    let renderCount = 0;

    const AnotherComponent = () => {
      const { loading, data } = useQuery(CAR_QUERY, { skip: false });

      renderCount += 1;

      if (!loading) {
        expect(data).toEqual(CAR_RESULT_DATA);
        const { make, model, vin } = data!.cars[0];
        return (
          <div>
            {make}, {model}, {vin}
          </div>
        );
      }

      return null;
    };

    const Component = () => {
      const { loading, data } = useQuery(CAR_QUERY, { skip: true });
      renderCount += 1;

      expect(loading).toBeFalsy();
      expect(data).toBeUndefined();

      return <AnotherComponent />;
    };

    const app = (
      <MockedProvider mocks={CAR_MOCKS}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((result) => {
      expect(renderCount).toBe(4);
      expect(result).toMatch(/Audi/);
      expect(result).toMatch(/RS8/);
    });
  });

  it("should return data written previously to cache during SSR pass if using cache-only fetchPolicy", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Order: {
          keyFields: ["selection"],
        },
      },
    });

    const query: TypedDocumentNode<typeof initialData> = gql`
      query GetSearchResults {
        getSearchResults @client {
          locale
          order {
            selection
          }
          pagination {
            pageLimit
          }
          results {
            id
            text
          }
        }
      }
    `;

    const initialData = {
      getSearchResults: {
        __typename: "SearchResults",
        locale: "en-US",
        order: {
          __typename: "Order",
          selection: "RELEVANCE",
        },
        pagination: {
          pageLimit: 3,
        },
        results: [
          { __typename: "SearchResult", id: 1, text: "hi" },
          { __typename: "SearchResult", id: 2, text: "hello" },
          { __typename: "SearchResult", id: 3, text: "hey" },
        ],
      },
    };

    const spy = jest.fn();

    const Component = () => {
      useApolloClient().writeQuery({ query, data: initialData });

      const { loading, data } = useQuery(query, {
        fetchPolicy: "cache-only",
      });

      spy(loading);

      if (!loading) {
        expect(data).toEqual(initialData);

        const {
          getSearchResults: {
            pagination: { pageLimit },
          },
        } = data!;
        return <div>{pageLimit}</div>;
      }
      return null;
    };

    const app = (
      <MockedProvider cache={cache}>
        <Component />
      </MockedProvider>
    );

    return getMarkupFromTree({
      renderFunction: renderToString,
      tree: app,
    }).then((markup) => {
      expect(spy).toHaveBeenNthCalledWith(1, false);
      expect(markup).toMatch(/<div.*>3<\/div>/);
      expect(cache.extract()).toMatchSnapshot();
    });
  });

  it("should deduplicate `variables` with identical content, but different order", async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CAR_QUERY,
          variables: { foo: "a", bar: 1 },
        },
        result: { data: CAR_RESULT_DATA },
        maxUsageCount: 1,
      },
    ];

    const Component = ({
      variables,
    }: {
      variables: { foo: string; bar: number };
    }) => {
      const { loading, data } = useQuery(CAR_QUERY, { variables, ssr: true });
      if (!loading) {
        expect(data).toEqual(CAR_RESULT_DATA);
        const { make, model, vin } = data!.cars[0];
        return (
          <div>
            {make}, {model}, {vin}
          </div>
        );
      }
      return null;
    };

    await getMarkupFromTree({
      renderFunction: renderToString,
      tree: (
        <MockedProvider mocks={mocks}>
          <>
            <Component variables={{ foo: "a", bar: 1 }} />
            <Component variables={{ bar: 1, foo: "a" }} />
          </>
        </MockedProvider>
      ),
    });
  });

  const reactMajor = React.version.split(".")[0];
  it.each(
    reactMajor == "19" ?
      [
        ["renderToStaticMarkup", renderToStaticMarkup],
        ["renderToString", renderToString],
        [
          "prerender",
          (
            require("react-dom/static.edge") as typeof import("react-dom/static")
          ).prerender,
        ],
        [
          "prerenderToNodeStream",
          (
            require("react-dom/static.node") as typeof import("react-dom/static")
          ).prerenderToNodeStream,
        ],
      ]
    : [
        ["renderToStaticMarkup", renderToStaticMarkup],
        ["renderToString", renderToString],
      ]
  )(
    `React ${reactMajor}, %s, should render waterfalls by rerendering the tree multiple times`,
    async (_, renderFunction) => {
      const query1: TypedDocumentNode<{ hello: string }> = gql`
        query {
          hello
        }
      `;
      const query2: TypedDocumentNode<{ whoami: { name: string } }> = gql`
        query {
          whoami {
            name
          }
        }
      `;
      const query3: TypedDocumentNode<{ currentTime: string }> = gql`
        query {
          currentTime
        }
      `;

      const link = mockSingleLink(
        { request: { query: query1 }, result: { data: { hello: "world" } } },
        {
          request: { query: query2 },
          result: { data: { whoami: { name: "Apollo" } } },
        },
        {
          request: { query: query3 },
          result: { data: { currentTime: "2025-03-26T14:40:53.118Z" } },
        }
      );

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      function App() {
        const { loading, data } = useQuery(query1);

        if (loading) {
          return <p>Loading...</p>;
        }
        return (
          <div>
            <p>Hello {data?.hello}!</p>
            <Parent />
          </div>
        );
      }
      function Parent() {
        const { loading, data } = useQuery(query2);

        if (loading) {
          return <p>Loading...</p>;
        }
        return (
          <>
            <p>My name is {data?.whoami.name}!</p>
            <Child />
          </>
        );
      }
      function Child() {
        const { loading, data } = useQuery(query3);

        if (loading) {
          return <p>Loading...</p>;
        }
        return (
          <>
            <p>Current time is {data?.currentTime}!</p>
          </>
        );
      }
      const view = await getMarkupFromTree({
        tree: (
          <ApolloProvider client={client}>
            <App />
          </ApolloProvider>
        ),
        renderFunction,
      });
      expect(view).toMatch(/world/);
      expect(view).toMatch(/Apollo/);
      expect(view).toMatch(/2025-03-26T14:40:53.118Z/);
    }
  );
});
