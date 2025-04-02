/* eslint-disable testing-library/render-result-naming-convention */
// not exported
// eslint-disable-next-line local-rules/no-relative-imports
import "../../../testing/internal/messageChannelPolyfill.js";

import "./polyfillReactDomTypes.d.ts";

import { expectTypeOf } from "expect-type";
import { JSDOM } from "jsdom";
import jsesc from "jsesc";
import * as React from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { prerender } from "react-dom/static";
import { prerenderToNodeStream } from "react-dom/static.node";

import type { TypedDocumentNode } from "@apollo/client/core";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
} from "@apollo/client/core";
import {
  ApolloProvider,
  getApolloContext,
  useQuery,
  useSuspenseQuery,
} from "@apollo/client/react";
import { prerenderStatic } from "@apollo/client/react/ssr";
import type { MockedResponse } from "@apollo/client/testing";
import { MockLink, MockSubscriptionLink, wait } from "@apollo/client/testing";
import { resetApolloContext } from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

beforeEach(() => {
  // We are running tests with multiple different renderers, and that can result in a warning like
  // > Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.
  // This avoids that.
  resetApolloContext();
});
// @ts-ignore
global.setImmediate ||= (fn) => setTimeout(fn, 0);

function testSetup() {
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

  function Outlet() {
    const { data } = useSuspenseQuery(query1);
    return (
      <div>
        <p>Hello {data.hello}!</p>
        <Parent />
      </div>
    );
  }

  function Parent() {
    const { data } = useSuspenseQuery(query2);

    return (
      <>
        <p>My name is {data.whoami.name}!</p>
        <Child />
      </>
    );
  }
  function Child() {
    const { data } = useSuspenseQuery(query3);

    return (
      <>
        <p>Current time is {data.currentTime}!</p>
      </>
    );
  }

  const mocks = [
    {
      request: { query: query1 },
      result: { data: { hello: "world" } },
      maxUsageCount: 1,
    },
    {
      request: { query: query2 },
      result: { data: { whoami: { name: "Apollo" } } },
      maxUsageCount: 1,
    },
    {
      request: { query: query3 },
      result: { data: { currentTime: "2025-03-26T14:40:53.118Z" } },
      maxUsageCount: 1,
    },
  ];
  const mockLink = new MockLink(mocks);
  return {
    Outlet,
    mocks,
    mockLink,
    query1,
    query2,
    query3,
  };
}

test.each([
  ["prerender", prerender satisfies prerenderStatic.PrerenderToWebStream],
  [
    "prerenderToNodeStream",
    prerenderToNodeStream satisfies prerenderStatic.PrerenderToNodeStream,
  ],
] as const)(
  "real-life kitchen sink use case with %s and `useSuspenseQuery`",
  async (_, prerender) => {
    // reset things that might have been set by a previous run of this test with
    // a different runner
    (window as any).__APOLLO_CLIENT_INIT__ = undefined;
    window.document.documentElement.innerHTML = "<head></head><body></body>";

    const throwingLink = new ApolloLink(() => {
      throw new Error(
        "This ApolloClient instance should not need to make requests!"
      );
    });

    const { Outlet, mockLink: ssrLink } = testSetup();
    // from here on it's essentially what a userland app could look like

    function makeClient(link = throwingLink) {
      return new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });
    }
    function App() {
      const externalClient = React.useContext(getApolloContext()).client;
      const [client] = React.useState<ApolloClient>(
        externalClient || makeClient
      );
      if ((window as any).__APOLLO_CLIENT_INIT__) {
        client.restore((window as any).__APOLLO_CLIENT_INIT__);
      }

      return (
        <html>
          <head>
            <meta charSet="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <link rel="stylesheet" href="/styles.css"></link>
            <title>My app</title>
          </head>
          <body>
            <ApolloProvider client={client}>
              <React.Suspense fallback="Loading...">
                <Outlet />
              </React.Suspense>
            </ApolloProvider>
          </body>
        </html>
      );
    }

    async function ssr() {
      const client = makeClient(ssrLink);
      const signal = AbortSignal.timeout(2000);

      await prerenderStatic({
        tree: <App />,
        renderFunction: (tree) => prerender(tree, { signal }),
        context: {
          client,
        },
        ignoreResults: true,
        signal,
      });

      const extracted = client.extract();

      const { prelude } = await prerender(
        <ApolloProvider client={client}>
          <App />
        </ApolloProvider>,
        {
          bootstrapScripts: ["/main.js"],
          bootstrapScriptContent: `window.__APOLLO_CLIENT_INIT__ = ${jsesc(
            extracted,
            {
              isScriptContext: true,
              wrap: true,
              json: true,
            }
          )}`,
          signal,
        }
      );
      return new Response(prelude as any, {
        headers: { "content-type": "text/html" },
      });
    }

    const response = await ssr();

    // We're switching renderer, so we need to reset the context or the value
    // will carry over from the SSR render to the "browser" render
    resetApolloContext();

    const responseText = await response.text();
    expect(responseText).toMatchSnapshot();

    // JS isn't executed if we just assign the html to the current JSDOM root,
    // so we create another JSDOM instance just to extract the `__APOLLO_CLIENT_INIT__`
    // value and the top-level elements innerHTML
    const jsdom = new JSDOM(responseText, { runScripts: "dangerously" });
    expect(jsdom.window.__APOLLO_CLIENT_INIT__).toMatchSnapshot();
    const __APOLLO_CLIENT_INIT__ = jsdom.window.__APOLLO_CLIENT_INIT__;
    const innerHtml = jsdom.window.document.documentElement.innerHTML;
    jsdom.window.close();

    // hydrate the app in the "jest/browser" JSDOM
    (window as any).__APOLLO_CLIENT_INIT__ = __APOLLO_CLIENT_INIT__;
    window.document.documentElement.innerHTML = innerHtml;
    const reactClient = await import("react-dom/client");
    const root = reactClient.hydrateRoot(window.document, <App />, {
      onCaughtError: console.error,
      onRecoverableError: console.error,
      onUncaughtError: console.error,
    });

    // wait a bit - hydration errors would be thrown here
    await new Promise((resolve) => setTimeout(resolve, 500));

    // no errors, hydration was successful, test is done
    root.unmount();
  }
);

