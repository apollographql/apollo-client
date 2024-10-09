import React from "react";
import gql from "graphql-tag";
import { render, waitFor } from "@testing-library/react";

import { ApolloClient, ApolloError } from "../../../../core";
import { InMemoryCache as Cache } from "../../../../cache";
import { ApolloProvider } from "../../../context";
import { ApolloLink, DocumentNode, Operation } from "../../../../link/core";
import { itAsync, MockSubscriptionLink } from "../../../../testing";
import { Subscription } from "../../Subscription";
import { spyOnConsole } from "../../../../testing/internal";
import { renderToRenderStream } from "@testing-library/react-render-stream";

const results = [
  "Luke Skywalker",
  "Han Solo",
  "Darth Vader",
  "Leia Skywalker",
].map((name) => ({
  result: { data: { user: { name } } },
}));

beforeEach(() => {
  jest.useRealTimers();
});

const subscription = gql`
  subscription UserInfo {
    user {
      name
    }
  }
`;

const cache = new Cache({ addTypename: false });
const link = new MockSubscriptionLink();
const client = new ApolloClient({
  link,
  cache,
});

itAsync("executes the subscription", (resolve, reject) => {
  let renderCount = 0;
  const Component = () => (
    <Subscription subscription={subscription}>
      {(result: any) => {
        const { loading, data, error } = result;
        switch (renderCount) {
          case 0:
            expect(loading).toBe(true);
            expect(error).toBeUndefined();
            expect(data).toBeUndefined();
            break;
          case 1:
            expect(loading).toBe(false);
            expect(data).toEqual(results[0].result.data);
            break;
          case 2:
            expect(loading).toBe(false);
            expect(data).toEqual(results[1].result.data);
            break;
          case 3:
            expect(loading).toBe(false);
            expect(data).toEqual(results[2].result.data);
            break;
          case 4:
            expect(loading).toBe(false);
            expect(data).toEqual(results[3].result.data);
            break;
          default:
        }

        setTimeout(() => {
          renderCount <= results.length &&
            link.simulateResult(results[renderCount - 1]);
        });

        renderCount += 1;
        return null;
      }}
    </Subscription>
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  waitFor(() => expect(renderCount).toBe(5)).then(resolve, reject);
});

it("calls onData if given", async () => {
  let count = 0;

  const Component = () => (
    <Subscription
      subscription={subscription}
      onData={(opts: any) => {
        expect(opts.client).toBeInstanceOf(ApolloClient);
        const { data } = opts.data;
        expect(data).toEqual(results[count].result.data);
        count++;
      }}
    />
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  const interval = setInterval(() => {
    link.simulateResult(results[count]);
    if (count >= 3) clearInterval(interval);
  }, 10);

  await waitFor(() => expect(count).toBe(4));
});

it("calls onSubscriptionData with deprecation warning if given", async () => {
  using consoleSpy = spyOnConsole("warn");
  let count = 0;

  const Component = () => (
    <Subscription
      subscription={subscription}
      onSubscriptionData={(opts: any) => {
        expect(opts.client).toBeInstanceOf(ApolloClient);
        const { data } = opts.subscriptionData;
        expect(data).toEqual(results[count].result.data);
        count++;
      }}
    />
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    expect.stringContaining("'onSubscriptionData' is deprecated")
  );

  const interval = setInterval(() => {
    link.simulateResult(results[count]);
    if (count >= 3) clearInterval(interval);
  }, 10);

  await waitFor(() => expect(count).toBe(4));
});

it("should call onComplete if specified", async () => {
  let count = 0;

  let done = false;
  const Component = () => (
    <Subscription
      subscription={subscription}
      onData={() => {
        count++;
      }}
      onComplete={() => {
        done = true;
      }}
    />
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  const interval = setInterval(() => {
    link.simulateResult(results[count], count === 3);
    if (count >= 3) clearInterval(interval);
  }, 10);

  await waitFor(() => expect(done).toBeTruthy());
});

it("should call onSubscriptionComplete with deprecation warning if specified", async () => {
  using consoleSpy = spyOnConsole("warn");
  let count = 0;

  let done = false;
  const Component = () => (
    <Subscription
      subscription={subscription}
      onData={() => {
        count++;
      }}
      onSubscriptionComplete={() => {
        done = true;
      }}
    />
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    expect.stringContaining("'onSubscriptionComplete' is deprecated")
  );

  const interval = setInterval(() => {
    link.simulateResult(results[count], count === 3);
    if (count >= 3) clearInterval(interval);
  }, 10);

  await waitFor(() => expect(done).toBeTruthy());
});

itAsync(
  "executes subscription for the variables passed in the props",
  (resolve, reject) => {
    const subscriptionWithVariables = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;

    const variables = { name: "Luke Skywalker" };

    class MockSubscriptionLinkOverride extends MockSubscriptionLink {
      request(req: Operation) {
        try {
          expect(req.variables).toEqual(variables);
        } catch (error) {
          reject(error);
        }
        return super.request(req);
      }
    }

    const mockLink = new MockSubscriptionLinkOverride();

    const mockClient = new ApolloClient({
      link: mockLink,
      cache,
    });

    let count = 0;

    const Component = () => (
      <Subscription
        subscription={subscriptionWithVariables}
        variables={variables}
      >
        {(result: any) => {
          const { loading, data } = result;

          try {
            if (count === 0) {
              expect(loading).toBe(true);
            } else if (count === 1) {
              expect(loading).toBe(false);
              expect(data).toEqual(results[0].result.data);
            }
          } catch (error) {
            reject(error);
          }
          count++;
          return null;
        }}
      </Subscription>
    );

    render(
      <ApolloProvider client={mockClient}>
        <Component />
      </ApolloProvider>
    );

    mockLink.simulateResult(results[0]);

    waitFor(() => expect(count).toBe(2)).then(resolve, reject);
  }
);

itAsync("does not execute if variables have not changed", (resolve, reject) => {
  const subscriptionWithVariables = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  const name = "Luke Skywalker";

  class MockSubscriptionLinkOverride extends MockSubscriptionLink {
    request(req: Operation) {
      try {
        expect(req.variables).toEqual({ name });
      } catch (error) {
        reject(error);
      }
      return super.request(req);
    }
  }

  const mockLink = new MockSubscriptionLinkOverride();

  const mockClient = new ApolloClient({
    link: mockLink,
    cache,
  });

  let count = 0;

  class Component extends React.Component {
    render() {
      return (
        <Subscription
          subscription={subscriptionWithVariables}
          variables={{ name }}
        >
          {(result: any) => {
            const { loading } = result;
            try {
              if (count === 0) {
                expect(loading).toBe(true);
              } else if (count === 1) {
                expect(loading).toBe(false);
                setTimeout(() => this.forceUpdate());
              } else if (count === 2) {
                expect(loading).toBe(false);
              }
            } catch (error) {
              reject(error);
            }
            count++;
            return null;
          }}
        </Subscription>
      );
    }
  }

  render(
    <ApolloProvider client={mockClient}>
      <Component />
    </ApolloProvider>
  );

  mockLink.simulateResult(results[0]);

  waitFor(() => expect(count).toBe(3)).then(resolve, reject);
});

itAsync("renders an error", (resolve, reject) => {
  const subscriptionWithVariables = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  const variables = {
    name: "Luke Skywalker",
  };

  const subscriptionError = {
    error: new Error("error occurred"),
  };

  let count = 0;
  const Component = () => (
    <Subscription
      subscription={subscriptionWithVariables}
      variables={variables}
    >
      {(result: any) => {
        const { loading, data, error } = result;
        try {
          if (count === 0) {
            expect(loading).toBe(true);
            expect(error).toBeUndefined();
          } else if (count === 1) {
            expect(loading).toBe(false);
            expect(error).toEqual(
              new ApolloError({ protocolErrors: [new Error("error occurred")] })
            );
            expect(data).toBeUndefined();
          }
        } catch (error) {
          reject(error);
        }
        count++;

        return null;
      }}
    </Subscription>
  );

  render(
    <ApolloProvider client={client}>
      <Component />
    </ApolloProvider>
  );

  link.simulateResult(subscriptionError);

  waitFor(() => expect(count).toBe(2)).then(resolve, reject);
});

describe("should update", () => {
  it("if the client changes", async () => {
    const link2 = new MockSubscriptionLink();
    const client2 = new ApolloClient({
      link: link2,
      cache: new Cache({ addTypename: false }),
    });

    function Container() {
      return (
        <Subscription subscription={subscription}>
          {(r: any) => {
            replaceSnapshot(r);
            return null;
          }}
        </Subscription>
      );
    }
    const { takeRender, replaceSnapshot, renderResultPromise } =
      renderToRenderStream<any>(
        <ApolloProvider client={client}>
          <Container />
        </ApolloProvider>
      );
    const { rerender } = await renderResultPromise;
    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }

    link.simulateResult(results[0]);

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(results[0].result.data);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });

    rerender(
      <ApolloProvider client={client2}>
        <Container />
      </ApolloProvider>
    );

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }

    link2.simulateResult(results[1]);

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(results[1].result.data);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });
  });

  it("if the query changes", async () => {
    const subscriptionHero = gql`
      subscription HeroInfo {
        hero {
          name
        }
      }
    `;

    const heroResult = {
      result: {
        data: {
          hero: {
            name: "Chewie",
          },
        },
      },
    };

    const userLink = new MockSubscriptionLink();
    const heroLink = new MockSubscriptionLink();
    const linkCombined = new ApolloLink((o, f) => (f ? f(o) : null)).split(
      ({ operationName }) => operationName === "HeroInfo",
      heroLink,
      userLink
    );

    const mockClient = new ApolloClient({
      link: linkCombined,
      cache: new Cache({ addTypename: false }),
    });

    function Container({ subscription }: { subscription: DocumentNode }) {
      return (
        <Subscription subscription={subscription}>
          {(r: any) => {
            replaceSnapshot(r);
            return null;
          }}
        </Subscription>
      );
    }
    const { takeRender, replaceSnapshot, renderResultPromise } =
      renderToRenderStream<any>(<Container subscription={subscription} />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={mockClient}>{children}</ApolloProvider>
        ),
      });
    const { rerender } = await renderResultPromise;

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }
    userLink.simulateResult(results[0]);

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(results[0].result.data);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });

    rerender(<Container subscription={subscriptionHero} />);
    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }

    heroLink.simulateResult(heroResult);

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(heroResult.result.data);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });
  });

  it("if the variables change", async () => {
    const subscriptionWithVariables = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;

    const variablesLuke = { name: "Luke Skywalker" };
    const variablesHan = { name: "Han Solo" };

    const dataLuke = {
      user: {
        name: "Luke Skywalker",
      },
    };

    const dataHan = {
      user: {
        name: "Han Solo",
      },
    };

    const mockLink = new MockSubscriptionLink();

    const mockClient = new ApolloClient({
      link: mockLink,
      cache,
    });

    function Container({ variables }: { variables: any }) {
      return (
        <Subscription
          subscription={subscriptionWithVariables}
          variables={variables}
        >
          {(r: any) => {
            replaceSnapshot(r);
            return null;
          }}
        </Subscription>
      );
    }
    const { takeRender, renderResultPromise, replaceSnapshot } =
      renderToRenderStream<any>(<Container variables={variablesLuke} />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={mockClient}>{children}</ApolloProvider>
        ),
      });
    const { rerender } = await renderResultPromise;

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }
    mockLink.simulateResult({ result: { data: dataLuke } });

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(dataLuke);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });

    rerender(<Container variables={variablesHan} />);

    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeTruthy();
      expect(data).toBeUndefined();
    }
    mockLink.simulateResult({
      result: { data: dataHan },
    });
    {
      const {
        snapshot: { loading, data },
      } = await takeRender();
      expect(loading).toBeFalsy();
      expect(data).toEqual(dataHan);
    }

    await expect(takeRender).not.toRerender({ timeout: 50 });
  });
});

