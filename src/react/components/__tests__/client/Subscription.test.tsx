import React from 'react';
import gql from 'graphql-tag';
import { render, wait } from '@testing-library/react';

import { ApolloClient } from '../../../../core';
import { InMemoryCache as Cache } from '../../../../cache';
import { ApolloProvider } from '../../../context';
import { ApolloLink, Operation } from '../../../../link/core';
import { itAsync, MockSubscriptionLink } from '../../../../testing';
import { Subscription } from '../../Subscription';

const results = [
  'Luke Skywalker',
  'Han Solo',
  'Darth Vader',
  'Leia Skywalker'
].map(name => ({
  result: { data: { user: { name } } }
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
  cache
});

itAsync('executes the subscription', (resolve, reject) => {
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

  return wait(() => expect(renderCount).toBe(5)).then(resolve, reject);
});

itAsync('calls onSubscriptionData if given', (resolve, reject) => {
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

  const interval = setInterval(() => {
    link.simulateResult(results[count]);
    if (count >= 3) clearInterval(interval);
  }, 10);

  return wait(() => expect(count).toBe(4)).then(resolve, reject);
});

itAsync('should call onSubscriptionComplete if specified', (resolve, reject) => {
  let count = 0;

  let done = false;
  const Component = () => (
    <Subscription
      subscription={subscription}
      onSubscriptionData={() => {
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

  const interval = setInterval(() => {
    link.simulateResult(results[count], count === 3);
    if (count >= 3) clearInterval(interval);
  }, 10);

  return wait(() => expect(done).toBeTruthy()).then(resolve, reject);
});

itAsync('executes subscription for the variables passed in the props', (resolve, reject) => {
  const subscriptionWithVariables = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  const variables = { name: 'Luke Skywalker' };

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
    cache
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

  return wait(() => expect(count).toBe(2)).then(resolve, reject);
});

itAsync('does not execute if variables have not changed', (resolve, reject) => {
  const subscriptionWithVariables = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  const name = 'Luke Skywalker';

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
    cache
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

  return wait(() => expect(count).toBe(3)).then(resolve, reject);
});

itAsync('renders an error', (resolve, reject) => {
  const subscriptionWithVariables = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  const variables = {
    name: 'Luke Skywalker'
  };

  const subscriptionError = {
    error: new Error('error occurred')
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
            expect(error).toEqual(new Error('error occurred'));
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

  return wait(() => expect(count).toBe(2)).then(resolve, reject);
});

describe('should update', () => {
  itAsync('if the client changes', (resolve, reject) => {
    const link2 = new MockSubscriptionLink();
    const client2 = new ApolloClient({
      link: link2,
      cache: new Cache({ addTypename: false })
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        client: client
      };

      render() {
        return (
          <ApolloProvider client={this.state.client}>
            <Subscription subscription={subscription}>
              {(result: any) => {
                const { loading, data } = result;
                try {
                  if (count === 0) {
                    expect(loading).toBeTruthy();
                    expect(data).toBeUndefined();
                  } else if (count === 1) {
                    expect(loading).toBeFalsy();
                    expect(data).toEqual(results[0].result.data);
                    setTimeout(() => {
                      this.setState(
                        {
                          client: client2
                        },
                        () => {
                          link2.simulateResult(results[1]);
                        }
                      );
                    });
                  } else if (count === 2) {
                    expect(loading).toBeTruthy();
                    expect(data).toBeUndefined();
                  } else if (count === 3) {
                    expect(loading).toBeFalsy();
                    expect(data).toEqual(results[1].result.data);
                  }
                } catch (error) {
                  reject(error);
                }

                count++;
                return null;
              }}
            </Subscription>
          </ApolloProvider>
        );
      }
    }

    render(<Component />);

    link.simulateResult(results[0]);

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('if the query changes', (resolve, reject) => {
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
            name: 'Chewie'
          }
        }
      }
    };

    const userLink = new MockSubscriptionLink();
    const heroLink = new MockSubscriptionLink();
    const linkCombined = new ApolloLink((o, f) => (f ? f(o) : null)).split(
      ({ operationName }) => operationName === 'HeroInfo',
      heroLink,
      userLink
    );

    const mockClient = new ApolloClient({
      link: linkCombined,
      cache: new Cache({ addTypename: false })
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        subscription
      };

      render() {
        return (
          <Subscription subscription={this.state.subscription}>
            {(result: any) => {
              const { loading, data } = result;
              try {
                if (count === 0) {
                  expect(loading).toBeTruthy();
                  expect(data).toBeUndefined();
                } else if (count === 1) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(results[0].result.data);
                  setTimeout(() => {
                    this.setState(
                      {
                        subscription: subscriptionHero
                      },
                      () => {
                        heroLink.simulateResult(heroResult);
                      }
                    );
                  });
                } else if (count === 2) {
                  expect(loading).toBeTruthy();
                  expect(data).toBeUndefined();
                } else if (count === 3) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(heroResult.result.data);
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

    userLink.simulateResult(results[0]);

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('if the variables change', (resolve, reject) => {
    const subscriptionWithVariables = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;

    const variablesLuke = { name: 'Luke Skywalker' };
    const variablesHan = { name: 'Han Solo' };

    const dataLuke = {
      user: {
        name: 'Luke Skywalker'
      }
    };

    const dataHan = {
      user: {
        name: 'Han Solo'
      }
    };

    class MockSubscriptionLinkOverride extends MockSubscriptionLink {
      variables: any;
      request(req: Operation) {
        this.variables = req.variables;
        return super.request(req);
      }

      simulateResult() {
        if (this.variables.name === 'Luke Skywalker') {
          return super.simulateResult({
            result: {
              data: dataLuke
            }
          });
        } else if (this.variables.name === 'Han Solo') {
          return super.simulateResult({
            result: {
              data: dataHan
            }
          });
        }
      }
    }

    const mockLink = new MockSubscriptionLinkOverride();

    const mockClient = new ApolloClient({
      link: mockLink,
      cache
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        variables: variablesLuke
      };

      render() {
        return (
          <Subscription
            subscription={subscriptionWithVariables}
            variables={this.state.variables}
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
                        variables: variablesHan
                      },
                      () => {
                        mockLink.simulateResult();
                      }
                    );
                  });
                } else if (count === 2) {
                  expect(loading).toBeTruthy();
                  expect(data).toBeUndefined();
                } else if (count === 3) {
                  expect(loading).toBeFalsy();
                  expect(data).toEqual(dataHan);
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

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });
});

describe('should not update', () => {
  const variablesLuke = { name: 'Luke Skywalker' };
  const variablesHan = { name: 'Han Solo' };

  const dataLuke = {
    user: {
      name: 'Luke Skywalker'
    }
  };

  const dataHan = {
    user: {
      name: 'Han Solo'
    }
  };

  class MockSubscriptionLinkOverride extends MockSubscriptionLink {
    variables: any;
    request(req: Operation) {
      this.variables = req.variables;
      return super.request(req);
    }

    simulateResult() {
      if (this.variables.name === 'Luke Skywalker') {
        return super.simulateResult({
          result: {
            data: dataLuke
          }
        });
      } else if (this.variables.name === 'Han Solo') {
        return super.simulateResult({
          result: {
            data: dataHan
          }
        });
      }
    }
  }

  itAsync('if shouldResubscribe is false', (resolve, reject) => {
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
      cache
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        variables: variablesLuke
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
                        variables: variablesHan
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

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('if shouldResubscribe returns false', (resolve, reject) => {
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
      cache
    });

    let count = 0;

    class Component extends React.Component {
      state = {
        variables: variablesLuke
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
                        variables: variablesHan
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

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });
});
