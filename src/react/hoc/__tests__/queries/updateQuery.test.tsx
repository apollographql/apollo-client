import React from 'react';
import { gql } from 'graphql-tag';
import { DocumentNode } from 'graphql';
import { render, waitFor } from '@testing-library/react';

import { ApolloClient } from '../../../../core/index.js';
import { ApolloProvider } from '../../../context/index.js';
import { InMemoryCache as Cache } from '../../../../cache/index.js';
import { itAsync, mockSingleLink } from '../../../../testing/index.js';
import { graphql } from '../../graphql.js';
import { ChildProps } from '../../types.js';

describe('[queries] updateQuery', () => {
  // updateQuery
  itAsync('exposes updateQuery as part of the props api', (resolve, reject) => {
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
    const Container = graphql(query)(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.updateQuery).toBeTruthy();
          expect(data!.updateQuery instanceof Function).toBeTruthy();
          try {
            data!.updateQuery(() => { done = true; });
          } catch (error) {
            reject(error);
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

    waitFor(() => expect(done).toBeTruthy()).then(resolve, reject);
  });

  itAsync('exposes updateQuery as part of the props api during componentWillMount', (resolve, reject) => {
    let done = false;
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

    const Container = graphql(query)(
      class extends React.Component<ChildProps> {
        render() {
          expect(this.props.data!.updateQuery).toBeTruthy();
          expect(this.props.data!.updateQuery instanceof Function).toBeTruthy();
          done = true;
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true)
    }).then(resolve, reject);
  });

  itAsync('updateQuery throws if called before data has returned', (resolve, reject) => {
    let renderCount = 0;
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

    const Container = graphql(query)(
      class extends React.Component<ChildProps> {
        render() {
          expect(this.props.data!.updateQuery).toBeTruthy();
          expect(this.props.data!.updateQuery instanceof Function).toBeTruthy();
          try {
            this.props.data!.updateQuery(p => p);
          } catch (e) {
            // TODO: branch never hit in test
            expect(e.toString()).toMatch(
              /ObservableQuery with this id doesn't exist:/
            );
          }
          renderCount += 1;

          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(renderCount).toBe(2)
    }).then(resolve, reject);
  });

  itAsync('allows updating query results after query has finished (early binding)', (resolve, reject) => {
    let done = false;
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data1 = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    type Data = typeof data1;
    const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
    const link = mockSingleLink(
      { request: { query }, result: { data: data1 } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let isUpdated = false;
    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<{}, Data>> {
        public updateQuery: any;
        componentDidUpdate() {
          if (isUpdated) {
            expect(this.props.data!.allPeople).toEqual(
              data2.allPeople
            );
            done = true;
            return;
          } else {
            isUpdated = true;
            this.updateQuery(() => {
              return data2;
            });
          }
        }
        render() {
          this.updateQuery = this.props.data!.updateQuery;
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  itAsync('allows updating query results after query has finished', (resolve, reject) => {
    let done = false;
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data1 = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
    type Data = typeof data1;

    const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
    const link = mockSingleLink(
      { request: { query }, result: { data: data1 } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let isUpdated = false;
    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          if (isUpdated) {
            expect(this.props.data!.allPeople).toEqual(
              data2.allPeople
            );
            done = true
            return;
          } else {
            isUpdated = true;
            this.props.data!.updateQuery(() => {
              return data2;
            });
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

    waitFor(() => {
      expect(done).toBe(true)
    }).then(resolve, reject);
  });
});
