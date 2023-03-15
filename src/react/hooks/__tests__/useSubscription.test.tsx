import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import gql from 'graphql-tag';

import { ApolloClient, ApolloError, ApolloLink, concat } from '../../../core';
import { InMemoryCache as Cache } from '../../../cache';
import { ApolloProvider, resetApolloContext } from '../../context';
import { MockSubscriptionLink } from '../../../testing';
import { useSubscription } from '../useSubscription';

describe('useSubscription Hook', () => {
  afterEach(() => {
    resetApolloContext();
  });

  it('should handle a simple subscription properly', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ['Audi', 'BMW', 'Mercedes', 'Hyundai'].map(make => ({
      result: { data: { car: { make } } }
    }));

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });


    const { result } = renderHook(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(() => {
      expect(result.current.data).toEqual(results[0].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[1]));
    await waitFor(() => {
      expect(result.current.data).toEqual(results[1].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[2]));
    await waitFor(() => {
      expect(result.current.data).toEqual(results[2].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[3]));
    await waitFor(() => {
      expect(result.current.data).toEqual(results[3].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
  });

  it('should call onError after error results', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ['Audi', 'BMW', 'Mercedes', 'Hyundai'].map(make => ({
      result: { data: { car: { make } } }
    }));

    const errorResult = {
      error: new ApolloError({ errorMessage: "test" }),
      result: { data: { car: { make: null } } },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });


    const onError = jest.fn();
    const { result } = renderHook(
      () => useSubscription(subscription, { onError }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(results[0].result.data);
    setTimeout(() => link.simulateResult(errorResult));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
  });

  it('should call onComplete after subscription is complete', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [{
      result: { data: { car: { make: 'Audi' } } }
    }];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const onComplete = jest.fn();
    renderHook(
      () => useSubscription(subscription, { onComplete }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
  });

  it('should cleanup after the subscription component has been unmounted', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: 'Pagani' } } }
      }
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const onData = jest.fn();
    const { result, unmount } = renderHook(
      () => useSubscription(subscription, {
        onData,
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(results[0].result.data);
    setTimeout(() => {
      expect(onData).toHaveBeenCalledTimes(1);
      // After the component has been unmounted, the internal
      // ObservableQuery should be stopped, meaning it shouldn't
      // receive any new data (so the onDataCount should
      // stay at 1).
      unmount();
      link.simulateResult(results[0]);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onData).toHaveBeenCalledTimes(1);
  });

  it('should never execute a subscription with the skip option', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const onSetup = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(onSetup);
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const onData = jest.fn();

    const { result, unmount, rerender } = renderHook(
      ({ variables }) => useSubscription(subscription, {
        variables,
        skip: true,
        onData,
      }),
      {
        initialProps: {
          variables: {
            foo: 'bar'
          }
        },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        )
      },
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);

    rerender({ variables: { foo: 'bar2' }});
    await expect(waitFor(() => {
      expect(result.current.data).not.toBe(undefined);
    }, { interval: 1, timeout: 20 })).rejects.toThrow();

    expect(onSetup).toHaveBeenCalledTimes(0);
    expect(onData).toHaveBeenCalledTimes(0);
    unmount();
  });

  it('should create a subscription after skip has changed from true to a falsy value', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: 'Pagani' } } }
      },
      {
        result: { data: { car: { make: 'Scoop' } } }
      }
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });
    const { result, rerender } = renderHook(
      ({ skip }) => useSubscription(subscription, { skip }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
        initialProps: { skip: true },
      },
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    rerender({ skip: false });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[0]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });
    expect(result.current.data).toEqual(results[0].result.data);
    expect(result.current.error).toBe(undefined);

    rerender({ skip: true });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    // ensure state persists across rerenders
    rerender({ skip: true });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    await expect(waitFor(() => {
      expect(result.current.data).not.toBe(undefined);
    }, { interval: 1, timeout: 20 })).rejects.toThrow();

    // ensure state persists across rerenders
    rerender({ skip: false });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);
    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });
    expect(result.current.data).toEqual(results[1].result.data);
    expect(result.current.error).toBe(undefined);
  });

  it('should share context set in options', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ['Audi', 'BMW'].map(make => ({
      result: { data: { car: { make } } }
    }));

    let context: string;
    const link = new MockSubscriptionLink();
    const contextLink = new ApolloLink((operation, forward) => {
      context = operation.getContext()?.make
      return forward(operation);
    });
    const client = new ApolloClient({
      link: concat(contextLink, link),
      cache: new Cache({ addTypename: false })
    });

    const { result } = renderHook(
      () => useSubscription(subscription, {
        context: { make: 'Audi' },
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => {
      link.simulateResult(results[0]);
    }, 100);

    await waitFor(() => {
      expect(result.current.data).toEqual(results[0].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(results[1].result.data);
    }, { interval: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    expect(context!).toBe('Audi');
  });

  it('should handle multiple subscriptions properly', async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ['Audi', 'BMW'].map(make => ({
      result: { data: { car: { make } } }
    }));

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const { result } = renderHook(
      () => ({
        sub1: useSubscription(subscription),
        sub2: useSubscription(subscription),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.sub1.loading).toBe(true);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(undefined);
    expect(result.current.sub2.loading).toBe(true);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[0]);
    });

    await waitFor(() => {
      expect(result.current.sub1.data).toEqual(results[0].result.data);
    }, { interval: 1 });
    expect(result.current.sub1.loading).toBe(false);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toEqual(results[0].result.data);

    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(() => {
      expect(result.current.sub1.data).toEqual(results[1].result.data);
    }, { interval: 1 });
    expect(result.current.sub1.loading).toBe(false);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toEqual(results[1].result.data);
  });

  it('should handle immediate completions gracefully', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
      cache: new Cache({ addTypename: false })
    });

    const { result } = renderHook(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    setTimeout(() => {
      // Simulating the behavior of HttpLink, which calls next and complete in sequence.
      link.simulateResult({ result: { data: null } }, /* complete */ true);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { interval: 1 });
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(null);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe(
      "Missing field 'car' while writing result {}",
    );
    errorSpy.mockRestore();
  });

  it('should handle immediate completions with multiple subscriptions gracefully', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

    const { result } = renderHook(
      () => ({
        sub1: useSubscription(subscription),
        sub2: useSubscription(subscription),
        sub3: useSubscription(subscription),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(result.current.sub1.loading).toBe(true);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(undefined);
    expect(result.current.sub2.loading).toBe(true);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(undefined);
    expect(result.current.sub3.loading).toBe(true);
    expect(result.current.sub3.error).toBe(undefined);
    expect(result.current.sub3.data).toBe(undefined);

    setTimeout(() => {
      // Simulating the behavior of HttpLink, which calls next and complete in sequence.
      link.simulateResult({ result: { data: null } }, /* complete */ true);
    });

    await waitFor(() => {
      expect(result.current.sub1.loading).toBe(false);
    }, { interval: 1 });

    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(null);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(null);
    expect(result.current.sub3.loading).toBe(false);
    expect(result.current.sub3.error).toBe(undefined);
    expect(result.current.sub3.data).toBe(null);

    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(errorSpy.mock.calls[0][0]).toBe(
      "Missing field 'car' while writing result {}",
    );
    expect(errorSpy.mock.calls[1][0]).toBe(
      "Missing field 'car' while writing result {}",
    );
    expect(errorSpy.mock.calls[2][0]).toBe(
      "Missing field 'car' while writing result {}",
    );
    errorSpy.mockRestore();
  });

  test("should warn when using 'onSubscriptionData' and 'onData' together", () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

    renderHook(
      () => useSubscription(subscription, {
        onData: jest.fn(),
        onSubscriptionData: jest.fn(),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("supports only the 'onSubscriptionData' or 'onData' option"));
    warningSpy.mockRestore();
  });

  test("prefers 'onData' when using 'onSubscriptionData' and 'onData' together", async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: 'Pagani' } } }
      }
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn();
    const onSubscriptionData = jest.fn();

    renderHook(
      () => useSubscription(subscription, {
        onData,
        onSubscriptionData,
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(() => {
      expect(onData).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
    expect(onSubscriptionData).toHaveBeenCalledTimes(0);
  });

  test("uses 'onSubscriptionData' when 'onData' is absent", async () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: 'Pagani' } } }
      }
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onSubscriptionData = jest.fn();

    renderHook(
      () => useSubscription(subscription, {
        onSubscriptionData,
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(() => {
      expect(onSubscriptionData).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
    warningSpy.mockRestore();
  });

  test("only warns once using `onSubscriptionData`", () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

    const { rerender } = renderHook(
      () => useSubscription(subscription, {
        onSubscriptionData: jest.fn(),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    rerender();

    expect(warningSpy).toHaveBeenCalledTimes(1);
    warningSpy.mockRestore();
  });

  test("should warn when using 'onComplete' and 'onSubscriptionComplete' together", () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

    renderHook(
      () => useSubscription(subscription, {
        onComplete: jest.fn(),
        onSubscriptionComplete: jest.fn(),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("supports only the 'onSubscriptionComplete' or 'onComplete' option"));
    warningSpy.mockRestore();
  });

  test("prefers 'onComplete' when using 'onComplete' and 'onSubscriptionComplete' together", async () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [{
      result: { data: { car: { make: 'Audi' } } }
    }];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onComplete = jest.fn();
    const onSubscriptionComplete = jest.fn();

    renderHook(
      () => useSubscription(subscription, {
        onComplete,
        onSubscriptionComplete,
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
    expect(onSubscriptionComplete).toHaveBeenCalledTimes(0);
    warningSpy.mockRestore();
  });

  test("uses 'onSubscriptionComplete' when 'onComplete' is absent", async () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [{
      result: { data: { car: { make: 'Audi' } } }
    }];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onSubscriptionComplete = jest.fn();

    renderHook(
      () => useSubscription(subscription, {
        onSubscriptionComplete,
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(() => {
      expect(onSubscriptionComplete).toHaveBeenCalledTimes(1);
    }, { interval: 1 });
    warningSpy.mockRestore();
  });

  test("only warns once using `onSubscriptionComplete`", () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

    const { rerender } = renderHook(
      () => useSubscription(subscription, {
        onSubscriptionComplete: jest.fn(),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      },
    );

    rerender();

    expect(warningSpy).toHaveBeenCalledTimes(1);
    warningSpy.mockRestore();
  });
});