test.each([
  ["renderToString", renderToString satisfies prerenderStatic.RenderToString],
  [
    "renderToStaticMarkup",
    renderToStaticMarkup satisfies prerenderStatic.RenderToString,
  ],
])(
  "`prerenderStatic` with `%s` and suspense hooks will error",
  async (_, renderFunction) => {
    const { Outlet, mockLink } = testSetup();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: mockLink,
    });

    const promise = prerenderStatic({
      tree: <Outlet />,
      context: { client },
      renderFunction,
    });

    await expect(promise).rejects.toEqual(
      new Error(
        "A component suspended while responding to synchronous input. This will cause the UI to be replaced with a loading indicator. To fix, updates that suspend should be wrapped with startTransition."
      )
    );
  }
);

test.each([
  ["prerender", prerender],
  ["prerenderToNodeStream", prerenderToNodeStream],
])(
  "%s: AbortSignal times out during render - React re-throws abort error",
  async (_, renderFunction) => {
    const { Outlet, query1, query2 } = testSetup();
    type DataFor<T> = T extends TypedDocumentNode<infer D, any> ? D : never;

    const onError = jest.fn();

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const controller = new AbortController();

    const promise = prerenderStatic({
      tree: <Outlet />,
      context: { client },
      renderFunction: (tree) =>
        renderFunction(tree, {
          signal: controller.signal,
          onError,
        }),
      signal: controller.signal,
    });

    link.simulateResult(
      {
        result: {
          data: {
            hello: "world",
          } satisfies DataFor<typeof query1>,
        },
      },
      true
    );

    await wait(10);

    link.simulateResult(
      {
        result: {
          data: {
            whoami: { name: "Apollo" },
          } satisfies DataFor<typeof query2>,
        },
      },
      true
    );

    await wait(10);
    controller.abort("AbortReason");

    await expect(promise).rejects.toEqual("AbortReason");
    expect(onError).toHaveBeenLastCalledWith("AbortReason", expect.anything());
  }
);

