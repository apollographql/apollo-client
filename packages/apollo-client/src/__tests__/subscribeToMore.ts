import gql from 'graphql-tag';
import { ApolloLink, Operation } from 'apollo-link';
import { InMemoryCache } from 'apollo-cache-inmemory';

import { DocumentNode, OperationDefinitionNode } from 'graphql';

import { mockSingleLink, mockObservableLink } from '../__mocks__/mockLinks';

import ApolloClient from '../';

const isSub = (operation: Operation) =>
  (operation.query as DocumentNode).definitions
    .filter(x => x.kind === 'OperationDefinition')
    .some((x: OperationDefinitionNode) => x.operation === 'subscription');

describe('subscribeToMore', () => {
  const query = gql`
    query aQuery {
      entry {
        value
      }
    }
  `;
  const result = {
    data: {
      entry: {
        value: 1,
      },
    },
  };

  const req1 = { request: { query }, result };

  const results = ['Dahivat Pandya', 'Amanda Liu'].map(name => ({
    result: { data: { name } },
    delay: 10,
  }));

  const sub1 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  const results2 = [
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
    { error: new Error('You cant touch this'), delay: 10 },
  ];

  const sub2 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  const results3 = [
    { error: new Error('You cant touch this'), delay: 10 },
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
  ];

  const sub3 = {
    request: {
      query: gql`
        subscription newValues {
          name
        }
      `,
    },
  };

  it('triggers new result from subscription data', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink(sub1);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);
    let counter = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const obsHandle = client.watchQuery({ query });

    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.name } };
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(counter).toBe(3);
      expect(latestResult).toEqual({
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results[i]);
    }
  });

  it('calls error callback on error', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink(sub2);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    let counter = 0;

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let errorCount = 0;

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.name } };
      },
      onError: () => {
        errorCount += 1;
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(latestResult).toEqual({
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      expect(counter).toBe(2);
      expect(errorCount).toBe(1);
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results2[i]);
    }
  });

  it('prints unhandled subscription errors to the console', done => {
    let latestResult: any = null;

    const wSLink = mockObservableLink(sub3);
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    let counter = 0;

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let errorCount = 0;
    const consoleErr = console.error;
    console.error = (_: Error) => {
      errorCount += 1;
    };

    obsHandle.subscribeToMore({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: () => {
        throw new Error('should not be called because of initial error');
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(latestResult).toEqual({
        data: { entry: { value: 1 } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      expect(counter).toBe(1);
      expect(errorCount).toBe(1);
      console.error = consoleErr;
      done();
    }, 50);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results3[i]);
    }
  });
  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.
});
