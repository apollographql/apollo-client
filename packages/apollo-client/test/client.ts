import * as chai from 'chai';
const { assert } = chai;
import * as sinon from 'sinon';
import * as fetchMock from 'fetch-mock';

import ApolloClient, { printAST } from '../src';

import {
  GraphQLError,
  ExecutionResult,
  DocumentNode,
  FragmentDefinitionNode,
} from 'graphql';

import gql from 'graphql-tag';

import { print } from 'graphql/language/printer';

import { NetworkStatus } from '../src/queries/networkStatus';

import { QueryManager } from '../src/core/QueryManager';

import {
  FragmentMatcherInterface,
  IntrospectionFragmentMatcher,
} from '../src/data/fragmentMatcher';

import fragmentMatcherIntrospectionQuery from '../src/data/fragmentMatcherIntrospectionQuery';

import { GraphQLRequest as Request } from 'apollo-link-core';

import { mockSingleLink } from './mocks/mockLinks';

import { getFragmentDefinitions } from '../src/queries/getFromAST';

import { createMockFetch, createMockedIResponse } from './mocks/mockFetch';

import { WatchQueryOptions } from '../src/core/watchQueryOptions';

import subscribeAndCount from './util/subscribeAndCount';

import * as chaiAsPromised from 'chai-as-promised';

import { ApolloError } from '../src/errors/ApolloError';

import { withWarning } from './util/wrap';

import observableToPromise from './util/observableToPromise';

import { cloneDeep, assign, isEqual } from 'lodash';

import { ApolloLink, Observable } from 'apollo-link-core';

import { InMemoryCache } from '../src/data/inMemoryCache';

declare var fetch: any;

// make it easy to assert with promises
chai.use(chaiAsPromised);

