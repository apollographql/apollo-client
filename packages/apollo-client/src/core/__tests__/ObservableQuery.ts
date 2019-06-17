import gql from 'graphql-tag';
import { ApolloLink, Observable } from 'apollo-link';
import {
  InMemoryCache,
  IntrospectionFragmentMatcher,
} from 'apollo-cache-inmemory';
import { GraphQLError } from 'graphql';

import mockQueryManager from '../../__mocks__/mockQueryManager';
import mockWatchQuery from '../../__mocks__/mockWatchQuery';
import { mockSingleLink } from '../../__mocks__/mockLinks';

import { ObservableQuery } from '../ObservableQuery';
import { NetworkStatus } from '../networkStatus';
import { QueryManager } from '../QueryManager';
import { DataStore } from '../../data/store';
import ApolloClient from '../../';

import wrap from '../../util/wrap';
import subscribeAndCount from '../../util/subscribeAndCount';
import { stripSymbols } from 'apollo-utilities';
import { ApolloError } from '../../errors/ApolloError';

describe('ObservableQuery', () => {
  // Standard data for all these tests
  const query = gql`
    query query($id: ID!) {
      people_one(id: $id) {
        name
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
  const dataTwo = {
    people_one: {
      name: 'Leia Skywalker',
    },
  };

  const error = {
    name: 'people_one',
    message: 'is offline.',
  };

  const createQueryManager = ({ link }: { link?: ApolloLink }) => {
    return new QueryManager({
      link: link || mockSingleLink(),
      assumeImmutableResults: true,
      store: new DataStore(
        new InMemoryCache({
          addTypename: false,
          freezeResults: true,
        }),
      ),
    });
  };

  describe('setOptions', () => {
    describe('to change pollInterval', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('starts polling if goes from 0 -> something', done => {
        const manager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        );

        const observable = manager.watchQuery({
          query,
          variables,
          notifyOnNetworkStatusChange: false,
        });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(dataOne);
            observable.setOptions({ pollInterval: 10 });
            // 10 for the poll and an extra 1 for network requests
            jest.runTimersToTime(11);
          } else if (handleCount === 2) {
            expect(stripSymbols(result.data)).toEqual(dataTwo);
            done();
          }
        });

        jest.runTimersToTime(1);
      });

      it('stops polling if goes from something -> 0', done => {
        const manager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        );

        const observable = manager.watchQuery({
          query,
          variables,
          pollInterval: 10,
        });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(dataOne);
            observable.setOptions({ pollInterval: 0 });

            jest.runTimersToTime(5);
            done();
          } else if (handleCount === 2) {
            done.fail(new Error('Should not get more than one result'));
          }
        });

        // trigger the first subscription callback
        jest.runTimersToTime(1);
      });

      it('can change from x>0 to y>0', done => {
        const manager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        );

        const observable = manager.watchQuery({
          query,
          variables,
          pollInterval: 100,
          notifyOnNetworkStatusChange: false,
        });
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(dataOne);

            // It's confusing but we need to ensure we let the scheduler
            // come back from fetching before we mess with it.
            setImmediate(() => {
              observable.setOptions({ pollInterval: 10 });

              // Again, the scheduler needs to complete setting up the poll
              // before the timer goes off
              setImmediate(() => {
                // just enough to trigger a second data
                jest.runTimersToTime(11);
              });
            });
          } else if (handleCount === 2) {
            expect(stripSymbols(result.data)).toEqual(dataTwo);
            done();
          }
        });

        // trigger the first subscription callback
        jest.runTimersToTime(0);
      });
    });

    it('does not break refetch', done => {
      // This query and variables are copied from react-apollo
      const queryWithVars = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
      const variables2 = { first: 1 };

      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: {
            query: queryWithVars,
            variables: variables1,
          },
          result: { data },
        },
        {
          request: {
            query: queryWithVars,
            variables: variables2,
          },
          result: { data: data2 },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
          return observable.refetch(variables2);
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(result.loading).toBe(true);
        } else if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(data2);
          done();
        }
      });
    });

    it('rerenders when refetch is called', done => {
      // This query and variables are copied from react-apollo
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const variables = { first: 0 };

      const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };

      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: {
            query,
            variables,
          },
          result: { data },
        },
        {
          request: {
            query,
            variables,
          },
          result: { data: data2 },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
          return observable.refetch();
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(data2);
          done();
        }
      });
    });

    it('rerenders with new variables then shows correct data for previous variables', done => {
      // This query and variables are copied from react-apollo
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const variables = { first: 0 };

      const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
      const variables2 = { first: 1 };

      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: {
            query,
            variables,
          },
          result: { data },
        },
        {
          request: {
            query,
            variables: variables2,
          },
          result: { data: data2 },
        },
      );

      subscribeAndCount(done, observable, async (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
          await observable.setOptions({ variables: variables2 });
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(result.loading).toBe(true);
        } else if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(data2);
          // go back to first set of variables
          await observable.setOptions({ variables });
          const current = observable.getCurrentResult();
          expect(stripSymbols(current.data)).toEqual(data);
          const secondCurrent = observable.getCurrentResult();
          expect(current.data).toEqual(secondCurrent.data);
          done();
        }
      });
    });

    // TODO: Something isn't quite right with this test. It's failing but not
    // for the right reasons.
    it.skip('if query is refetched, and an error is returned, no other observer callbacks will be called', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { errors: [error] },
        },
        {
          request: { query, variables },
          result: { data: dataOne },
        },
      );

      let handleCount = 0;
      observable.subscribe({
        next: result => {
          handleCount++;
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(dataOne);
            observable.refetch();
          } else if (handleCount === 3) {
            throw new Error("next shouldn't fire after an error");
          }
        },
        error: () => {
          handleCount++;
          expect(handleCount).toBe(2);
          observable.refetch();
          setTimeout(done, 25);
        },
      });
    });

    it('does a network request if fetchPolicy becomes networkOnly', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          return observable.setOptions({ fetchPolicy: 'network-only' });
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          done();
        }
      });
    });

    it('does a network request if fetchPolicy is cache-only then store is reset then fetchPolicy becomes not cache-only', done => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () => {
          return new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
            return;
          });
        },
      ]);
      queryManager = createQueryManager({ link });
      // fetch first data from server
      observable = queryManager.watchQuery({ query: testQuery });

      subscribeAndCount(done, observable, async (handleCount, result) => {
        try {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(timesFired).toBe(1);
            // set policy to be cache-only but data is found
            await observable.setOptions({ fetchPolicy: 'cache-only' });
            await queryManager.resetStore();
          } else if (handleCount === 2) {
            expect(stripSymbols(result.data)).toEqual({});
            expect(timesFired).toBe(1);
            await observable.setOptions({ fetchPolicy: 'cache-first' });
          } else if (handleCount === 3) {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(timesFired).toBe(2);
            done();
          }
        } catch (e) {
          done.fail(e);
        }
      });
    });

    it('does a network request if fetchPolicy changes from cache-only', done => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () => {
          return new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
            return;
          });
        },
      ]);
      queryManager = createQueryManager({ link });
      observable = queryManager.watchQuery({
        query: testQuery,
        fetchPolicy: 'cache-only',
        notifyOnNetworkStatusChange: false,
      });

      subscribeAndCount(done, observable, async (handleCount, result) => {
        if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual({});
          expect(timesFired).toBe(0);
          await observable.setOptions({ fetchPolicy: 'cache-first' });
        } else if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(1);
          done();
        }
      });
    });

    it('can set queries to standby and will not fetch when doing so', done => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () => {
          return new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
            return;
          });
        },
      ]);
      queryManager = createQueryManager({ link });
      observable = queryManager.watchQuery({
        query: testQuery,
        fetchPolicy: 'cache-first',
        notifyOnNetworkStatusChange: false,
      });

      subscribeAndCount(done, observable, async (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(1);
          await observable.setOptions({ fetchPolicy: 'standby' });
          // make sure the query didn't get fired again.
          expect(timesFired).toBe(1);
          done();
        } else if (handleCount === 2) {
          throw new Error('Handle should not be triggered on standby query');
        }
      });
    });

    it('will not fetch when setting a cache-only query to standby', done => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () => {
          return new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
            return;
          });
        },
      ]);
      queryManager = createQueryManager({ link });

      queryManager.query({ query: testQuery }).then(() => {
        observable = queryManager.watchQuery({
          query: testQuery,
          fetchPolicy: 'cache-first',
          notifyOnNetworkStatusChange: false,
        });

        subscribeAndCount(done, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(timesFired).toBe(1);
            await observable.setOptions({ fetchPolicy: 'standby' });
            // make sure the query didn't get fired again.
            expect(timesFired).toBe(1);
            done();
          } else if (handleCount === 2) {
            throw new Error('Handle should not be triggered on standby query');
          }
        });
      });
    });
    it('returns a promise which eventually returns data', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      subscribeAndCount(done, observable, handleCount => {
        if (handleCount !== 1) {
          return;
        }
        observable
          .setOptions({ fetchPolicy: 'cache-and-network', fetchResults: true })
          .then(res => {
            // returns dataOne from cache
            expect(stripSymbols(res.data)).toEqual(dataOne);
            done();
          });
      });
    });
    it('can bypass looking up results if passed to options', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      let errored = false;
      subscribeAndCount(done, observable, handleCount => {
        if (handleCount === 1) {
          observable
            .setOptions({ fetchResults: false, fetchPolicy: 'standby' })
            .then(res => {
              expect(res).toBeUndefined();
              setTimeout(() => !errored && done(), 5);
            });
        } else if (handleCount > 1) {
          errored = true;
          throw new Error('Handle should not be called twice');
        }
      });
    });
  });

  describe('setVariables', () => {
    it('reruns query if the variables change', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          return observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(stripSymbols(result.data)).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          done();
        }
      });
    });

    it('does invalidate the currentResult data if the variables change', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
          delay: 25,
        },
      );

      subscribeAndCount(done, observable, async (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            dataOne,
          );
          await observable.setVariables(differentVariables);
          expect(observable.getCurrentResult().data).toEqual({});
          expect(observable.getCurrentResult().loading).toBe(true);
        }
        // after loading is false and data has returned
        if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            dataTwo,
          );
          expect(observable.getCurrentResult().loading).toBe(false);
          done();
        }
      });
    });
    it('does invalidate the currentResult data if the variables change', done => {
      // Standard data for all these tests
      const query = gql`
        query UsersQuery($page: Int) {
          users {
            id
            name
            posts(page: $page) {
              title
            }
          }
        }
      `;
      const variables = { page: 1 };
      const differentVariables = { page: 2 };
      const dataOne = {
        users: [
          {
            id: 1,
            name: 'James',
            posts: [{ title: 'GraphQL Summit' }, { title: 'Awesome' }],
          },
        ],
      };
      const dataTwo = {
        users: [
          {
            id: 1,
            name: 'James',
            posts: [{ title: 'Old post' }],
          },
        ],
      };

      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
          delay: 25,
        },
      );

      subscribeAndCount(done, observable, async (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            dataOne,
          );
          await observable.setVariables(differentVariables);
          expect(observable.getCurrentResult().data).toEqual({});
          expect(observable.getCurrentResult().loading).toBe(true);
        }
        // after loading is false and data has returned
        if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            dataTwo,
          );
          expect(observable.getCurrentResult().loading).toBe(false);
          done();
        }
      });
    });

    it('does not invalidate the currentResult errors if the variables change', done => {
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { errors: [error] },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: 'all',
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.errors).toEqual([error]);
          expect(observable.getCurrentResult().errors).toEqual([error]);
          observable.setVariables(differentVariables);
          expect(observable.getCurrentResult().errors).toEqual([error]);
        }
        // after loading is done and new results are returned
        if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            dataTwo,
          );
          expect(observable.getCurrentResult().loading).toBe(false);
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

    it('sets networkStatus to `setVariables` when fetching', done => {
      const mockedResponses = [
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
      ];

      const queryManager = mockQueryManager(...mockedResponses);
      const firstRequest = mockedResponses[0].request;
      const observable = queryManager.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          expect(stripSymbols(result.data)).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          done();
        }
      });
    });

    it('sets networkStatus to `setVariables` when calling refetch with new variables', done => {
      const mockedResponses = [
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
      ];

      const queryManager = mockQueryManager(...mockedResponses);
      const firstRequest = mockedResponses[0].request;
      const observable = queryManager.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          observable.refetch(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          expect(stripSymbols(result.data)).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          done();
        }
      });
    });

    it('reruns observer callback if the variables change but data does not', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataOne },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(stripSymbols(result.data)).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          done();
        }
      });
    });

    it('does not rerun observer callback if the variables change but new data is in store', done => {
      const manager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataOne },
        },
      );

      manager.query({ query, variables: differentVariables }).then(() => {
        const observable: ObservableQuery<any> = manager.watchQuery({
          query,
          variables,
          notifyOnNetworkStatusChange: false,
        });

        let errored = false;
        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(stripSymbols(result.data)).toEqual(dataOne);
            observable.setVariables(differentVariables);

            // Nothing should happen, so we'll wait a moment to check that
            setTimeout(() => !errored && done(), 10);
          } else if (handleCount === 2) {
            throw new Error('Observable callback should not fire twice');
          }
        });
      });
    });

    it('does not rerun query if variables do not change', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      let errored = false;
      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          observable.setVariables(variables);

          // Nothing should happen, so we'll wait a moment to check that
          setTimeout(() => !errored && done(), 10);
        } else if (handleCount === 2) {
          errored = true;
          throw new Error('Observable callback should not fire twice');
        }
      });
    });

    it('does not rerun query if set to not refetch', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      let errored = false;
      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(dataOne);
          observable.setVariables(variables, true, false);

          // Nothing should happen, so we'll wait a moment to check that
          setTimeout(() => !errored && done(), 10);
        } else if (handleCount === 2) {
          errored = true;
          throw new Error('Observable callback should not fire twice');
        }
      });
    });

    it('handles variables changing while a query is in-flight', done => {
      // The expected behavior is that the original variables are forgotten
      // and the query stays in loading state until the result for the new variables
      // has returned.
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
          delay: 20,
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
          delay: 20,
        },
      );

      setTimeout(() => observable.setVariables(differentVariables), 10);

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(result.loading).toBe(false);
          expect(stripSymbols(result.data)).toEqual(dataTwo);
          done();
        }
      });
    });
  });

  describe('refetch', () => {
    it('calls fetchRequest with fetchPolicy `network-only` when using a non-networked fetch policy', done => {
      const mockedResponses = [
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
      ];

      const queryManager = mockQueryManager(...mockedResponses);
      const firstRequest = mockedResponses[0].request;
      const observable = queryManager.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        fetchPolicy: 'cache-first',
      });

      const origFetchQuery = queryManager.fetchQuery;
      queryManager.fetchQuery = jest.fn(() =>
        origFetchQuery.apply(queryManager, arguments),
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          observable.refetch(differentVariables);
        } else if (handleCount === 3) {
          expect(queryManager.fetchQuery.mock.calls[1][1].fetchPolicy).toEqual(
            'network-only',
          );
          done();
        }
      });
    });

    it(
      'calls fetchRequest with fetchPolicy `no-cache` when using `no-cache` ' +
        'fetch policy',
      done => {
        const mockedResponses = [
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ];

        const queryManager = mockQueryManager(...mockedResponses);
        const firstRequest = mockedResponses[0].request;
        const observable = queryManager.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          fetchPolicy: 'no-cache',
        });

        const origFetchQuery = queryManager.fetchQuery;
        queryManager.fetchQuery = jest.fn(() =>
          origFetchQuery.apply(queryManager, arguments),
        );

        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            observable.refetch(differentVariables);
          } else if (handleCount === 2) {
            expect(
              queryManager.fetchQuery.mock.calls[1][1].fetchPolicy,
            ).toEqual('no-cache');
            done();
          }
        });
      },
    );

    it('calls ObservableQuery.next even after hitting cache', done => {
      // This query and variables are copied from react-apollo
      const queryWithVars = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: 'Luke Skywalker' }] } };
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [{ name: 'Leia Skywalker' }] } };
      const variables2 = { first: 1 };

      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: {
            query: queryWithVars,
            variables: variables1,
          },
          result: { data },
        },
        {
          request: {
            query: queryWithVars,
            variables: variables2,
          },
          result: { data: data2 },
        },
        {
          request: {
            query: queryWithVars,
            variables: variables1,
          },
          result: { data },
        },
      );

      observable.setOptions({ fetchPolicy: 'cache-and-network' });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toBeUndefined();
          expect(result.loading).toBe(true);
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(result.loading).toBe(false);
          observable.refetch(variables2);
        } else if (handleCount === 3) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(result.loading).toBe(true);
        } else if (handleCount === 4) {
          expect(stripSymbols(result.data)).toEqual(data2);
          expect(result.loading).toBe(false);
          observable.refetch(variables1);
        } else if (handleCount === 5) {
          expect(stripSymbols(result.data)).toEqual(data2);
          expect(result.loading).toBe(true);
        } else if (handleCount === 6) {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(result.loading).toBe(false);
          done();
        }
      });
    });

    it('cache-and-network refetch should run @client(always: true) resolvers when network request fails', done => {
      const query = gql`
        query MixedQuery {
          counter @client(always: true)
          name
        }
      `;

      let count = 0;

      let linkObservable = Observable.of({
        data: {
          name: 'Ben',
        },
      });

      const intentionalNetworkFailure = new ApolloError({
        networkError: new Error('intentional network failure'),
      });

      const errorObservable: typeof linkObservable = new Observable(
        observer => {
          observer.error(intentionalNetworkFailure);
        },
      );

      const client = new ApolloClient({
        link: new ApolloLink(request => linkObservable),
        cache: new InMemoryCache(),
        resolvers: {
          Query: {
            counter() {
              return ++count;
            },
          },
        },
      });

      const observable = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
        returnPartialData: true,
      });

      let handleCount = 0;
      observable.subscribe({
        error(error) {
          expect(error).toBe(intentionalNetworkFailure);
        },

        next(result) {
          ++handleCount;

          if (handleCount === 1) {
            expect(result).toEqual({
              data: {},
              loading: true,
              networkStatus: NetworkStatus.loading,
              stale: false,
            });
          } else if (handleCount === 2) {
            expect(result).toEqual({
              data: {
                counter: 1,
              },
              loading: true,
              networkStatus: NetworkStatus.loading,
              stale: false,
            });
          } else if (handleCount === 3) {
            expect(result).toEqual({
              data: {
                counter: 2,
                name: 'Ben',
              },
              loading: false,
              networkStatus: NetworkStatus.ready,
              stale: false,
            });

            // Make the next network request fail.
            linkObservable = errorObservable;

            observable.refetch().then(
              result => {
                expect(result).toEqual({
                  data: {
                    counter: 3,
                    name: 'Ben',
                  },
                });
              },
              error => {
                expect(error).toBe(intentionalNetworkFailure);
              },
            );
          } else if (handleCount === 4) {
            expect(result).toEqual({
              data: {
                counter: 2,
                name: 'Ben',
              },
              loading: true,
              networkStatus: NetworkStatus.refetch,
              stale: false,
            });
          } else if (handleCount === 5) {
            expect(result).toEqual({
              data: {
                counter: 3,
                name: 'Ben',
              },
              loading: true,
              networkStatus: NetworkStatus.refetch,
              stale: false,
            });

            done();
          } else if (handleCount > 5) {
            done.fail(new Error('should not get here'));
          }
        },
      });
    });
  });

  describe('currentResult', () => {
    it('returns the same value as observableQuery.next got', done => {
      const queryWithFragment = gql`
        fragment CatInfo on Cat {
          isTabby
          __typename
        }

        fragment DogInfo on Dog {
          hasBrindleCoat
          __typename
        }

        fragment PetInfo on Pet {
          id
          name
          age
          ... on Cat {
            ...CatInfo
            __typename
          }
          ... on Dog {
            ...DogInfo
            __typename
          }
          __typename
        }

        {
          pets {
            ...PetInfo
            __typename
          }
        }
      `;

      const petData = [
        {
          id: 1,
          name: 'Phoenix',
          age: 6,
          isTabby: true,
          __typename: 'Cat',
        },
        {
          id: 2,
          name: 'Tempe',
          age: 3,
          isTabby: false,
          __typename: 'Cat',
        },
        {
          id: 3,
          name: 'Robin',
          age: 10,
          hasBrindleCoat: true,
          __typename: 'Dog',
        },
      ];

      const dataOneWithTypename = {
        pets: petData.slice(0, 2),
      };

      const dataTwoWithTypename = {
        pets: petData.slice(0, 3),
      };

      const ni = mockSingleLink(
        {
          request: { query: queryWithFragment, variables },
          result: { data: dataOneWithTypename },
        },
        {
          request: { query: queryWithFragment, variables },
          result: { data: dataTwoWithTypename },
        },
      );

      const client = new ApolloClient({
        link: ni,
        cache: new InMemoryCache({
          fragmentMatcher: new IntrospectionFragmentMatcher({
            introspectionQueryResultData: {
              __schema: {
                types: [
                  {
                    kind: 'UNION',
                    name: 'Creature',
                    possibleTypes: [{ name: 'Pet' }],
                  },
                ],
              },
            },
          }),
        }),
      });

      const observable = client.watchQuery({
        query: queryWithFragment,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (count, result) => {
        const { data, loading, networkStatus } = observable.getCurrentResult();
        try {
          expect(result).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });
        } catch (e) {
          done.fail(e);
        }

        if (count === 1) {
          observable.refetch();
        }
        if (count === 3) {
          setTimeout(done, 5);
        }
        if (count > 3) {
          done.fail(new Error('Observable.next called too many times'));
        }
      });
    });

    it('returns the current query status immediately', done => {
      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
        delay: 100,
      });

      subscribeAndCount(done, observable, () => {
        expect(stripSymbols(observable.getCurrentResult())).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: 7,
          partial: false,
        });
        done();
      });

      expect(observable.getCurrentResult()).toEqual({
        loading: true,
        data: undefined,
        networkStatus: 1,
        partial: true,
      });

      setTimeout(
        wrap(done, () => {
          expect(observable.getCurrentResult()).toEqual({
            loading: true,
            data: undefined,
            networkStatus: 1,
            partial: true,
          });
        }),
        0,
      );
    });

    it('returns results from the store immediately', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      return queryManager.query({ query, variables }).then((result: any) => {
        expect(stripSymbols(result)).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: 7,
          stale: false,
        });
        const observable = queryManager.watchQuery({
          query,
          variables,
        });
        expect(stripSymbols(observable.getCurrentResult())).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: 7,
          partial: false,
        });
      });
    });

    it('returns errors from the store immediately', done => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
      });

      observable.subscribe({
        error: theError => {
          expect(theError.graphQLErrors).toEqual([error]);

          const currentResult = observable.getCurrentResult();
          expect(currentResult.loading).toBe(false);
          expect(currentResult.error!.graphQLErrors).toEqual([error]);
          done();
        },
      });
    });

    it('returns referentially equal errors', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
      });

      return observable.result().catch((theError: any) => {
        expect(theError.graphQLErrors).toEqual([error]);

        const currentResult = observable.getCurrentResult();
        expect(currentResult.loading).toBe(false);
        expect(currentResult.error!.graphQLErrors).toEqual([error]);
        const currentResult2 = observable.getCurrentResult();
        expect(currentResult.error === currentResult2.error).toBe(true);
      });
    });

    it('returns errors with data if errorPolicy is all', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne, errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: 'all',
      });

      return observable.result().then(result => {
        expect(stripSymbols(result.data)).toEqual(dataOne);
        expect(result.errors).toEqual([error]);
        const currentResult = observable.getCurrentResult();
        expect(currentResult.loading).toBe(false);
        expect(currentResult.errors).toEqual([error]);
        expect(currentResult.error).toBeUndefined();
      });
    });

    it('ignores errors with data if errorPolicy is ignore', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error], data: dataOne },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: 'ignore',
      });

      return observable.result().then(result => {
        expect(stripSymbols(result.data)).toEqual(dataOne);
        expect(result.errors).toBeUndefined();
        const currentResult = observable.getCurrentResult();
        expect(currentResult.loading).toBe(false);
        expect(currentResult.errors).toBeUndefined();
        expect(currentResult.error).toBeUndefined();
      });
    });

    it('returns partial data from the store immediately', done => {
      const superQuery = gql`
        query superQuery($id: ID!) {
          people_one(id: $id) {
            name
            age
          }
        }
      `;

      const superDataOne = {
        people_one: {
          name: 'Luke Skywalker',
          age: 21,
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query: superQuery, variables },
          result: { data: superDataOne },
        },
      );

      queryManager.query({ query, variables }).then(result => {
        const observable = queryManager.watchQuery({
          query: superQuery,
          variables,
          returnPartialData: true,
        });

        expect(observable.currentResult()).toEqual({
          data: dataOne,
          loading: true,
          networkStatus: 1,
          partial: true,
        });

        // we can use this to trigger the query
        subscribeAndCount(done, observable, (handleCount, subResult) => {
          const { data, loading, networkStatus } = observable.currentResult();
          expect(subResult).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (handleCount === 1) {
            expect(subResult).toEqual({
              data: dataOne,
              loading: true,
              networkStatus: 1,
              stale: false,
            });

          } else if (handleCount === 2) {
            expect(subResult).toEqual({
              data: superDataOne,
              loading: false,
              networkStatus: 7,
              stale: false,
            });
            done();
          }
        });
      });
    });

    it('returns loading even if full data is available when using network-only fetchPolicy', done => {
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      queryManager.query({ query, variables }).then(() => {
        const observable = queryManager.watchQuery({
          query,
          variables,
          fetchPolicy: 'network-only',
        });
        expect(stripSymbols(observable.getCurrentResult())).toEqual({
          data: undefined,
          loading: true,
          networkStatus: 1,
          partial: false,
        });

        subscribeAndCount(done, observable, (handleCount, subResult) => {
          const {
            data,
            loading,
            networkStatus,
          } = observable.getCurrentResult();
          expect(subResult).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (handleCount === 2) {
            expect(stripSymbols(subResult)).toEqual({
              data: dataTwo,
              loading: false,
              networkStatus: 7,
              stale: false,
            });
            done();
          }
        });
      });
    });

    it('returns loading on no-cache fetchPolicy queries when calling getCurrentResult', done => {
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      queryManager.query({ query, variables }).then(() => {
        const observable = queryManager.watchQuery({
          query,
          variables,
          fetchPolicy: 'no-cache',
        });
        expect(stripSymbols(observable.getCurrentResult())).toEqual({
          data: undefined,
          loading: true,
          networkStatus: 1,
          partial: false,
        });

        subscribeAndCount(done, observable, (handleCount, subResult) => {
          const {
            data,
            loading,
            networkStatus,
          } = observable.getCurrentResult();
          expect(subResult).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (handleCount === 2) {
            expect(stripSymbols(subResult)).toEqual({
              data: dataTwo,
              loading: false,
              networkStatus: 7,
              stale: false,
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
        query: (_: any, { mutationResult }: any) => {
          return {
            people_one: { name: mutationResult.data.name },
          };
        },
      };

      it('returns optimistic mutation results from the store', done => {
        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query: mutation },
            result: { data: mutationData },
          },
        );

        const observable = queryManager.watchQuery({
          query,
          variables,
        });

        subscribeAndCount(done, observable, (count, result) => {
          const {
            data,
            loading,
            networkStatus,
          } = observable.getCurrentResult();
          expect(result).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (count === 1) {
            expect(stripSymbols(result)).toEqual({
              data: dataOne,
              loading: false,
              networkStatus: 7,
              stale: false,
            });
            queryManager.mutate({
              mutation,
              optimisticResponse,
              updateQueries,
            });
          } else if (count === 2) {
            expect(stripSymbols(result.data.people_one)).toEqual(
              optimisticResponse,
            );
          } else if (count === 3) {
            expect(stripSymbols(result.data.people_one)).toEqual(mutationData);
            done();
          }
        });
      });
    });
  });

  describe('assumeImmutableResults', () => {
    it('should prevent costly (but safe) cloneDeep calls', async () => {
      const queryOptions = {
        query: gql`
          query {
            value
          }
        `,
        pollInterval: 20,
      };

      function check({ assumeImmutableResults, freezeResults }) {
        const client = new ApolloClient({
          link: mockSingleLink(
            { request: queryOptions, result: { data: { value: 1 } } },
            { request: queryOptions, result: { data: { value: 2 } } },
            { request: queryOptions, result: { data: { value: 3 } } },
          ),
          assumeImmutableResults,
          cache: new InMemoryCache({ freezeResults }),
        });

        const observable = client.watchQuery(queryOptions);
        const values = [];

        return new Promise<any[]>((resolve, reject) => {
          observable.subscribe({
            next(result) {
              values.push(result.data.value);
              try {
                result.data.value = 'oyez';
              } catch (error) {
                reject(error);
              }
              client.writeData(result);
            },
            error(err) {
              expect(err.message).toMatch(/No more mocked responses/);
              resolve(values);
            },
          });
        });
      }

      // When we assume immutable results, the next method will not fire as a
      // result of destructively modifying result.data.value, because the data
      // object is still === to the previous object. This behavior might seem
      // like a bug, if you are relying on the mutability of results, but the
      // cloneDeep calls required to prevent that bug are expensive. Assuming
      // immutability is safe only when you write your code in an immutable
      // style, but the benefits are well worth the extra effort.
      expect(
        await check({
          assumeImmutableResults: true,
          freezeResults: false,
        }),
      ).toEqual([1, 2, 3]);

      // When we do not assume immutable results, the observable must do
      // extra work to take snapshots of past results, just in case those
      // results are destructively modified. The benefit of that work is
      // that such mutations can be detected, which is why "oyez" appears
      // in the list of values here. This is a somewhat indirect way of
      // detecting that cloneDeep must have been called, but at least it
      // doesn't violate any abstractions.
      expect(
        await check({
          assumeImmutableResults: false,
          freezeResults: false,
        }),
      ).toEqual([1, 'oyez', 2, 'oyez', 3, 'oyez']);

      async function checkThrows(assumeImmutableResults) {
        try {
          await check({
            assumeImmutableResults,
            // No matter what value we provide for assumeImmutableResults, if we
            // tell the InMemoryCache to deep-freeze its results, destructive
            // modifications of the result objects will become fatal. Once you
            // start enforcing immutability in this way, you might as well pass
            // assumeImmutableResults: true, to prevent calling cloneDeep.
            freezeResults: true,
          });
          throw new Error('not reached');
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
          expect(error.message).toMatch(
            /Cannot assign to read only property 'value'/,
          );
        }
      }
      await checkThrows(true);
      await checkThrows(false);
    });
  });

  describe('stopPolling', () => {
    it('does not restart polling after stopping and resubscribing', done => {
      const observable = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        },
      );

      observable.startPolling(50);
      observable.stopPolling();

      let startedPolling = false;
      subscribeAndCount(done, observable, handleCount => {
        if (handleCount === 1) {
          // first call to subscribe is the immediate result when
          // subscribing. later calls to this callback indicate that
          // we will be polling.

          // Wait a bit to see if the subscription's `next` was called
          // again, indicating that we are polling for data.
          setTimeout(() => {
            if (!startedPolling) {
              // if we're not polling for data, it means this test
              // is ok
              done();
            }
          }, 60);
        } else if (handleCount === 2) {
          // oops! we are polling for data, this should not happen.
          startedPolling = true;
          done.fail(new Error('should not start polling, already stopped'));
        }
      });
    });
  });

  describe('resetQueryStoreErrors', () => {
    it("should remove any GraphQLError's stored in the query store", (done) => {
      const graphQLError = new GraphQLError('oh no!');

      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { errors: [graphQLError] },
      });

      observable.subscribe({
        error() {
          const { queryManager } = (observable as any);
          const queryStore = queryManager.queryStore.get(observable.queryId);
          expect(queryStore.graphQLErrors).toEqual([graphQLError]);

          observable.resetQueryStoreErrors();
          expect(queryStore.graphQLErrors).toEqual([]);

          done();
        }
      });
    });

    it("should remove network error's stored in the query store", (done) => {
      const networkError = new Error('oh no!');

      const observable: ObservableQuery<any> = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      });

      observable.subscribe({
        next() {
          const { queryManager } = (observable as any);
          const queryStore = queryManager.queryStore.get(observable.queryId);
          queryStore.networkError = networkError;
          observable.resetQueryStoreErrors();
          expect(queryStore.networkError).toBeNull();
          done();
        }
      });
    });
  });
});
