import gql from 'graphql-tag';
import { ApolloLink, Operation } from 'apollo-link';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { stripSymbols } from 'apollo-utilities';

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
        value: '1',
      },
    },
  };

  const req1 = { request: { query } as Operation, result };

  const results = ['Dahivat Pandya', 'Amanda Liu'].map(name => ({
    result: { data: { name } },
    delay: 10,
  }));

  const results2 = [
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
    { error: new Error('You cant touch this'), delay: 10 },
  ];

  const results3 = [
    { error: new Error('You cant touch this'), delay: 10 },
    { result: { data: { name: 'Amanda Liu' } }, delay: 10 },
  ];

  const result4 = {
    data: {
      entry: [{ value: '1' }, { value: '2' }],
    },
  };
  const req4 = { request: { query } as Operation, result: result4 };

  interface SubscriptionData {
    name: string;
  }

  it('triggers new result from subscription data', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);
    let counter = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const obsHandle = client.watchQuery<typeof req1['result']['data']>({
      query,
    });

    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(counter).toBe(3);
      expect(stripSymbols(latestResult)).toEqual({
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      done();
    }, 15);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results[i]);
    }
  });

  it('calls error callback on error', done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req1);

    const link = ApolloLink.split(isSub, wSLink, httpLink);

    let counter = 0;

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const obsHandle = client.watchQuery<typeof req1['result']['data']>({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let errorCount = 0;

    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
      onError: () => {
        errorCount += 1;
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(stripSymbols(latestResult)).toEqual({
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      expect(counter).toBe(2);
      expect(errorCount).toBe(1);
      done();
    }, 15);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results2[i]);
    }
  });

  it('prints unhandled subscription errors to the console', done => {
    let latestResult: any = null;

    const wSLink = mockObservableLink();
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
      expect(stripSymbols(latestResult)).toEqual({
        data: { entry: { value: '1' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      expect(counter).toBe(1);
      expect(errorCount).toBe(1);
      console.error = consoleErr;
      done();
    }, 15);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results3[i]);
    }
  });

  it('should not corrupt the cache (#3062)', async done => {
    let latestResult: any = null;
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(req4);

    const link = ApolloLink.split(isSub, wSLink, httpLink);
    let counter = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }).restore({
        'ROOT_QUERY.entry.0': {
          value: 1,
        },
        'ROOT_QUERY.entry.1': {
          value: 2,
        },
        ROOT_QUERY: {
          entry: [
            {
              type: 'id',
              id: 'ROOT_QUERY.entry.0',
              generated: true,
            },
            {
              type: 'id',
              id: 'ROOT_QUERY.entry.1',
              generated: true,
            },
          ],
        },
      }),
      link,
    });

    const obsHandle = client.watchQuery<typeof req4['result']['data']>({
      query,
    });

    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    let nextMutation: { value: string };
    obsHandle.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription createdEntry {
          name
        }
      `,
      updateQuery: (prev, { subscriptionData }) => {
        expect(prev.entry).not.toContainEqual(nextMutation);
        return {
          entry: [...prev.entry, { value: subscriptionData.data.name }],
        };
      },
    });

    const wait = (dur: any) => new Promise(resolve => setTimeout(resolve, dur));

    for (let i = 0; i < 2; i++) {
      // init optimistic mutation
      let data = client.cache.readQuery<typeof req4['result']['data']>(
        { query },
        false,
      );
      client.cache.recordOptimisticTransaction(proxy => {
        nextMutation = { value: results[i].result.data.name };
        proxy.writeQuery({
          data: { entry: [...((data && data.entry) || []), nextMutation] },
          query,
        });
      }, i.toString());
      // on slow networks, subscription can happen first
      wSLink.simulateResult(results[i]);
      await wait(results[i].delay + 1);
      // complete mutation
      client.cache.removeOptimistic(i.toString());
      // note: we don't complete mutation with performTransaction because a real example would detect duplicates
    }
    sub.unsubscribe();
    expect(counter).toBe(3);
    expect(stripSymbols(latestResult)).toEqual({
      data: {
        entry: [
          {
            value: 1,
          },
          {
            value: 2,
          },
          {
            value: 'Dahivat Pandya',
          },
          {
            value: 'Amanda Liu',
          },
        ],
      },
      loading: false,
      networkStatus: 7,
      stale: false,
    });
    done();
  });
  // TODO add a test that checks that subscriptions are cancelled when obs is unsubscribed from.

  it('allows specification of custom types for variables and payload (#4246)', done => {
    interface TypedOperation extends Operation {
      variables: {
        someNumber: number;
      };
    }
    const typedReq = {
      request: { query, variables: { someNumber: 1 } } as TypedOperation,
      result,
    };
    interface TypedSubscriptionVariables {
      someString: string;
    }

    let latestResult: any = null;
    const wSLink = mockObservableLink();
    const httpLink = mockSingleLink(typedReq);

    const link = ApolloLink.split(isSub, wSLink, httpLink);
    let counter = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const obsHandle = client.watchQuery<
      typeof typedReq['result']['data'],
      typeof typedReq['request']['variables']
    >({
      query,
      variables: { someNumber: 1 },
    });

    const sub = obsHandle.subscribe({
      next(queryResult) {
        latestResult = queryResult;
        counter++;
      },
    });

    obsHandle.subscribeToMore<SubscriptionData, TypedSubscriptionVariables>({
      document: gql`
        subscription newValues {
          name
        }
      `,
      variables: {
        someString: 'foo',
      },
      updateQuery: (_, { subscriptionData }) => {
        return { entry: { value: subscriptionData.data.name } };
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      expect(counter).toBe(3);
      expect(stripSymbols(latestResult)).toEqual({
        data: { entry: { value: 'Amanda Liu' } },
        loading: false,
        networkStatus: 7,
        stale: false,
      });
      done();
    }, 15);

    for (let i = 0; i < 2; i++) {
      wSLink.simulateResult(results[i]);
    }
  });
});
