import {
  QueryManager,
} from '../src/QueryManager';

import {
  createApolloStore,
} from '../src/store';

import gql from 'graphql-tag';

import {
  assert,
} from 'chai';

import ApolloClient from '../src';
import {
  stripApolloDirectivesFromDocument,
} from '../src/queries/directives';

import mockNetworkInterface from './mocks/mockNetworkInterface';

describe('fetchMore', () => {
  it('default behavior (append)', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore {
          name
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          name: 'Luke Skywalker',
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          name: 'Obi-Wan Kenobi',
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [].concat(data1.all_people, data2.all_people),
          });
          done();
        }
      },
    });
  });

  it('by defining the quiet fields in the directive', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore(quiet: ["latest_name"]) {
          name
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          name: 'Luke Skywalker',
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          name: 'Obi-Wan Kenobi',
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      variables: variables1,
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [].concat(data1.all_people, data2.all_people),
          });
          done();
        }
      },
    });
  });

  it('default behavior but avoid concatenating more than needed', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) {
          tags @apolloFetchMore {
            name
          }
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          tags: [{name: 'jedi'}],
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          tags: [{name: 'human'}],
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [
              {
                tags: [].concat(data1.all_people[0].tags, data2.all_people[0].tags),
              },
            ],
          });
          done();
        }
      },
    });
  });

  it('while naming the appropriate directive', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore(name: "all_people") {
          tags @apolloFetchMore(name: "tags") {
            name
          }
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          tags: [{name: 'jedi'}],
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          tags: [{name: 'human'}],
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
      targetedFetchMoreDirectives: ['tags'],
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [
              {
                tags: [].concat(data1.all_people[0].tags, data2.all_people[0].tags),
              },
            ],
          });
          done();
        }
      },
    });
  });

  it('a special global behavior', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore {
          name
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          name: 'Luke Skywalker',
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          name: 'Obi-Wan Kenobi',
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
      mergeResults: (oldArr, newArr) => [].concat(newArr, oldArr),
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [].concat(data2.all_people, data1.all_people),
          });
          done();
        }
      },
    });
  });

  it('a special behavior for a named directive', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore(name: "all_people") {
          name
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          name: 'Luke Skywalker',
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          name: 'Obi-Wan Kenobi',
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    let handleCount = 0;

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
      mergeResults: {
        empty: (oldArr, newArr) => [],
        all_people: (oldArr, newArr) => [].concat(newArr, oldArr),
      },
    });

    const subscription = handle.subscribe({
      next(result) {
        handleCount++;

        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({variables: variables2});
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            all_people: [].concat(data2.all_people, data1.all_people),
          });
          done();
        }
      },
    });
  });

  it('warns when trying to fetch more on polled query', (done) => {
    const query = gql`
      query fetch_people($latest_name: String, $type: String) {
        all_people(latest_name: $latest_name, type: $type) @apolloFetchMore {
          name
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const variables1 = {
      type: 'Jedi',
      latest_name: null,
    };

    const variables2 = {
      type: 'Jedi',
      latest_name: 'Luke Skywalker',
    };

    const data1 = {
      all_people: [
        {
          name: 'Luke Skywalker',
        },
      ],
    };

    const data2 = {
      all_people: [
        {
          name: 'Obi-Wan Kenobi',
        },
      ],
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: networkSentQuery, variables: variables1 },
        result: { data: data1 },
      },
      {
        request: { query: networkSentQuery, variables: variables2 },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    const handle = queryManager.watchQuery({
      query,
      quietArguments: ['latest_name'],
      variables: variables1,
      pollInterval: 100000,
    });

    let handled = false;
    const subscription = handle.subscribe({
      next(result) {
        if (!handled) {
          handled = true;
          // hacky solution that allows us to test whether the warning is printed
          const oldWarn = console.warn;
          console.warn = (str, vals) => {
            subscription.unsubscribe();
            assert.include(str, 'Warning: You are trying to refetchMore on a polled query.');
            console.warn = oldWarn;
            done();
          };
          subscription.refetchMore({variables: variables2});
        }
      },
    });
  });

  it('can setup global pagination quietArguments for relay schemas', (done) => {
    const query = gql`
      query people($nPeople: Int!, $cursor: ID, $type: String!) {
        allPeople(type: $type, first: $nPeople, after: $cursor) {
          edges @apolloFetchMore {
            node {
              id
              name
            }
            cursor
          }
        }
      }
    `;
    const networkSentQuery = stripApolloDirectivesFromDocument(query);

    const data1 = {
      allPeople: {
        edges: [
          {
            node: {
              id: 'id:person:luke',
              name: 'Luke Skywalker',
            },
            cursor: 'cursor:person:luke',
          },
        ],
      },
    };
    const variables1 = {
      nPeople: 1,
      cursor: null,
      type: 'Jedi',
    };

    const data2 = {
      allPeople: {
        edges: [
          {
            node: {
              id: 'id:person:obiwan',
              name: 'Obi-Wan Kenobi',
            },
            cursor: 'cursor:person:obiwan',
          },
          {
            node: {
              id: 'id:person:anakin',
              name: 'Anakin Skywalker',
            },
            cursor: 'cursor:person:anakin',
          },
        ],
      },
    };
    const variables2 = {
      nPeople: 2,
      cursor: 'cursor:person:luke',
      type: 'Jedi',
    };

    const data3 = {
      allPeople: {
        edges: [
          {
            node: {
              id: 'id:person:vader',
              name: 'Darth Vader',
            },
            cursor: 'cursor:person:vader',
          },
        ],
      },
    };
    const variables3 = {
      nPeople: 1,
      cursor: null,
      type: 'Sith',
    };

    const networkInterface = mockNetworkInterface({
      request: { query: networkSentQuery, variables: variables1 },
      result: { data: data1 },
    }, {
      request: { query: networkSentQuery, variables: variables2 },
      result: { data: data2 },
    }, {
      request: { query: networkSentQuery, variables: variables3 },
      result: { data: data3 },
    });

    const client = new ApolloClient({
      networkInterface,
      quietArguments: ['first', 'last', 'after', 'before'],
    });

    let handleCount = 0;
    const subscription = client.watchQuery({ query, variables: variables1 }).subscribe({
      next(result) {
        handleCount ++;
        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          subscription.refetchMore({
            variables: variables2,
          });
        } else if (handleCount === 2) {
          assert.deepEqual(result.data, {
            allPeople: {
              edges: [].concat(data1.allPeople.edges, data2.allPeople.edges),
            },
          });
          subscription.refetch(variables3);
        } else if (handleCount === 3) {
          assert.deepEqual(result.data, data3);
          done();
        }
      },
    });
  });
});
