import React, { useContext } from "react";
import { render, screen } from "@testing-library/react";

import { ApolloLink } from "../../../link/core";
import { ApolloClient } from "../../../core";
import { InMemoryCache as Cache } from "../../../cache";
import { ApolloProvider, ApolloProviderProps } from "../ApolloProvider";
import { ApolloContextValue, getApolloContext } from "../ApolloContext";

describe("<ApolloProvider /> Component", () => {
  const client = new ApolloClient({
    cache: new Cache(),
    link: new ApolloLink((o, f) => (f ? f(o) : null)),
  });

  const anotherClient = new ApolloClient({
    cache: new Cache(),
    link: new ApolloLink((o, f) => (f ? f(o) : null)),
  });

  it("should render children components", () => {
    render(
      <ApolloProvider client={client}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );

    expect(screen.getByText("Test")).toBeTruthy();
  });

  it("should support the 2.0", () => {
    render(
      <ApolloProvider client={{} as ApolloClient<any>}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );

    expect(screen.getByText("Test")).toBeTruthy();
  });

  it("should require a client", () => {
    const originalConsoleError = console.error;
    console.error = () => {
      /* noop */
    };
    expect(() => {
      // Before testing `ApolloProvider`, we first fully reset the
      // existing context using `ApolloContext.Provider` directly.
      const ApolloContext = getApolloContext();
      render(
        <ApolloContext.Provider value={{}}>
          <ApolloProvider client={undefined as any}>
            <div className="unique" />
          </ApolloProvider>
        </ApolloContext.Provider>
      );
    }).toThrowError(
      "ApolloProvider was not passed a client instance. Make " +
        'sure you pass in your client via the "client" prop.'
    );
    console.error = originalConsoleError;
  });

  it("should not require a store", () => {
    render(
      <ApolloProvider client={client}>
        <div className="unique">Test</div>
      </ApolloProvider>
    );
    expect(screen.getByText("Test")).toBeTruthy();
  });

  it("should add the client to the children context", () => {
    const TestChild = () => {
      const context = useContext(getApolloContext());
      expect(context.client).toEqual(client);
      return null;
    };
    render(
      <ApolloProvider client={client}>
        <TestChild />
        <TestChild />
      </ApolloProvider>
    );
  });

  it("should update props when the client changes", () => {
    let clientToCheck = client;

    const TestChild = () => {
      const context = useContext(getApolloContext());
      expect(context.client).toEqual(clientToCheck);
      return null;
    };
    const { rerender } = render(
      <ApolloProvider client={clientToCheck}>
        <TestChild />
      </ApolloProvider>
    );

    const newClient = new ApolloClient({
      cache: new Cache(),
      link: new ApolloLink((o, f) => (f ? f(o) : null)),
    });
    clientToCheck = newClient;
    rerender(
      <ApolloProvider client={clientToCheck}>
        <TestChild />
      </ApolloProvider>
    );
  });

  describe.each<
    [
      string,
      Omit<ApolloProviderProps<any>, "children">,
      Omit<ApolloProviderProps<any>, "children">,
    ]
  >([["client", { client }, { client: anotherClient }]])(
    "context value stability, %s prop",
    (prop, value, childValue) => {
      it(`should not recreate the context value if the ${prop} prop didn't change`, () => {
        let lastContext: ApolloContextValue | undefined;

        const TestChild = () => {
          lastContext = useContext(getApolloContext());
          return null;
        };

        const { rerender } = render(
          <ApolloProvider {...value}>
            <TestChild />
          </ApolloProvider>
        );

        const firstContextValue = lastContext;

        rerender(
          <ApolloProvider {...value}>
            <TestChild />
          </ApolloProvider>
        );

        expect(lastContext).toBe(firstContextValue);
      });

      it(`should not recreate the context if the parent context value differs, but the ${prop} prop didn't change`, () => {
        let lastContext: ApolloContextValue | undefined;

        const TestChild = () => {
          lastContext = useContext(getApolloContext());
          return null;
        };

        const { rerender } = render(
          <ApolloProvider {...value}>
            <ApolloProvider {...childValue}>
              <TestChild />
            </ApolloProvider>
          </ApolloProvider>
        );

        const firstContextValue = lastContext;

        rerender(
          <ApolloProvider {...value}>
            <ApolloProvider {...childValue}>
              <TestChild />
            </ApolloProvider>
          </ApolloProvider>
        );

        expect(lastContext).toBe(firstContextValue);
      });
    }
  );
});