describe("should not update", () => {
  const variablesLuke = { name: "Luke Skywalker" };
  const variablesHan = { name: "Han Solo" };

  const dataLuke = {
    user: {
      name: "Luke Skywalker",
    },
  };

  const dataHan = {
    user: {
      name: "Han Solo",
    },
  };

  class MockSubscriptionLinkOverride extends MockSubscriptionLink {
    variables: any;
    request(req: Operation) {
      this.variables = req.variables;
      return super.request(req);
    }

    simulateResult() {
      if (this.variables.name === "Luke Skywalker") {
        return super.simulateResult({
          result: {
            data: dataLuke,
          },
        });
      } else if (this.variables.name === "Han Solo") {
        return super.simulateResult({
          result: {
            data: dataHan,
          },
        });
      }
    }
  }

  itAsync("if shouldResubscribe is false", (resolve, reject) => {
    const subscriptionWithVariables = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;

    const mockLink = new MockSubscriptionLinkOverride();

    const mockClient = new ApolloClient({
      link: mockLink,
      cache,
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        variables: variablesLuke,
      };

      render() {
        return (
          <Subscription
            subscription={subscriptionWithVariables}
            variables={this.state.variables}
            shouldResubscribe={false}
          >
            {(result: any) => {
              const { loading, data } = result;
              try {
                if (count === 0) {
                  expect(loading).toBeTruthy();
                  expect(data).toBeUndefined();
                } else if (count === 1) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(dataLuke);
                  setTimeout(() => {
                    this.setState(
                      {
                        variables: variablesHan,
                      },
                      () => {
                        mockLink.simulateResult();
                      }
                    );
                  });
                } else if (count === 2) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(dataLuke);
                }
              } catch (error) {
                reject(error);
              }

              count++;
              return null;
            }}
          </Subscription>
        );
      }
    }

    render(
      <ApolloProvider client={mockClient}>
        <Component />
      </ApolloProvider>
    );

    mockLink.simulateResult();

    waitFor(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync("if shouldResubscribe returns false", (resolve, reject) => {
    const subscriptionWithVariables = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;

    const mockLink = new MockSubscriptionLinkOverride();

    const mockClient = new ApolloClient({
      link: mockLink,
      cache,
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        variables: variablesLuke,
      };

      render() {
        return (
          <Subscription
            subscription={subscriptionWithVariables}
            variables={this.state.variables}
            shouldResubscribe={() => false}
          >
            {(result: any) => {
              const { loading, data } = result;
              try {
                if (count === 0) {
                  expect(loading).toBeTruthy();
                  expect(data).toBeUndefined();
                } else if (count === 1) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(dataLuke);
                  setTimeout(() => {
                    this.setState(
                      {
                        variables: variablesHan,
                      },
                      () => {
                        mockLink.simulateResult();
                      }
                    );
                  });
                } else if (count === 2) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(dataLuke);
                }
              } catch (error) {
                reject(error);
              }

              count++;
              return null;
            }}
          </Subscription>
        );
      }
    }

    render(
      <ApolloProvider client={mockClient}>
        <Component />
      </ApolloProvider>
    );

    mockLink.simulateResult();

    waitFor(() => expect(count).toBe(4)).then(resolve, reject);
  });
});
