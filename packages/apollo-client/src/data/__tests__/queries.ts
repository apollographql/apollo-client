import { QueryStore } from '../queries';
import { NetworkStatus } from '../../core/networkStatus';
import { DocumentNode } from 'graphql';

describe('QueryStore', () => {
  const queryId = 'abc123';
  let queryStore;

  beforeEach(() => {
    queryStore = new QueryStore();
    queryStore.initQuery({
      queryId,
      document: {} as DocumentNode,
      storePreviousVariables: false,
      variables: {},
      isPoll: false,
      isRefetch: false,
      metadata: {},
      fetchMoreForQueryId: queryId,
    });
  });

  describe('initQuery', () => {
    it(
      'should set the network status of a query to `fetchMore` if the ' +
        'query has a `fetchMoreForQueryId` property',
      () => {
        expect(queryStore.get(queryId).networkStatus).toBe(
          NetworkStatus.fetchMore,
        );
      },
    );

    it(
      'should not attempt to set the network status of a ' +
        '`fetchMoreForQueryId` query, if it does not exist in the store',
      () => {
        queryStore.stopQuery(queryId);
        expect(() => {
          queryStore.initQuery({
            queryId: 'new-query-id',
            document: {} as DocumentNode,
            storePreviousVariables: false,
            variables: {},
            isPoll: false,
            isRefetch: false,
            metadata: {},
            fetchMoreForQueryId: queryId,
          });
        }).not.toThrow("Cannot set property 'networkStatus' of undefined");
      },
    );
  });

  describe('markQueryResult', () => {
    it(
      'should not attempt to set the network status if the store does not ' +
        'exist',
      () => {
        const testStore = new QueryStore();
        testStore['store'] = null;
        expect(() => {
          testStore.markQueryResult('someId', {}, 'anotherId');
        }).not.toThrow();
      },
    );

    it(
      'should set the network status of a `fetchMoreForQueryId` query to ' +
        '`ready` in the store, if it exists',
      () => {
        queryStore.markQueryResult(queryId, {}, queryId);
        expect(queryStore.get(queryId).networkStatus).toBe(NetworkStatus.ready);
      },
    );

    it(
      'should not attempt to set the network status of a ' +
        '`fetchMoreForQueryId` query, if it does not exist in the store',
      () => {
        expect(() => {
          queryStore.markQueryResult(queryId, {}, 'id-does-not-exist');
        }).not.toThrow("Cannot set property 'networkStatus' of undefined");
      },
    );
  });

  describe('markQueryError', () => {
    it(
      'should not attempt to set the network status if the store does not ' +
        'exist',
      () => {
        const testStore = new QueryStore();
        testStore['store'] = null;
        expect(() => {
          testStore.markQueryError('someId', null, 'anotherId');
        }).not.toThrow();
      },
    );

    it(
      'should set the network status of a `fetchMoreForQueryId` query to ' +
        '`ready` in the store, if it exists',
      () => {
        queryStore.markQueryError(queryId, null, queryId);
        expect(queryStore.get(queryId).networkStatus).toBe(NetworkStatus.ready);
      },
    );

    it(
      'should not attempt to set the network status of a ' +
        '`fetchMoreForQueryId` query, if it does not exist in the store',
      () => {
        expect(() => {
          queryStore.markQueryError(queryId, null, 'id-does-not-exist');
        }).not.toThrow("Cannot set property 'networkStatus' of undefined");
      },
    );
  });

  describe('markQueryResultClient', () => {
    it(
      'should not attempt to set the network status if the store does not ' +
        'exist',
      () => {
        const testStore = new QueryStore();
        testStore['store'] = null;
        expect(() => {
          testStore.markQueryResultClient('someId', false);
        }).not.toThrow();
      },
    );
  });
});
