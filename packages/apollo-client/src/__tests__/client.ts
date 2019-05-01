import { cloneDeep, assign } from 'lodash';
import { GraphQLError, ExecutionResult, DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { ApolloLink, Observable } from 'apollo-link';
import {
  InMemoryCache,
  IntrospectionFragmentMatcher,
  FragmentMatcherInterface,
} from 'apollo-cache-inmemory';
import { stripSymbols } from 'apollo-utilities';

import { QueryManager } from '../core/QueryManager';
import { WatchQueryOptions, FetchPolicy } from '../core/watchQueryOptions';

import { ApolloError } from '../errors/ApolloError';

import ApolloClient, { printAST } from '..';

import subscribeAndCount from '../util/subscribeAndCount';
import { withWarning } from '../util/wrap';

import { mockSingleLink } from '../__mocks__/mockLinks';

describe('client', () => {
  it('can be loaded via require', () => {
    /* tslint:disable */
    const ApolloClientRequire = require('../').default;
    /* tslint:enable */

    const client = new ApolloClientRequire({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    expect(client.queryManager).toBeDefined();
    expect(client.cache).toBeDefined();
  });

  it('can allow passing in a link', () => {
    const link = ApolloLink.empty();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    expect(client.link).toBeInstanceOf(ApolloLink);
  });

  it('should throw an error if query option is missing or not wrapped with a "gql" tag', () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    expect(() => {
      client.query(gql`
        {
          a
        }
      ` as any);
    }).toThrowError(
      'query option is required. You must specify your GraphQL document in the query option.',
    );
    expect(() => {
      client.query({ query: '{ a }' } as any);
    }).toThrowError('You must wrap the query string in a "gql" tag.');
  });

  it('should throw an error if mutation option is missing', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    return await expect(
      client.mutate({
        query: gql`
          {
            a
          }
        `,
      } as any),
    ).rejects.toThrow(
      'mutation option is required. You must specify your GraphQL document in the mutation option.',
    );
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    client.query({ query, variables }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(data);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const basic = client.query({ query, variables }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
    });

    const withDefault = client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const basic = client.query({ query, variables }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
    });

    const withDefault = client.query({ query }).then(actualResult => {
      return expect(stripSymbols(actualResult.data)).toEqual(result);
    });

    const withOverride = client
      .query({ query, variables: override })
      .then(actualResult => {
        return expect(stripSymbols(actualResult.data)).toEqual(
          overriddenResult,
        );
      });

    return Promise.all([basic, withDefault, withOverride]);
  });

  it('should allow fragments on root query', () => {
    const query = gql`
      query {
        ...QueryFragment
      }

      fragment QueryFragment on Query {
        records {
          id
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

    return clientRoundtrip(query, { data }, null);
  });

  it('should allow fragments on root query with ifm', () => {
    const query = gql`
      query {
        ...QueryFragment
      }

      fragment QueryFragment on Query {
        records {
          id
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

  it('should merge fragments on root query', () => {
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
      cache: new InMemoryCache({ addTypename: false }).restore(
        initialState.data,
      ),
    });

    return client.query({ query }).then(result => {
      expect(stripSymbols(result.data)).toEqual(data);
      expect(finalState.data).toEqual(
        (client.cache as InMemoryCache).extract(),
      );
    });
  });

  it('store can be rehydrated from the server using the shadow method', () => {
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
      cache: new InMemoryCache({ addTypename: false }).restore(
        initialState.data,
      ),
    });

    return client.query({ query }).then(result => {
      expect(stripSymbols(result.data)).toEqual(data);
      expect(finalState.data).toEqual(client.extract());
    });
  });

  it('stores shadow of restore returns the same result as accessing the method directly on the cache', () => {
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

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }).restore(
        initialState.data,
      ),
    });

    expect(client.restore(initialState.data)).toEqual(
      client.cache.restore(initialState.data),
    );
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).catch((error: ApolloError) => {
      expect(error.graphQLErrors).toEqual(errors);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    client.query({ query }).catch((error: ApolloError) => {
      expect(error.graphQLErrors).toEqual(errors);
      done();
    });
  });

  xit('should pass a network error correctly on a query using an observable network interface with a warning', done => {
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

      const networkError = new Error('Some kind of network error.');

      const link = ApolloLink.from([
        () => {
          return new Observable(_ => {
            throw networkError;
          });
        },
      ]);

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      client.query({ query }).catch((error: ApolloError) => {
        expect(error.networkError).toBeDefined();
        expect(error.networkError!.message).toEqual(networkError.message);
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

    const networkError = new Error('Some kind of network error.');

    const link = ApolloLink.from([
      () => {
        return new Observable(_ => {
          throw networkError;
        });
      },
    ]);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    client.query({ query }).catch((error: ApolloError) => {
      expect(error.networkError).toBeDefined();
      expect(error.networkError!.message).toEqual(networkError.message);
      done();
    });
  });

  it('should not warn when receiving multiple results from apollo-link network interface', () => {
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then((result: ExecutionResult) => {
      expect(stripSymbols(result.data)).toEqual(data);
    });
  });

  xit('should surface errors in observer.next as uncaught', done => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      console.log(e);
      process.removeListener('uncaughtException', handleUncaught);
      if (typeof oldHandler === 'function')
        process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done.fail(e);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next() {
        throw expectedError;
      },
    });
  });

  xit('should surfaces errors in observer.error as uncaught', done => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      process.removeListener('uncaughtException', handleUncaught);
      process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done.fail(e);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const handle = client.watchQuery({ query });
    handle.subscribe({
      next() {
        done.fail(new Error('did not expect next to be called'));
      },
      error() {
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next(result) {
        expect(stripSymbols(result.data)).toEqual(data);
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
      cache: new InMemoryCache({ addTypename: true }),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(transformedResult);
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
      cache: new InMemoryCache({ addTypename: true }),
    });

    return client
      .query({ fetchPolicy: 'network-only', query })
      .then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(transformedResult);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.mutate({ mutation }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client
      .query({ fetchPolicy: 'network-only', query })
      .then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      const obj = context.store.get(idValue.id);

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
      cache: new InMemoryCache({
        fragmentMatcher: { match: fancyFragmentMatcher },
      }),
    });
    return client.query({ query }).then((actualResult: any) => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ fragmentMatcher: ifm }),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
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
      cache: new InMemoryCache({ fragmentMatcher: ifm }),
    });

    const queryUpdaterSpy = jest.fn();
    const queryUpdater = (prev: any) => {
      queryUpdaterSpy();
      return prev;
    };
    const updateQueries = {
      items: queryUpdater,
    };

    const updateSpy = jest.fn();

    const obs = client.watchQuery({ query });

    const sub = obs.subscribe({
      next() {
        client
          .mutate({ mutation, updateQueries, update: updateSpy })
          .then(() => {
            expect(queryUpdaterSpy).toBeCalled();
            expect(updateSpy).toBeCalled();
            sub.unsubscribe();
            done();
          })
          .catch(err => {
            done.fail(err);
          });
      },
      error(err) {
        done.fail(err);
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
        expect(request.operationName).toBe('myQueryName');
        return Observable.of({ data });
      },
    ]);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(data);
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
        expect(request.operationName).toBe('myMutationName');
        return Observable.of({ data });
      },
    ]);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.mutate({ mutation }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(data);
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
      cache: new InMemoryCache({ addTypename: false }),

      queryDeduplication: false,
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication happened, result2.data will equal data.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      expect(stripSymbols(result1.data)).toEqual(data);
      expect(stripSymbols(result2.data)).toEqual(data2);
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication didn't happen, result.data will equal data2.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      expect(result1.data).toEqual(result2.data);
    });
  });

  it('unsubscribes from deduplicated observables only once', done => {
    const document: DocumentNode = gql`
      query test1($x: String) {
        test(x: $x)
      }
    `;

    const variables1 = { x: 'Hello World' };
    const variables2 = { x: 'Hello World' };

    let unsubscribed = false;

    const client = new ApolloClient({
      link: new ApolloLink(() => {
        return new Observable(observer => {
          observer.complete();
          return () => {
            unsubscribed = true;
            setTimeout(done, 0);
          };
        });
      }),
      cache: new InMemoryCache(),
    });

    const sub1 = client
      .watchQuery({
        query: document,
        variables: variables1,
      })
      .subscribe({});

    const sub2 = client
      .watchQuery({
        query: document,
        variables: variables2,
      })
      .subscribe({});

    sub1.unsubscribe();
    expect(unsubscribed).toBe(false);

    sub2.unsubscribe();
  });

  describe('deprecated options', () => {
    const query = gql`
      query people {
        name
      }
    `;

    it('errors when returnPartialData is used on query', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });
      expect(() => {
        client.query({ query, returnPartialData: true } as WatchQueryOptions);
      }).toThrowError(/returnPartialData/);
    });

    it('errors when returnPartialData is used on watchQuery', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });
      expect(() => {
        client.query({ query, returnPartialData: true } as WatchQueryOptions);
      }).toThrowError(/returnPartialData/);
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

        cache: new InMemoryCache({
          dataIdFromObject: (obj: { id: any }) => obj.id,
          addTypename: false,
        }),
      });

      return client.query({ query }).then(result => {
        expect(stripSymbols(result.data)).toEqual(data);
        expect((client.cache as InMemoryCache).extract()['1']).toEqual({
          id: '1',
          name: 'Luke Skywalker',
        });
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

    const cacheAndNetworkError =
      'The cache-and-network fetchPolicy does not work with client.query, because ' +
      'client.query can only return a single result. Please use client.watchQuery ' +
      'to receive multiple results from the cache and the network, or consider ' +
      'using a different fetchPolicy, such as cache-first or network-only.';

    function checkCacheAndNetworkError(callback: () => any) {
      try {
        callback();
        throw new Error('not reached');
      } catch (thrown) {
        expect(thrown.message).toBe(cacheAndNetworkError);
      }
    }

    // Test that cache-and-network can only be used on watchQuery, not query.
    it('warns when used with client.query', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      checkCacheAndNetworkError(
        () => client.query({
          query,
          fetchPolicy: 'cache-and-network' as FetchPolicy,
        }),
      );
    });

    it('warns when used with client.query with defaultOptions', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
        defaultOptions: {
          query: {
            fetchPolicy: 'cache-and-network' as FetchPolicy,
          },
        },
      });

      checkCacheAndNetworkError(() => client.query({ query }));
    });

    it('fetches from cache first, then network', done => {
      const link = mockSingleLink({
        request: { query },
        result: { data: networkFetch },
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      client.writeQuery({ query, data: initialData });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(initialData);
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(networkFetch);
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
        cache: new InMemoryCache({ addTypename: false }),
      });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toBe(undefined);
          expect(result.loading).toBe(true);
        } else if (handleCount === 2) {
          expect(stripSymbols(result.data)).toEqual(networkFetch);
          expect(result.loading).toBe(false);
          done();
        }
      });
    });

    it('fails if network request fails', done => {
      const link = mockSingleLink(); // no queries = no replies.
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });

      let count = 0;
      obs.subscribe({
        next: result => {
          expect(result.data).toBe(undefined);
          expect(result.loading).toBe(true);
          count++;
        },
        error: e => {
          expect(e.message).toMatch(/No more mocked responses/);
          expect(count).toBe(1); // make sure next was called.
          setTimeout(done, 100);
        },
      });
    });

    it('fetches from cache first, then network and does not have an unhandled error', done => {
      const link = mockSingleLink({
        request: { query },
        result: { errors: [{ message: 'network failure' }] },
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      client.writeQuery({ query, data: initialData });

      const obs = client.watchQuery({
        query,
        fetchPolicy: 'cache-and-network',
      });
      let shouldFail = true;
      process.once('unhandledRejection', rejection => {
        if (shouldFail) done.fail('promise had an unhandledRejection');
      });
      let count = 0;
      obs.subscribe({
        next: result => {
          expect(stripSymbols(result.data)).toEqual(initialData);
          expect(result.loading).toBe(true);
          count++;
        },
        error: e => {
          expect(e.message).toMatch(/network failure/);
          expect(count).toBe(1); // make sure next was called.
          setTimeout(() => {
            shouldFail = false;
            done();
          }, 0);
        },
      });
    });
  });

  describe('standby queries', () => {
    // XXX queries can only be set to standby by setOptions. This is simply out of caution,
    // not some fundamental reason. We just want to make sure they're not used in unanticipated ways.
    // If there's a good use-case, the error and test could be removed.
    it('cannot be started with watchQuery or query', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });
      expect(() =>
        client.watchQuery({
          query: gql`
            {
              abc
            }
          `,
          fetchPolicy: 'standby',
        }),
      ).toThrowError(
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

      const client = new ApolloClient({ link, cache: new InMemoryCache() });

      const obs = client.watchQuery({ query, fetchPolicy: 'cache-first' });

      let handleCalled = false;
      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
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
          done.fail(
            new Error('Handle should never be called on standby query'),
          );
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

      const client = new ApolloClient({ link, cache: new InMemoryCache() });

      const obs = client.watchQuery({ query, fetchPolicy: 'cache-first' });

      let handleCalled = false;
      subscribeAndCount(done, obs, (handleCount, result) => {
        if (handleCount === 1) {
          expect(stripSymbols(result.data)).toEqual(data);
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
          expect(stripSymbols(result.data)).toEqual(data2);
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
      //
    });

    afterAll(() => jest.useRealTimers());

    it('forces the query to rerun', () => {
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      // Run a query first to initialize the store
      return (
        client
          .query({ query })
          // then query for real
          .then(() => client.query({ query, fetchPolicy: 'network-only' }))
          .then(result => {
            expect(stripSymbols(result.data)).toEqual({ myNumber: { n: 2 } });
          })
      );
    });

    it('can be disabled with ssrMode', () => {
      const client = new ApolloClient({
        link,
        ssrMode: true,
        cache: new InMemoryCache({ addTypename: false }),
      });

      const options: WatchQueryOptions = { query, fetchPolicy: 'network-only' };

      // Run a query first to initialize the store
      return (
        client
          .query({ query })
          // then query for real
          .then(() => client.query(options))
          .then(result => {
            expect(stripSymbols(result.data)).toEqual({ myNumber: { n: 1 } });

            // Test that options weren't mutated, issue #339
            expect(options).toEqual({
              query,
              fetchPolicy: 'network-only',
            });
          })
      );
    });

    it('can temporarily be disabled with ssrForceFetchDelay', () => {
      jest.useFakeTimers();
      const client = new ApolloClient({
        link,
        ssrForceFetchDelay: 100,
        cache: new InMemoryCache({ addTypename: false }),
      });

      // Run a query first to initialize the store
      const outerPromise = client
        .query({ query })
        // then query for real
        .then(() => {
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          jest.runTimersToTime(0);
          return promise;
        })
        .then(result => {
          expect(stripSymbols(result.data)).toEqual({ myNumber: { n: 1 } });
          jest.runTimersToTime(100);
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          jest.runTimersToTime(0);
          return promise;
        })
        .then(result => {
          expect(stripSymbols(result.data)).toEqual({ myNumber: { n: 2 } });
        });
      jest.runTimersToTime(0);
      return outerPromise;
    });
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    client
      .mutate({ mutation })
      .then(_ => {
        done.fail(new Error('Returned a result when it should not have.'));
      })
      .catch((error: ApolloError) => {
        expect(error.networkError).toBeDefined();
        expect(error.networkError!.message).toBe(networkError.message);
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
      cache: new InMemoryCache({ addTypename: false }),
    });
    client
      .mutate({ mutation })
      .then(_ => {
        done.fail(new Error('Returned a result when it should not have.'));
      })
      .catch((error: ApolloError) => {
        expect(error.graphQLErrors).toBeDefined();
        expect(error.graphQLErrors.length).toBe(1);
        expect(error.graphQLErrors[0].message).toBe(errors[0].message);
        done();
      });
  });
  it('should allow errors to be returned from a mutation', done => {
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
      cache: new InMemoryCache({ addTypename: false }),
    });
    client
      .mutate({ mutation, errorPolicy: 'all' })
      .then(result => {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe(errors[0].message);
        expect(result.data).toEqual(data);
        done();
      })
      .catch((error: ApolloError) => {
        throw error;
      });
  });
  it('should strip errors on a mutation if ignored', done => {
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
      cache: new InMemoryCache({ addTypename: false }),
    });
    client
      .mutate({ mutation, errorPolicy: 'ignore' })
      .then(result => {
        expect(result.errors).toBeUndefined();
        expect(stripSymbols(result.data)).toEqual(data);
        done();
      })
      .catch((error: ApolloError) => {
        throw error;
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
      cache: new InMemoryCache({ addTypename: false }),
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

    const { data, optimisticData } = client.cache as any;
    expect(optimisticData).not.toBe(data);
    expect(optimisticData.parent).toBe(data);

    mutatePromise
      .then(_ => {
        done.fail(new Error('Returned a result when it should not have.'));
      })
      .catch((_: ApolloError) => {
        const { data, optimisticData } = client.cache as any;
        expect(optimisticData).toBe(data);
        done();
      });
  });

  it('has a clearStore method which calls QueryManager', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });
    const spy = jest.spyOn(client.queryManager, 'clearStore');
    await client.clearStore();
    expect(spy).toHaveBeenCalled();
  });

  it('has an onClearStore method which takes a callback to be called after clearStore', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    const onClearStore = jest.fn();
    client.onClearStore(onClearStore);

    await client.clearStore();

    expect(onClearStore).toHaveBeenCalled();
  });

  it('onClearStore returns a method that unsubscribes the callback', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    const onClearStore = jest.fn();
    const unsubscribe = client.onClearStore(onClearStore);

    unsubscribe();

    await client.clearStore();
    expect(onClearStore).not.toHaveBeenCalled();
  });

  it('has a resetStore method which calls QueryManager', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });
    const spy = jest.spyOn(client.queryManager, 'clearStore');
    await client.resetStore();
    expect(spy).toHaveBeenCalled();
  });

  it('has an onResetStore method which takes a callback to be called after resetStore', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    const onResetStore = jest.fn();
    client.onResetStore(onResetStore);

    await client.resetStore();

    expect(onResetStore).toHaveBeenCalled();
  });

  it('onResetStore returns a method that unsubscribes the callback', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    const onResetStore = jest.fn();
    const unsubscribe = client.onResetStore(onResetStore);

    unsubscribe();

    await client.resetStore();
    expect(onResetStore).not.toHaveBeenCalled();
  });

  it('resetStore waits until all onResetStore callbacks are called', async () => {
    const delay = time => new Promise(r => setTimeout(r, time));

    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });

    let count = 0;
    const onResetStoreOne = jest.fn(async () => {
      expect(count).toEqual(0);
      await delay(10).then(() => count++);
      expect(count).toEqual(1);
    });

    const onResetStoreTwo = jest.fn(async () => {
      expect(count).toEqual(0);
      await delay(11).then(() => count++);
      expect(count).toEqual(2);
    });

    client.onResetStore(onResetStoreOne);
    client.onResetStore(onResetStoreTwo);

    expect(count).toEqual(0);
    await client.resetStore();
    expect(count).toEqual(2);
  });

  it('invokes onResetStore callbacks before notifying queries during resetStore call', async () => {
    const delay = time => new Promise(r => setTimeout(r, time));

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
      },
    };

    const data2 = {
      author: {
        __typename: 'Author',
        firstName: 'Joe',
        lastName: 'Joe',
      },
    };

    let timesFired = 0;
    const link = ApolloLink.from([
      new ApolloLink(
        () =>
          new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
            return;
          }),
      ),
    ]);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    let count = 0;
    const onResetStoreOne = jest.fn(async () => {
      expect(count).toEqual(0);
      await delay(10).then(() => count++);
      expect(count).toEqual(1);
    });

    const onResetStoreTwo = jest.fn(async () => {
      expect(count).toEqual(0);
      await delay(11).then(() => count++);
      expect(count).toEqual(2);

      try {
        client.readQuery({ query });
        fail('should not see any data');
      } catch (e) {
        expect(e.message).toMatch(/Can't find field/);
      }

      client.cache.writeQuery({ query, data: data2 });
    });

    client.onResetStore(onResetStoreOne);
    client.onResetStore(onResetStoreTwo);

    let called = false;
    const next = jest.fn(d => {
      if (called) {
        expect(onResetStoreOne).toHaveBeenCalled();
      } else {
        expect(stripSymbols(d.data)).toEqual(data);
        called = true;
      }
    });

    const observable = client
      .watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      })
      .subscribe({
        next,
        error: fail,
        complete: fail,
      });

    expect(count).toEqual(0);
    await client.resetStore();
    expect(count).toEqual(2);
    //watchQuery should only receive data twice
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('has a reFetchObservableQueries method which calls QueryManager', async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
    });
    const spy = jest.spyOn(client.queryManager, 'reFetchObservableQueries');
    await client.reFetchObservableQueries();
    expect(spy).toHaveBeenCalled();
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

    // it('with self-made store', () => {
    //   const link = mockSingleLink({
    //     request: { query: cloneDeep(query) },
    //     result: { data },
    //   });
    //
    //   const client = new ApolloClient({
    //     link,
    //     cache: new InMemoryCache({ addTypename: false }),
    //   });
    //
    //   const log: any[] = [];
    //   client.__actionHookForDevTools((entry: any) => {
    //     log.push(entry);
    //   });
    //
    //   return client.query({ query }).then(() => {
    //     expect(log.length).toBe(2);
    //     expect(log[1].state.queries['0'].loading).toBe(false);
    //   });
    // });
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
      cache: new InMemoryCache({ addTypename: false }),
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
        expect(error.message).toBe('Network error: Uh oh!');
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
      cache: new InMemoryCache(),
    });

    return client.query({ query }).catch(err => {
      expect(err.message).toBe(
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
      cache: new InMemoryCache(),
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
        books(skip: 0, limit: 2) {
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
      cache: new InMemoryCache(),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
    });
  });

  it('should remove the connection directive before the link is sent', () => {
    const query = gql`
      {
        books(skip: 0, limit: 2) @connection {
          name
        }
      }
    `;

    const transformedQuery = gql`
      {
        books(skip: 0, limit: 2) {
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
      cache: new InMemoryCache(),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
    });
  });
});

describe('@connect', () => {
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
        books(skip: 0, limit: 2) {
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
      cache: new InMemoryCache(),
    });

    return client.query({ query }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });
  });

  it('should run a query with the connection directive and filter arguments and write the result to the correct store key', () => {
    const query = gql`
      query books($order: string) {
        books(skip: 0, limit: 2, order: $order)
          @connection(key: "abc", filter: ["order"]) {
          name
        }
      }
    `;
    const transformedQuery = gql`
      query books($order: string) {
        books(skip: 0, limit: 2, order: $order) {
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
      request: { query: transformedQuery, variables },
      result: { data: result },
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    return client.query({ query, variables }).then(actualResult => {
      expect(stripSymbols(actualResult.data)).toEqual(result);
      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });
  });

  describe('default settings', () => {
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
    it('allows setting default options for watchQuery', done => {
      const link = mockSingleLink({
        request: { query },
        result: { data: networkFetch },
      });
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
        defaultOptions: {
          watchQuery: {
            fetchPolicy: 'cache-and-network',
          },
        },
      });

      client.writeQuery({
        query,
        data: initialData,
      });

      const obs = client.watchQuery({ query });

      subscribeAndCount(done, obs, (handleCount, result) => {
        const resultData = stripSymbols(result.data);
        if (handleCount === 1) {
          expect(resultData).toEqual(initialData);
        } else if (handleCount === 2) {
          expect(resultData).toEqual(networkFetch);
          done();
        }
      });
    });
    it('allows setting default options for query', () => {
      const errors = [{ message: 'failure', name: 'failure' }];
      const link = mockSingleLink({
        request: { query },
        result: { errors },
      });
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
        defaultOptions: {
          query: { errorPolicy: 'all' },
        },
      });

      return client.query({ query }).then(result => {
        expect(result.errors).toEqual(errors);
      });
    });
    it('allows setting default options for mutation', () => {
      const mutation = gql`
        mutation upVote($id: ID!) {
          upvote(id: $id) {
            success
          }
        }
      `;

      const data = {
        upvote: { success: true },
      };

      const link = mockSingleLink({
        request: { query: mutation, variables: { id: 1 } },
        result: { data },
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
        defaultOptions: {
          mutate: { variables: { id: 1 } },
        },
      });

      return client.mutate({ mutation }).then(result => {
        expect(result.data).toEqual(data);
      });
    });
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

  const config = {};
  if (fragmentMatcher) config.fragmentMatcher = fragmentMatcher;

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(config),
  });

  return client.query({ query, variables }).then(result => {
    expect(stripSymbols(result.data)).toEqual(data.data);
  });
}
