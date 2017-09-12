import gql from 'graphql-tag';
import { ApolloLink, Observable } from 'apollo-link-core';
import InMemoryCache, {
  IntrospectionFragmentMatcher,
} from 'apollo-cache-inmemory';

import mockQueryManager from '../../__mocks__/mockQueryManager';
import mockWatchQuery from '../../__mocks__/mockWatchQuery';
import { mockSingleLink } from '../../__mocks__/mockLinks';

import { ObservableQuery, ApolloCurrentResult } from '../ObservableQuery';
import { NetworkStatus } from '../networkStatus';
import { ApolloQueryResult } from '../types';
import { QueryManager } from '../QueryManager';
import { DataStore } from '../../data/store';
import ApolloClient from '../../';

import wrap from '../../util/wrap';
import subscribeAndCount from '../../util/subscribeAndCount';

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
      store: new DataStore(new InMemoryCache({ addTypename: false })),
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
            expect(result.data).toEqual(dataOne);
            observable.setOptions({ pollInterval: 10 });
            // 10 for the poll and an extra 1 for network requests
            jest.runTimersToTime(11);
          } else if (handleCount === 2) {
            expect(result.data).toEqual(dataTwo);
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
            expect(result.data).toEqual(dataOne);
            observable.setOptions({ pollInterval: 0 });

            // big number just to be sure
            jest.runTimersToTime(100);
            done();
          } else if (handleCount === 2) {
            done(new Error('Should not get more than one result'));
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
            expect(result.data).toEqual(dataOne);

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
            expect(result.data).toEqual(dataTwo);
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
          request: { query: queryWithVars, variables: variables1 },
          result: { data },
        },
        {
          request: { query: queryWithVars, variables: variables2 },
          result: { data: data2 },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toEqual(data);
          observable.refetch(variables2);
        } else if (handleCount === 3) {
          // 3 because there is an intermediate loading state
          expect(result.data).toEqual(data2);
          done();
        }
      });
    });

    it('if query is refetched, and an error is returned, no other observer callbacks will be called', done => {
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
            expect(result.data).toEqual(dataOne);
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
          expect(result.data).toEqual(dataOne);
          observable.setOptions({ fetchPolicy: 'network-only' });
        } else if (handleCount === 2) {
          expect(result.data).toEqual(dataTwo);
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
      observable = queryManager.watchQuery({ query: testQuery });

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toEqual(data);
          expect(timesFired).toBe(1);

          setTimeout(() => {
            observable.setOptions({ fetchPolicy: 'cache-only' });

            queryManager.resetStore();
          }, 0);
        } else if (handleCount === 2) {
          expect(result.data).toEqual({});
          expect(timesFired).toBe(1);

          setTimeout(() => {
            observable.setOptions({ fetchPolicy: 'cache-first' });
          }, 0);
        } else if (handleCount === 3) {
          expect(result.data).toEqual(data);
          expect(timesFired).toBe(2);

          done();
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

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 2) {
          expect(result.data).toEqual({});
          expect(timesFired).toBe(0);

          setTimeout(() => {
            observable.setOptions({ fetchPolicy: 'cache-first' });
          }, 0);
        } else if (handleCount === 3) {
          expect(result.data).toEqual(data);
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

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toEqual(data);
          expect(timesFired).toBe(1);

          setTimeout(() => {
            observable.setOptions({ fetchPolicy: 'standby' });
          }, 0);
          setTimeout(() => {
            // make sure the query didn't get fired again.
            expect(timesFired).toBe(1);
            done();
          }, 20);
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

        subscribeAndCount(done, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(timesFired).toBe(1);
            setTimeout(() => {
              observable.setOptions({ fetchPolicy: 'standby' });
            }, 0);
            setTimeout(() => {
              // make sure the query didn't get fired again.
              expect(timesFired).toBe(1);
              done();
            }, 20);
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
            expect(res.data).toEqual(dataOne);
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
          expect(result.data).toEqual(dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.data).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual(dataTwo);
          done();
        }
      });
    });

    it('returns results that are frozen in development mode', done => {
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
      const nop = () => {
        return 1;
      };
      const sub = observable.subscribe({ next: nop });

      observable.setVariables(differentVariables).then(result2 => {
        expect(result2.data).toEqual(dataTwo);
        try {
          (result2.data as any).stuff = 'awful';
          done(
            new Error(
              'results from setVariables should be frozen in development mode',
            ),
          );
        } catch (e) {
          done();
        } finally {
          sub.unsubscribe();
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
          expect(result.data).toEqual(dataOne);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          expect(result.data).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(result.data).toEqual(dataTwo);
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
          expect(result.data).toEqual(dataOne);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          observable.refetch(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          expect(result.data).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(result.data).toEqual(dataTwo);
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
          expect(result.data).toEqual(dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.data).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.data).toEqual(dataOne);
          done();
        }
      });
    });

    it('reruns observer callback if the variables change and change back', done => {
      const observable: ObservableQuery<any> = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        },
        {
          request: { query, variables },
          result: { data: dataOne },
        },
      );

      subscribeAndCount(done, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toEqual(dataOne);
          observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.data).toEqual(dataOne);
        } else if (handleCount === 3) {
          expect(result.data).toEqual(dataTwo);
          observable.setVariables(variables);
        } else if (handleCount === 4) {
          expect(result.data).toEqual(dataOne);
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
            expect(result.data).toEqual(dataOne);
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
          expect(result.data).toEqual(dataOne);
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
          expect(result.data).toEqual(dataOne);
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
          expect(result.data).toEqual(dataTwo);
          done();
        }
      });
    });
  });

  describe('currentResult', () => {
    it('returns the same value as observableQuery.next got', done => {
      const queryWithFragment = gql`
        fragment MaleInfo on Man {
          trouserSize
          __typename
        }

        fragment FemaleInfo on Woman {
          skirtSize
          __typename
        }

        fragment PersonInfo on Person {
          id
          name
          sex
          ... on Man {
            ...MaleInfo
            __typename
          }
          ... on Woman {
            ...FemaleInfo
            __typename
          }
          __typename
        }

        {
          people {
            ...PersonInfo
            __typename
          }
        }
      `;

      const peopleData = [
        {
          id: 1,
          name: 'John Smith',
          sex: 'male',
          trouserSize: 6,
          __typename: 'Man',
        },
        {
          id: 2,
          name: 'Sara Smith',
          sex: 'female',
          skirtSize: 4,
          __typename: 'Woman',
        },
        {
          id: 3,
          name: 'Budd Deey',
          sex: 'male',
          trouserSize: 10,
          __typename: 'Man',
        },
      ];

      const dataOneWithTypename = {
        people: peopleData.slice(0, 2),
      };

      const dataTwoWithTypename = {
        people: peopleData.slice(0, 3),
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
                    possibleTypes: [{ name: 'Person' }],
                  },
                ],
              },
            },
          }).match,
        }),
      });

      const observable = client.watchQuery({
        query: queryWithFragment,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(done, observable, (count, result) => {
        const { data, loading, networkStatus } = observable.currentResult();
        try {
          expect(result).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });
        } catch (e) {
          done(e);
        }

        if (count === 1) {
          observable.refetch();
        }
        if (count === 3) {
          setTimeout(done, 5);
        }
        if (count > 3) {
          done(new Error('Observable.next called too many times'));
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
        expect(observable.currentResult()).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: 7,
          partial: false,
        });
        done();
      });

      expect(observable.currentResult()).toEqual({
        loading: true,
        data: {},
        networkStatus: 1,
        partial: true,
      });
      setTimeout(
        wrap(done, () => {
          expect(observable.currentResult()).toEqual({
            loading: true,
            data: {},
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
        expect(result).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: 7,
          stale: false,
        });
        const observable = queryManager.watchQuery({
          query,
          variables,
        });
        expect(observable.currentResult()).toEqual({
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

      return observable.result().catch((theError: any) => {
        expect(theError.graphQLErrors).toEqual([error]);

        const currentResult = observable.currentResult();
        expect(currentResult.loading).toBe(false);
        expect(currentResult.error!.graphQLErrors).toEqual([error]);
      });
    });

    it('returns errors with data if errorPolicy is all', () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: 'all',
      });

      return observable.result().then(result => {
        expect(result.data).toBeUndefined();
        expect(result.errors).toEqual([error]);
        const currentResult = observable.currentResult();
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
        expect(result.data).toEqual(dataOne);
        expect(result.errors).toBeUndefined();
        const currentResult = observable.currentResult();
        expect(currentResult.loading).toBe(false);
        expect(currentResult.errors).toBeUndefined();
        expect(currentResult.error).toBeUndefined();
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
        expect(observable.currentResult()).toEqual({
          data: dataOne,
          loading: true,
          networkStatus: 1,
          partial: false,
        });

        subscribeAndCount(done, observable, (handleCount, subResult) => {
          const { data, loading, networkStatus } = observable.currentResult();
          expect(subResult).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (handleCount === 2) {
            expect(subResult).toEqual({
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
          const { data, loading, networkStatus } = observable.currentResult();
          expect(result).toEqual({
            data,
            loading,
            networkStatus,
            stale: false,
          });

          if (count === 1) {
            expect(result).toEqual({
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
            expect(result.data.people_one).toEqual(optimisticResponse);
          } else if (count === 3) {
            expect(result.data.people_one).toEqual(mutationData);
            done();
          }
        });
      });
    });
  });

  describe('stopPolling', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
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

      observable.startPolling(100);
      observable.stopPolling();

      let startedPolling = false;
      subscribeAndCount(done, observable, handleCount => {
        if (handleCount === 1) {
          // first call to subscribe is the immediate result when
          // subscribing. later calls to this callback indicate that
          // we will be polling.

          jest.runTimersToTime(101);

          // Wait a bit to see if the subscription's `next` was called
          // again, indicating that we are polling for data.
          setImmediate(() => {
            if (!startedPolling) {
              // if we're not polling for data, it means this test
              // is ok
              done();
            }
          });
        } else if (handleCount === 2) {
          // oops! we are polling for data, this should not happen.
          startedPolling = true;
          done(new Error('should not start polling, already stopped'));
        }
      });

      // trigger the first subscription callback
      jest.runTimersToTime(1);
    });
  });
});
