import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { gql } from 'graphql-tag';
import { DocumentNode } from 'graphql';

import { ApolloClient, ApolloLink } from '../../../../core/index.js';
import { ApolloProvider } from '../../../context/index.js';
import { InMemoryCache as Cache } from '../../../../cache/index.js';
import { itAsync, mockSingleLink } from '../../../../testing/index.js';
import { Observable } from '../../../../utilities/index.js';
import { graphql } from '../../graphql.js';
import { ChildProps } from '../../types.js';

describe('[queries] polling', () => {
  let error: typeof console.error;

  beforeEach(() => {
    error = console.error;
    console.error = jest.fn(() => {});
    jest.useRealTimers();
  });

  afterEach(() => {
    console.error = error;
  });

  // polling
  itAsync('allows a polling query to be created', (resolve, reject) => {
    const POLL_INTERVAL = 5;
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
    const link = mockSingleLink(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } },
      { request: { query }, result: { data } }
    );
    const cache = new Cache({ addTypename: false })
    const client = new ApolloClient({
      link,
      cache,
    });

    let count = 0;
    const Container = graphql(query, {
      options: () => ({
        pollInterval: POLL_INTERVAL,
        notifyOnNetworkStatusChange: false,
      })
    })(({ data }) => {
      count++;
      if (count === 4) {
        data!.stopPolling();
        expect(cache.readQuery({query})).toBeTruthy();
        resolve();
      }
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('ensures polling respects no-cache fetchPolicy', (resolve, reject) => {
    const POLL_INTERVAL = 5;
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
    const link = mockSingleLink(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } },
      { request: { query }, result: { data } }
    );
    const cache = new Cache({ addTypename: false })
    const client = new ApolloClient({
      link,
      cache,
    });

    let count = 0;
    const Container = graphql(query, {
      options: () => ({
        pollInterval: POLL_INTERVAL,
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'no-cache'
      })
    })(({ data }) => {
      count++;
      if (count === 4) {
        data!.stopPolling();
        expect(cache.readQuery({query})).toBeNull();
        resolve();
      }
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => expect(count).toBe(4)).then(resolve, reject);
  });

  const allPeopleQuery: DocumentNode = gql`
    query people {
      allPeople(first: 1) {
        people {
          name
        }
      }
    }
  `;

  const lukeLink = new ApolloLink(operation => new Observable(observer => {
    expect(operation.query).toBe(allPeopleQuery);
    observer.next({
      data: {
        allPeople: {
          people: [
            { name: "Luke Skywalker" },
          ],
        },
      },
    });
    observer.complete();
  }));

  itAsync('exposes stopPolling as part of the props api', (resolve, reject) => {
    let done = false;
    const client = new ApolloClient({
      link: lukeLink,
      cache: new Cache({ addTypename: false })
    });

    const Container = graphql(allPeopleQuery)(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          try {
            const { data } = this.props;
            expect(data!.stopPolling).toBeTruthy();
            expect(data!.stopPolling instanceof Function).toBeTruthy();
            expect(data!.stopPolling).not.toThrow();
            done = true;
          } catch (e) {
            reject(e);
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
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  itAsync('exposes startPolling as part of the props api', (resolve, reject) => {
    let done = false;
    const client = new ApolloClient({
      link: lukeLink,
      cache: new Cache({ addTypename: false })
    });

    const Container = graphql(allPeopleQuery, { options: { pollInterval: 10 } })(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          try {
            const { data } = this.props;
            expect(data!.startPolling).toBeTruthy();
            expect(data!.startPolling instanceof Function).toBeTruthy();
            done = true;
          } catch (e) {
            reject(e);
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
      expect(done).toBe(true);
    }).then(resolve, reject);
  });
});
