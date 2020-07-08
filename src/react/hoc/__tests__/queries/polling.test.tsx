import React from 'react';
import { render, wait } from '@testing-library/react';
import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';

import { ApolloClient } from '../../../../ApolloClient';
import { ApolloProvider } from '../../../context/ApolloProvider';
import { InMemoryCache as Cache } from '../../../../cache/inmemory/inMemoryCache';
import { mockSingleLink } from '../../../../utilities/testing/mocking/mockLink';
import { graphql } from '../../graphql';
import { ChildProps } from '../../types';
import { itAsync } from '../../../../utilities/testing/itAsync';

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
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let count = 0;
    const Container = graphql(query, {
      options: () => ({
        pollInterval: POLL_INTERVAL,
        notifyOnNetworkStatusChange: false
      })
    })(({ data }) => {
      count++;
      expect(true).toBe(true);
      if (count === 4) {
        data!.stopPolling();
        resolve();
      }
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    return wait(() => expect(count).toBe(4)).then(resolve, reject);
  });

  itAsync('exposes stopPolling as part of the props api', (resolve, reject) => {
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
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.stopPolling).toBeTruthy();
          expect(data!.stopPolling instanceof Function).toBeTruthy();
          expect(data!.stopPolling).not.toThrow();
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

  itAsync('exposes startPolling as part of the props api', (resolve, reject) => {
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

    const Container = graphql(query, { options: { pollInterval: 10 } })(
      class extends React.Component<ChildProps> {
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.startPolling).toBeTruthy();
          expect(data!.startPolling instanceof Function).toBeTruthy();
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