test.each([
  ["renderToString", renderToString],
  ["renderToStaticMarkup", renderToStaticMarkup],
])(
  "%s: AbortSignal times out during render - stops rerendering, returns partial result",
  async (_, renderFunction) => {
    const { query1, query2, query3 } = testSetup();
    type DataFor<T> = T extends TypedDocumentNode<infer D, any> ? D : never;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const controller = new AbortController();

    function Component() {
      const { data, loading } = useQuery(query1);
      if (loading) return <div>loading...</div>;
      return (
        <div>
          <p>Hello {data?.hello}!</p>
          <Parent />
        </div>
      );
    }

    function Parent() {
      const { data, loading } = useQuery(query2);
      if (loading) return <div>loading...</div>;

      return (
        <>
          <p>My name is {data?.whoami.name}!</p>
          <Child />
        </>
      );
    }
    function Child() {
      const { data, loading } = useQuery(query3);
      if (loading) return <div>loading...</div>;

      return (
        <>
          <p>Current time is {data?.currentTime}!</p>
        </>
      );
    }

    const promise = prerenderStatic({
      tree: <Component />,
      context: { client },
      renderFunction,
      signal: controller.signal,
      diagnostics: true,
    });

    link.simulateResult(
      {
        result: {
          data: {
            hello: "world",
          } satisfies DataFor<typeof query1>,
        },
      },
      true
    );

    await wait(10);

    link.simulateResult(
      {
        result: {
          data: {
            whoami: { name: "Apollo" },
          } satisfies DataFor<typeof query2>,
        },
      },
      true
    );

    await wait(10);

    controller.abort("AbortReason");
    // the network request here never "resolves"
    // (no call to `simulateResult` for the third query), yet the `abort` call
    // should finish up the prerendering

    const { result, aborted, diagnostics } = await promise;
    expect(result).toMatchSnapshot();
    expect(result).toMatch(/world/);
    expect(result).toMatch(/Apollo/);
    expect(result).toMatch(/loading.../);
    expect(aborted).toBe(true);
    expect(diagnostics?.renderCount).toBe(3);
  }
);

test("cancelled AbortSignal is passed into `prerenderStatic`", async () => {
  const { Outlet, mockLink } = testSetup();

  const controller = new AbortController();
  controller.abort();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: mockLink,
  });

  const promise = prerenderStatic({
    tree: <Outlet />,
    context: { client },
    renderFunction: prerender,
    signal: controller.signal,
  });

  await expect(promise).rejects.toEqual(
    new Error("The operation was aborted before it could be attempted.")
  );
});

test("usage with `useSuspenseQuery`: `diagnostics.renderCount` stays 1", async () => {
  const { Outlet, mockLink } = testSetup();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: mockLink,
  });

  const { diagnostics, result } = await prerenderStatic({
    tree: <Outlet />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
  });

  expect(diagnostics?.renderCount).toBe(1);
  expect(result).toMatchInlineSnapshot(
    `"<div><p>Hello <!-- -->world<!-- -->!</p><p>My name is <!-- -->Apollo<!-- -->!</p><p>Current time is <!-- -->2025-03-26T14:40:53.118Z<!-- -->!</p></div>"`
  );
});

test("usage with `useQuery`: `diagnostics.renderCount` is 2", async () => {
  const { query1, mockLink } = testSetup();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: mockLink,
  });

  function Component() {
    const { data, loading } = useQuery(query1);
    if (loading) return <div>loading...</div>;
    return <div>{data?.hello}</div>;
  }

  const { diagnostics, result } = await prerenderStatic({
    tree: <Component />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
  });

  expect(diagnostics?.renderCount).toBe(2);
  expect(result).toMatchInlineSnapshot(`"<div>world</div>"`);
});

test("usage with a waterfall of `useQuery`: `diagnostics.renderCount` is `n+1`", async () => {
  const { query1, query2, query3, mockLink } = testSetup();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: mockLink,
  });

  function Component() {
    const { data, loading } = useQuery(query1);
    if (loading) return <div>loading...</div>;
    return (
      <div>
        <p>Hello {data?.hello}!</p>
        <Parent />
      </div>
    );
  }

  function Parent() {
    const { data, loading } = useQuery(query2);
    if (loading) return <div>loading...</div>;

    return (
      <>
        <p>My name is {data?.whoami.name}!</p>
        <Child />
      </>
    );
  }
  function Child() {
    const { data, loading } = useQuery(query3);
    if (loading) return <div>loading...</div>;

    return (
      <>
        <p>Current time is {data?.currentTime}!</p>
      </>
    );
  }

  const { diagnostics, result } = await prerenderStatic({
    tree: <Component />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
  });

  expect(diagnostics?.renderCount).toBe(4);
  expect(result).toMatchInlineSnapshot(
    `"<div><p>Hello <!-- -->world<!-- -->!</p><p>My name is <!-- -->Apollo<!-- -->!</p><p>Current time is <!-- -->2025-03-26T14:40:53.118Z<!-- -->!</p></div>"`
  );
});

