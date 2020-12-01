import React from 'react';
import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';
import { render, wait } from '@testing-library/react';

import { ApolloClient } from '../../../../core';
import { ApolloProvider } from '../../../context';
import { InMemoryCache as Cache } from '../../../../cache';
import { itAsync, stripSymbols, mockSingleLink } from '../../../../testing';
import { graphql } from '../../graphql';
import { ChildProps } from '../../types';

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

    return wait(() => expect(done).toBeTruthy()).then(resolve, reject);
  });

  itAsync('exposes updateQuery as part of the props api during componentWillMount', (resolve, reject) => {
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

  itAsync('updateQuery throws if called before data has returned', (resolve, reject) => {
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
            expect(e.toString()).toMatch(
              /ObservableQuery with this id doesn't exist:/
            );
          }

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

  itAsync('allows updating query results after query has finished (early binding)', (resolve, reject) => {
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
            expect(stripSymbols(this.props.data!.allPeople)).toEqual(
              data2.allPeople
            );
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

    return wait().then(resolve, reject);
  });

  itAsync('allows updating query results after query has finished', (resolve, reject) => {
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
            expect(stripSymbols(this.props.data!.allPeople)).toEqual(
              data2.allPeople
            );
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

    return wait().then(resolve, reject);
  });
});
