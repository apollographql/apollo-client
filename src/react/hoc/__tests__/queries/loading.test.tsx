import React from 'react';
import { render, wait } from '@testing-library/react';
import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';

import { ApolloClient } from '../../../../core';
import { ApolloProvider } from '../../../context';
import { InMemoryCache as Cache } from '../../../../cache';
import { itAsync, mockSingleLink } from '../../../../testing';
import { graphql } from '../../graphql';
import { ChildProps } from '../../types';

describe('[queries] loading', () => {
  // networkStatus / loading
  itAsync('exposes networkStatus as a part of the props api', (resolve, reject) => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const link = mockSingleLink({
      request: { query },
      result: { data: { allPeople: { people: [{ name: 'Luke Skywalker' }] } } }
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let done = false;
    const Container = graphql(query, {
      options: { notifyOnNetworkStatusChange: true }
    })(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.networkStatus).toBeTruthy();
          done = true;
        }
        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait(() => expect(done).toBeTruthy()).then(resolve, reject);
  });

  itAsync('should set the initial networkStatus to 1 (loading)', (resolve, reject) => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    const link = mockSingleLink({
      request: { query },
      result: { data }
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    @graphql(query, { options: { notifyOnNetworkStatusChange: true } })
    class Container extends React.Component<ChildProps> {
      constructor(props: ChildProps) {
        super(props);
        const { networkStatus } = props.data!;
        expect(networkStatus).toBe(1);
      }

      render(): React.ReactNode {
        return null;
      }
    }

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait().then(resolve, reject);
  });

  itAsync('should set the networkStatus to 7 (ready) when the query is loaded', (resolve, reject) => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    const link = mockSingleLink({
      request: { query },
      result: { data }
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const Container = graphql(query, {
      options: { notifyOnNetworkStatusChange: true }
    })(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          expect(this.props.data!.networkStatus).toBe(7);
        }

        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait().then(resolve, reject);
  });

  itAsync('should set the networkStatus to 2 (setVariables) when the query variables are changed', (resolve, reject) => {
    let count = 0;
    const query: DocumentNode = gql`
      query people($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    const data1 = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    const variables1 = { first: 1 };

    const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
    const variables2 = { first: 2 };

    type Data = typeof data1;
    type Vars = typeof variables1;

    const link = mockSingleLink(
      { request: { query, variables: variables1 }, result: { data: data1 } },
      { request: { query, variables: variables2 }, result: { data: data2 } }
    );

    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let done = false;
    const Container = graphql<Vars, Data, Vars>(query, {
      options: props => ({
        variables: props,
        notifyOnNetworkStatusChange: true
      })
    })(
      class extends React.Component<ChildProps<Vars, Data, Vars>> {
        componentDidUpdate(prevProps: ChildProps<Vars, Data, Vars>) {
          const { data } = this.props;
          // variables changed, new query is loading, but old data is still there
          if (count === 1) {
            if (data!.loading) {
              expect(data!.networkStatus).toBe(2);
              expect(data!.allPeople).toBeUndefined();
            } else {
              expect(prevProps.data!.loading).toBe(true);
              expect(data!.networkStatus).toBe(7);
              expect(data!.allPeople).toEqual(data2.allPeople);
              done = true;
            }
          }
        }
        render() {
          return null;
        }
      }
    );

    class ChangingProps extends React.Component<any, any> {
      state = { first: 1 };

      componentDidMount() {
        setTimeout(() => {
          count++;
          this.setState({ first: 2 });
        }, 50);
      }

      render() {
        return <Container first={this.state.first} />;
      }
    }

    render(
      <ApolloProvider client={client}>
        <ChangingProps />
      </ApolloProvider>
    );

    return wait(() => expect(done).toBeTruthy()).then(resolve, reject);
  });

  itAsync('resets the loading state after a refetched query', (resolve, reject) => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };

    type Data = typeof data;

    const link = mockSingleLink(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let count = 0;
    const Container = graphql<{}, Data>(query, {
      options: { notifyOnNetworkStatusChange: true }
    })(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          const { data } = this.props;
          switch (count++) {
            case 0:
              expect(data!.networkStatus).toBe(7);
              // this isn't reloading fully
              setTimeout(() => {
                data!.refetch();
              });
              break;
            case 1:
              expect(data!.loading).toBeTruthy();
              expect(data!.networkStatus).toBe(4);
              expect(data!.allPeople).toEqual(data!.allPeople);
              break;
            case 2:
              expect(data!.loading).toBeFalsy();
              expect(data!.networkStatus).toBe(7);
              expect(data!.allPeople).toEqual(data2.allPeople);
              break;
            default:
              reject(new Error('Too many props updates'));
          }
        }

        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait(() => expect(count).toBe(3)).then(resolve, reject);
  });

  itAsync('correctly sets loading state on remounted network-only query', (resolve, reject) => {
    const query: DocumentNode = gql`
      query pollingPeople {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: 'Darth Skywalker' }] } };
    type Data = typeof data;

    const link = mockSingleLink({
      request: { query },
      result: { data },
      newData: () => ({
        data: {
          allPeople: {
            people: [{ name: `Darth Skywalker - ${Math.random()}` }]
          }
        }
      })
    });

    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
      queryDeduplication: false
    });

    let count = 0;

    const Container = graphql<{}, Data>(query, {
      options: {
        fetchPolicy: 'network-only',
        nextFetchPolicy: 'cache-first',
      },
    })(
      class extends React.Component<ChildProps<{}, Data>> {
        render() {
          if (count === 1) {
            // Has data
            setTimeout(() => {
              render(App);
            }, 0);
          }
          if (count === 2) {
            // Loading after remount
            expect(this.props.data!.loading).toBeTruthy();
          }
          if (count === 3) {
            // Fetched data loading after remount
            expect(this.props.data!.loading).toBeFalsy();
            expect(this.props.data!.allPeople!.people[0].name).toMatch(
              /Darth Skywalker - /
            );
          }
          count += 1;
          return null;
        }
      }
    );

    const App: React.ReactElement<any> = (
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    render(App);

    return wait(() => expect(count).toBe(5)).then(resolve, reject);
  });

  itAsync('correctly sets loading state on remounted component with changed variables', (resolve, reject) => {
    const query: DocumentNode = gql`
      query remount($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    interface Data {
      allPeople: {
        people: { name: string }[];
      };
    }
    const data = { allPeople: null };
    const variables = { first: 1 };
    const variables2 = { first: 2 };

    type Vars = typeof variables;

    const link = mockSingleLink(
      { request: { query, variables }, result: { data }, delay: 10 },
      {
        request: { query, variables: variables2 },
        result: { data },
        delay: 10
      }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });
    let renderFn: (num: number) => React.ReactElement<any>,
      count = 0;

    interface Props {
      first: number;
    }
    const Container = graphql<Props, Data, Vars>(query, {
      options: ({ first }) => ({ variables: { first } })
    })(
      class extends React.Component<ChildProps<Props, Data, Vars>> {
        componentDidUpdate() {
          if (count === 0) {
            // has data
            unmount();
            setTimeout(() => {
              render(renderFn(2));
            }, 5);
          }

          if (count === 2) {
            // remounted data after fetch
            expect(this.props.data!.loading).toBeFalsy();
          }
          count++;
        }

        render() {
          if (count === 1) {
            expect(this.props.data!.loading).toBeTruthy(); // on remount
            count++;
          }

          return null;
        }
      }
    );

    renderFn = (first: number) => (
      <ApolloProvider client={client}>
        <Container first={first} />
      </ApolloProvider>
    );

    const { unmount } = render(renderFn(1));

    return wait(() => expect(count).toBe(3)).then(resolve, reject);
  });

  itAsync('correctly sets loading state on remounted component with changed variables (alt)', (resolve, reject) => {
    const query: DocumentNode = gql`
      query remount($name: String) {
        allPeople(name: $name) {
          people {
            name
          }
        }
      }
    `;

    interface Data {
      allPeople: {
        people: { name: string }[];
      };
    }
    const data = { allPeople: null };
    const variables = { name: 'does-not-exist' };
    const variables2 = { name: 'nothing-either' };

    type Vars = typeof variables;

    const link = mockSingleLink(
      { request: { query, variables }, result: { data } },
      {
        request: { query, variables: variables2 },
        result: { data }
      }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let count = 0;

    const Container = graphql<Vars, Data, Vars>(query)(
      class extends React.Component<ChildProps<Vars, Data, Vars>> {
        render() {
          const { loading } = this.props.data!;
          if (count === 0) expect(loading).toBeTruthy();
          if (count === 1) {
            expect(loading).toBeFalsy();
            setTimeout(() => {
              unmount();
              render(
                <ApolloProvider client={client}>
                  <Container {...variables2} />
                </ApolloProvider>
              );
            }, 0);
          }
          if (count === 2) expect(loading).toBeTruthy();
          if (count === 3) {
            expect(loading).toBeFalsy();
          }
          count++;
          return null;
        }
      }
    );

    const { unmount } = render(
      <ApolloProvider client={client}>
        <Container {...variables} />
      </ApolloProvider>
    );

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('correctly sets loading state on component with changed variables and unchanged result', (resolve, reject) => {
    const query: DocumentNode = gql`
      query remount($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;
    interface Data {
      allPeople: {
        people: { name: string }[];
      };
    }

    const data = { allPeople: null };
    const variables = { first: 1 };
    const variables2 = { first: 2 };

    type Vars = typeof variables;
    const link = mockSingleLink(
      { request: { query, variables }, result: { data } },
      {
        request: { query, variables: variables2 },
        result: { data }
      }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });
    let count = 0;

    interface Props extends Vars {
      setFirst: (first: number) => void;
    }

    const connect = (
      component: React.ComponentType<Props>
    ): React.ComponentType<{}> => {
      return class extends React.Component<{}, { first: number }> {
        constructor(props: {}) {
          super(props);

          this.state = {
            first: 1
          };
          this.setFirst = this.setFirst.bind(this);
        }

        setFirst(first: number) {
          this.setState({ first });
        }

        render() {
          return React.createElement(component, {
            first: this.state.first,
            setFirst: this.setFirst
          });
        }
      };
    };

    const Container = connect(
      graphql<Props, Data, Vars>(query, {
        options: ({ first }) => ({ variables: { first } })
      })(
        class extends React.Component<ChildProps<Props, Data, Vars>> {
          render() {
            if (count === 0) {
              expect(this.props.data!.loading).toBeTruthy(); // has initial data
            }

            if (count === 1) {
              expect(this.props.data!.loading).toBeFalsy();
              setTimeout(() => {
                this.props.setFirst(2);
              });
            }

            if (count === 2) {
              expect(this.props.data!.loading).toBeTruthy(); // on variables change
            }

            if (count === 3) {
              // new data after fetch
              expect(this.props.data!.loading).toBeFalsy();
            }
            count++;

            return null;
          }
        }
      )
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync(
    'correctly sets loading state on component with changed variables, ' +
      'unchanged result, and network-only',
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query remount($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;
      interface Data {
        allPeople: {
          people: { name: string }[];
        };
      }

      const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const variables = { first: 1 };
      const variables2 = { first: 2 };

      type Vars = typeof variables;
      const link = mockSingleLink(
        { request: { query, variables }, result: { data }, delay: 10 },
        {
          request: { query, variables: variables2 },
          result: { data },
          delay: 10
        }
      );
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false })
      });
      let count = 0;

      interface Props extends Vars {
        setFirst: (first: number) => void;
      }

      const connect = (
        component: React.ComponentType<Props>
      ): React.ComponentType<{}> => {
        return class extends React.Component<{}, { first: number }> {
          constructor(props: {}) {
            super(props);

            this.state = {
              first: 1
            };
            this.setFirst = this.setFirst.bind(this);
          }

          setFirst(first: number) {
            this.setState({ first });
          }

          render() {
            return React.createElement(component, {
              first: this.state.first,
              setFirst: this.setFirst
            });
          }
        };
      };

      const Container = connect(
        graphql<Props, Data, Vars>(query, {
          options: ({ first }) => ({
            variables: { first },
            fetchPolicy: 'network-only'
          })
        })(
          class extends React.Component<ChildProps<Props, Data, Vars>> {
            render() {
              const { props } = this;
              if (count === 0) {
                expect(props.data!.loading).toBeTruthy();
              }

              if (count === 1) {
                expect(props.data!.loading).toBeFalsy(); // has initial data
                expect(props.data!.allPeople).toEqual(data.allPeople);
                setTimeout(() => {
                  this.props.setFirst(2);
                });
              }

              if (count === 2) {
                expect(props.data!.loading).toBeTruthy(); // on variables change
              }

              if (count === 3) {
                // new data after fetch
                expect(props.data!.loading).toBeFalsy();
                expect(props.data!.allPeople).toEqual(data.allPeople);
              }
              count++;
              return null;
            }
          }
        )
      );

      render(
        <ApolloProvider client={client}>
          <Container />
        </ApolloProvider>
      );

      return wait(() => expect(count).toBe(4)).then(resolve, reject);
    }
  );
});