describe('client', () => {
  it('does not require any arguments and creates query manager lazily', () => {
    const client = new ApolloClient();

    assert.isUndefined(client.queryManager);

    // We only create the query manager on the first query
    client.initQueryManager();
    assert.isDefined(client.queryManager);
    assert.isDefined(client.queryManager.dataStore.getCache());
  });

  it('can be loaded via require', () => {
    /* tslint:disable */
    const ApolloClientRequire = require('../src').default;
    /* tslint:enable */

    const client = new ApolloClientRequire();

    assert.isUndefined(client.queryManager);

    // We only create the query manager on the first query
    client.initQueryManager();
    assert.isDefined(client.queryManager);
    assert.isDefined(client.queryManager.dataStore.getCache());
  });

  it('can allow passing in a link', () => {
    const link = ApolloLink.empty();
    const client = new ApolloClient({
      link,
    });

    assert.instanceOf(client.link, ApolloLink);
  });

  it('should throw an error if query option is missing or not wrapped with a "gql" tag', () => {
    const client = new ApolloClient();

    assert.throws(() => {
      client.query(
        gql`
          {
            a
          }
        ` as any,
      );
    }, 'query option is required. You must specify your GraphQL document in the query option.');
    assert.throws(() => {
      client.query({ query: '{ a }' } as any);
    }, 'You must wrap the query string in a "gql" tag.');
  });

  it('should throw an error if mutation option is missing', () => {
    const client = new ApolloClient();

    assert.throws(() => {
      client.mutate(
        {
          query: gql`
            {
              a
            }
          `,
        } as any,
      );
    }, 'mutation option is required. You must specify your GraphQL document in the mutation option.');
  });

  it('should allow for a single query to take place', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
            __typename
          }
          __typename
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
            __typename: 'Person',
          },
        ],
        __typename: 'People',
      },
    };

    return clientRoundtrip(query, { data });
  });

  it('should allow a single query with an apollo-link enabled network interface', done => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
            __typename
          }
          __typename
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
            __typename: 'Person',
          },
        ],
        __typename: 'People',
      },
    };

    const variables = { first: 1 };

    const link = ApolloLink.from([() => Observable.of({ data })]);

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const basic = client.query({ query, variables }).then(actualResult => {
      assert.deepEqual(actualResult.data, data);
      done();
    });
  });

  it('should allow for a single query with complex default variables to take place', () => {
    const query = gql`
      query stuff(
        $test: Input = { key1: ["value", "value2"], key2: { key3: 4 } }
      ) {
        allStuff(test: $test) {
          people {
            name
          }
        }
      }
    `;

    const result = {
      allStuff: {
        people: [
          {
            name: 'Luke Skywalker',
          },
          {
            name: 'Jabba The Hutt',
          },
        ],
      },
    };

    const variables = {
      test: { key1: ['value', 'value2'], key2: { key3: 4 } },
    };

    const link = mockSingleLink({
      request: { query, variables },
      result: { data: result },
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const basic = client.query({ query, variables }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });

    const withDefault = client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });

    return Promise.all([basic, withDefault]);
  });

  it('should allow for a single query with default values that get overridden with variables', () => {
    const query = gql`
      query people($first: Int = 1) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    const variables = { first: 1 };
    const override = { first: 2 };

    const result = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const overriddenResult = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
          {
            name: 'Jabba The Hutt',
          },
        ],
      },
    };

    const link = mockSingleLink(
      {
        request: { query, variables },
        result: { data: result },
      },
      {
        request: { query, variables: override },
        result: { data: overriddenResult },
      },
    );

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const basic = client.query({ query, variables }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });

    const withDefault = client.query({ query }).then(actualResult => {
      return assert.deepEqual(actualResult.data, result);
    });

    const withOverride = client
      .query({ query, variables: override })
      .then(actualResult => {
        return assert.deepEqual(actualResult.data, overriddenResult);
      });

    return Promise.all([basic, withDefault, withOverride]);
  });

  it('should allow fragments on root query', () => {
    // The fragment should be used after the selected fields for the query.
    // Otherwise, the results aren't merged.
    // see: https://github.com/apollographql/apollo-client/issues/1479
    const query = gql`
      query {
        records {
          id
          __typename
        }
        ...QueryFragment
      }

      fragment QueryFragment on Query {
        records {
          name
          __typename
        }
        __typename
      }
    `;

    const data = {
      records: [
        { id: 1, name: 'One', __typename: 'Record' },
        { id: 2, name: 'Two', __typename: 'Record' },
      ],
      __typename: 'Query',
    };

    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [
            {
              kind: 'UNION',
              name: 'Query',
              possibleTypes: [
                {
                  name: 'Record',
                },
              ],
            },
          ],
        },
      },
    });

    return clientRoundtrip(query, { data }, null, ifm);
  });

  it('store can be rehydrated from the server', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });

    const initialState: any = {
      data: {
        'ROOT_QUERY.allPeople({"first":"1"}).people.0': {
          name: 'Luke Skywalker',
        },
        'ROOT_QUERY.allPeople({"first":1})': {
          people: [
            {
              type: 'id',
              generated: true,
              id: 'ROOT_QUERY.allPeople({"first":"1"}).people.0',
            },
          ],
        },
        ROOT_QUERY: {
          'allPeople({"first":1})': {
            type: 'id',
            id: 'ROOT_QUERY.allPeople({"first":1})',
            generated: true,
          },
        },
        optimistic: [],
      },
    };

    const finalState = assign({}, initialState, {});

    const client = new ApolloClient({
      link,
      initialState,
      addTypename: false,
    });

    return client.query({ query }).then(result => {
      assert.deepEqual(result.data, data);
      assert.deepEqual(
        finalState.data,
        (client.queryManager.dataStore.getCache() as InMemoryCache).getData(),
      );
    });
  });

  it('should return errors correctly for a single query', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const errors: GraphQLError[] = [
      {
        name: 'test',
        message: 'Syntax Error GraphQL request (8:9) Expected Name, found EOF',
      },
    ];

    const link = mockSingleLink({
      request: { query },
      result: { errors },
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.query({ query }).catch((error: ApolloError) => {
      assert.deepEqual(error.graphQLErrors, errors);
    });
  });

  it('should return GraphQL errors correctly for a single query with an apollo-link enabled network interface', done => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const errors: GraphQLError[] = [
      {
        name: 'test',
        message: 'Syntax Error GraphQL request (8:9) Expected Name, found EOF',
      },
    ];

    const link = ApolloLink.from([
      () => {
        return new Observable(observer => {
          observer.next({ data, errors });
        });
      },
    ]);

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    client.query({ query }).catch((error: ApolloError) => {
      assert.deepEqual(error.graphQLErrors, errors);
      done();
    });
  });

  it('should pass a network error correctly on a query using an observable network interface with a warning', done => {
    withWarning(() => {
      const query = gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `;

      const data = {
        person: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const networkError = new Error('Some kind of network error.');

      const link = ApolloLink.from([
        () => {
          return new Observable(observer => {
            throw networkError;
          });
        },
      ]);

      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      client.query({ query }).catch((error: ApolloError) => {
        assert(error.networkError);
        assert.deepEqual(error.networkError!.message, networkError.message);
        done();
      });
    }, /deprecated/);
  });

  it('should pass a network error correctly on a query with apollo-link network interface', done => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };

    const networkError = new Error('Some kind of network error.');

    const link = ApolloLink.from([
      () => {
        return new Observable(observer => {
          throw networkError;
        });
      },
    ]);

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    client.query({ query }).catch((error: ApolloError) => {
      assert(error.networkError);
      assert.deepEqual(error.networkError!.message, networkError.message);
      done();
    });
  });

  it('should warn when receiving multiple results from apollo-link network interface', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const link = ApolloLink.from([() => Observable.of({ data }, { data })]);

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return withWarning(() => {
      return client.query({ query }).then((result: ExecutionResult) => {
        assert.deepEqual(result.data, data);
      });
    }, /multiple results/);
  });

  it('should surface errors in observer.next as uncaught', done => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      process.removeListener('uncaughtException', handleUncaught);
      process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done(e);
      }
    };
    process.removeListener('uncaughtException', oldHandler);
    process.addListener('uncaughtException', handleUncaught);
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next(result) {
        throw expectedError;
      },
    });
  });

  it('should surfaces errors in observer.error as uncaught', done => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      process.removeListener('uncaughtException', handleUncaught);
      process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done(e);
      }
    };
    process.removeListener('uncaughtException', oldHandler);
    process.addListener('uncaughtException', handleUncaught);

    const query = gql`
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
      result: {},
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });
    handle.subscribe({
      next() {
        done(new Error('did not expect next to be called'));
      },
      error(err) {
        throw expectedError;
      },
    });
  });

  it('should allow for subscribing to a request', done => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next(result) {
        assert.deepEqual(result.data, data);
        done();
      },
    });
  });

  it('should be able to transform queries', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const transformedQuery = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `;

    const result = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const transformedResult = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        __typename: 'Author',
      },
    };

    const link = mockSingleLink(
      {
        request: { query },
        result: { data: result },
      },
      {
        request: { query: transformedQuery },
        result: { data: transformedResult },
      },
    );

    const client = new ApolloClient({
      link,
      addTypename: true,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, transformedResult);
    });
  });

  it('should be able to transform queries on network-only fetches', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const transformedQuery = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `;
    const result = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const transformedResult = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        __typename: 'Author',
      },
    };
    const link = mockSingleLink(
      {
        request: { query },
        result: { data: result },
      },
      {
        request: { query: transformedQuery },
        result: { data: transformedResult },
      },
    );

    const client = new ApolloClient({
      link,
      addTypename: true,
    });

    return client
      .query({ fetchPolicy: 'network-only', query })
      .then(actualResult => {
        assert.deepEqual(actualResult.data, transformedResult);
      });
  });

  it('should handle named fragments on mutations', () => {
    const mutation = gql`
      mutation {
        starAuthor(id: 12) {
          author {
            __typename
            ...authorDetails
          }
        }
      }

      fragment authorDetails on Author {
        firstName
        lastName
      }
    `;
    const result = {
      starAuthor: {
        author: {
          __typename: 'Author',
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    };
    const link = mockSingleLink({
      request: { query: mutation },
      result: { data: result },
    });
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.mutate({ mutation }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle named fragments on network-only queries', () => {
    const query = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }

      query {
        author {
          __typename
          ...authorDetails
        }
      }
    `;
    const result = {
      author: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client
      .query({ fetchPolicy: 'network-only', query })
      .then(actualResult => {
        assert.deepEqual(actualResult.data, result);
      });
  });

  it('should be able to handle named fragments with multiple fragments', () => {
    const query = gql`
      query {
        author {
          __typename
          ...authorDetails
          ...moreDetails
        }
      }

      fragment authorDetails on Author {
        firstName
        lastName
      }

      fragment moreDetails on Author {
        address
      }
    `;
    const result = {
      author: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
        address: '1337 10th St.',
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle named fragments', () => {
    const query = gql`
      query {
        author {
          __typename
          ...authorDetails
        }
      }

      fragment authorDetails on Author {
        firstName
        lastName
      }
    `;
    const result = {
      author: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
      },
    };

    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle inlined fragments on an Interface type', () => {
    const query = gql`
      query items {
        items {
          ...ItemFragment
          __typename
        }
      }

      fragment ItemFragment on Item {
        id
        __typename
        ... on ColorItem {
          color
          __typename
        }
      }
    `;
    const result = {
      items: [
        {
          __typename: 'ColorItem',
          id: '27tlpoPeXm6odAxj3paGQP',
          color: 'red',
        },
        {
          __typename: 'MonochromeItem',
          id: '1t3iFLsHBm4c4RjOMdMgOO',
        },
      ],
    };

    const fancyFragmentMatcher = (
      idValue: any, // TODO types, please.
      typeCondition: string,
      context: any,
    ): boolean => {
      const obj = context.store[idValue.id];

      if (!obj) {
        return false;
      }

      const implementingTypesMap: { [key: string]: string[] } = {
        Item: ['ColorItem', 'MonochromeItem'],
      };

      if (obj.__typename === typeCondition) {
        return true;
      }

      const implementingTypes = implementingTypesMap[typeCondition];
      if (implementingTypes && implementingTypes.indexOf(obj.__typename) > -1) {
        return true;
      }

      return false;
    };

    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      link,
      fragmentMatcher: {
        match: fancyFragmentMatcher,
      },
    });
    return client.query({ query }).then((actualResult: any) => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle inlined fragments on an Interface type with introspection fragment matcher', () => {
    const query = gql`
      query items {
        items {
          ...ItemFragment
          __typename
        }
      }

      fragment ItemFragment on Item {
        id
        ... on ColorItem {
          color
          __typename
        }
        __typename
      }
    `;
    const result = {
      items: [
        {
          __typename: 'ColorItem',
          id: '27tlpoPeXm6odAxj3paGQP',
          color: 'red',
        },
        {
          __typename: 'MonochromeItem',
          id: '1t3iFLsHBm4c4RjOMdMgOO',
        },
      ],
    };

    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });

    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [
            {
              kind: 'UNION',
              name: 'Item',
              possibleTypes: [
                {
                  name: 'ColorItem',
                },
                {
                  name: 'MonochromeItem',
                },
              ],
            },
          ],
        },
      },
    });

    const client = new ApolloClient({
      link,
      fragmentMatcher: ifm,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should call updateQueries and update after mutation on query with inlined fragments on an Interface type', done => {
    const query = gql`
      query items {
        items {
          ...ItemFragment
          __typename
        }
      }

      fragment ItemFragment on Item {
        id
        ... on ColorItem {
          color
          __typename
        }
        __typename
      }
    `;
    const result = {
      items: [
        {
          __typename: 'ColorItem',
          id: '27tlpoPeXm6odAxj3paGQP',
          color: 'red',
        },
        {
          __typename: 'MonochromeItem',
          id: '1t3iFLsHBm4c4RjOMdMgOO',
        },
      ],
    };

    const mutation = gql`
      mutation myMutationName {
        fortuneCookie
      }
    `;
    const mutationResult = {
      fortuneCookie: 'The waiter spit in your food',
    };

    const link = mockSingleLink(
      {
        request: { query },
        result: { data: result },
      },
      {
        request: { query: mutation },
        result: { data: mutationResult },
      },
    );

    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [
            {
              kind: 'UNION',
              name: 'Item',
              possibleTypes: [
                {
                  name: 'ColorItem',
                },
                {
                  name: 'MonochromeItem',
                },
              ],
            },
          ],
        },
      },
    });

    const client = new ApolloClient({
      link,
      fragmentMatcher: ifm,
    });

    const queryUpdaterSpy = sinon.spy();
    const queryUpdater = (prev: any) => {
      queryUpdaterSpy();
      return prev;
    };
    const updateQueries = {
      items: queryUpdater,
    };

    const updateSpy = sinon.spy();

    const obs = client.watchQuery({ query });

    const sub = obs.subscribe({
      next() {
        client
          .mutate({ mutation, updateQueries, update: updateSpy })
          .then(() => {
            assert.isTrue(queryUpdaterSpy.called);
            assert.isTrue(updateSpy.called);
            sub.unsubscribe();
            done();
          })
          .catch(err => {
            done(err);
          });
      },
      error(err) {
        done(err);
      },
    });
  });

  it('should send operationName along with the query to the server', () => {
    const query = gql`
      query myQueryName {
        fortuneCookie
      }
    `;
    const data = {
      fortuneCookie: 'The waiter spit in your food',
    };
    const link = ApolloLink.from([
      request => {
        assert.equal(request.operationName, 'myQueryName');
        return Observable.of({ data });
      },
    ]);
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, data);
    });
  });

  it('should send operationName along with the mutation to the server', () => {
    const mutation = gql`
      mutation myMutationName {
        fortuneCookie
      }
    `;
    const data = {
      fortuneCookie: 'The waiter spit in your food',
    };
    const link = ApolloLink.from([
      request => {
        assert.equal(request.operationName, 'myMutationName');
        return Observable.of({ data });
      },
    ]);
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    return client.mutate({ mutation }).then(actualResult => {
      assert.deepEqual(actualResult.data, data);
    });
  });

  it('does not deduplicate queries if option is set to false', () => {
    const queryDoc = gql`
      query {
        author {
          name
        }
      }
    `;
    const data = {
      author: {
        name: 'Jonas',
      },
    };
    const data2 = {
      author: {
        name: 'Dhaivat',
      },
    };

    // we have two responses for identical queries, but only the first should be requested.
    // the second one should never make it through to the network interface.
    const link = mockSingleLink(
      {
        request: { query: queryDoc },
        result: { data },
        delay: 10,
      },
      {
        request: { query: queryDoc },
        result: { data: data2 },
      },
    );
    const client = new ApolloClient({
      link,
      addTypename: false,
      queryDeduplication: false,
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication happened, result2.data will equal data.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      assert.deepEqual(result1.data, data);
      assert.deepEqual(result2.data, data2);
    });
  });

  it('deduplicates queries by default', () => {
    const queryDoc = gql`
      query {
        author {
          name
        }
      }
    `;
    const data = {
      author: {
        name: 'Jonas',
      },
    };
    const data2 = {
      author: {
        name: 'Dhaivat',
      },
    };

    // we have two responses for identical queries, but only the first should be requested.
    // the second one should never make it through to the network interface.
    const link = mockSingleLink(
      {
        request: { query: queryDoc },
        result: { data },
        delay: 10,
      },
      {
        request: { query: queryDoc },
        result: { data: data2 },
      },
    );
    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication didn't happen, result.data will equal data2.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      assert.deepEqual(result1.data, result2.data);
    });
  });

  describe('deprecated options', () => {
    const query = gql`
      query people {
        name
      }
    `;

    it('errors when returnPartialData is used on query', () => {
      const client = new ApolloClient();
      assert.throws(() => {
        client.query({ query, returnPartialData: true } as WatchQueryOptions);
      }, /returnPartialData/);
    });

    it('errors when returnPartialData is used on watchQuery', () => {
      const client = new ApolloClient();
      assert.throws(() => {
        client.query({ query, returnPartialData: true } as WatchQueryOptions);
      }, /returnPartialData/);
    });
  });

  describe('accepts dataIdFromObject option', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            id
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            id: '1',
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    it('for internal store', () => {
      const link = mockSingleLink({
        request: { query },
        result: { data },
      });

      const client = new ApolloClient({
        link,
        dataIdFromObject: (obj: { id: any }) => obj.id,
        addTypename: false,
      });

      return client.query({ query }).then(result => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(
          (client.queryManager.dataStore.getCache() as InMemoryCache).getData()[
            '1'
          ],
          {
            id: '1',
            name: 'Luke Skywalker',
          },
        );
      });
    });
  });

  describe('cache-and-network fetchPolicy', () => {
    const query = gql`
      query number {
        myNumber {
          n
        }
      }
    `;

    const initialData = {
      myNumber: {
        n: 1,
      },
    };
    const networkFetch = {
      myNumber: {
        n: 2,
      },
    };

    // Test that cache-and-network can only be used on watchQuery, not query.
    it('errors when being used on query', () => {
      const client = new ApolloClient();
      assert.throws(() => {
        client.query({ query, fetchPolicy: 'cache-and-network' });
      });
    });

    it('fetches from cache first, then network', done => {
      const link = mockSingleLink({
        request: { query },
        result: { data: networkFetch },
      });
      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      client.writeQuery({
        query,
        data: initialData,
      });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, initialData);
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, networkFetch);
          done();
        }
      });
    });

    it('does not fail if cache entry is not present', done => {
      const link = mockSingleLink({
        request: { query },
        result: { data: networkFetch },
      });
      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          assert.equal(result.data, undefined);
          assert(result.loading);
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, networkFetch);
          assert(!result.loading);
          done();
        }
      });
    });

    it('fails if network request fails', done => {
      const link = mockSingleLink(); // no queries = no replies.
      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      let count = 0;
      obs.subscribe({
        next: result => {
          assert.equal(result.data, undefined);
          assert(result.loading);
          count++;
        },
        error: e => {
          assert.match(e.message, /No more mocked responses/);
          assert.equal(count, 1); // make sure next was called.
          done();
        },
      });
    });
  });

  describe('standby queries', () => {
    // XXX queries can only be set to standby by setOptions. This is simply out of caution,
    // not some fundamental reason. We just want to make sure they're not used in unanticipated ways.
    // If there's a good use-case, the error and test could be removed.
    it('cannot be started with watchQuery or query', () => {
      const client = new ApolloClient();
      assert.throws(
        () =>
          client.watchQuery({
            query: gql`
              {
                abc
              }
            `,
            fetchPolicy: 'standby',
          }),
        'client.watchQuery cannot be called with fetchPolicy set to "standby"',
      );
    });

    it('are not watching the store or notifying on updates', done => {
      const query = gql`
        {
          test
        }
      `;
      const data = { test: 'ok' };
      const data2 = { test: 'not ok' };

      const link = mockSingleLink({
        request: { query },
        result: { data },
      });

      const client = new ApolloClient({ link });

      const obs = client.watchQuery({ query, fetchPolicy: 'cache-first' });

      let handleCalled = false;
      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, data);
          obs.setOptions({ fetchPolicy: 'standby' }).then(() => {
            client.writeQuery({ query, data: data2 });
            // this write should be completely ignored by the standby query
          });
          setTimeout(() => {
            if (!handleCalled) {
              done();
            }
          }, 20);
        }
        if (handleCount === 2) {
          handleCalled = true;
          done(new Error('Handle should never be called on standby query'));
        }
      });
    });

    it('return the current result when coming out of standby', done => {
      const query = gql`
        {
          test
        }
      `;
      const data = { test: 'ok' };
      const data2 = { test: 'not ok' };

      const link = mockSingleLink({
        request: { query },
        result: { data },
      });

      const client = new ApolloClient({ link });

      const obs = client.watchQuery({ query, fetchPolicy: 'cache-first' });

      let handleCalled = false;
      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          assert.deepEqual(result.data, data);
          obs.setOptions({ fetchPolicy: 'standby' }).then(() => {
            client.writeQuery({ query, data: data2 });
            // this write should be completely ignored by the standby query
            setTimeout(() => {
              obs.setOptions({ fetchPolicy: 'cache-first' });
            }, 10);
          });
        }
        if (handleCount === 2) {
          handleCalled = true;
          assert.deepEqual(result.data, data2);
          done();
        }
      });
    });
  });

  describe('network-only fetchPolicy', () => {
    const query = gql`
      query number {
        myNumber {
          n
        }
      }
    `;

    const firstFetch = {
      myNumber: {
        n: 1,
      },
    };
    const secondFetch = {
      myNumber: {
        n: 2,
      },
    };

    let link: any;
    let clock: any;
    beforeEach(() => {
      link = mockSingleLink(
        {
          request: { query },
          result: { data: firstFetch },
        },
        {
          request: { query },
          result: { data: secondFetch },
        },
      );
    });

    afterEach(() => {
      if (clock) {
        clock.restore();
      }
    });

    it('forces the query to rerun', () => {
      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      // Run a query first to initialize the store
      return (
        client
          .query({ query })
          // then query for real
          .then(() => client.query({ query, fetchPolicy: 'network-only' }))
          .then(result => {
            assert.deepEqual<{}>(result.data, { myNumber: { n: 2 } });
          })
      );
    });

    it('can be disabled with ssrMode', () => {
      const client = new ApolloClient({
        link,
        ssrMode: true,
        addTypename: false,
      });

      const options: WatchQueryOptions = { query, fetchPolicy: 'network-only' };

      // Run a query first to initialize the store
      return (
        client
          .query({ query })
          // then query for real
          .then(() => client.query(options))
          .then(result => {
            assert.deepEqual<{}>(result.data, { myNumber: { n: 1 } });

            // Test that options weren't mutated, issue #339
            assert.deepEqual<WatchQueryOptions>(options, {
              query,
              fetchPolicy: 'network-only',
            });
          })
      );
    });

    it('can temporarily be disabled with ssrForceFetchDelay', () => {
      clock = sinon.useFakeTimers();

      const client = new ApolloClient({
        link,
        ssrForceFetchDelay: 100,
        addTypename: false,
      });

      // Run a query first to initialize the store
      const outerPromise = client
        .query({ query })
        // then query for real
        .then(() => {
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          clock.tick(0);
          return promise;
        })
        .then(result => {
          assert.deepEqual<{}>(result.data, { myNumber: { n: 1 } });
          clock.tick(100);
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          clock.tick(0);
          return promise;
        })
        .then(result => {
          assert.deepEqual<{}>(result.data, { myNumber: { n: 2 } });
        });
      clock.tick(0);
      return outerPromise;
    });
  });

  it('should expose a method called printAST that is prints graphql queries', () => {
    const query = gql`
      query {
        fortuneCookie
      }
    `;

    assert.equal(printAST(query), print(query));
  });

  it('should pass a network error correctly on a mutation', done => {
    const mutation = gql`
      mutation {
        person {
          firstName
          lastName
        }
      }
    `;
    const data = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const networkError = new Error('Some kind of network error.');
    const client = new ApolloClient({
      link: mockSingleLink({
        request: { query: mutation },
        result: { data },
        error: networkError,
      }),
      addTypename: false,
    });

    client
      .mutate({ mutation })
      .then(result => {
        done(new Error('Returned a result when it should not have.'));
      })
      .catch((error: ApolloError) => {
        assert(error.networkError);
        assert.equal(error.networkError!.message, networkError.message);
        done();
      });
  });

  it('should pass a GraphQL error correctly on a mutation', done => {
    const mutation = gql`
      mutation {
        newPerson {
          person {
            firstName
            lastName
          }
        }
      }
    `;
    const data = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const errors = [new Error('Some kind of GraphQL error.')];
    const client = new ApolloClient({
      link: mockSingleLink({
        request: { query: mutation },
        result: { data, errors },
      }),
      addTypename: false,
    });
    client
      .mutate({ mutation })
      .then(result => {
        done(new Error('Returned a result when it should not have.'));
      })
      .catch((error: ApolloError) => {
        assert(error.graphQLErrors);
        assert.equal(error.graphQLErrors.length, 1);
        assert.equal(error.graphQLErrors[0].message, errors[0].message);
        done();
      });
  });

  it('should rollback optimistic after mutation got a GraphQL error', done => {
    const mutation = gql`
      mutation {
        newPerson {
          person {
            firstName
            lastName
          }
        }
      }
    `;
    const data = {
      newPerson: {
        person: {
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    };
    const errors = [new Error('Some kind of GraphQL error.')];
    const client = new ApolloClient({
      link: mockSingleLink({
        request: { query: mutation },
        result: { data, errors },
      }),
      addTypename: false,
    });
    const mutatePromise = client.mutate({
      mutation,
      optimisticResponse: {
        newPerson: {
          person: {
            firstName: 'John*',
            lastName: 'Smith*',
          },
        },
      },
    });
    assert.equal(
      (client.queryManager.dataStore.getCache() as any).optimistic.length,
      1,
    );
    mutatePromise
      .then(result => {
        done(new Error('Returned a result when it should not have.'));
      })
      .catch((error: ApolloError) => {
        assert.equal(
          (client.queryManager.dataStore.getCache() as any).optimistic.length,
          0,
        );
        done();
      });
  });

  it('has a resetStore method which calls QueryManager', done => {
    const client = new ApolloClient();
    client.queryManager = {
      resetStore: () => {
        done();
      },
    } as QueryManager;
    client.resetStore();
  });

  it('should enable dev tools logging', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    it('with self-made store', () => {
      const link = mockSingleLink({
        request: { query: cloneDeep(query) },
        result: { data },
      });

      const client = new ApolloClient({
        link,
        addTypename: false,
      });

      const log: any[] = [];
      client.__actionHookForDevTools((entry: any) => {
        log.push(entry);
      });

      return client.query({ query }).then(() => {
        assert.equal(log.length, 2);
        assert.equal(log[1].state.queries['0'].loading, false);
      });
    });
  });

  it('should propagate errors from network interface to observers', done => {
    const link = ApolloLink.from([
      () =>
        new Observable(x => {
          x.error(new Error('Uh oh!'));
          return;
        }),
    ]);

    const client = new ApolloClient({
      link,
      addTypename: false,
    });

    const handle = client.watchQuery({
      query: gql`
        query {
          a
          b
          c
        }
      `,
    });

    handle.subscribe({
      error(error) {
        assert.equal(error.message, 'Network error: Uh oh!');
        done();
      },
    });
  });

  it('should throw a GraphQL error', () => {
    const query = gql`
      query {
        posts {
          foo
          __typename
        }
      }
    `;
    const errors: GraphQLError[] = [
      {
        name: 'test',
        message: 'Cannot query field "foo" on type "Post".',
      },
    ];
    const link = mockSingleLink({
      request: { query },
      result: { errors },
    });
    const client = new ApolloClient({
      link,
    });

    return client.query({ query }).catch(err => {
      assert.equal(
        err.message,
        'GraphQL error: Cannot query field "foo" on type "Post".',
      );
    });
  });

  it('should warn if server returns wrong data', () => {
    const query = gql`
      query {
        todos {
          id
          name
          description
          __typename
        }
      }
    `;
    const result = {
      data: {
        todos: [
          {
            id: '1',
            name: 'Todo 1',
            price: 100,
            __typename: 'Todo',
          },
        ],
      },
    };
    const link = mockSingleLink({
      request: { query },
      result,
    });
    const client = new ApolloClient({
      link,
    });

    return withWarning(
      () => client.query({ query }),
      /Missing field description/,
    );
  });

  it('runs a query with the connection directive and writes it to the store key defined in the directive', () => {
    const query = gql`
      {
        books(skip: 0, limit: 2) @connection(key: "abc") {
          name
        }
      }
    `;

    const transformedQuery = gql`
      {
        books(skip: 0, limit: 2) @connection(key: "abc") {
          name
          __typename
        }
      }
    `;

    const result = {
      books: [
        {
          name: 'abcd',
          __typename: 'Book',
        },
      ],
    };

    const link = mockSingleLink({
      request: { query: transformedQuery },
      result: { data: result },
    });

    const client = new ApolloClient({
      link,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should not remove the connection directive at the store level', () => {
    const query = gql`
      {
        books(skip: 0, limit: 2) @connection {
          name
        }
      }
    `;

    const transformedQuery = gql`
      {
        books(skip: 0, limit: 2) @connection {
          name
          __typename
        }
      }
    `;

    const result = {
      books: [
        {
          name: 'abcd',
          __typename: 'Book',
        },
      ],
    };

    const link = mockSingleLink({
      request: { query: transformedQuery },
      result: { data: result },
    });

    const client = new ApolloClient({
      link,
    });

    return client.query({ query }).then(actualResult => {
      assert.deepEqual(actualResult.data, result);
    });
  });
});

it('should run a query with the connection directive and write the result to the store key defined in the directive', () => {
  const query = gql`
    {
      books(skip: 0, limit: 2) @connection(key: "abc") {
        name
      }
    }
  `;

  const transformedQuery = gql`
    {
      books(skip: 0, limit: 2) @connection(key: "abc") {
        name
        __typename
      }
    }
  `;

  const result = {
    books: [
      {
        name: 'abcd',
        __typename: 'Book',
      },
    ],
  };

  const link = mockSingleLink({
    request: { query: transformedQuery },
    result: { data: result },
  });

  const client = new ApolloClient({
    link,
  });

  return client.query({ query }).then(actualResult => {
    assert.deepEqual(actualResult.data, result);
    assert.deepEqual(
      (client.queryManager.dataStore.getCache() as InMemoryCache).getData(),
      {
        'ROOT_QUERY.abc.0': { name: 'abcd', __typename: 'Book' },
        ROOT_QUERY: {
          abc: [
            {
              generated: true,
              id: 'ROOT_QUERY.abc.0',
              type: 'id',
            },
          ],
        },
      },
    );
  });
});

it('should run a query with the connection directive and filter arguments and write the result to the correct store key', () => {
  const query = gql`
    query books($order: string) {
      books(skip: 0, limit: 2, order: $order)
        @connection(key: "abc", filter: ["order"]) {
        name
        __typename
      }
    }
  `;

  const result = {
    books: [
      {
        name: 'abcd',
        __typename: 'Book',
      },
    ],
  };

  const variables = { order: 'popularity' };

  const link = mockSingleLink({
    request: { query: query, variables },
    result: { data: result },
  });

  const client = new ApolloClient({
    link,
  });

  return client.query({ query, variables }).then(actualResult => {
    assert.deepEqual(actualResult.data, result);
    assert.deepEqual(
      (client.queryManager.dataStore.getCache() as InMemoryCache).getData(),
      {
        'ROOT_QUERY.abc({"order":"popularity"}).0': {
          name: 'abcd',
          __typename: 'Book',
        },
        ROOT_QUERY: {
          'abc({"order":"popularity"})': [
            {
              generated: true,
              id: 'ROOT_QUERY.abc({"order":"popularity"}).0',
              type: 'id',
            },
          ],
        },
      },
    );
  });
});

function clientRoundtrip(
  query: DocumentNode,
  data: ExecutionResult,
  variables?: any,
  fragmentMatcher?: FragmentMatcherInterface,
) {
  const link = mockSingleLink({
    request: { query: cloneDeep(query) },
    result: data,
  });

  const client = new ApolloClient({
    link,
    fragmentMatcher,
  });

  return client.query({ query, variables }).then(result => {
    assert.deepEqual(result.data, data.data);
  });
}
