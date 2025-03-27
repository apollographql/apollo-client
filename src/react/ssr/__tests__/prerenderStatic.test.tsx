import "../../../testing/internal/messageChannelPolyfill.js";

import { expectTypeOf } from "expect-type";
import { JSDOM } from "jsdom";
import jsesc from "jsesc";
import * as React from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  TypedDocumentNode,
} from "@apollo/client/core";
import {
  ApolloProvider,
  getApolloContext,
  useSuspenseQuery,
} from "@apollo/client/react";
import { prerenderStatic } from "@apollo/client/react/ssr";
import { MockLink } from "@apollo/client/testing";

import { resetApolloContext } from "../../../testing/internal/resetApolloContext.js";

beforeEach(() => {
  // We are running tests with multiple different renderers, and that can result in a warning like
  // > Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.
  // This avoids that.
  resetApolloContext();
});

test.each([
  [
    "prerender",
    (require("react-dom/static.edge") as typeof import("react-dom/static"))
      .prerender satisfies prerenderStatic.PrerenderToWebStream,
  ],
  [
    "prerenderToNodeStream",
    (require("react-dom/static.node") as typeof import("react-dom/static"))
      .prerenderToNodeStream satisfies prerenderStatic.PrerenderToNodeStream,
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
          <p>My name is {data?.whoami.name}!</p>
          <Child />
        </>
      );
    }
    function Child() {
      const { data } = useSuspenseQuery(query3);

      return (
        <>
          <p>Current time is {data?.currentTime}!</p>
        </>
      );
    }

    const ssrLink = new MockLink([
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
    ]);

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

it.skip("type tests", async () => {
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToStaticMarkup,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToString,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  if (React.version.startsWith("19")) {
    const { prerender, prerenderToNodeStream } =
      require("react-dom/static") as typeof import("react-dom/static");

    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerender,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerenderToNodeStream,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  }
});
