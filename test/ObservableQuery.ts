import * as chai from 'chai';
const { assert } = chai;
import * as sinon from 'sinon';

import gql from 'graphql-tag';
import {
  ExecutionResult,
} from 'graphql';

import {
  QueryManager,
} from '../src/core/QueryManager';
import {
  createApolloStore,
  ApolloStore,
} from '../src/store';
import ApolloClient, {
  ApolloStateSelector,
} from '../src/ApolloClient';

import mockQueryManager from './mocks/mockQueryManager';
import mockWatchQuery from './mocks/mockWatchQuery';
import mockNetworkInterface, {
  ParsedRequest,
} from './mocks/mockNetworkInterface';
import { ObservableQuery } from '../src/core/ObservableQuery';
import {
  NetworkInterface,
} from '../src/transport/networkInterface';

import wrap from './util/wrap';
import subscribeAndCount from './util/subscribeAndCount';

import { NetworkStatus } from '../src/queries/networkStatus';

describe('ObservableQuery', () => {
  // Standard data for all these tests
  const query = gql`
    query query($id: ID!) {
      people_one(id: $id) {
        name
      }
    }
  `;
  const superQuery = gql`
    query superQuery($id: ID!) {
      people_one(id: $id) {
        name
        age
      }
    }
  `;
  const variables = { id: 1 };
  const differentVariables = { id: 2 };
  const dataOne = {
    people_one: {
      name: 'Luke Skywalker',
    },
  };
  const superDataOne = {
    people_one: {
      name: 'Luke Skywalker',
      age: 21,
    },
  };
  const dataTwo = {
    people_one: {
      name: 'Leia Skywalker',
    },
  };

  const error = {
    name: 'people_one',
    message: 'is offline.',
  };

  const defaultReduxRootSelector = (state: any) => state.apollo;
  const createQueryManager = ({
    networkInterface,
    store,
    reduxRootSelector,
    addTypename = false,
  }: {
    networkInterface?: NetworkInterface,
    store?: ApolloStore,
    reduxRootSelector?: ApolloStateSelector,
    addTypename?: boolean,
  }) => {

    return new QueryManager({
      networkInterface: networkInterface || mockNetworkInterface(),
      store: store || createApolloStore(),
      reduxRootSelector: reduxRootSelector || defaultReduxRootSelector,
      addTypename,
    });
  };

  describe('setOptions', () => {
    describe('to change pollInterval', () => {
      let timer: any;
      // We need to use this to jump over promise.then boundaries
      let defer: Function = setImmediate;
      beforeEach(() => timer = sinon.useFakeTimers());
      afterEach(() => timer.restore());

      it('starts polling if goes from 0 -> something', (done) => {
        const manager = mockQueryManager({
          request: { query, variables },
          result: { data: dataOne },
        }, {
          request: { query, variables },
          result: { data: dataTwo },
        });

        const observable = manager.watchQuery({ query, variables });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);
            observable.setOptions({ pollInterval: 10 });
            // 10 for the poll and an extra 1 for network requests
            timer.tick(11);
          } else if (handleCount === 2) {
            assert.deepEqual(result.data, dataTwo);
            done();
          }
        });

        // trigger the first subscription callback
        timer.tick(0);
      });

      it('stops polling if goes from something -> 0', (done) => {
        const manager = mockQueryManager({
          request: { query, variables },
          result: { data: dataOne },
        }, {
          request: { query, variables },
          result: { data: dataTwo },
        });

        const observable = manager.watchQuery({
          query,
          variables,
          pollInterval: 10,
        });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);
            observable.setOptions({ pollInterval: 0 });

            // big number just to be sure
            timer.tick(100);
            done();
          } else if (handleCount === 2) {
            done(new Error('Should not get more than one result'));
          }
        });

        // trigger the first subscription callback
        timer.tick(0);
      });

      it('can change from x>0 to y>0', (done) => {
        const manager = mockQueryManager({
          request: { query, variables },
          result: { data: dataOne },
        }, {
          request: { query, variables },
          result: { data: dataTwo },
        });

        const observable = manager.watchQuery({
          query,
          variables,
          pollInterval: 100,
        });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            assert.deepEqual(result.data, dataOne);

            // It's confusing but we need to ensure we let the scheduler
            // come back from fetching before we mess with it.
            defer(() => {
              observable.setOptions({ pollInterval: 10 });

              // Again, the scheduler needs to complete setting up the poll
              // before the timer goes off
              defer(() => {
                // just enough to trigger a second data
                timer.tick(11);
              });
            });

          } else if (handleCount === 2) {
            assert.deepEqual(result.data, dataTwo);
            done();
          }
        });

        // trigger the first subscription callback
        timer.tick(0);
      });
    });

    it('does not break refetch', (done) => {
      // This query and variables are copied from react-apollo
      const queryWithVars = gql`query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }`;

      const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
      const variables2 = { first: 1 };


      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query: queryWithVars, variables: variables1 },
        result: { data },
      }, {
        request: { query: queryWithVars, variables: variables2 },
        result: { data: data2 },
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, data);
          observable.setOptions({ forceFetch: false });
          observable.refetch(variables2);
        } else if (handleCount === 3) { // 3 because there is an intermediate loading state
          assert.deepEqual(result.data, data2);
          done();
        }
      });
    });

    it('does a network request if forceFetch becomes true', (done) => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          observable.setOptions({ forceFetch: true });
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, dataTwo);
          done();
        }
      });
    });

    it('does a network request if noFetch becomes true then store is reset then noFetch becomes false', (done) => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          timesFired += 1;
          return Promise.resolve({ data });
        },
      };
      queryManager = createQueryManager({ networkInterface });
      observable = queryManager.watchQuery({ query: testQuery });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, data);
          assert.equal(timesFired, 1);

          setTimeout(() => {
            observable.setOptions({noFetch: true});

            queryManager.resetStore();
          }, 0);
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {});
          assert.equal(timesFired, 1);

          setTimeout(() => {
            observable.setOptions({noFetch: false});
          }, 0);
        } else if (handleCount === 3) {
          assert.deepEqual(result.data, data);
          assert.equal(timesFired, 2);

          done();
        }
      });
    });

    it('does a network request if noFetch becomes false', (done) => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          timesFired += 1;
          return Promise.resolve({ data });
        },
      };
      queryManager = createQueryManager({ networkInterface });
      observable = queryManager.watchQuery({ query: testQuery, noFetch: true });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 2) {
          assert.deepEqual(result.data, {});
          assert.equal(timesFired, 0);

          setTimeout(() => {
            observable.setOptions({noFetch: false});
          }, 0);
        } else if (handleCount === 3) {
          assert.deepEqual(result.data, data);
          assert.equal(timesFired, 1);

          done();
        }
      });
    });
  });

  describe('setVariables', () => {
    it('reruns query if the variables change', (done) => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataTwo },
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          assert.isTrue(result.loading);
          assert.deepEqual(result.data, dataOne);
        } else if (handleCount === 3) {
          assert.isFalse(result.loading);
          assert.deepEqual(result.data, dataTwo);
          done();
        }
      });
    });

    it('does not perform a query when unsubscribed if variables change', () => {
      // Note: no responses, will throw if a query is made
      const queryManager = mockQueryManager();
      const observable = queryManager.watchQuery({ query, variables });

      return observable.setVariables(differentVariables);
    });

    it('sets networkStatus to `setVariables` when fetching', (done) => {
      const mockedResponses = [{
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataTwo },
      }];

      const queryManager = mockQueryManager(...mockedResponses);
      const firstRequest = mockedResponses[0].request;
      const observable =  queryManager.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          assert.equal(result.networkStatus, NetworkStatus.ready);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          assert.isTrue(result.loading);
          assert.equal(result.networkStatus, NetworkStatus.setVariables);
          assert.deepEqual(result.data, dataOne);
        } else if (handleCount === 3) {
          assert.isFalse(result.loading);
          assert.equal(result.networkStatus, NetworkStatus.ready);
          assert.deepEqual(result.data, dataTwo);
          done();
        }
      });
    });

    it('sets networkStatus to `setVariables` when calling refetch with new variables', (done) => {
      const mockedResponses = [{
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataTwo },
      }];

      const queryManager = mockQueryManager(...mockedResponses);
      const firstRequest = mockedResponses[0].request;
      const observable =  queryManager.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          assert.equal(result.networkStatus, NetworkStatus.ready);
          observable.refetch(differentVariables);
        } else if (handleCount === 2) {
          assert.isTrue(result.loading);
          assert.equal(result.networkStatus, NetworkStatus.setVariables);
          assert.deepEqual(result.data, dataOne);
        } else if (handleCount === 3) {
          assert.isFalse(result.loading);
          assert.equal(result.networkStatus, NetworkStatus.ready);
          assert.deepEqual(result.data, dataTwo);
          done();
        }
      });
    });

    it('reruns observer callback if the variables change but data does not', (done) => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataOne },
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          assert.isTrue(result.loading);
          assert.deepEqual(result.data, dataOne);
        } else if (handleCount === 3) {
          assert.deepEqual(result.data, dataOne);
          done();
        }
      });
    });

    it('does not rerun observer callback if the variables change but new data is in store', (done) => {
      const manager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataOne },
      });

      manager.query({ query, variables: differentVariables })
        .then(() => {
          const observable: ObservableQuery<any> = manager.watchQuery({ query, variables });

          let errored = false;
          subscribeAndCount(done, observable, (handleCount, result) => {
            if (handleCount === 1) {
              assert.deepEqual(result.data, dataOne);
              observable.setVariables(differentVariables);

              // Nothing should happen, so we'll wait a moment to check that
              setTimeout(() => !errored && done(), 10);
            } else if (handleCount === 2) {
              errored = true;
              throw new Error('Observable callback should not fire twice');
            }
          });
        });
    });

    it('does not rerun query if variables do not change', (done) => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      let errored = false;
      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, dataOne);
          observable.setVariables(variables);

          // Nothing should happen, so we'll wait a moment to check that
          setTimeout(() => !errored && done(), 10);
        } else if (handleCount === 2) {
          errored = true;
          throw new Error('Observable callback should not fire twice');
        }
      });
    });

    it('handles variables changing while a query is in-flight', (done) => {
      // The expected behavior is that the original variables are forgotten
      // and the query stays in loading state until the result for the new variables
      // has returned.
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
        delay: 20,
      }, {
        request: { query, variables: differentVariables },
        result: { data: dataTwo },
        delay: 20,
      });

      setTimeout(() => observable.setVariables(differentVariables), 10);

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          assert.equal(result.networkStatus, NetworkStatus.ready);
          assert.isFalse(result.loading);
          assert.deepEqual(result.data, dataTwo);
          done();
        }
      });
    });
  });

  describe('currentResult', () => {
    it('returns the current query status immediately', (done) => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
        delay: 100,
      });

      subscribeAndCount(done, observable, () => {
        assert.deepEqual(observable.currentResult(), {
          data: dataOne,
          loading: false,
          networkStatus: 7,
          partial: false,
        });
        done();
      });

      assert.deepEqual(observable.currentResult(), {
        loading: true,
        data: {},
        networkStatus: 1,
        partial: true,
      });
      setTimeout(wrap(done, () => {
        assert.deepEqual(observable.currentResult(), {
          loading: true,
          data: {},
          networkStatus: 1,
          partial: true,
        });
      }), 0);
    });

    it('returns results from the store immediately', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      return queryManager.query({ query, variables })
        .then((result: any) => {
          assert.deepEqual(result, {
            data: dataOne,
            loading: false,
            networkStatus: 7,
          });
          const observable = queryManager.watchQuery({
            query,
            variables,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: false,
            networkStatus: 7,
            partial: false,
          });
        });
    });

    it('returns errors from the store immediately', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
      });

      return observable.result()
        .catch((theError: any) => {
          assert.deepEqual(theError.graphQLErrors, [error]);

          const currentResult = observable.currentResult();

          assert.equal(currentResult.loading, false);
          assert.deepEqual(currentResult.error!.graphQLErrors, [error]);
        });
    });

    it('returns partial data from the store immediately', (done) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query: superQuery, variables },
        result: { data: superDataOne },
      });

      queryManager.query({ query, variables })
        .then((result: any) => {
          const observable = queryManager.watchQuery({
            query: superQuery,
            variables,
            returnPartialData: true,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: true,
            networkStatus: 1,
            partial: true,
          });

          // we can use this to trigger the query
          subscribeAndCount(done, observable, (handleCount, subResult) => {
            const { data, loading, networkStatus } = observable.currentResult();
            assert.deepEqual(subResult, { data, loading, networkStatus });

            if (handleCount === 1) {
              assert.deepEqual(subResult, {
                data: dataOne,
                loading: true,
                networkStatus: 1,
              });
            } else if (handleCount === 2) {
              assert.deepEqual(subResult, {
                data: superDataOne,
                loading: false,
                networkStatus: 7,
              });
              done();
            }
          });
        });
    });

    it('returns loading even if full data is available when force fetching', (done) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      }, {
        request: { query, variables },
        result: { data: dataTwo },
      });

      queryManager.query({ query, variables })
        .then((result: any) => {
          const observable = queryManager.watchQuery({
            query,
            variables,
            forceFetch: true,
          });
          assert.deepEqual(observable.currentResult(), {
            data: dataOne,
            loading: true,
            networkStatus: 1,
            partial: false,
          });

          subscribeAndCount(done, observable, (handleCount, subResult) => {
            const { data, loading, networkStatus } = observable.currentResult();
            assert.deepEqual(subResult, { data, loading, networkStatus });

            if (handleCount === 1) {
              assert.deepEqual(subResult, {
                data: dataTwo,
                loading: false,
                networkStatus: 7,
              });
              done();
            }
          });
        });
    });

    describe('mutations', () => {
      const mutation = gql`
        mutation setName {
          name
        }
      `;

      const mutationData = {
        name: 'Leia Skywalker',
      };

      const optimisticResponse = {
        name: 'Leia Skywalker (optimistic)',
      };

      const updateQueries = {
        query: (previousQueryResult: any, { mutationResult }: any ) => {
          return {
            people_one: { name: mutationResult.data.name },
          };
        },
      };

      it('returns optimistic mutation results from the store', (done) => {
        const queryManager = mockQueryManager({
          request: { query, variables },
          result: { data: dataOne },
        }, {
          request: { query: mutation },
          result: { data: mutationData },
        });

        const observable = queryManager.watchQuery({
          query,
          variables,
        });

        subscribeAndCount(done, observable, (count, result) => {
          const { data, loading, networkStatus } = observable.currentResult();
          assert.deepEqual(result, { data, loading, networkStatus });

          if (count === 1) {
            assert.deepEqual(result, {
              data: dataOne,
              loading: false,
              networkStatus: 7,
            });
            queryManager.mutate({ mutation, optimisticResponse, updateQueries });
          } else if (count === 2) {
            assert.deepEqual(result.data.people_one, optimisticResponse);
          } else if (count === 3) {
            assert.deepEqual(result.data.people_one, mutationData);
            done();
          }
        });
      });

      it('applies query reducers with correct variables', (done) => {
        const queryManager = mockQueryManager({
          // First we make the query
          request: { query, variables },
          result: { data: dataOne },
        }, {
          // Then we make a mutation
          request: { query: mutation },
          result: { data: mutationData },
        }, {
          // Then we make another query
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        }, {
          // Then we make another mutation
          request: { query: mutation },
          result: { data: mutationData },
        });


        let lastReducerVars: Array<Object> = [];
        let lastReducerData: Array<Object> = [];
        const observable = queryManager.watchQuery({
          query,
          variables,
          reducer: (previous, action, reducerVars) => {
            if (action.type === 'APOLLO_MUTATION_RESULT') {
              // We want to track the history of the `variables` the reducer
              // is given for the query.
              lastReducerData.push(previous);
              lastReducerVars.push(reducerVars);
            }

            return previous;
          },
        });

        // Check that the variables fed into the reducer are correct.
        function assertVariables() {
          assert.lengthOf(lastReducerVars, 2);
          assert.deepEqual(lastReducerVars[0], variables);
          assert.deepEqual(lastReducerData[0], dataOne);
          assert.deepEqual(lastReducerVars[1], differentVariables);
          assert.deepEqual(lastReducerData[1], dataTwo);
          done();
        }

        // Subscribe to the query, then run the mutation, then change the variables, then run another mutation.
        let sub = observable.subscribe({});
        queryManager.mutate({ mutation }).then(() => {
          observable.setVariables(differentVariables);
          queryManager.mutate({ mutation }).then(() => {
            // We have to get out of the Promise scope here
            // because the promises are capturing the assertion errors
            // leading to timesouts.
            setTimeout(assertVariables, 0);
          });
        });
      });
    });
  });
});