test("multiple `useQuery` calls in the same component do not waterfall", async () => {
  const { query1, query2, query3, mockLink } = testSetup();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: mockLink,
  });

  function Component() {
    const result1 = useQuery(query1);
    const result2 = useQuery(query2);
    const result3 = useQuery(query3);
    if (result1.loading || result2.loading || result3.loading)
      return <div>loading...</div>;

    return (
      <div>
        {result1.data?.hello}
        {result2.data?.whoami?.name}
        {result3.data?.currentTime}
      </div>
    );
  }

  const { result, diagnostics } = await prerenderStatic({
    tree: <Component />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
  });

  expect(diagnostics?.renderCount).toBe(2);
  expect(result).toMatchInlineSnapshot(
    `"<div>world<!-- -->Apollo<!-- -->2025-03-26T14:40:53.118Z</div>"`
  );
});

test("`maxRerenders` will throw an error if exceeded", async () => {
  const query: TypedDocumentNode<{ hello: string }, { depth: number }> = gql`
    query ($depth: Int!) {
      hello(depth: $depth)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        variableMatcher: () => true,
        newData: (arg) => ({ data: { hello: "world" + arg.depth } }),
      } satisfies MockedResponse<{ hello: string }, { depth: number }>,
    ]),
  });

  function Component({ depth }: { depth: number }) {
    const { loading, data } = useQuery(query, { variables: { depth } });

    if (loading) return <div>loading...</div>;

    return (
      <div>
        {data?.hello}
        <Component depth={depth + 1} />
      </div>
    );
  }

  const promise = prerenderStatic({
    tree: <Component depth={1} />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
    maxRerenders: 4,
  });
  await expect(promise).rejects.toEqual(
    new InvariantError(`Exceeded maximum rerender count of 4.
This either means you have very deep \`useQuery\` waterfalls in your application
and need to increase the \`maxRerender\` option to \`prerenderStatic\`, or that
you have an infinite render loop in your application.`)
  );
});

test("`maxRerenders` defaults to 50", async () => {
  const query: TypedDocumentNode<{ hello: string }, { depth: number }> = gql`
    query ($depth: Int!) {
      hello(depth: $depth)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        variableMatcher: () => true,
        newData: (arg) => ({ data: { hello: "world" + arg.depth } }),
      } satisfies MockedResponse<{ hello: string }, { depth: number }>,
    ]),
  });

  function Component({ depth }: { depth: number }) {
    const { loading, data } = useQuery(query, { variables: { depth } });

    if (loading) return <div>loading...</div>;

    return (
      <div>
        {data?.hello}
        <Component depth={depth + 1} />
      </div>
    );
  }

  const promise = prerenderStatic({
    tree: <Component depth={1} />,
    context: { client },
    renderFunction: prerender,
    diagnostics: true,
  });
  await expect(promise).rejects.toEqual(
    new InvariantError(`Exceeded maximum rerender count of 50.
This either means you have very deep \`useQuery\` waterfalls in your application
and need to increase the \`maxRerender\` option to \`prerenderStatic\`, or that
you have an infinite render loop in your application.`)
  );
});

test.each([
  ["renderToString", renderToString],
  ["renderToStaticMarkup", renderToStaticMarkup],
  ["prerender", prerender],
  ["prerenderToNodeStream", prerenderToNodeStream],
])(
  "`ignoreResults` will result in an empty string to be returned (%s)",
  async (_, renderFunction) => {
    const { mockLink, query1 } = testSetup();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: mockLink,
    });
    function Component() {
      const { data, loading } = useQuery(query1);
      if (loading) return <div>loading...</div>;
      return <div>{data?.hello}</div>;
    }
    const { result } = await prerenderStatic({
      tree: <Component />,
      context: { client },
      renderFunction,
      ignoreResults: true,
    });

    expect(result).toBe("");
  }
);

it.skip("type tests", async () => {
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToStaticMarkup,
    })
  ).toEqualTypeOf<{
    result: string;
    aborted: boolean;
    diagnostics?: { renderCount: number };
  }>();
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToString,
    })
  ).toEqualTypeOf<{
    result: string;
    aborted: boolean;
    diagnostics?: { renderCount: number };
  }>();
  if (React.version.startsWith("19")) {
    const { prerender, prerenderToNodeStream } =
      require("react-dom/static") as typeof import("react-dom/static");

    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerender,
      })
    ).toEqualTypeOf<{
      result: string;
      aborted: boolean;
      diagnostics?: { renderCount: number };
    }>();
    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerenderToNodeStream,
      })
    ).toEqualTypeOf<{
      result: string;
      aborted: boolean;
      diagnostics?: { renderCount: number };
    }>();
  }
});
